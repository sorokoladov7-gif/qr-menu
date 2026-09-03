'use strict';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const PRIMARY_MODEL = process.env.GEMINI_IMPORT_MODEL || 'gemini-3.7-flash';
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const GEMINI_TIMEOUT_MS = 45000;
const MAX_BODY = 14 * 1024 * 1024;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    venue_name: { type: 'STRING' },
    venue_description: { type: 'STRING' },
    products: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          price: { type: 'NUMBER' },
          category: { type: 'STRING' },
          image_url: { type: 'STRING' },
          is_available: { type: 'BOOLEAN' }
        },
        required: ['name', 'description', 'price', 'category', 'image_url', 'is_available']
      }
    }
  },
  required: ['venue_name', 'venue_description', 'products']
};

function clean(value, max = 600) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeProduct(item) {
  const name = clean(item && item.name, 220);
  const value = Number(item && item.price);
  const image = clean(item && item.image_url, 2000);
  return {
    name,
    description: clean(item && item.description, 600),
    price: Number.isFinite(value) && value > 0 ? value : 0,
    category: clean(item && item.category, 120) || 'Основные блюда',
    image_url: /^https?:\/\//i.test(image) ? image : '',
    is_available: !!(item && item.is_available !== false)
  };
}

function getOutputText(data) {
  const candidates = data && Array.isArray(data.candidates) ? data.candidates : [];
  const parts = candidates[0] && candidates[0].content && Array.isArray(candidates[0].content.parts)
    ? candidates[0].content.parts
    : [];
  return parts.map(part => part && part.text || '').join('');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 });
  }
  return text ? JSON.parse(text) : {};
}

function parseBearer(req) {
  const header = String(req.headers && (req.headers.authorization || req.headers.Authorization) || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function requireAuthenticatedUser(req) {
  const token = parseBearer(req);
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !data.id) throw Object.assign(new Error('AUTH_INVALID'), { status: 401 });
  return data;
}

async function fetchSiteText(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw Object.assign(new Error('INVALID_URL'), { status: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(parsed.href, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 QR-Menu-Gemini/1.0',
        accept: 'text/html,application/xhtml+xml,text/plain,*/*;q=0.5',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) throw Object.assign(new Error('SITE_HTTP_' + response.status), { status: response.status });
    const html = (await response.text()).slice(0, 7 * 1024 * 1024);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180000);
    return { url: response.url || parsed.href, title: clean(titleMatch && titleMatch[1] || '', 300), text };
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableGeminiError(error) {
  const status = Number(error && error.status) || 0;
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function callGeminiModel(parts, model) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY_NOT_CONFIGURED'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        response_mime_type: 'application/json',
        response_schema: SCHEMA,
        maxOutputTokens: 18000,
        temperature: 0.1
      }
    };
    let response;
    try {
      response = await fetch(GEMINI_URL + model + ':generateContent', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
        throw Object.assign(new Error('GEMINI_TIMEOUT'), { status: 504, code: 'GEMINI_TIMEOUT' });
      }
      throw error;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && data.error && data.error.message ? data.error.message : 'Gemini HTTP ' + response.status;
      throw Object.assign(new Error(message), { status: response.status, geminiStatus: response.status });
    }
    const raw = getOutputText(data);
    if (!raw) throw Object.assign(new Error('AI_EMPTY_RESPONSE'), { status: 502 });
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      throw Object.assign(new Error('AI_INVALID_JSON'), { status: 502 });
    }
    return { data: parsed, model };
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(parts) {
  const models = [PRIMARY_MODEL].concat(FALLBACK_MODELS).filter((model, index, list) => model && list.indexOf(model) === index);
  let lastError = null;
  for (let i = 0; i < models.length; i++) {
    try {
      return await callGeminiModel(parts, models[i]);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || i === models.length - 1 || error.code === 'GEMINI_TIMEOUT') throw error;
    }
  }
  throw lastError || Object.assign(new Error('AI_IMPORT_FAILED'), { status: 502 });
}

function buildPrompt(kind, extra = '') {
  return [
    'Ты профессиональный анализатор меню для QR Menu.',
    'Работай как человек, который вручную проверяет меню: сначала пойми структуру страниц и колонок, затем извлеки все реальные позиции.',
    'Извлекай только реальные блюда/товары, присутствующие в источнике.',
    'Не выдумывай названия, цены, описания, категории и изображения.',
    'Исправляй только очевидные OCR-ошибки, сохраняя смысл и написание максимально близко к источнику.',
    'Каждая отдельная товарная позиция должна быть отдельным объектом products.',
    'Если у блюда несколько размеров/объёмов и источник показывает разные цены, используй основную реально указанную цену и не придумывай варианты.',
    'Цена — число в рублях. Если достоверной цены нет, 0.',
    'Категория — понятная категория на русском языке.',
    'Описание заполняй только когда оно реально есть в источнике; не генерируй рекламный текст.',
    'image_url заполняй только прямой http/https ссылкой, найденной в источнике; для фото/PDF оставляй пустым.',
    'Удаляй заголовки разделов, адреса, телефоны, акции, служебный текст, номера страниц и дубликаты.',
    'Учитывай контекст предыдущих/соседних строк страницы при определении названия, описания и цены.',
    'Верни только JSON по заданной схеме.',
    'Источник: ' + kind + '.',
    extra
  ].join('\n');
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw Object.assign(new Error('INVALID_DATA_URL'), { status: 400 });
  return { mime: match[1].toLowerCase(), data: match[2] };
}

function browserClient() {
  return "(()=>{'use strict';if(window.__QR_MENU_AI_IMPORT__)return;window.__QR_MENU_AI_IMPORT__=true;})();";
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'GET' && String(req.query && req.query.client || '') === '1') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(200).send(browserClient());
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Используйте POST' } });
  try {
    await requireAuthenticatedUser(req);
    const body = await readBody(req);
    const kind = String(body.kind || '').toLowerCase();
    let parts;

    if (kind === 'image') {
      const image = parseDataUrl(body.data);
      if (image.mime.indexOf('image/') !== 0) throw Object.assign(new Error('IMAGE_REQUIRED'), { status: 400 });
      const context = clean(body.context || '', 24000);
      parts = [
        { text: buildPrompt('фото меню', 'Имя файла: ' + clean(body.filename, 200) + (context ? '\nТекстовый слой/контекст страницы:\n' + context : '')) },
        { inline_data: { mime_type: image.mime, data: image.data } }
      ];
    } else if (kind === 'pdf') {
      const pdf = parseDataUrl(body.data);
      if (pdf.mime !== 'application/pdf') throw Object.assign(new Error('PDF_REQUIRED'), { status: 400 });
      parts = [
        { text: buildPrompt('PDF меню', 'Имя файла: ' + clean(body.filename, 200)) },
        { inline_data: { mime_type: 'application/pdf', data: pdf.data } }
      ];
    } else if (kind === 'site') {
      const url = clean(body.url, 2000);
      if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('URL_REQUIRED'), { status: 400 });
      const site = await fetchSiteText(url);
      parts = [{ text: buildPrompt('сайт', 'URL: ' + site.url + '\nTITLE: ' + site.title + '\nТЕКСТ:\n' + site.text) }];
    } else {
      throw Object.assign(new Error('KIND_REQUIRED'), { status: 400 });
    }

    const ai = await callGemini(parts);
    const result = ai.data || {};
    const products = (Array.isArray(result.products) ? result.products : []).map(normalizeProduct).filter(item => item.name);
    return res.status(200).json({
      ok: true,
      venue: { name: clean(result.venue_name, 220), description: clean(result.venue_description, 600) },
      products,
      meta: { provider: 'google-gemini', model: ai.model, kind, products_found: products.length }
    });
  } catch (error) {
    const code = String(error && error.message || 'IMPORT_AI_ERROR');
    const status = Number(error && error.status) || 500;
    let message = code;
    if (code === 'AUTH_REQUIRED') message = 'Требуется авторизация управляющего.';
    else if (code === 'AUTH_INVALID') message = 'Сессия авторизации недействительна. Войдите в кабинет заново.';
    else if (code === 'GEMINI_API_KEY_NOT_CONFIGURED') message = 'Не настроен GEMINI_API_KEY на сервере.';
    else if (code === 'REQUEST_TOO_LARGE') message = 'Файл слишком большой для AI-импорта.';
    else if (code === 'GEMINI_TIMEOUT') message = 'Gemini не ответил вовремя. Страница будет автоматически повторно обработана.';
    else if (code === 'AI_INVALID_JSON') message = 'ИИ вернул неполный результат. Страница будет повторно обработана.';
    return res.status(status).json({ ok: false, error: { code, message: clean(message, 700) } });
  }
};
