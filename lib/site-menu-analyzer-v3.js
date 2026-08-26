'use strict';

const MAX_PAGES = 60;
const MAX_LINKS = 400;
const MAX_HTML = 12 * 1024 * 1024;
const REQUEST_TIMEOUT = 12000;

const MENU_URL_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык)(?:[\/?#_.-]|$)/iu;
const MENU_TEXT_RE = /(?:^|\s)(меню|каталог|карта\s+меню|карта\s+блюд|цены|наше\s+меню|food\s+menu|menu)(?:\s|$)/iu;
const ASSET_RE = /\.(?:css|js|mjs|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|xml|pdf)(?:[?#].*)?$/iu;
const NOISE_RE = /^(главная|меню|каталог|о нас|о компании|доставка|акции|новости|контакты|отзывы|вакансии|заказать|корзина|войти|регистрация|подробнее|купить|добавить|калории|белки|жиры|углеводы|добавить в корзину|выбрать)$/iu;
const WEIGHT_RE = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
const CATEGORY_RE = /^(закуски|салаты?|супы?|бургеры?|горячие блюда.*|пицца|.*роллы?|суши|десерты?|соусы?|карта бара|барная карта|напитки?|завтраки?|гарниры?|паста|стейки?|основные блюда|детское меню|детям)$/iu;

function decode(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _; } })
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}
function clean(value, max = 600) { return decode(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, max); }
function absolute(value, base) { try { return new URL(String(value || ''), base).href; } catch { return null; } }
function hostOf(value) { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function sameHost(value, host) { return hostOf(value) === host; }

function contentOnly(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/giu, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/giu, ' ');
}
function visibleText(html) {
  return decode(contentOnly(html)
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(?:div|p|li|section|article|h[1-6]|tr|td|th|a|button|label|option|form|header|footer|nav)>/giu, '\n')
    .replace(/<[^>]+>/g, ' '));
}
function lines(html) { return visibleText(html).split(/\r?\n/).map(x => clean(x, 700)).filter(Boolean); }

function priceValue(value) {
  const s = decode(value).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
  const m = s.match(/(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu);
  if (!m) return 0;
  const n = Number(m[1].replace(/[ .]/g, ''));
  return n > 0 && n < 1000000 ? n : 0;
}
function rawPrices(html) {
  const safe = contentOnly(html);
  const out = [];
  const re = /(\d{1,3}(?:[ .]\d{3})?|\d{1,6})\s*(?:(?:<[^>]+>)\s*){0,30}(?:₽|&#8381;|&#x20bd;|р\.?|руб(?:лей|ля|ль)?\.?|RUB)/giu;
  let m;
  while ((m = re.exec(safe)) && out.length < 2000) {
    const price = Number(m[1].replace(/[ .]/g, ''));
    if (price > 0 && price < 1000000) out.push({ price, index: m.index, sample: clean(safe.slice(Math.max(0, m.index - 180), m.index + m[0].length + 180), 500) });
  }
  return out;
}

function extractJsonLd(html, pageUrl) {
  const out = [];
  const blocks = String(html).match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu) || [];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block.replace(/^.*?>/s, '').replace(/<\/script>.*$/is, ''));
      const walk = value => {
        if (!value) return;
        if (Array.isArray(value)) return value.forEach(walk);
        if (typeof value !== 'object') return;
        const type = String(value['@type'] || '').toLowerCase();
        const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers;
        const price = Number(String(value.price ?? offer?.price ?? '').replace(/\s/g, '').replace(',', '.'));
        if ((type.includes('product') || type.includes('menuitem') || type.includes('menu') || value.offers) && value.name && price > 0 && price < 1000000) out.push({ name: clean(value.name, 220), description: clean(value.description, 600), price, image_url: typeof value.image === 'string' ? absolute(value.image, pageUrl) : null, source: 'json-ld' });
        Object.values(value).forEach(walk);
      };
      walk(json);
    } catch (_) {}
  }
  return out;
}

function extractEmbedded(html) {
  const out = [];
  const safe = contentOnly(html);
  const re = /(?:"|')(?:name|title|productName|dishName)(?:"|')\s*:\s*(?:"|')([^"']{2,220})(?:"|')[\s\S]{0,1000}?(?:"|')(?:price|cost|amount)(?:"|')\s*:\s*(?:"|')?([\d\s.,]{1,12})/giu;
  let m;
  while ((m = re.exec(safe)) && out.length < 1000) {
    const price = Number(m[2].replace(/\s/g, '').replace(',', '.'));
    if (price > 0 && price < 1000000) out.push({ name: clean(m[1], 220), price, source: 'embedded-json' });
  }
  return out;
}

function textNearPrices(html) {
  const out = [];
  const list = lines(html);
  for (let i = 0; i < list.length; i++) {
    const price = priceValue(list[i]);
    if (!price) continue;
    const candidates = [];
    for (let d = 1; d <= 8; d++) { candidates.push(list[i - d], list[i + d]); }
    for (const candidate of candidates) {
      if (!candidate || priceValue(candidate) || WEIGHT_RE.test(candidate) || NOISE_RE.test(candidate) || CATEGORY_RE.test(candidate)) continue;
      if (candidate.length >= 3 && candidate.length <= 220 && /[A-Za-zА-Яа-яЁё]/.test(candidate)) { out.push({ name: candidate, description: '', price, source: 'visible-text-near-price' }); break; }
    }
  }
  return out;
}

function structuralCards(html, pageUrl) {
  const safe = contentOnly(html);
  const out = [];
  const re = /<(?:article|li|div|section)[^>]*(?:class|id)=["'][^"']*(?:menu|dish|product|food|price|card|item)[^"']*["'][^>]*>[\s\S]{0,10000}?<\/(?:article|li|div|section)>/giu;
  let m;
  while ((m = re.exec(safe)) && out.length < 1000) {
    const block = m[0];
    const prices = rawPrices(block);
    if (!prices.length) continue;
    const candidates = lines(block).filter(x => x.length >= 3 && x.length <= 220 && !NOISE_RE.test(x) && !WEIGHT_RE.test(x) && !CATEGORY_RE.test(x) && !priceValue(x) && /[A-Za-zА-Яа-яЁё]/.test(x));
    if (!candidates.length) continue;
    const image = block.match(/<(?:img|source)[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)/iu);
    out.push({ name: candidates[0], description: candidates.slice(1, 3).join(' '), price: prices[0].price, image_url: image ? absolute(image[1], pageUrl) : null, source: 'structural-card' });
  }
  return out;
}

function jsSignals(html) {
  const scripts = (html.match(/<script\b/gi) || []).length;
  const appMarkers = /(next-data|__next_f|nuxt|__nuxt|react-root|app-root|webpack|vite|angular|svelte|vue)/i.test(html);
  const apiMarkers = /(fetch\s*\(|axios\.|graphql|\/api\/|application\/json|XMLHttpRequest)/i.test(html);
  const visible = visibleText(html).replace(/\s+/g, ' ').trim().length;
  return { scripts, app_markers: appMarkers, api_markers: apiMarkers, visible_text_chars: visible, likely_js_rendered: visible < 1800 && (appMarkers || apiMarkers || scripts > 15) };
}

function addProduct(products, keys, item, pageUrl) {
  const name = clean(item.name, 220);
  const price = Number(item.price);
  if (!name || name.length < 2 || !price || price <= 0 || price >= 1000000 || NOISE_RE.test(name) || WEIGHT_RE.test(name)) return false;
  const key = name.toLowerCase().replace(/\s+/g, ' ');
  if (keys.has(key)) return false;
  keys.add(key);
  products.push({ name, description: clean(item.description, 600), price, category: clean(item.category || 'main', 120), image_url: item.image_url || null, is_available: true, applies_to: 'all', source_url: pageUrl, extraction_source: item.source || 'analyzer-v3' });
  return true;
}
function menuLinkScore(url, anchorText = '', title = '') {
  let score = 0;
  const u = String(url || '');
  if (MENU_URL_RE.test(u)) score += 8;
  if (MENU_TEXT_RE.test(anchorText)) score += 8;
  if (MENU_TEXT_RE.test(title)) score += 5;
  return score;
}

async function analyzeSite(inputUrl) {
  const start = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  const host = hostOf(start.href);
  if (!host) throw new Error('Некорректный адрес сайта');
  const diagnostics = { version: '32.0', pages_attempted: 0, pages_checked: 0, pages_failed: [], links_found: 0, html_bytes: 0, menu_pages: [], structural_cards: 0, raw_price_hits: 0, jsonld_product_hits: 0, embedded_json_hits: 0, nearby_product_hits: 0, products_found: 0, confidence: 0, confidence_reasons: [], js_render: { required: false, pages: [] }, price_samples: [], analysis_steps: [] };
  const headers = { 'User-Agent': 'Mozilla/5.0 QR-Menu-Site-Analyzer/32.0', Accept: 'text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.8', 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' };
  const queue = [{ url: start.href, score: 0 }];
  const seen = new Set([start.href]);
  const pages = [];

  async function fetchPage(url) {
    diagnostics.pages_attempted++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      const response = await fetch(url, { redirect: 'follow', headers, signal: controller.signal });
      clearTimeout(timer);
      const finalUrl = response.url || url;
      if (!sameHost(finalUrl, host)) { diagnostics.pages_failed.push({ url, code: 'REDIRECT_EXTERNAL_HOST' }); return null; }
      const type = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) { diagnostics.pages_failed.push({ url, code: `HTTP_${response.status}` }); return null; }
      if (!/html|xhtml|json|text/.test(type)) { diagnostics.pages_failed.push({ url, code: 'UNSUPPORTED_CONTENT', content_type: type }); return null; }
      const bytes = await response.arrayBuffer();
      const html = new TextDecoder('utf-8').decode(bytes).slice(0, MAX_HTML);
      diagnostics.html_bytes += html.length;
      diagnostics.pages_checked++;
      return { url: finalUrl, html };
    } catch (error) {
      diagnostics.pages_failed.push({ url, code: error?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED', message: String(error?.message || error).slice(0, 180) });
      return null;
    }
  }

  while (queue.length && pages.length < MAX_PAGES) {
    queue.sort((a, b) => b.score - a.score);
    const target = queue.shift();
    const page = await fetchPage(target.url);
    if (!page) continue;
    pages.push(page);
    const js = jsSignals(page.html);
    if (js.likely_js_rendered) diagnostics.js_render.pages.push({ url: page.url, ...js });
    const title = clean((page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu) || [, ''])[1], 180);
    const visible = visibleText(page.html);
    if (menuLinkScore(page.url, '', title) >= 8) diagnostics.menu_pages.push(page.url);
    const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu;
    let match;
    while ((match = linkRe.exec(page.html)) && seen.size < MAX_LINKS) {
      const targetUrl = absolute(match[1], page.url);
      if (!targetUrl || !sameHost(targetUrl, host) || ASSET_RE.test(targetUrl) || seen.has(targetUrl)) continue;
      const anchorText = clean(visibleText(match[2]), 180);
      const score = menuLinkScore(targetUrl, anchorText, title);
      seen.add(targetUrl); diagnostics.links_found++;
      queue.push({ url: targetUrl, score });
      if (score >= 8) diagnostics.menu_pages.push(targetUrl);
    }
    if (diagnostics.menu_pages.length === 0 && MENU_TEXT_RE.test(visible)) diagnostics.menu_pages.push(page.url);
  }

  diagnostics.menu_pages = [...new Set(diagnostics.menu_pages)].sort((a, b) => menuLinkScore(b) - menuLinkScore(a));
  const products = [], keys = new Set();
  for (const page of pages) {
    const raw = rawPrices(page.html);
    diagnostics.raw_price_hits += raw.length;
    raw.slice(0, 2).forEach(x => { if (diagnostics.price_samples.length < 20) diagnostics.price_samples.push(x.sample); });
    const structural = structuralCards(page.html, page.url);
    diagnostics.structural_cards += structural.length;
    structural.forEach(x => addProduct(products, keys, x, page.url));
    const jsonld = extractJsonLd(page.html, page.url);
    diagnostics.jsonld_product_hits += jsonld.length;
    jsonld.forEach(x => addProduct(products, keys, x, page.url));
    const embedded = extractEmbedded(page.html);
    diagnostics.embedded_json_hits += embedded.length;
    embedded.forEach(x => addProduct(products, keys, x, page.url));
    const nearby = textNearPrices(page.html);
    diagnostics.nearby_product_hits += nearby.length;
    nearby.forEach(x => addProduct(products, keys, x, page.url));
  }

  diagnostics.products_found = products.length;
  const signals = [];
  if (diagnostics.menu_pages.length) signals.push({ points: 15, reason: `найдены реальные страницы-кандидаты меню: ${diagnostics.menu_pages.length}` });
  if (diagnostics.structural_cards >= 3) signals.push({ points: 35, reason: `найдены структурные карточки товаров: ${diagnostics.structural_cards}` });
  else if (diagnostics.structural_cards) signals.push({ points: 10, reason: `найдены структурные карточки: ${diagnostics.structural_cards}` });
  if (products.length >= 20) signals.push({ points: 40, reason: `извлечено товаров: ${products.length}` });
  else if (products.length >= 5) signals.push({ points: 30, reason: `извлечено товаров: ${products.length}` });
  else if (products.length) signals.push({ points: 10, reason: `извлечены отдельные товары: ${products.length}` });
  if (diagnostics.raw_price_hits >= 10) signals.push({ points: 10, reason: `найдены цены в видимом HTML: ${diagnostics.raw_price_hits}` });
  if (diagnostics.jsonld_product_hits + diagnostics.embedded_json_hits >= 3) signals.push({ points: 10, reason: 'найдены структурированные товарные данные' });
  diagnostics.confidence = Math.min(100, signals.reduce((sum, x) => sum + x.points, 0));
  diagnostics.confidence_reasons = signals.map(x => x.reason);
  diagnostics.js_render.required = products.length < 5 && (diagnostics.js_render.pages.length > 0 || diagnostics.menu_pages.length > 0);
  diagnostics.analysis_steps.push(`Обход: ${pages.length} страниц, ${diagnostics.links_found} внутренних ссылок`);
  diagnostics.analysis_steps.push(`Структурный анализ: ${diagnostics.structural_cards} карточек, ${products.length} товаров, confidence ${diagnostics.confidence}%`);

  let error = null;
  if (!pages.length) error = { code: 'SITE_UNAVAILABLE', message: 'Сайт не удалось получить сервером.', details: { pages_failed: diagnostics.pages_failed.slice(0, 10) } };
  else if (diagnostics.js_render.required) error = { code: 'MENU_JS_RENDER_REQUIRED', message: 'Меню, вероятно, формируется JavaScript или скрыто в динамическом DOM. Требуется браузерный рендеринг.', details: { pages: diagnostics.js_render.pages.slice(0, 10), menu_pages: diagnostics.menu_pages.slice(0, 10) } };
  else if (!products.length) error = { code: 'MENU_NOT_EXTRACTED', message: 'Сайт просмотрен, но товарные позиции не удалось извлечь.', details: { menu_pages: diagnostics.menu_pages.slice(0, 10), raw_price_hits: diagnostics.raw_price_hits, structural_cards: diagnostics.structural_cards, jsonld_product_hits: diagnostics.jsonld_product_hits, embedded_json_hits: diagnostics.embedded_json_hits, nearby_product_hits: diagnostics.nearby_product_hits, price_samples: diagnostics.price_samples } };
  else if (diagnostics.confidence < 50) error = { code: 'MENU_LOW_CONFIDENCE', message: 'Товарные данные найдены, но уверенность в полноценном меню низкая.', details: { confidence: diagnostics.confidence, reasons: diagnostics.confidence_reasons } };

  let business = {};
  const allLines = pages.flatMap(p => lines(p.html));
  for (const page of pages.slice(0, 30)) {
    const blocks = page.html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu) || [];
    for (const block of blocks) {
      try {
        const json = JSON.parse(block.replace(/^.*?>/s, '').replace(/<\/script>.*$/is, ''));
        const walk = x => { if (!x) return; if (Array.isArray(x)) return x.forEach(walk); if (typeof x !== 'object') return; if (!business.name && /restaurant|cafe|bar|foodestablishment|localbusiness/i.test(String(x['@type'] || ''))) business = x; Object.values(x).forEach(walk); };
        walk(json);
      } catch (_) {}
    }
  }
  const text = allLines.join('\n');
  let address = typeof business.address === 'string' ? business.address : business.address ? [business.address.streetAddress, business.address.addressLocality, business.address.addressRegion, business.address.postalCode].filter(Boolean).join(', ') : '';
  if (!address) { const match = text.match(/(?:адрес|наш адрес|мы находимся|находимся)\s*[:—-]?\s*([^\n]{8,250})/iu); if (match) address = match[1]; }
  if (!address) { const hit = allLines.find(x => /(?:ул\.?|улица|проспект|пр-т|переулок|пер\.?|площадь|пл\.?|набережная|наб\.?|шоссе|бульвар|бул\.?|проезд|дом|д\.)\s*[^,\n]{2,}/iu.test(x) && x.length < 250); if (hit) address = hit; }
  let phone = clean(business.telephone, 80);
  if (!phone) { const hit = allLines.find(x => /(?:\+7|8)[\s()\-\d]{9,}/.test(x)); if (hit) phone = (hit.match(/(?:\+7|8)[\s()\-\d]{9,}/) || [''])[0]; }
  const first = pages[0]?.html || '';
  const title = clean((first.match(/<title[^>]*>([\s\S]*?)<\/title>/iu) || [, ''])[1], 180);
  const validated = diagnostics.confidence >= 50 && products.length >= 5;
  return { ok: true, source_url: start.href, venue: { name: clean(business.name || title || host.split('.')[0], 180), description: clean(business.description, 1000), address: clean(address, 500), address_found: !!address, phone, website_url: start.href, logo_url: business.logo ? absolute(typeof business.logo === 'string' ? business.logo : business.logo.url, start.href) : null, opening_hours: business.openingHours || null }, products: products.slice(0, 500), meta: { menu_found: validated, products_found: products.length, pages_checked: pages.length, pages_discovered: Math.max(0, seen.size - 1), best_menu_page: diagnostics.menu_pages[0] || null, validation: validated ? 'validated' : 'not_validated', diagnostics, error } };
}

module.exports = { analyzeSite };
