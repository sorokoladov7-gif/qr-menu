'use strict';

const MAX_PAGES = 18;
const MAX_LINKS = 350;
const MAX_HTML = 10 * 1024 * 1024;
const REQUEST_TIMEOUT = 4500;
const ANALYZER_BUDGET = 22000;
const PDF_TIMEOUT = 6500;
const MAX_PDF_TARGETS = 6;

const MENU_URL_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|deserts|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|zakuski|закуск|salaty|salad|салат|soup|суп|goriachie|горяч|bluda|блюда|pasta|паста|garniry|гарнир|steak|стейк|osnovnye|основные|det|детск|children|детям|mangal|первы[еы]\-bliuda)(?:[\/?#_.-]|$)/iu;
const MENU_TEXT_RE = /(?:^|\s)(меню|каталог|карта\s+меню|карта\s+блюд|цены|наше\s+меню|food\s+menu|menu|catalog|ланч|кухня|напитки|завтраки)(?:\s|$)/iu;
const ASSET_RE = /\.(?:css|js|mjs|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|xml)(?:[?#].*)?$/iu;
const PDF_RE = /\.pdf(?:[?#].*)?$/iu;
const NOISE_RE = /^(главная|меню|каталог|о нас|о компании|доставка|акции|новости|контакты|отзывы|вакансии|заказать|корзина|войти|регистрация|подробнее|купить|добавить|калории|белки|жиры|углеводы|добавить в корзину|выбрать|вес|объем|объём)$/iu;
const WEIGHT_RE = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
const CATEGORY_RE = /^(закуски|салаты?|супы?|бургеры?|горячие блюда.*|пицца|.*роллы?|суши|десерты?|соусы?|карта бара|барная карта|напитки?|завтраки?|гарниры?|паста|стейки?|основные блюда|детское меню|детям|мангал|первые блюда)$/iu;

function decode(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _; } })
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}
function clean(value, max = 600) { return decode(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, max); }
function absolute(value, base) { try { const u = new URL(String(value || ''), base); return /^https?:$/i.test(u.protocol) ? u.href : null; } catch { return null; } }
function hostOf(value) { try { return new URL(value).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } }
function sameHost(value, host) { return hostOf(value) === host; }
function normalize(value, base) { try { const u = new URL(String(value || ''), base); if (!/^https?:$/i.test(u.protocol)) return null; u.hash = ''; return u.href.replace(/\/$/, '') || u.origin; } catch { return null; } }
function isAsset(url) { return ASSET_RE.test(String(url || '')) || /\.(?:woff2?|ttf|mp4|mp3|zip|rar)(?:[?#].*)?$/iu.test(String(url || '')); }

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
  const m = s.match(/(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu)
    || s.match(/(?:₽|руб(?:лей|ля|ль)?\.?|RUB)\s*((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?/iu);
  if (!m) return 0;
  const n = Number(String(m[1] || '').replace(/[ .]/g, '').replace(',', '.'));
  return n > 0 && n < 1000000 ? n : 0;
}
function rawPrices(html) {
  const safe = contentOnly(html);
  const out = [];
  const re = /((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})\s*(?:(?:<[^>]+>)\s*){0,30}(?:₽|&#8381;|&#x20bd;|р\.?|руб(?:лей|ля|ль)?\.?|RUB)/giu;
  let m;
  while ((m = re.exec(safe)) && out.length < 1500) {
    const price = Number(m[1].replace(/[ .]/g, ''));
    if (price > 0 && price < 1000000) out.push({ price, index: m.index });
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
        const types = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '');
        const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers;
        const price = Number(String(value.price ?? offer?.price ?? '').replace(/\s/g, '').replace(',', '.'));
        if ((/(product|menuitem)/i.test(types) || value.offers) && value.name && price > 0 && price < 1000000) {
          const image = typeof value.image === 'string' ? absolute(value.image, pageUrl) : null;
          out.push({ name: clean(value.name, 220), description: clean(value.description, 600), price, image_url: image, source: 'json-ld', category: clean(value.category, 120) || 'main' });
        }
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
  while ((m = re.exec(safe)) && out.length < 800) {
    const price = Number(m[2].replace(/\s/g, '').replace(',', '.'));
    if (price > 0 && price < 1000000) out.push({ name: clean(m[1], 220), description: '', price, source: 'embedded-json' });
  }
  return out;
}

function textNearPrices(text) {
  const out = [];
  const list = Array.isArray(text) ? text : lines(text);
  for (let i = 0; i < list.length; i++) {
    const price = priceValue(list[i]);
    if (!price) continue;
    const candidates = [];
    for (let d = 1; d <= 8; d++) { candidates.push(list[i - d], list[i + d]); }
    for (const candidate of candidates) {
      if (!candidate || priceValue(candidate) || WEIGHT_RE.test(candidate) || NOISE_RE.test(candidate) || CATEGORY_RE.test(candidate)) continue;
      if (candidate.length >= 3 && candidate.length <= 220 && /[A-Za-zА-Яа-яЁё]/.test(candidate)) {
        out.push({ name: candidate, description: '', price, source: 'visible-text-near-price' });
        break;
      }
    }
  }
  return out;
}

function structuralCards(html, pageUrl) {
  const safe = contentOnly(html);
  const out = [];
  const re = /<(?:article|li|div|section)[^>]*(?:class|id)=["'][^"']*(?:menu|dish|product|food|price|card|item)[^"']*["'][^>]*>[\s\S]{0,8000}?<\/(?:article|li|div|section)>/giu;
  let m;
  while ((m = re.exec(safe)) && out.length < 700) {
    const block = m[0];
    const prices = rawPrices(block);
    if (!prices.length) continue;
    const candidates = lines(block).filter(x => x.length >= 3 && x.length <= 220 && !NOISE_RE.test(x) && !WEIGHT_RE.test(x) && !CATEGORY_RE.test(x) && !priceValue(x) && /[A-Za-zА-Яа-яЁё]/.test(x));
    if (!candidates.length) continue;
    const image = block.match(/<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)/iu);
    out.push({ name: candidates[0], description: candidates.slice(1, 3).join(' '), price: prices[0].price, image_url: image ? absolute(image[1], pageUrl) : null, source: 'structural-card' });
  }
  return out;
}

function addProduct(products, keys, item, pageUrl, category = 'main') {
  const name = clean(item?.name, 220);
  const price = Number(item?.price);
  if (!name || name.length < 2 || !price || price <= 0 || price >= 1000000 || NOISE_RE.test(name) || WEIGHT_RE.test(name)) return false;
  const key = name.toLowerCase().replace(/\s+/g, ' ');
  if (keys.has(key)) return false;
  keys.add(key);
  products.push({ name, description: clean(item.description, 600), price, category: clean(item.category || category || 'main', 120), image_url: item.image_url || null, is_available: true, applies_to: 'all', source_url: pageUrl, extraction_source: item.source || 'analyzer-v4' });
  return true;
}

function menuLinkScore(url, anchorText = '', title = '') {
  let score = 0;
  if (MENU_URL_RE.test(String(url || ''))) score += 12;
  if (MENU_TEXT_RE.test(anchorText)) score += 10;
  if (MENU_TEXT_RE.test(title)) score += 6;
  if (PDF_RE.test(String(url || ''))) score += 7;
  if (/(privacy|offer|vacancy|career|login|cart|checkout|contact|news|blog)/i.test(String(url || ''))) score -= 10;
  return score;
}

function parseLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < MAX_LINKS) {
    const rawHref = m[1];
    const url = normalize(rawHref, baseUrl);
    if (!url || !sameHost(url, baseUrl) || isAsset(url)) continue;
    const text = clean(String(m[2]).replace(/<[^>]+>/g, ' '), 180);
    const score = menuLinkScore(url, text);
    if (score > 0 || PDF_RE.test(url)) out.push({ url, text, score });
  }
  return out;
}

function parseSitemap(xml, baseUrl) {
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/giu;
  let m;
  while ((m = re.exec(String(xml || ''))) && out.length < 1200) {
    const url = normalize(m[1], baseUrl);
    if (url && sameHost(url, baseUrl) && (!isAsset(url) || PDF_RE.test(url))) out.push(url);
  }
  return [...new Set(out)];
}

async function fetchRaw(url, timeoutMs = REQUEST_TIMEOUT, accept = 'text/html,application/xhtml+xml,application/json,text/plain,*/*;q=0.5') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: {
      'user-agent': 'Mozilla/5.0 QR-Menu-Site-Analyzer/41.0',
      accept,
      'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
    }});
    const finalUrl = response.url || url;
    const type = (response.headers.get('content-type') || '').toLowerCase();
    const status = response.status;
    const bytes = await response.arrayBuffer();
    return { ok: response.ok, status, url: finalUrl, type, bytes: bytes.byteLength, text: new TextDecoder('utf-8').decode(bytes).slice(0, MAX_HTML) };
  } catch (error) {
    return { ok: false, status: 0, url, type: '', bytes: 0, text: '', error: error?.name || 'FETCH_ERROR' };
  } finally { clearTimeout(timer); }
}

async function fetchJina(url, timeoutMs = PDF_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`;
    const response = await fetch(endpoint, { signal: controller.signal, headers: { 'user-agent': 'QR-Menu-Site-Analyzer/41.0', accept: 'text/plain,*/*;q=0.5' } });
    if (!response.ok) return null;
    return { url, text: (await response.text()).slice(0, 2 * 1024 * 1024) };
  } catch (_) { return null; }
  finally { clearTimeout(timer); }
}

function extractPdfProducts(text, pageUrl) {
  const rows = String(text || '').split(/\r?\n/).map(x => clean(x, 260)).filter(Boolean);
  const products = [];
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    let price = priceValue(line);
    if (!price) continue;
    let name = '';
    for (let d = 1; d <= 5; d++) {
      const candidate = rows[i - d];
      if (!candidate || priceValue(candidate) || WEIGHT_RE.test(candidate) || NOISE_RE.test(candidate) || CATEGORY_RE.test(candidate)) continue;
      if (/[A-Za-zА-Яа-яЁё]/.test(candidate) && candidate.length >= 3 && candidate.length <= 220) { name = candidate; break; }
    }
    if (!name && i + 1 < rows.length) {
      const candidate = rows[i + 1];
      if (candidate && !priceValue(candidate) && /[A-Za-zА-Яа-яЁё]/.test(candidate) && candidate.length <= 220) name = candidate;
    }
    if (!name) continue;
    const weight = rows.slice(Math.max(0, i - 3), i + 2).find(x => WEIGHT_RE.test(x));
    products.push({ name, description: weight || '', price, category: 'main', image_url: null, source: 'jina-pdf' });
  }
  return products;
}

async function analyzeSite(inputUrl) {
  const started = Date.now();
  const start = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  const host = hostOf(start.href);
  if (!host) throw new Error('Некорректный адрес сайта');

  const diagnostics = {
    version: '41.0', pages_attempted: 0, pages_checked: 0, pages_failed: [], links_found: 0, html_bytes: 0,
    menu_pages: [], menu_pages_by_products: [], menu_page_evidence: [], structural_cards: 0, raw_price_hits: 0,
    jsonld_product_hits: 0, embedded_json_hits: 0, nearby_product_hits: 0, products_found: 0,
    confidence: 0, confidence_reasons: [], js_render: { required: false, pages: [] }, price_samples: [],
    analysis_steps: [], pdf_fallback: { attempted: 0, successful: 0, products_found: 0 }
  };
  const products = [];
  const keys = new Set();
  const targets = new Map();
  const addTarget = (url, score, reason = '') => {
    const normalized = normalize(url, start.href);
    if (!normalized || !sameHost(normalized, host)) return;
    const current = targets.get(normalized) || { url: normalized, score: 0, reasons: [] };
    current.score = Math.max(current.score, Number(score || 0));
    if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
    targets.set(normalized, current);
  };

  addTarget(start.href, 2, 'start');
  const root = await fetchRaw(start.href, 5000);
  diagnostics.pages_attempted++;
  if (root.ok) {
    diagnostics.pages_checked++;
    diagnostics.html_bytes += root.bytes;
    const links = parseLinks(root.text, root.url);
    diagnostics.links_found = links.length;
    for (const item of links) addTarget(item.url, item.score, 'homepage-link');
    for (const pdf of links.filter(x => PDF_RE.test(x.url)).slice(0, MAX_PDF_TARGETS)) addTarget(pdf.url, pdf.score + 10, 'homepage-pdf-menu');
  } else diagnostics.pages_failed.push({ url: start.href, code: root.error || `HTTP_${root.status}` });

  const sitemapCandidates = [new URL('/sitemap.xml', start).href, new URL('/sitemap_index.xml', start).href];
  for (const sitemapUrl of sitemapCandidates) {
    if (Date.now() - started > ANALYZER_BUDGET) break;
    const sm = await fetchRaw(sitemapUrl, 3500, 'application/xml,text/xml,text/plain,*/*;q=0.4');
    diagnostics.pages_attempted++;
    if (!sm.ok) continue;
    const urls = parseSitemap(sm.text, sm.url);
    for (const url of urls) addTarget(url, menuLinkScore(url), PDF_RE.test(url) ? 'sitemap-pdf' : 'sitemap');
  }

  const ranked = [...targets.values()].sort((a, b) => b.score - a.score).slice(0, MAX_PAGES);
  const nonPdf = ranked.filter(x => !PDF_RE.test(x.url)).slice(0, MAX_PAGES - MAX_PDF_TARGETS);
  const pdfs = ranked.filter(x => PDF_RE.test(x.url)).slice(0, MAX_PDF_TARGETS);
  diagnostics.menu_pages = nonPdf.filter(x => x.score >= 8).map(x => x.url);
  diagnostics.analysis_steps.push(`bounded crawl: ${ranked.length} targets`);

  let cursor = 0;
  const worker = async () => {
    while (cursor < nonPdf.length && Date.now() - started < ANALYZER_BUDGET) {
      const index = cursor++;
      const target = nonPdf[index];
      const page = await fetchRaw(target.url, REQUEST_TIMEOUT);
      diagnostics.pages_attempted++;
      if (!page.ok || !sameHost(page.url, host)) {
        diagnostics.pages_failed.push({ url: target.url, code: page.error || `HTTP_${page.status}` });
        continue;
      }
      diagnostics.pages_checked++;
      diagnostics.html_bytes += page.bytes;
      const category = (() => { const path = new URL(page.url).pathname.split('/').filter(Boolean).pop() || ''; return clean(decodeURIComponent(path.replace(/[-_]+/g, ' ')), 100); })();
      const jsonld = extractJsonLd(page.text, page.url);
      const embedded = extractEmbedded(page.text);
      const nearby = textNearPrices(page.text);
      const structural = structuralCards(page.text, page.url);
      diagnostics.jsonld_product_hits += jsonld.length;
      diagnostics.embedded_json_hits += embedded.length;
      diagnostics.nearby_product_hits += nearby.length;
      diagnostics.structural_cards += structural.length;
      diagnostics.raw_price_hits += rawPrices(page.text).length;
      for (const item of [...jsonld, ...embedded, ...structural, ...nearby]) addProduct(products, keys, item, page.url, category || 'main');
      if (products.some(p => p.source_url === page.url)) diagnostics.menu_pages_by_products.push(page.url);
      diagnostics.menu_page_evidence.push({ url: page.url, score: target.score, products: products.filter(p => p.source_url === page.url).length, title: clean(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 180) });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  if (!products.length && pdfs.length && Date.now() - started < ANALYZER_BUDGET) {
    const pdfQueue = pdfs.slice(0, MAX_PDF_TARGETS);
    diagnostics.pdf_fallback.attempted = pdfQueue.length;
    const pdfResults = await Promise.all(pdfQueue.map(pdf => fetchJina(pdf.url)));
    for (const result of pdfResults) {
      if (!result) continue;
      diagnostics.pdf_fallback.successful++;
      for (const item of extractPdfProducts(result.text, result.url)) addProduct(products, keys, item, result.url, 'main');
    }
    diagnostics.pdf_fallback.products_found = products.length;
  }

  const uniqueMenuPages = [...new Set(diagnostics.menu_pages_by_products)];
  diagnostics.menu_pages_by_products = uniqueMenuPages;
  diagnostics.products_found = products.length;
  const priceCount = products.filter(x => x.price > 0).length;
  const descCount = products.filter(x => x.description).length;
  const imageCount = products.filter(x => x.image_url).length;
  diagnostics.confidence = Math.min(100, Math.round((products.length ? 40 : 0) + (priceCount ? 20 : 0) + (descCount ? 15 : 0) + (imageCount ? 10 : 0) + (uniqueMenuPages.length ? 10 : 0) + (diagnostics.pdf_fallback.products_found ? 5 : 0)));
  diagnostics.confidence_reasons = [
    products.length ? `найдено ${products.length} позиций` : 'позиции не найдены',
    priceCount ? 'есть цены' : null,
    descCount ? 'есть описания' : null,
    imageCount ? 'есть изображения' : null,
    uniqueMenuPages.length ? `подтверждено страницами меню: ${uniqueMenuPages.length}` : null,
    diagnostics.pdf_fallback.products_found ? 'использовано PDF-меню через резервный reader' : null,
    Date.now() - started >= ANALYZER_BUDGET ? 'достигнут внутренний бюджет анализатора' : null
  ].filter(Boolean);
  diagnostics.analysis_steps.push(`extraction: ${products.length} products; confidence ${diagnostics.confidence}%`);

  return {
    ok: true,
    venue: {},
    products,
    meta: {
      name: null,
      venue_name: null,
      title: root.ok ? clean(root.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 180) : null,
      diagnostics,
      menu_found: products.length > 0,
      validation: products.length ? 'validated-multisource-catalog' : 'not_validated',
      error: products.length ? null : { code: 'MENU_NOT_FOUND', message: 'Не удалось найти позиции меню на доступных страницах' }
    }
  };
}

module.exports = { analyzeSite };