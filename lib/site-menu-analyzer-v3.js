'use strict';

const MAX_PAGES = 14;
const MAX_LINKS = 300;
const MAX_HTML = 8 * 1024 * 1024;
const REQUEST_TIMEOUT = 5000;
const ANALYZER_BUDGET = 22000;
const MAX_PDF_TARGETS = 4;
const PDF_TIMEOUT = 7000;

const MENU_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|deserts|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|zakuski|закуск|salaty|salad|салат|soup|суп|goriachie|горяч|bluda|блюда|pasta|паста|garniry|гарнир|steak|стейк|osnovnye|основные|det|детск|children|детям|mangal|первы)(?:[\/?#_.-]|$)/iu;
const MENU_TEXT_RE = /(?:^|\s)(меню|каталог|карта\s+меню|карта\s+блюд|цены|наше\s+меню|food\s+menu|menu|кухня|напитки|завтраки|ланч)(?:\s|$)/iu;
const PDF_RE = /\.pdf(?:[?#].*)?$/iu;
const NOISE_RE = /^(главная|меню|каталог|о нас|о компании|доставка|акции|новости|контакты|отзывы|вакансии|заказать|корзина|войти|регистрация|подробнее|купить|добавить|калории|белки|жиры|углеводы|добавить в корзину|выбрать|вес|объем|объём)$/iu;
const WEIGHT_RE = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
const CATEGORY_RE = /^(закуски|салаты?|супы?|бургеры?|горячие блюда.*|пицца|.*роллы?|суши|десерты?|соусы?|карта бара|барная карта|напитки?|завтраки?|гарниры?|паста|стейки?|основные блюда|детское меню|детям|мангал|первые блюда)$/iu;
const BLOCK_RE = /(вы не робот|captcha|cloudflare|access denied|checking your browser|just a moment|verify you are human|robot check)/iu;
const IMAGE_ATTR_RE = /(?:src|data-src|data-lazy-src|data-original|data-image|data-image-url|data-fsrc|data-thumb|data-photo|data-photo-url)\s*=\s*["']([^"']+)["']/giu;
const SRCSET_ATTR_RE = /(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/giu;
const IMAGE_BAD_RE = /^(?:data:|about:|javascript:)|(?:transparent|placeholder|spacer|blank|pixel|1x1|logo|icon|avatar|sprite|favicon)/iu;

function clean(value, max = 600) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function decodeHtml(value) { return String(value || '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'); }
function safeDecodeUrlPath(value) { try { return decodeURIComponent(String(value || '')); } catch (_) { return String(value || ''); } }
function absolute(value, base) { try { const u = new URL(String(value || ''), base); return /^https?:$/i.test(u.protocol) ? u.href : null; } catch (_) { return null; } }
function normalize(value, base) { try { const u = new URL(String(value || ''), base); if (!/^https?:$/i.test(u.protocol)) return null; u.hash = ''; return u.href.replace(/\/$/, '') || u.origin; } catch (_) { return null; } }
function hostOf(value) { try { return new URL(value).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } }
function sameHost(value, host) { return hostOf(value) === host; }
function isAsset(url) { return /\.(?:css|js|mjs|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|xml)(?:[?#].*)?$/iu.test(String(url || '')); }
function priceValue(value) {
  const s = decodeHtml(value).replace(/[\u00a0\u202f]/g, ' ');
  const m = s.match(/(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)(?=$|\s|[.,;:!?])/iu)
    || s.match(/(?:₽|руб(?:лей|ля|ль)?\.?|RUB)\s*((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?/iu);
  if (!m) return 0;
  const n = Number(String(m[1] || '').replace(/[ .]/g, '').replace(',', '.'));
  return n > 0 && n < 1000000 ? n : 0;
}
function lines(html) {
  return decodeHtml(String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, ' ').replace(/<br\s*\/?>/giu, '\n').replace(/<\/(?:div|p|li|section|article|h[1-6]|tr|td|th|a|button|label|option|form|header|footer|nav)>/giu, '\n').replace(/<[^>]+>/g, ' ')).split(/\r?\n/).map(x => clean(x, 700)).filter(Boolean);
}
function rawPrices(html) {
  const out = [];
  const re = /((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})\s*(?:(?:<[^>]+>)\s*){0,20}(?:₽|&#8381;|&#x20bd;|р\.?|руб(?:лей|ля|ль)?\.?|RUB)/giu;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < 1000) {
    const price = Number(m[1].replace(/[ .]/g, ''));
    if (price > 0 && price < 1000000) out.push({ price, index: m.index });
  }
  return out;
}
function parseLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < MAX_LINKS) {
    const url = normalize(m[1], baseUrl);
    if (!url || !sameHost(url, hostOf(baseUrl)) || isAsset(url)) continue;
    const text = clean(m[2].replace(/<[^>]+>/g, ' '), 160);
    let score = 0;
    if (MENU_RE.test(url)) score += 20;
    if (MENU_TEXT_RE.test(text)) score += 20;
    if (PDF_RE.test(url)) score += 10;
    if (/(privacy|offer|vacancy|career|login|cart|checkout|contact|news|blog)/i.test(url)) score -= 10;
    if (score > 0 || PDF_RE.test(url)) out.push({ url, text, score });
  }
  return out;
}
function parseSitemap(text, baseUrl) {
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/giu;
  let m;
  while ((m = re.exec(String(text || ''))) && out.length < 1500) {
    const url = normalize(m[1], baseUrl);
    if (url && sameHost(url, hostOf(baseUrl)) && (!isAsset(url) || PDF_RE.test(url))) out.push(url);
  }
  return [...new Set(out)];
}
function pickImageCandidate(value, pageUrl) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = pickImageCandidate(item, pageUrl); if (found) return found; }
    return null;
  }
  if (typeof value === 'object') {
    return pickImageCandidate(value.url || value.contentUrl || value.image || value.src || value.thumbnailUrl, pageUrl);
  }
  const raw = decodeHtml(String(value).trim());
  if (!raw || IMAGE_BAD_RE.test(raw)) return null;
  const candidates = raw.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
  for (const candidate of candidates) {
    if (IMAGE_BAD_RE.test(candidate)) continue;
    const url = absolute(candidate, pageUrl);
    if (url) return url;
  }
  return null;
}
function pickImageFromTag(tag, pageUrl) {
  const source = String(tag || '');
  let m;
  IMAGE_ATTR_RE.lastIndex = 0;
  while ((m = IMAGE_ATTR_RE.exec(source))) {
    const url = pickImageCandidate(m[1], pageUrl);
    if (url) return url;
  }
  SRCSET_ATTR_RE.lastIndex = 0;
  while ((m = SRCSET_ATTR_RE.exec(source))) {
    const entries = String(m[1] || '').split(',').map(x => x.trim()).filter(Boolean).map(x => ({ raw: x, score: Number(x.match(/\s(\d+(?:\.\d+)?)w$/)?.[1] || x.match(/\s(\d+(?:\.\d+)?)x$/)?.[1] || 0) })).sort((a, b) => b.score - a.score);
    for (const entry of entries) { const url = pickImageCandidate(entry.raw.replace(/\s+(?:\d+(?:\.\d+)?)(?:w|x)$/, ''), pageUrl); if (url) return url; }
  }
  const bg = source.match(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')\s]+)["']?\s*\)/iu)?.[1];
  return pickImageCandidate(bg, pageUrl);
}
function firstImageInBlock(block, pageUrl) {
  const source = String(block || '');
  const tags = source.match(/<(?:picture|img|source|div|span|a)[^>]*(?:src|data-src|data-lazy-src|data-original|data-image|data-image-url|data-fsrc|data-thumb|data-photo|data-photo-url|srcset|data-srcset|style)=[^>]*>/giu) || [];
  for (const tag of tags) { const image = pickImageFromTag(tag, pageUrl); if (image) return image; }
  return null;
}
function extractDescriptionFromBlock(block, candidates, name) {
  const meta = String(block || '').match(/<(?:meta|p|div|span)[^>]*(?:class|id)=["'][^"']*(?:description|desc|subtitle|composition|ingredients|about)[^"']*["'][^>]*>([\s\S]{0,900})<\/(?:meta|p|div|span)>/iu)?.[1];
  const text = clean((meta || '').replace(/<[^>]+>/g, ' '), 600);
  if (text && text.toLowerCase() !== String(name || '').toLowerCase()) return text;
  return clean((candidates || []).filter(x => x && x.toLowerCase() !== String(name || '').toLowerCase()).slice(0, 2).join(' '), 600);
}
function extractMeasure(value) {
  const text = clean(value, 120);
  const m = text.match(/\b(\d+(?:[.,]\d+)?)\s*(г|гр|кг|мл|л|шт)\b/iu);
  return m ? `${m[1]} ${m[2]}` : '';
}
function addProduct(products, keys, raw, pageUrl, category = 'main') {
  const name = clean(raw?.name, 220);
  const price = Number(raw?.price);
  if (!name || name.length < 2 || !Number.isFinite(price) || price <= 0 || price >= 1000000) return false;
  if (NOISE_RE.test(name) || WEIGHT_RE.test(name)) return false;
  const key = name.toLowerCase().replace(/\s+/g, ' ');
  const existingIndex = products.findIndex(item => item.name.toLowerCase().replace(/\s+/g, ' ') === key);
  const normalized = {
    name,
    description: clean(raw?.description, 600),
    price,
    category: clean(raw?.category || category || 'main', 120),
    image_url: pickImageCandidate(raw?.image_url || raw?.image || raw?.photo, pageUrl),
    weight: clean(raw?.weight || raw?.volume || extractMeasure(raw?.description), 60),
    is_available: true,
    applies_to: 'all',
    source_url: pageUrl,
    extraction_source: raw?.source || 'analyzer-v4'
  };
  if (existingIndex >= 0) {
    const existing = products[existingIndex];
    if (!existing.description && normalized.description) existing.description = normalized.description;
    if (!existing.image_url && normalized.image_url) existing.image_url = normalized.image_url;
    if ((!existing.category || existing.category === 'main') && normalized.category && normalized.category !== 'main') existing.category = normalized.category;
    if (!existing.weight && normalized.weight) existing.weight = normalized.weight;
    if (!existing.source_url && normalized.source_url) existing.source_url = normalized.source_url;
    if (existing.extraction_source === 'analyzer-v4' && normalized.extraction_source) existing.extraction_source = normalized.extraction_source;
    return true;
  }
  keys.add(key);
  products.push(normalized);
  return true;
}
function extractJsonLd(html, pageUrl) {
  const out = [];
  const blocks = String(html || '').match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu) || [];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block.replace(/^.*?>/s, '').replace(/<\/script>.*$/is, ''));
      const walk = value => {
        if (!value) return;
        if (Array.isArray(value)) return value.forEach(walk);
        if (typeof value !== 'object') return;
        const type = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '');
        const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers;
        const price = Number(String(value.price ?? offer?.price ?? '').replace(/\s/g, '').replace(',', '.'));
        const image = pickImageCandidate(value.image || value.image_url || value.imageUrl || value.photo || value.thumbnailUrl, pageUrl);
        const description = value.description || value.desc || value.subtitle || value.composition || value.ingredients || '';
        const category = value.category || value.menuSection || value.section || '';
        const weight = value.weight || value.netWeight || value.volume || value.size || '';
        if ((/(product|menuitem)/i.test(type) || value.offers) && value.name && price > 0 && price < 1000000) {
          out.push({ name: value.name, description, price, image_url: image, category, weight, source: 'json-ld' });
        }
        for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child);
      };
      walk(json);
    } catch (_) {}
  }
  return out;
}
function extractEmbedded(html, pageUrl) {
  const out = [];
  const source = String(html || '');
  const re = /(?:"|')(?:name|title|productName|dishName)(?:"|')\s*:\s*(?:"|')([^"']{2,220})(?:"|')([\s\S]{0,1800}?)(?:"|')(?:price|cost|amount)(?:"|')\s*:\s*(?:"|')?([\d\s.,]{1,12})/giu;
  let m;
  while ((m = re.exec(source)) && out.length < 700) {
    const price = Number(m[3].replace(/\s/g, '').replace(',', '.'));
    if (!(price > 0 && price < 1000000)) continue;
    const tail = m[2] || '';
    const image = tail.match(/(?:"|')(?:image|imageUrl|image_url|photo|photoUrl|picture|thumbnail)(?:"|')\s*:\s*(?:"|')([^"']+)(?:"|')/iu)?.[1];
    const description = tail.match(/(?:"|')(?:description|desc|subtitle|composition|ingredients)(?:"|')\s*:\s*(?:"|')([^"']{1,700})(?:"|')/iu)?.[1] || '';
    const category = tail.match(/(?:"|')(?:category|categoryName|section|menuSection)(?:"|')\s*:\s*(?:"|')([^"']{1,160})(?:"|')/iu)?.[1] || '';
    const weight = tail.match(/(?:"|')(?:weight|volume|size|portion)(?:"|')\s*:\s*(?:"|')?([^,"'}]{1,80})/iu)?.[1] || '';
    out.push({ name: m[1], price, image_url: pickImageCandidate(image, pageUrl), description, category, weight, source: 'embedded-json' });
  }
  return out;
}
function extractNearby(html) {
  const list = lines(html);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const price = priceValue(list[i]);
    if (!price) continue;
    for (let d = 1; d <= 7; d++) {
      const candidate = list[i - d] || list[i + d];
      if (!candidate || priceValue(candidate) || WEIGHT_RE.test(candidate) || NOISE_RE.test(candidate) || CATEGORY_RE.test(candidate)) continue;
      if (candidate.length >= 3 && candidate.length <= 220 && /[A-Za-zА-Яа-яЁё]/.test(candidate)) { out.push({ name: candidate, price, source: 'visible-text-near-price' }); break; }
    }
  }
  return out;
}
function extractCards(html, pageUrl) {
  const out = [];
  const re = /<(?:article|li|div|section)[^>]*(?:class|id)=["'][^"']*(?:menu|dish|product|food|price|card|item)[^"']*["'][^>]*>[\s\S]{0,7000}?<\/(?:article|li|div|section)>/giu;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < 500) {
    const block = m[0];
    const price = rawPrices(block)[0]?.price || 0;
    if (!price) continue;
    const candidates = lines(block).filter(x => x.length >= 3 && x.length <= 220 && !NOISE_RE.test(x) && !WEIGHT_RE.test(x) && !CATEGORY_RE.test(x) && !priceValue(x) && /[A-Za-zА-Яа-яЁё]/.test(x));
    if (!candidates.length) continue;
    const name = candidates[0];
    const image = firstImageInBlock(block, pageUrl);
    const description = extractDescriptionFromBlock(block, candidates.slice(1), name);
    const weight = extractMeasure(lines(block).find(x => WEIGHT_RE.test(x)) || description);
    const category = clean(lines(block).find(x => CATEGORY_RE.test(x)) || '', 120);
    out.push({ name, description, price, image_url: image, weight, category, source: 'structural-card' });
  }
  return out;
}
async function fetchPage(url, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: {
      'user-agent': 'Mozilla/5.0 QR-Menu-Site-Analyzer/43.0',
      accept: 'text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.6',
      'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
    }});
    const type = (response.headers.get('content-type') || '').toLowerCase();
    const finalUrl = response.url || url;
    if (!response.ok || !sameHost(finalUrl, hostOf(url))) return { ok: false, blocked: false, url: finalUrl, type, text: '', status: response.status };
    const bytes = await response.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(bytes).slice(0, MAX_HTML);
    return { ok: true, blocked: BLOCK_RE.test(text), url: finalUrl, type, text, status: response.status };
  } catch (error) {
    return { ok: false, blocked: false, url, type: '', text: '', status: 0, error: error?.name || 'FETCH_ERROR' };
  } finally { clearTimeout(timer); }
}
async function readWithJina(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT);
  try {
    const endpoint = `https://r.jina.ai/http://${String(url).replace(/^https?:\/\//i, '')}`;
    const response = await fetch(endpoint, { signal: controller.signal, headers: { 'user-agent': 'QR-Menu-Site-Analyzer/43.0' } });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 2 * 1024 * 1024);
  } catch (_) { return null; }
  finally { clearTimeout(timer); }
}
function pdfProducts(text) {
  const rows = String(text || '').split(/\r?\n/).map(x => clean(x, 260)).filter(Boolean);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const price = priceValue(rows[i]);
    if (!price) continue;
    let name = '';
    for (let d = 1; d <= 5; d++) {
      const c = rows[i - d];
      if (!c || priceValue(c) || WEIGHT_RE.test(c) || NOISE_RE.test(c) || CATEGORY_RE.test(c)) continue;
      if (/[A-Za-zА-Яа-яЁё]/.test(c) && c.length >= 3 && c.length <= 220) { name = c; break; }
    }
    if (name) out.push({ name, price, description: rows.slice(Math.max(0, i - 3), i + 1).find(x => WEIGHT_RE.test(x)) || '', source: 'jina-pdf' });
  }
  return out;
}

async function analyzeSite(inputUrl) {
  const started = Date.now();
  const start = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  const host = hostOf(start.href);
  if (!host) throw new Error('Некорректный адрес сайта');

  const diagnostics = {
    version: '43.0', pages_attempted: 0, pages_checked: 0, pages_failed: [], links_found: 0, html_bytes: 0,
    menu_pages: [], menu_pages_by_products: [], menu_page_evidence: [], structural_cards: 0, raw_price_hits: 0,
    jsonld_product_hits: 0, embedded_json_hits: 0, nearby_product_hits: 0, products_found: 0,
    image_hits: 0, description_hits: 0, confidence: 0, confidence_reasons: [], js_render: { required: false, pages: [] }, price_samples: [], analysis_steps: [],
    pdf_fallback: { attempted: 0, successful: 0, products_found: 0 }, blocked_pages: 0
  };
  const targets = new Map();
  const products = [];
  const keys = new Set();
  const addTarget = (url, score, reason) => {
    const normalized = normalize(url, start.href);
    if (!normalized || !sameHost(normalized, host)) return;
    const item = targets.get(normalized) || { url: normalized, score: 0, reasons: [] };
    item.score = Math.max(item.score, Number(score || 0));
    if (reason && !item.reasons.includes(reason)) item.reasons.push(reason);
    targets.set(normalized, item);
  };
  addTarget(start.href, 2, 'start');

  let root = null;
  try { root = await fetchPage(start.href, 5000); } catch (_) {}
  diagnostics.pages_attempted++;
  if (root?.ok) {
    diagnostics.pages_checked++;
    diagnostics.html_bytes += root.text.length;
    const links = parseLinks(root.text, root.url);
    diagnostics.links_found = links.length;
    for (const item of links) addTarget(item.url, item.score, 'homepage-link');
  } else diagnostics.pages_failed.push({ url: start.href, code: root?.error || `HTTP_${root?.status || 0}` });

  for (const smUrl of [new URL('/sitemap.xml', start).href, new URL('/sitemap_index.xml', start).href]) {
    if (Date.now() - started > ANALYZER_BUDGET) break;
    const sm = await fetchPage(smUrl, 3500);
    diagnostics.pages_attempted++;
    if (!sm?.ok) continue;
    for (const url of parseSitemap(sm.text, sm.url)) addTarget(url, MENU_RE.test(url) ? 18 : PDF_RE.test(url) ? 16 : 2, PDF_RE.test(url) ? 'sitemap-pdf' : 'sitemap');
  }

  const ranked = [...targets.values()].sort((a, b) => b.score - a.score).slice(0, MAX_PAGES);
  diagnostics.menu_pages = ranked.filter(x => x.score >= 8 && !PDF_RE.test(x.url)).map(x => x.url);
  diagnostics.analysis_steps.push(`bounded crawl: ${ranked.length} targets`);

  const htmlTargets = ranked.filter(x => !PDF_RE.test(x.url)).slice(0, MAX_PAGES - MAX_PDF_TARGETS);
  const results = await Promise.allSettled(htmlTargets.map(target => fetchPage(target.url)));
  results.forEach((settled, index) => {
    const target = htmlTargets[index];
    diagnostics.pages_attempted++;
    if (Date.now() - started > ANALYZER_BUDGET) return;
    if (settled.status !== 'fulfilled' || !settled.value?.ok) {
      diagnostics.pages_failed.push({ url: target.url, code: settled.status === 'fulfilled' ? `HTTP_${settled.value?.status || 0}` : 'FETCH_ERROR' });
      return;
    }
    const page = settled.value;
    diagnostics.pages_checked++;
    diagnostics.html_bytes += page.text.length;
    if (page.blocked) diagnostics.blocked_pages++;
    const pathPart = new URL(page.url).pathname.split('/').filter(Boolean).pop() || '';
    const category = clean(safeDecodeUrlPath(pathPart).replace(/[-_]+/g, ' '), 100);
    const jsonld = extractJsonLd(page.text, page.url);
    const embedded = extractEmbedded(page.text, page.url);
    const nearby = extractNearby(page.text);
    const cards = extractCards(page.text, page.url);
    diagnostics.jsonld_product_hits += jsonld.length;
    diagnostics.embedded_json_hits += embedded.length;
    diagnostics.nearby_product_hits += nearby.length;
    diagnostics.structural_cards += cards.length;
    diagnostics.raw_price_hits += rawPrices(page.text).length;
    for (const item of [...jsonld, ...embedded, ...cards, ...nearby]) addProduct(products, keys, item, page.url, category || 'main');
    const pageProducts = products.filter(p => p.source_url === page.url).length;
    if (pageProducts) diagnostics.menu_pages_by_products.push(page.url);
    diagnostics.menu_page_evidence.push({ url: page.url, score: target.score, products: pageProducts, blocked: page.blocked });
  });

  const pdfTargets = ranked.filter(x => PDF_RE.test(x.url)).slice(0, MAX_PDF_TARGETS);
  if (!products.length && pdfTargets.length && Date.now() - started < ANALYZER_BUDGET) {
    diagnostics.pdf_fallback.attempted = pdfTargets.length;
    const pdfResults = await Promise.all(pdfTargets.map(x => readWithJina(x.url)));
    pdfResults.forEach((text, index) => { if (text) { diagnostics.pdf_fallback.successful++; for (const item of pdfProducts(text)) addProduct(products, keys, item, pdfTargets[index].url, 'main'); } });
    diagnostics.pdf_fallback.products_found = products.length;
  }

  diagnostics.menu_pages_by_products = [...new Set(diagnostics.menu_pages_by_products)];
  diagnostics.products_found = products.length;
  diagnostics.image_hits = products.filter(x => x.image_url).length;
  diagnostics.description_hits = products.filter(x => x.description).length;
  const priceCount = products.filter(x => x.price > 0).length;
  const descCount = diagnostics.description_hits;
  const imageCount = diagnostics.image_hits;
  diagnostics.confidence = Math.min(100, Math.round((products.length ? 40 : 0) + (priceCount ? 20 : 0) + (descCount ? 15 : 0) + (imageCount ? 10 : 0) + (diagnostics.menu_pages_by_products.length ? 10 : 0) + (diagnostics.pdf_fallback.products_found ? 5 : 0)));
  diagnostics.confidence_reasons = [
    products.length ? `найдено ${products.length} позиций` : 'позиции не найдены',
    priceCount ? 'есть цены' : null,
    descCount ? `есть описания: ${descCount}` : null,
    imageCount ? `есть изображения: ${imageCount}` : null,
    diagnostics.menu_pages_by_products.length ? `подтверждено страниц меню: ${diagnostics.menu_pages_by_products.length}` : null,
    diagnostics.pdf_fallback.products_found ? 'использовано PDF-меню через reader' : null,
    diagnostics.blocked_pages ? `обнаружено антибот-блокировок: ${diagnostics.blocked_pages}` : null
  ].filter(Boolean);
  diagnostics.analysis_steps.push(`extraction: ${products.length} products; images ${imageCount}; descriptions ${descCount}; confidence ${diagnostics.confidence}%`);

  return {
    ok: true,
    venue: {},
    products,
    meta: {
      title: root?.ok ? clean(root.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 180) : null,
      diagnostics,
      menu_found: products.length > 0,
      validation: products.length ? 'validated-multisource-catalog' : 'not_validated',
      error: products.length ? null : { code: 'MENU_NOT_FOUND', message: 'Не удалось найти позиции меню на доступных источниках' }
    }
  };
}

module.exports = { analyzeSite };
