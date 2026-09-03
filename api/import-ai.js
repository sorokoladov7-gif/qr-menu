'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');
const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const PRIMARY_MODEL = process.env.GEMINI_IMPORT_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.7-flash'];
const GEMINI_TIMEOUT_MS = 50000;
const SITE_TIMEOUT_MS = 46000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 12;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const rateState = new Map();

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    venue_name: { type: 'STRING' },
    currency: { type: 'STRING' },
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                description: { type: 'STRING' },
                price: { type: 'NUMBER', nullable: true },
                unit: { type: 'STRING' },
                weight: { type: 'NUMBER', nullable: true },
                image_url: { type: 'STRING', nullable: true },
                allergens: { type: 'ARRAY', items: { type: 'STRING' } },
                tags: { type: 'ARRAY', items: { type: 'STRING' } },
                available: { type: 'BOOLEAN' }
              },
              required: ['name', 'description', 'price', 'unit', 'weight', 'image_url', 'allergens', 'tags', 'available']
            }
          }
        },
        required: ['name', 'items']
      }
    },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['venue_name', 'currency', 'categories', 'warnings']
};

function clean(value, max = 600) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers?.['x-real-ip'] || 'unknown').trim() || 'unknown';
}

function checkRateLimit(req, userId) {
  const key = userId + ':' + clientIp(req);
  const now = Date.now();
  const current = rateState.get(key) || { started: now, count: 0 };
  if (now - current.started >= RATE_WINDOW_MS) {
    current.started = now;
    current.count = 0;
  }
  current.count += 1;
  rateState.set(key, current);
  for (const [k, v] of rateState) if (now - v.started > RATE_WINDOW_MS * 2) rateState.delete(k);
  if (current.count > RATE_LIMIT) throw Object.assign(new Error('RATE_LIMITED'), { status: 429 });
}

function parseBearer(req) {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function requireManagerOrAdmin(req) {
  const token = parseBearer(req);
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  const authResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  const user = await authResponse.json().catch(() => null);
  if (!authResponse.ok || !user?.id) throw Object.assign(new Error('AUTH_INVALID'), { status: 401 });
  const profileResponse = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role&limit=1', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token, accept: 'application/json' }
  });
  const profiles = await profileResponse.json().catch(() => []);
  const role = String(profiles?.[0]?.role || '').toLowerCase();
  if (!profileResponse.ok || !['manager', 'admin'].includes(role)) throw Object.assign(new Error('ROLE_FORBIDDEN'), { status: 403 });
  return { id: user.id, role };
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && b === 18) || (a >= 224);
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7));
  }
  return false;
}

async function assertSafeUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); }
  catch (_) { throw Object.assign(new Error('INVALID_URL'), { status: 400 }); }
  if (!/^https?:$/i.test(url.protocol) || url.username || url.password) throw Object.assign(new Error('INVALID_URL'), { status: 400 });
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') || (net.isIP(url.hostname) && isPrivateIp(url.hostname))) throw Object.assign(new Error('URL_BLOCKED'), { status: 400 });
  try {
    const addresses = await dns.lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(x => isPrivateIp(x.address))) throw Object.assign(new Error('URL_BLOCKED'), { status: 400 });
  } catch (error) {
    if (error?.status) throw error;
    throw Object.assign(new Error('URL_UNREACHABLE'), { status: 400 });
  }
  url.hash = '';
  return url.href;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000, maxBytes = MAX_FILE_BYTES) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw Object.assign(new Error('HTTP_' + response.status), { status: response.status });
    const length = Number(response.headers.get('content-length') || 0);
    if (length > maxBytes) throw Object.assign(new Error('FILE_TOO_LARGE'), { status: 413 });
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > maxBytes) throw Object.assign(new Error('FILE_TOO_LARGE'), { status: 413 });
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('UPSTREAM_TIMEOUT'), { status: 504 });
    throw error;
  } finally { clearTimeout(timer); }
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) throw Object.assign(new Error('INVALID_FILE_DATA'), { status: 400 });
  const data = Buffer.from(match[2], 'base64');
  if (!data.length) throw Object.assign(new Error('EMPTY_FILE'), { status: 400 });
  if (data.length > MAX_FILE_BYTES) throw Object.assign(new Error('FILE_TOO_LARGE'), { status: 413 });
  return { mime: match[1].toLowerCase(), data };
}

function detectMime(buffer, claimed = '') {
  const mime = String(claimed || '').toLowerCase();
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return mime;
}

function supportedFileMime(mime) {
  return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(String(mime || '').toLowerCase());
}

function pdfPageEstimate(buffer) {
  const text = buffer.subarray(0, Math.min(buffer.length, MAX_FILE_BYTES)).toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?:\s|\/|>|])/g);
  return matches ? matches.length : null;
}

function buildPrompt(kind, language, extra = '') {
  return [
    'Ты — точный парсер ресторанного меню для QR Menu.',
    'Работай как человек, который вручную проверяет каждую страницу, колонку и цену. Сначала восстанови структуру, затем извлеки позиции.',
    'Сохраняй оригинальные названия блюд. Допускаются только очевидные исправления OCR, не меняющие смысл.',
    'Ничего не выдумывай: отсутствующие данные должны быть null или пустым массивом.',
    'Категории определяй по явным заголовкам разделов и контексту страницы. Если блюдо встречается в разных категориях — сохрани его в каждой категории.',
    'Цена — число без валюты. Если цена не найдена, price=null и добавь warning с названием блюда.',
    'unit допускается только: шт, г, мл, порция; если явно не указан — пустая строка.',
    'weight — число без единицы измерения; если вес/объём не указан — null.',
    'allergens и tags заполняй только по явным данным источника; не делай догадок.',
    'image_url заполняй только если источник содержит реальную URL изображения. Для PDF/фото — null.',
    'available=true по умолчанию, если источник не сообщает об обратном.',
    'Удали навигацию, футер, рекламу, телефоны, адреса, часы работы, номера страниц, служебные кнопки и дубли.',
    'Не объединяй разные позиции только потому, что их названия похожи. Не теряй позиции из-за отсутствия цены.',
    'Язык результата — язык меню. language_hint=' + clean(language || 'auto', 20) + '.',
    'Источник: ' + kind + '.',
    extra
  ].join('\n');
}

function getOutputText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map(x => x?.text || '').join('') : '';
}

async function callGemini(parts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY_NOT_CONFIGURED'), { status: 503 });
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS].filter((x, i, a) => x && a.indexOf(x) === i);
  let lastError = null;
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const response = await fetch(GEMINI_URL + model + ':generateContent', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: SCHEMA,
            maxOutputTokens: 24000,
            thinkingConfig: { thinkingLevel: 'low' }
          }
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Gemini HTTP ' + response.status), { status: response.status });
      const text = getOutputText(data);
      if (!text) throw Object.assign(new Error('AI_EMPTY_RESPONSE'), { status: 502 });
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { throw Object.assign(new Error('AI_INVALID_JSON'), { status: 502 }); }
      return { data: parsed, model };
    } catch (error) {
      lastError = error;
      const status = Number(error?.status) || 0;
      const retryableHttp = status === 408 || status === 429 || status >= 500;
      if (!retryableHttp) throw error;
    } finally { clearTimeout(timer); }
  }
  if (lastError?.name === 'AbortError') throw Object.assign(new Error('GEMINI_TIMEOUT'), { status: 504 });
  throw lastError || Object.assign(new Error('AI_IMPORT_FAILED'), { status: 502 });
}

function normalizeTagArray(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(x => clean(x, 80)).filter(Boolean))].slice(0, 20);
}

function normalizeItem(item, categoryName) {
  const name = clean(item?.name, 220);
  const price = item?.price == null || item?.price === '' ? null : Number(item.price);
  const weight = item?.weight == null || item?.weight === '' ? null : Number(item.weight);
  const unit = clean(item?.unit, 20).toLowerCase();
  return {
    name,
    description: clean(item?.description, 600),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    unit: ['шт', 'г', 'мл', 'порция'].includes(unit) ? unit : '',
    weight: Number.isFinite(weight) && weight > 0 ? weight : null,
    image_url: /^https?:\/\//i.test(String(item?.image_url || '').trim()) ? String(item.image_url).trim() : null,
    allergens: normalizeTagArray(item?.allergens),
    tags: normalizeTagArray(item?.tags),
    available: item?.available !== false,
    category: categoryName
  };
}

function validateAndNormalizeMenu(raw, context = {}) {
  const warnings = Array.isArray(raw?.warnings) ? raw.warnings.map(x => clean(x, 500)).filter(Boolean).slice(0, 100) : [];
  const categories = [];
  const categoryMap = new Map();
  for (const rawCategory of Array.isArray(raw?.categories) ? raw.categories : []) {
    const name = clean(rawCategory?.name, 160);
    if (!name) continue;
    if (!categoryMap.has(name.toLowerCase())) {
      const category = { name, items: [] };
      categoryMap.set(name.toLowerCase(), category);
      categories.push(category);
    }
    const category = categoryMap.get(name.toLowerCase());
    for (const rawItem of Array.isArray(rawCategory?.items) ? rawCategory.items : []) {
      const item = normalizeItem(rawItem, category.name);
      if (!item.name) continue;
      const duplicate = category.items.find(x => x.name.toLowerCase() === item.name.toLowerCase() && (x.price ?? null) === (item.price ?? null));
      if (duplicate) continue;
      if (item.price == null) warnings.push('Не удалось распознать цену для блюда «' + item.name + '»');
      category.items.push(item);
    }
  }
  for (let i = categories.length - 1; i >= 0; i--) {
    if (!categories[i].items.length) {
      warnings.push('Категория «' + categories[i].name + '» не имеет элементов');
      categories.splice(i, 1);
    }
  }
  if (!categories.length) warnings.push(context.unreadable ? 'Не удалось распознать текст меню. Проверьте качество источника.' : 'В источнике не найдено ни одной позиции меню');
  return {
    venue_name: clean(raw?.venue_name || context.venue_name || '', 220),
    currency: clean(raw?.currency || 'RUB', 12).toUpperCase(),
    categories,
    warnings: [...new Set(warnings)].slice(0, 120)
  };
}

function flattenMenu(menu) {
  const out = [];
  for (const category of menu.categories || []) {
    for (const item of category.items || []) {
      out.push({
        name: item.name,
        description: item.description,
        price: item.price,
        category: category.name,
        image_url: item.image_url,
        is_available: item.available !== false,
        applies_to: 'all',
        unit: item.unit || null,
        weight: item.weight,
        allergens: item.allergens,
        tags: item.tags
      });
    }
  }
  return out;
}

async function fetchExternalFile(url) {
  const safe = await assertSafeUrl(url);
  const { response, data } = await fetchWithTimeout(safe, { headers: { 'user-agent': 'QR-Menu-Importer/1.0', accept: 'application/pdf,image/jpeg,image/png,image/webp,*/*;q=0.5' } }, 20000, MAX_FILE_BYTES);
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  return { url: response.url || safe, mime: detectMime(data, contentType), data };
}

async function deleteTempObject(path) {
  if (!SUPABASE_SERVICE_ROLE_KEY || !path) return;
  try {
    await fetch(SUPABASE_URL + '/storage/v1/object/menu-images/' + String(path).split('/').map(encodeURIComponent).join('/'), {
      method: 'DELETE',
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
    });
  } catch (_) {}
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BYTES) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 });
  }
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) { throw Object.assign(new Error('INVALID_JSON'), { status: 400 }); }
}

async function importSite(url) {
  const safe = await assertSafeUrl(url);
  try {
    const result = await Promise.race([
      analyzeSite(safe),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('SITE_TIMEOUT'), { status: 504 })), SITE_TIMEOUT_MS))
    ]);
    const products = Array.isArray(result?.products) ? result.products : [];
    const grouped = new Map();
    for (const product of products) {
      const category = clean(product?.category || 'Основные блюда', 160);
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push({
        name: clean(product?.name, 220),
        description: clean(product?.description, 600),
        price: Number.isFinite(Number(product?.price)) && Number(product.price) > 0 ? Number(product.price) : null,
        unit: '',
        weight: null,
        image_url: /^https?:\/\//i.test(String(product?.image_url || '')) ? String(product.image_url) : null,
        allergens: [],
        tags: [],
        available: true
      });
    }
    const raw = {
      venue_name: clean(result?.venue?.name || result?.meta?.name || '', 220),
      currency: 'RUB',
      categories: [...grouped.entries()].map(([name, items]) => ({ name, items })),
      warnings: []
    };
    return { menu: validateAndNormalizeMenu(raw, { venue_name: raw.venue_name }), meta: { source_url: safe, analyzer: 'site-menu-analyzer-v3', site_menu_found: products.length > 0 } };
  } catch (error) {
    if (error?.status === 504) throw Object.assign(new Error('SITE_IMPORT_TIMEOUT'), { status: 504 });
    throw error;
  }
}

function errorMessage(code) {
  const map = {
    AUTH_REQUIRED: 'Требуется авторизация управляющего.',
    AUTH_INVALID: 'Сессия авторизации недействительна. Войдите в кабинет заново.',
    ROLE_FORBIDDEN: 'Импорт меню доступен только управляющему или администратору.',
    RATE_LIMITED: 'Слишком много попыток импорта. Повторите позже.',
    REQUEST_TOO_LARGE: 'Слишком большой запрос. Для файла до 10 МБ используйте обычную загрузку файла.',
    FILE_TOO_LARGE: 'Файл превышает лимит 10 МБ.',
    EMPTY_FILE: 'Файл пустой. Выберите корректный PDF или изображение.',
    INVALID_FILE_DATA: 'Не удалось прочитать файл.',
    UNSUPPORTED_FILE: 'Поддерживаются только PDF, JPG, PNG и WEBP.',
    INVALID_URL: 'Укажите корректную ссылку http/https.',
    URL_BLOCKED: 'Ссылка заблокирована по правилам безопасности.',
    URL_UNREACHABLE: 'Не удалось открыть ссылку.',
    SITE_IMPORT_TIMEOUT: 'Сайт слишком долго отвечает. Укажите прямую ссылку на страницу меню.',
    SITE_NO_MENU: 'Ссылка не содержит меню. Укажите прямую ссылку на страницу меню.',
    GEMINI_API_KEY_NOT_CONFIGURED: 'Не настроен серверный ключ AI-импорта.',
    GEMINI_TIMEOUT: 'ИИ не ответил вовремя. Повторите импорт.',
    AI_INVALID_JSON: 'ИИ вернул некорректный результат. Повторите импорт.',
    AI_EMPTY_RESPONSE: 'ИИ не вернул результат. Повторите импорт.',
    UPSTREAM_TIMEOUT: 'Источник не ответил вовремя.',
    PDF_TOO_MANY_PAGES: 'Превышен лимит страниц PDF. Разделите файл на части.'
  };
  return map[code] || 'Ошибка импорта меню.';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Используйте POST' } });
  let tempPath = '';
  try {
    const auth = await requireManagerOrAdmin(req);
    checkRateLimit(req, auth.id);
    const body = await parseRequestBody(req);
    const language = clean(body.language || 'auto', 20);
    const source = clean(body.source || (body.file ? 'file' : body.url ? 'url' : ''), 20).toLowerCase();
    let menu;
    let meta = { provider: 'google-gemini', model: null, source: source || 'unknown' };

    if (source === 'url' || source === 'site') {
      const target = clean(body.url, 2000);
      if (!target) throw Object.assign(new Error('INVALID_URL'), { status: 400 });
      let external = null;
      try { external = await fetchExternalFile(target); } catch (error) {
        if (['URL_BLOCKED', 'INVALID_URL'].includes(String(error?.message))) throw error;
      }
      if (external && supportedFileMime(external.mime)) {
        const pdfPages = external.mime === 'application/pdf' ? pdfPageEstimate(external.data) : null;
        if (pdfPages && pdfPages > 80) throw Object.assign(new Error('PDF_TOO_MANY_PAGES'), { status: 400 });
        const ai = await callGemini([
          { text: buildPrompt(external.mime === 'application/pdf' ? 'PDF по URL' : 'изображение по URL', language, 'URL: ' + target + (pdfPages ? '\nОценочное число страниц: ' + pdfPages : '')) },
          { inline_data: { mime_type: external.mime, data: external.data.toString('base64') } }
        ]);
        menu = validateAndNormalizeMenu(ai.data, { unreadable: !Array.isArray(ai.data?.categories) || !ai.data.categories.length });
        meta.model = ai.model;
        meta.mime = external.mime;
        meta.pages = pdfPages;
      } else {
        const siteResult = await importSite(target);
        menu = siteResult.menu;
        meta = { ...meta, ...siteResult.meta };
        if (!siteResult.meta.site_menu_found) menu.warnings.push('Ссылка не содержит меню. Укажите прямую ссылку на страницу меню.');
      }
    } else if (source === 'file') {
      const file = body.file && typeof body.file === 'object' ? body.file : {};
      let external;
      if (file.url) {
        external = await fetchExternalFile(file.url);
        tempPath = clean(file.temp_path || '', 500);
      } else if (file.data) {
        if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_REQUEST_BYTES) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 });
        external = parseDataUrl(file.data);
      } else {
        throw Object.assign(new Error('INVALID_FILE_DATA'), { status: 400 });
      }
      const mime = detectMime(external.data, external.mime || file.mime);
      if (!supportedFileMime(mime)) throw Object.assign(new Error('UNSUPPORTED_FILE'), { status: 415 });
      if (external.data.length > MAX_FILE_BYTES) throw Object.assign(new Error('FILE_TOO_LARGE'), { status: 413 });
      const pdfPages = mime === 'application/pdf' ? pdfPageEstimate(external.data) : null;
      if (pdfPages && pdfPages > 80) throw Object.assign(new Error('PDF_TOO_MANY_PAGES'), { status: 400 });
      const ai = await callGemini([
        { text: buildPrompt(mime === 'application/pdf' ? 'PDF меню' : 'фото меню', language, 'Имя файла: ' + clean(file.name, 200) + (pdfPages ? '\nОценочное число страниц: ' + pdfPages : '')) },
        { inline_data: { mime_type: mime, data: external.data.toString('base64') } }
      ]);
      menu = validateAndNormalizeMenu(ai.data, { unreadable: !Array.isArray(ai.data?.categories) || !ai.data.categories.length });
      meta.model = ai.model;
      meta.mime = mime;
      meta.pages = pdfPages;
      meta.bytes = external.data.length;
    } else {
      throw Object.assign(new Error('INVALID_URL'), { status: 400 });
    }

    const products = flattenMenu(menu);
    return res.status(200).json({
      ok: true,
      job_id: crypto.randomUUID(),
      menu,
      products,
      warnings: menu.warnings,
      meta: { ...meta, products_found: products.length, categories_found: menu.categories.length, role: auth.role }
    });
  } catch (error) {
    const code = String(error?.message || 'IMPORT_ERROR');
    const status = Number(error?.status) || (code === 'UNSUPPORTED_FILE' ? 415 : 500);
    const safeCode = code.length > 80 || /\s/.test(code) ? 'IMPORT_ERROR' : code;
    console.error('[menu-import]', safeCode);
    return res.status(status).json({ ok: false, error: { code: safeCode, message: errorMessage(safeCode) } });
  } finally {
    await deleteTempObject(tempPath);
  }
};
