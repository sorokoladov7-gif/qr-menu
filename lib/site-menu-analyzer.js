const MAX_PAGES = 80;
const MAX_LINKS = 500;
const MAX_HTML = 18 * 1024 * 1024;

const MENU_RE = /menu|menus|меню|catalog|каталог|food|dish|блюд|цены|price|pizza|пицц|sushi|суш|roll|ролл|dessert|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|карта/i;
const ASSET_RE = /\.(?:css|js|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|xml)(?:[?#].*)?$/i;
const NOISE_RE = /^(главная|меню|каталог|о нас|о компании|доставка|акции|новости|контакты|отзывы|вакансии|заказать|корзина|войти|регистрация|подробнее|купить|добавить|калории|белки|жиры|углеводы|добавить в корзину|вам есть 18 лет\??)$/i;
const WEIGHT_RE = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
const CATEGORY_RE = /^(закуски|салаты?|супы?|бургеры?|горячие блюда.*|пицца|.*роллы?|суши|десерты?|соусы?|карта бара|барная карта|напитки?|завтраки?|гарниры?|паста|стейки?|основные блюда|детское меню|детям)$/iu;

function decode(input) {
  return String(input || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _; } })
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function clean(v, max = 500) {
  return decode(String(v || '').replace(/\s+/g, ' ').trim()).slice(0, max);
}

function abs(url, base) { try { return new URL(String(url || ''), base).href; } catch { return null; } }
function sameHost(url, host) { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() === host; } catch { return false; } }

function priceValue(value) {
  const s = decode(value).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
  const m = s.match(/(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu);
  if (!m) return 0;
  const n = Number(m[1].replace(/[ .]/g, ''));
  return n > 0 && n < 1000000 ? n : 0;
}

function rawPrices(html) {
  const out = [];
  const re = /(\d{1,3}(?:[ .]\d{3})?|\d{1,6})\s*(?:(?:<[^>]+>)\s*){0,30}(?:₽|&#8381;|&#x20bd;|р\.?|руб(?:лей|ля|ль)?\.?|RUB)/giu;
  let m;
  while ((m = re.exec(html)) && out.length < 2000) {
    const price = Number(m[1].replace(/[ .]/g, ''));
    if (price > 0 && price < 1000000) out.push({ price, index: m.index, sample: clean(html.slice(Math.max(0, m.index - 220), m.index + m[0].length + 220), 500) });
  }
  return out;
}

function stripHtml(html) {
  return decode(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li|section|article|h[1-6]|tr|td|th|a|button|label|option|form)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '));
}

function textLines(html) {
  return stripHtml(html).split(/\r?\n/).map(x => clean(x, 700)).filter(Boolean);
}

function extractJsonCandidates(html) {
  const result = [];
  const re = /(?:"|')(?:name|title|productName|dishName)(?:"|')\s*:\s*(?:"|')([^"']{2,220})(?:"|')[\s\S]{0,1000}?(?:"|')(?:price|cost|amount)(?:"|')\s*:\s*(?:"|')?([\d\s.,]{1,12})/giu;
  let m;
  while ((m = re.exec(html)) && result.length < 1000) {
    const price = Number(m[2].replace(/\s/g, '').replace(',', '.'));
    if (price > 0 && price < 1000000) result.push({ name: clean(m[1], 220), price });
  }
  return result;
}

function extractJsonLd(html, pageUrl) {
  const products = [];
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu) || [];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block.replace(/^.*?>/, '').replace(/<\/script>.*$/i, ''));
      const walk = value => {
        if (!value) return;
        if (Array.isArray(value)) return value.forEach(walk);
        if (typeof value !== 'object') return;
        const type = String(value['@type'] || '').toLowerCase();
        if ((type.includes('product') || type.includes('menuitem') || value.offers) && value.name) {
          const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers;
          const p = Number(String(value.price ?? offer?.price ?? '').replace(',', '.'));
          if (p > 0 && p < 1000000) products.push({ name: clean(value.name, 220), description: clean(value.description, 600), price: p, image_url: typeof value.image === 'string' ? abs(value.image, pageUrl) : null });
        }
        Object.values(value).forEach(walk);
      };
      walk(json);
    } catch {}
  }
  return products;
}

function detectStructuralCards(html, pageUrl) {
  const products = [];
  const cardRe = /<(?:article|li|div|section)[^>]*(?:class|id)=["'][^"']*(?:menu|dish|product|item|food|price|card)[^"']*["'][^>]*>[\s\S]{0,12000}?<\/(?:article|li|div|section)>/giu;
  let block;
  while ((block = cardRe.exec(html)) && products.length < 1000) {
    const raw = block[0];
    const prices = rawPrices(raw);
    if (!prices.length) continue;
    const lines = textLines(raw);
    const candidates = lines.filter(x => x.length >= 3 && x.length <= 220 && !NOISE_RE.test(x) && !WEIGHT_RE.test(x) && !CATEGORY_RE.test(x) && !priceValue(x) && /[A-Za-zА-Яа-яЁё]/.test(x));
    if (!candidates.length) continue;
    const image = raw.match(/<(?:img|source)[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)/i);
    products.push({ name: candidates[0], description: candidates.slice(1, 3).join(' '), price: prices[0].price, image_url: image ? abs(image[1], pageUrl) : null });
  }
  return products;
}

function nearbyProducts(html, pageUrl) {
  const products = [];
  const lines = textLines(html);
  for (let i = 0; i < lines.length; i++) {
    const p = priceValue(lines[i]);
    if (!p) continue;
    for (let d = 1; d <= 15; d++) {
      const indexes = [i - d, i + d];
      let found = '';
      for (const idx of indexes) {
        const x = lines[idx];
        if (!x || priceValue(x) || WEIGHT_RE.test(x) || NOISE_RE.test(x) || CATEGORY_RE.test(x)) continue;
        if (x.length >= 3 && x.length <= 220 && /[A-Za-zА-Яа-яЁё]/.test(x)) { found = x; break; }
      }
      if (found) { products.push({ name: found, description: '', price: p, image_url: null }); break; }
    }
  }
  return products;
}

function detectJsOnly(html) {
  const scripts = (html.match(/<script\b/gi) || []).length;
  const appMarkers = /(next-data|__next_f|nuxt|__nuxt|react-root|app-root|webpack|vite|angular|svelte|vue)/i.test(html);
  const apiMarkers = /(fetch\s*\(|axios\.|graphql|/api/|application\/json|XMLHttpRequest)/i.test(html);
  const visibleText = stripHtml(html).replace(/\s+/g, ' ').trim().length;
  return { scripts, app_markers: appMarkers, api_markers: apiMarkers, visible_text_chars: visibleText, likely_js_rendered: visibleText < 1200 && (appMarkers || apiMarkers || scripts > 15) };
}

async function analyzeSite(inputUrl) {
  let start = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  const host = start.hostname.replace(/^www\./, '').toLowerCase();
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 QR-Menu-Site-Analyzer/30.0', Accept: 'text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.8', 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' };
  const diagnostics = { version: '30.0', pages_attempted: 0, pages_checked: 0, pages_failed: [], links_found: 0, html_bytes: 0, menu_pages: [], structural_cards: 0, raw_price_hits: 0, jsonld_product_hits: 0, embedded_json_hits: 0, nearby_product_hits: 0, products_found: 0, confidence: 0, confidence_reasons: [], js_render: { required: false, pages: [] }, price_samples: [], analysis_steps: [] };
  const queue = [start.href], seen = new Set(queue), pages = [];
  const get = async url => {
    diagnostics.pages_attempted++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { redirect: 'follow', headers, signal: controller.signal });
      clearTimeout(timer);
      const type = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) { diagnostics.pages_failed.push({ url, code: `HTTP_${response.status}` }); return null; }
      if (!/html|xhtml|json|text/.test(type)) { diagnostics.pages_failed.push({ url, code: 'UNSUPPORTED_CONTENT', content_type: type }); return null; }
      const bytes = await response.arrayBuffer();
      const html = new TextDecoder('utf-8').decode(bytes).slice(0, MAX_HTML);
      diagnostics.html_bytes += html.length; diagnostics.pages_checked++;
      return { url: response.url || url, html };
    } catch (error) {
      diagnostics.pages_failed.push({ url, code: error?.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED', message: String(error?.message || error).slice(0, 180) });
      return null;
    }
  };
  while (queue.length && pages.length < MAX_PAGES) {
    const page = await get(queue.shift());
    if (!page) continue;
    pages.push(page);
    const js = detectJsOnly(page.html);
    if (js.likely_js_rendered) diagnostics.js_render.pages.push({ url: page.url, ...js });
    if (MENU_RE.test(page.url) || MENU_RE.test(page.html.slice(0, 50000))) diagnostics.menu_pages.push(page.url);
    const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/giu;
    let match;
    while ((match = linkRe.exec(page.html)) && seen.size < MAX_LINKS) {
      const target = abs(match[1], page.url);
      if (!target || !sameHost(target, host) || ASSET_RE.test(target) || seen.has(target)) continue;
      seen.add(target); diagnostics.links_found++;
      if (MENU_RE.test(target) || MENU_RE.test(match[0]) || seen.size < 70) queue.push(target);
    }
  }
  diagnostics.analysis_steps.push(`Обход: ${pages.length} страниц, ${diagnostics.links_found} внутренних ссылок`);

  const products = []; const keys = new Set();
  const add = (item, source, pageUrl) => {
    const name = clean(item.name, 220); const price = Number(item.price);
    if (!name || name.length < 2 || !price || price <= 0 || price >= 1000000 || NOISE_RE.test(name)) return false;
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (keys.has(key)) return false;
    keys.add(key); products.push({ name, description: clean(item.description, 600), price, category: clean(item.category || 'main', 120), image_url: item.image_url || null, is_available: true, applies_to: 'all', source_url: pageUrl, extraction_source: source });
    return true;
  };

  for (const page of pages) {
    const raw = rawPrices(page.html);
    diagnostics.raw_price_hits += raw.length;
    raw.slice(0, 3).forEach(x => { if (diagnostics.price_samples.length < 20) diagnostics.price_samples.push(x.sample); });
    const structural = detectStructuralCards(page.html, page.url);
    diagnostics.structural_cards += structural.length;
    structural.forEach(x => add(x, 'structural-card', page.url));
    const ld = extractJsonLd(page.html, page.url);
    diagnostics.jsonld_product_hits += ld.length;
    ld.forEach(x => add(x, 'json-ld', page.url));
    const embedded = extractJsonCandidates(page.html);
    diagnostics.embedded_json_hits += embedded.length;
    embedded.forEach(x => add(x, 'embedded-json', page.url));
    const nearby = nearbyProducts(page.html, page.url);
    diagnostics.nearby_product_hits += nearby.length;
    nearby.forEach(x => add(x, 'text-near-price', page.url));
  }

  diagnostics.products_found = products.length;
  const uniqueMenuPages = [...new Set(diagnostics.menu_pages)];
  const signals = [];
  if (uniqueMenuPages.length) signals.push({ points: 20, reason: `найдены страницы-кандидаты меню: ${uniqueMenuPages.length}` });
  if (diagnostics.structural_cards >= 3) signals.push({ points: 35, reason: `найдены структурные карточки товаров: ${diagnostics.structural_cards}` });
  else if (diagnostics.structural_cards) signals.push({ points: 15, reason: `найдены структурные карточки: ${diagnostics.structural_cards}` });
  if (diagnostics.products_found >= 20) signals.push({ points: 35, reason: `извлечено товаров: ${diagnostics.products_found}` });
  else if (diagnostics.products_found >= 5) signals.push({ points: 25, reason: `извлечено товаров: ${diagnostics.products_found}` });
  else if (diagnostics.products_found) signals.push({ points: 10, reason: `извлечены отдельные товары: ${diagnostics.products_found}` });
  if (diagnostics.raw_price_hits >= 10) signals.push({ points: 10, reason: `найдены цены: ${diagnostics.raw_price_hits}` });
  if (diagnostics.jsonld_product_hits + diagnostics.embedded_json_hits >= 3) signals.push({ points: 10, reason: 'найдены структурированные товарные данные' });
  diagnostics.confidence = Math.min(100, signals.reduce((sum, x) => sum + x.points, 0));
  diagnostics.confidence_reasons = signals.map(x => x.reason);
  const jsRequired = diagnostics.products_found === 0 && diagnostics.js_render.pages.length > 0;
  diagnostics.js_render.required = jsRequired;
  diagnostics.analysis_steps.push(`Структурный анализ: ${diagnostics.structural_cards} карточек, ${diagnostics.products_found} уникальных товаров, confidence ${diagnostics.confidence}%`);

  let error = null;
  if (!pages.length) error = { code: 'SITE_UNAVAILABLE', message: 'Сайт не удалось получить сервером.', details: { pages_failed: diagnostics.pages_failed.slice(0, 10) } };
  else if (jsRequired) error = { code: 'MENU_JS_RENDER_REQUIRED', message: 'Страница получена, но меню, вероятно, формируется JavaScript после загрузки. Требуется браузерный рендеринг.', details: { pages: diagnostics.js_render.pages.slice(0, 10), confidence: diagnostics.confidence } };
  else if (!products.length) error = { code: 'MENU_NOT_EXTRACTED', message: 'Структура сайта просмотрена, но товарные позиции не удалось извлечь.', details: { menu_pages: uniqueMenuPages.slice(0, 10), raw_price_hits: diagnostics.raw_price_hits, structural_cards: diagnostics.structural_cards, jsonld_product_hits: diagnostics.jsonld_product_hits, embedded_json_hits: diagnostics.embedded_json_hits, nearby_product_hits: diagnostics.nearby_product_hits, price_samples: diagnostics.price_samples } };
  else if (diagnostics.confidence < 50) error = { code: 'MENU_LOW_CONFIDENCE', message: 'Товарные данные найдены, но уверенность в том, что это полноценное меню, низкая.', details: { confidence: diagnostics.confidence, reasons: diagnostics.confidence_reasons } };

  const first = pages[0]?.html || '';
  let business = {};
  for (const page of pages.slice(0, 40)) {
    const blocks = page.html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu) || [];
    for (const block of blocks) {
      try {
        const json = JSON.parse(block.replace(/^.*?>/, '').replace(/<\/script>.*$/i, ''));
        const walk = x => { if (!x) return; if (Array.isArray(x)) return x.forEach(walk); if (typeof x !== 'object') return; if (!business.name && /restaurant|cafe|bar|foodestablishment|localbusiness/i.test(String(x['@type'] || ''))) business = x; Object.values(x).forEach(walk); };
        walk(json);
      } catch {}
    }
  }
  const allLines = pages.flatMap(p => textLines(p.html));
  const text = allLines.join('\n');
  let address = typeof business.address === 'string' ? business.address : business.address ? [business.address.streetAddress, business.address.addressLocality, business.address.addressRegion, business.address.postalCode].filter(Boolean).join(', ') : '';
  if (!address) { const m = text.match(/(?:адрес|наш адрес|мы находимся|находимся)\s*[:—-]?\s*([^\n]{8,250})/i); if (m) address = m[1]; }
  if (!address) { const hit = allLines.find(x => /(?:ул\.?|улица|проспект|пр-т|переулок|пер\.?|площадь|пл\.?|набережная|наб\.?|шоссе|бульвар|бул\.?|проезд|дом|д\.)\s*[^,\n]{2,}/i.test(x) && x.length < 250); if (hit) address = hit; }
  let phone = clean(business.telephone, 80);
  if (!phone) { const hit = allLines.find(x => /(?:\+7|8)[\s()\-\d]{9,}/.test(x)); if (hit) phone = (hit.match(/(?:\+7|8)[\s()\-\d]{9,}/) || [''])[0]; }
  const title = clean((first.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1], 180);
  return { ok: true, source_url: start.href, venue: { name: clean(business.name || title || host.split('.')[0], 180), description: clean(business.description, 1000), address: clean(address, 500), address_found: !!address, phone, website_url: start.href, logo_url: business.logo ? abs(typeof business.logo === 'string' ? business.logo : business.logo.url, start.href) : null, opening_hours: business.openingHours || null }, products: products.slice(0, 500), meta: { menu_found: diagnostics.confidence >= 50 && products.length >= 5, products_found: products.length, pages_checked: pages.length, pages_discovered: seen.size - 1, best_menu_page: uniqueMenuPages[0] || null, validation: diagnostics.confidence >= 50 && products.length >= 5 ? 'validated' : 'not_validated', diagnostics, error } };
}

module.exports = { analyzeSite };