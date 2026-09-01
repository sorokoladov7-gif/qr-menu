'use strict';

const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

const ANALYSIS_BUDGET_MS = 55000;
const MAX_RENDER_TARGETS = 28;
const MENU_PATH_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|deserts|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|zakuski|закуск|salaty|salad|салат|soup|суп|goriachie|горяч|bluda|блюда|pasta|паста|garniry|гарнир|steak|стейк|osnovnye|основные|det|детск|children|детям)(?:[\/?#_.-]|$)/iu;
const MENU_TEXT_RE = /(?:^|\s)(меню|каталог|карта\s+меню|карта\s+блюд|цены|наше\s+меню|food\s+menu|menu|catalog)(?:\s|$)/iu;
const COMMON_MENU_PATHS = [
  'menu','menyu','catalog','catalogue','food','food-menu','menu-food','menu-list',
  'zakuski','salaty','goriachie-zakuski','goriachie-bliuda','goriachie-blyuda',
  'osnovnye-bliuda','osnovnye-blyuda','pasta','pizza','sushi','rolls','garniry',
  'steak','steiki','shashlyk','grill','myaso','ryba','soups','soup','supy',
  'desert','dessert','desserty','zavtraki','breakfast','napitki','drinks','drink',
  'bar','sauces','sousy','deti','detskoe-menu','det-menu'
];

function normalizeName(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function cleanText(value, max = 600) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function firstNonEmpty(...values) { return values.map(v => cleanText(v, 1000)).find(Boolean) || null; }
function absoluteHttp(value, baseUrl) {
  try {
    const url = new URL(String(value || ''), baseUrl);
    return /^https?:$/i.test(url.protocol) ? url.href : null;
  } catch (_) { return null; }
}
function normalizeUrl(value, baseUrl) {
  try {
    const url = new URL(String(value || ''), baseUrl);
    if (!/^https?:$/i.test(url.protocol)) return null;
    url.hash = '';
    return url.href.replace(/\/$/, '') || url.origin;
  } catch (_) { return null; }
}
function sameHost(a, b) {
  try { return new URL(a).hostname.replace(/^www\./i, '').toLowerCase() === new URL(b).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch (_) { return false; }
}
function isAsset(url) { return /\.(?:css|js|mjs|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|pdf)(?:[?#].*)?$/iu.test(String(url || '')); }
function isMenuPage(url, menuPages = []) {
  const value = String(url || '').trim().replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
  if (!value) return false;
  if (MENU_PATH_RE.test(value)) return true;
  return menuPages.some(page => {
    const p = String(page || '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
    return p && (p === value || value.startsWith(`${p}/`));
  });
}
function targetScore(url, anchorText = '', evidence = {}) {
  const value = String(url || '').toLowerCase();
  let score = 0;
  if (MENU_PATH_RE.test(value)) score += 30;
  if (MENU_TEXT_RE.test(anchorText)) score += 35;
  if (evidence.schemaMenu) score += 50;
  if (evidence.sitemap) score += 5;
  if (/(product|dish|item|food|menu|catalog|category|pizza|sushi|salad|breakfast|dessert|drink)/i.test(value)) score += 15;
  if (/(login|account|cart|checkout|privacy|terms|contact|delivery|news|blog|vacancy|career)/i.test(value)) score -= 15;
  return score;
}
function cleanMenuProduct(item) {
  const name = cleanText(item?.name, 220);
  if (!name) return null;
  const price = Number(item?.price);
  return {
    name,
    description: item?.description ? cleanText(item.description, 600) : null,
    price: Number.isFinite(price) && price > 0 ? price : 0,
    category: item?.category ? cleanText(item.category, 120) : 'main',
    image_url: item?.image_url ? String(item.image_url).trim() : null,
    is_available: true,
    applies_to: 'all'
  };
}
function mergeProducts(existing, rendered) {
  const out = [];
  const byName = new Map();
  const add = raw => {
    const product = cleanMenuProduct(raw);
    if (!product) return;
    const key = normalizeName(product.name);
    if (!key) return;
    const previous = byName.get(key);
    if (previous) {
      if (!previous.image_url && product.image_url) previous.image_url = product.image_url;
      if (!previous.description && product.description) previous.description = product.description;
      if ((!previous.price || previous.price <= 0) && product.price > 0) previous.price = product.price;
      if ((!previous.category || previous.category === 'main') && product.category) previous.category = product.category;
      return;
    }
    byName.set(key, product);
    out.push(product);
  };
  for (const item of Array.isArray(existing) ? existing : []) add(item);
  for (const item of Array.isArray(rendered) ? rendered : []) add(item);
  return out;
}
function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { code: 'IMPORT_ERROR', message: error, details: {} };
  return { code: String(error.code || 'IMPORT_ERROR'), message: String(error.message || 'Ошибка импорта'), details: error.details && typeof error.details === 'object' ? error.details : {} };
}

async function fetchText(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 QR-Menu-Site-Analyzer/40.0',
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml,application/json,text/plain,*/*;q=0.7',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) return null;
    return { url: response.url || url, contentType: response.headers.get('content-type') || '', text: (await response.text()).slice(0, 8 * 1024 * 1024) };
  } catch (_) { return null; }
  finally { clearTimeout(timer); }
}

function parseLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu;
  let match;
  while ((match = re.exec(String(html || ''))) && out.length < 800) {
    const url = normalizeUrl(match[1], baseUrl);
    if (!url || !sameHost(url, baseUrl) || isAsset(url)) continue;
    const text = cleanText(String(match[2]).replace(/<[^>]+>/g, ' '), 180);
    out.push({ url, text, score: targetScore(url, text) });
  }
  return out;
}

function parseSitemap(xml, baseUrl) {
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/giu;
  let match;
  while ((match = re.exec(String(xml || ''))) && out.length < 1200) {
    const url = normalizeUrl(match[1], baseUrl);
    if (url && sameHost(url, baseUrl) && !isAsset(url)) out.push(url);
  }
  return [...new Set(out)];
}

function parseRobotsSitemaps(text, baseUrl) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap\s*:\s*(\S+)/iu);
    if (match) {
      const url = normalizeUrl(match[1], baseUrl);
      if (url && sameHost(url, baseUrl)) out.push(url);
    }
  }
  return [...new Set(out)];
}

function parseJsonLdNodes(html, baseUrl) {
  const nodes = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  let match;
  while ((match = re.exec(String(html || '')))) {
    try {
      const value = JSON.parse(match[1].trim());
      const walk = node => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node !== 'object') return;
        nodes.push(node);
        if (Array.isArray(node['@graph'])) node['@graph'].forEach(walk);
        Object.values(node).forEach(value => {
          if (value && typeof value === 'object') walk(value);
        });
      };
      walk(value);
    } catch (_) {}
  }
  return nodes;
}

function parseSchemaMenuTargets(html, baseUrl) {
  const targets = [];
  const nodes = parseJsonLdNodes(html, baseUrl);
  const push = value => {
    if (typeof value !== 'string') return;
    const url = normalizeUrl(value, baseUrl);
    if (url && sameHost(url, baseUrl)) targets.push({ url, score: 80, reason: 'schema-menu-url' });
  };
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
    if (/(restaurant|cafe|bar|foodestablishment)/i.test(type)) {
      const menu = node.hasMenu || node.menu;
      if (typeof menu === 'string') push(menu);
      else if (menu && typeof menu === 'object') {
        push(menu.url);
        push(menu['@id']);
      }
    }
    if (/(menu|menusection)/i.test(type)) push(node.url);
    Object.values(node).forEach(value => {
      if (value && typeof value === 'object') walk(value);
    });
  };
  nodes.forEach(walk);
  return targets;
}

function parseJsonLdIdentity(html, baseUrl) {
  const identity = { name: null, description: null, address: null, phone: null, logo_url: null, opening_hours: null, cuisine: [], sources: [] };
  const nodes = parseJsonLdNodes(html, baseUrl);
  const addressText = a => {
    if (!a) return null;
    if (typeof a === 'string') return cleanText(a, 300);
    return [a.streetAddress, a.postalCode, a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(', ');
  };
  for (const item of nodes) {
    const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : String(item['@type'] || '');
    if (!/(restaurant|cafe|bar|foodestablishment|localbusiness|organization)/i.test(type)) continue;
    identity.name ||= firstNonEmpty(item.name);
    identity.description ||= firstNonEmpty(item.description);
    identity.address ||= addressText(item.address);
    identity.phone ||= firstNonEmpty(item.telephone, item.phone);
    identity.opening_hours ||= item.openingHours || item.openingHoursSpecification || null;
    const logo = typeof item.logo === 'object' ? item.logo?.url : item.logo;
    const image = typeof item.image === 'object' ? item.image?.url : item.image;
    identity.logo_url ||= absoluteHttp(logo || image, baseUrl);
    const cuisine = Array.isArray(item.servesCuisine) ? item.servesCuisine : [item.servesCuisine];
    identity.cuisine.push(...cuisine.filter(Boolean).map(x => cleanText(x, 80)));
    identity.sources.push('json-ld');
  }
  identity.cuisine = [...new Set(identity.cuisine)];
  identity.sources = [...new Set(identity.sources)];
  return identity;
}

async function discoverSite(rawUrl, diagnostics) {
  const start = normalizeUrl(rawUrl, rawUrl);
  const candidates = new Map();
  const add = (url, score, reason, anchor = '') => {
    const normalized = normalizeUrl(url, start);
    if (!normalized || !sameHost(normalized, start) || isAsset(normalized)) return;
    const existing = candidates.get(normalized);
    const entry = { url: normalized, score: Number(score || 0), reasons: existing?.reasons || [], anchor: existing?.anchor || anchor };
    if (reason && !entry.reasons.includes(reason)) entry.reasons.push(reason);
    entry.score = Math.max(entry.score, Number(score || 0));
    candidates.set(normalized, entry);
  };

  add(start, 1, 'start');
  for (const path of COMMON_MENU_PATHS) add(`${start}/${path}`, 25, 'common-menu-path');

  const root = await fetchText(start, 8000);
  if (root) {
    const identity = parseJsonLdIdentity(root.text, root.url);
    diagnostics.site_discovery.identity = identity;
    for (const item of parseLinks(root.text, root.url)) add(item.url, item.score, 'homepage-link', item.text);
    for (const item of parseSchemaMenuTargets(root.text, root.url)) add(item.url, item.score, item.reason);
    diagnostics.site_discovery.homepage_links = parseLinks(root.text, root.url).length;
    diagnostics.site_discovery.schema_menu_targets = parseSchemaMenuTargets(root.text, root.url).map(x => x.url);
  }

  const robots = await fetchText(new URL('/robots.txt', start).href, 5000);
  const sitemapUrls = new Set();
  if (robots) parseRobotsSitemaps(robots.text, start).forEach(x => sitemapUrls.add(x));
  sitemapUrls.add(new URL('/sitemap.xml', start).href);
  sitemapUrls.add(new URL('/sitemap_index.xml', start).href);
  diagnostics.site_discovery.sitemaps_checked = [];
  diagnostics.site_discovery.sitemap_urls_found = [];

  for (const sitemapUrl of sitemapUrls) {
    const sitemap = await fetchText(sitemapUrl, 6000);
    if (!sitemap) continue;
    diagnostics.site_discovery.sitemaps_checked.push(sitemapUrl);
    const urls = parseSitemap(sitemap.text, sitemap.url);
    diagnostics.site_discovery.sitemap_urls_found.push(...urls);
    for (const url of urls) add(url, targetScore(url, '', { sitemap: true }), 'sitemap');
    if (urls.length) {
      const nested = urls.filter(url => /sitemap/i.test(url)).slice(0, 8);
      for (const nestedUrl of nested) {
        const child = await fetchText(nestedUrl, 5000);
        if (!child) continue;
        for (const url of parseSitemap(child.text, nestedUrl)) add(url, targetScore(url, '', { sitemap: true }), 'nested-sitemap');
      }
    }
  }

  diagnostics.site_discovery.candidate_count = candidates.size;
  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 120);
}

function fallbackMenuTargets(raw, diagnostics) {
  const base = String(raw || '').replace(/#.*$/, '').replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) return [];
  const discovered = [];
  const push = value => {
    const url = normalizeUrl(value, base);
    if (url && !discovered.includes(url)) discovered.push(url);
  };
  for (const url of Array.isArray(diagnostics?.menu_pages) ? diagnostics.menu_pages : []) push(url);
  for (const url of Array.isArray(diagnostics?.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : []) push(url);
  for (const item of Array.isArray(diagnostics?.site_discovery?.candidates) ? diagnostics.site_discovery.candidates : []) push(item.url);
  for (const path of COMMON_MENU_PATHS) push(`${base}/${path}`);
  return discovered;
}

async function analyzeVenueIdentity(rawUrl, discoveryIdentity = null) {
  const base = discoveryIdentity || {};
  try {
    const response = await fetchText(rawUrl, 8000);
    if (!response) return base;
    const html = response.text;
    const identity = parseJsonLdIdentity(html, response.url || rawUrl);
    const meta = name => {
      const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${safe}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
      return html.match(re)?.[1] || null;
    };
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null;
    const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const addressMatch = bodyText.match(/(?:адрес|address|г\.|город|city)\s*[:\-]?\s*([^|]{8,180}?)(?=\s+(?:тел|phone|режим|время|часы|email|e-mail)\b|$)/iu);
    const logo = html.match(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || null;
    return {
      name: firstNonEmpty(identity.name, base.name, meta('og:site_name'), meta('application-name'), title?.replace(/\s*[|—-]\s*(меню|menu|доставка|официальный сайт).*$/iu, '')),
      description: firstNonEmpty(identity.description, base.description, meta('description'), meta('og:description')),
      address: firstNonEmpty(identity.address, base.address, meta('street-address'), addressMatch?.[1]),
      phone: firstNonEmpty(identity.phone, base.phone, meta('telephone')),
      logo_url: identity.logo_url || base.logo_url || absoluteHttp(meta('og:image'), response.url || rawUrl) || absoluteHttp(logo, response.url || rawUrl),
      opening_hours: identity.opening_hours || base.opening_hours || null,
      cuisine: [...new Set([...(base.cuisine || []), ...(identity.cuisine || [])])],
      sources: [...new Set([...(base.sources || []), ...(identity.sources || []), 'meta/title'])]
    };
  } catch (_) { return base; }
}

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const fail = (status, code, message, details = {}) => res.status(status).json({ ok: false, error: { code, message, details } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return fail(400, 'URL_REQUIRED', 'Не передан адрес сайта');

  try {
    const discoveryDiagnostics = { site_discovery: { candidates: [], identity: null, homepage_links: 0, schema_menu_targets: [], sitemaps_checked: [], sitemap_urls_found: [] } };
    const discovery = await discoverSite(raw, discoveryDiagnostics);
    discoveryDiagnostics.site_discovery.candidates = discovery;

    const [result, identity] = await Promise.all([
      withTimeout(analyzeSite(raw), ANALYSIS_BUDGET_MS),
      analyzeVenueIdentity(raw, discoveryDiagnostics.site_discovery.identity)
    ]);

    const meta = result.meta || (result.meta = {});
    const diagnostics = meta.diagnostics || (meta.diagnostics = {});
    diagnostics.site_discovery = discoveryDiagnostics.site_discovery;
    diagnostics.analysis_steps = Array.isArray(diagnostics.analysis_steps) ? diagnostics.analysis_steps : [];
    diagnostics.analysis_steps.push(`Site reconnaissance: ${discovery.length} кандидатов страниц`);
    diagnostics.analysis_steps.push(`Sitemap: найдено ${discoveryDiagnostics.site_discovery.sitemap_urls_found.length} URL`);
    diagnostics.analysis_steps.push(`Schema.org menu: найдено ${discoveryDiagnostics.site_discovery.schema_menu_targets.length} прямых ссылок на меню`);

    const jsPages = Array.isArray(diagnostics.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : [];
    const menuPages = Array.isArray(diagnostics.menu_pages) ? diagnostics.menu_pages : [];
    const discoveredTargets = discovery.map(item => item.url);
    const highValueTargets = discovery.filter(item => item.score >= 20).map(item => item.url);
    const fallbackTargets = fallbackMenuTargets(raw, diagnostics);

    const renderTargets = [...new Set([
      ...highValueTargets,
      ...menuPages,
      ...jsPages,
      ...fallbackTargets,
      ...discoveredTargets
    ])].filter(url => sameHost(url, raw)).slice(0, MAX_RENDER_TARGETS);

    diagnostics.analysis_steps.push(`Adaptive browser crawl: ${renderTargets.length} приоритетных URL`);

    let browserResult = { ok: false, code: 'NOT_RUN', products: [], diagnostics: {} };
    try {
      const { renderMenuPages } = require('../lib/site-browser-renderer-v2');
      browserResult = await renderMenuPages(renderTargets);
    } catch (browserLoadError) {
      browserResult = {
        ok: false,
        code: 'BROWSER_DEPENDENCY_FAILED',
        products: [],
        diagnostics: {
          error_name: browserLoadError?.name || 'Error',
          error_message: String(browserLoadError?.message || browserLoadError),
          stack: String(browserLoadError?.stack || '').split('\n').slice(0, 12)
        }
      };
    }

    diagnostics.browser_render = browserResult.diagnostics || {};
    diagnostics.browser_render_code = browserResult.code || null;
    diagnostics.browser_products_found = Array.isArray(browserResult.products) ? browserResult.products.length : 0;
    diagnostics.analysis_steps.push(`Adaptive browser crawl: ${browserResult.code || 'UNKNOWN'}; найдено ${diagnostics.browser_products_found} позиций`);
    if (Array.isArray(browserResult.diagnostics?.discovered_menu_links) && browserResult.diagnostics.discovered_menu_links.length) {
      diagnostics.analysis_steps.push(`Динамически обнаружено ссылок меню: ${browserResult.diagnostics.discovered_menu_links.length}`);
    }

    result.products = mergeProducts(result.products, browserResult.products);
    diagnostics.products_found = result.products.length;
    diagnostics.venue_identity = identity;
    diagnostics.product_sources = [...new Set(result.products.map(x => x?.extraction_source).filter(Boolean))];
    diagnostics.discovery_strategy = 'entity-catalog-multisource-v40';

    const evidenceScore = Math.min(100, Math.round(
      (result.products.length ? 35 : 0) +
      (result.products.filter(x => x.price > 0).length ? 20 : 0) +
      (result.products.filter(x => x.description).length ? 15 : 0) +
      (result.products.filter(x => x.image_url).length ? 15 : 0) +
      (discoveryDiagnostics.site_discovery.schema_menu_targets.length ? 10 : 0) +
      (discoveryDiagnostics.site_discovery.sitemap_urls_found.length ? 5 : 0)
    ));
    diagnostics.confidence = evidenceScore;
    diagnostics.confidence_reasons = [
      result.products.length ? `найдено ${result.products.length} структурированных позиций` : 'позиции не найдены',
      result.products.some(x => x.price > 0) ? 'есть ценовые доказательства' : null,
      result.products.some(x => x.description) ? 'есть описания' : null,
      result.products.some(x => x.image_url) ? 'есть изображения' : null,
      discoveryDiagnostics.site_discovery.schema_menu_targets.length ? 'обнаружена Schema.org связь с меню' : null,
      discoveryDiagnostics.site_discovery.sitemap_urls_found.length ? 'использован sitemap' : null
    ].filter(Boolean);

    meta.diagnostics = diagnostics;
    meta.menu_found = result.products.length > 0;
    meta.validation = result.products.length ? 'validated-multisource-catalog' : 'not_validated';
    meta.error = result.products.length ? null : normalizeError(meta.error);

    const sourceVenue = result.venue || {};
    const venue = {
      name: firstNonEmpty(identity.name, sourceVenue.name, meta.name, meta.venue_name, meta.title),
      description: firstNonEmpty(identity.description, sourceVenue.description),
      address: firstNonEmpty(identity.address, sourceVenue.address, meta.address, meta.venue_address),
      phone: firstNonEmpty(identity.phone, sourceVenue.phone),
      website_url: sourceVenue.website_url || raw,
      logo_url: identity.logo_url || sourceVenue.logo_url || null,
      opening_hours: identity.opening_hours || sourceVenue.opening_hours || null,
      cuisine: identity.cuisine || []
    };

    return res.status(200).json({
      ok: true,
      venue,
      products: result.products,
      meta: {
        menu_found: Boolean(meta.menu_found),
        products_found: result.products.length,
        validation: meta.validation,
        confidence: Number(diagnostics.confidence || 0),
        confidence_reasons: Array.isArray(diagnostics.confidence_reasons) ? diagnostics.confidence_reasons : [],
        diagnostics,
        source_url: raw
      }
    });
  } catch (error) {
    if (error?.code === 'IMPORT_ANALYSIS_TIMEOUT') return fail(504, 'IMPORT_ANALYSIS_TIMEOUT', 'Импорт сайта превысил допустимое время анализа. Попробуйте повторить анализ.', { budget_ms: ANALYSIS_BUDGET_MS });
    return fail(500, 'IMPORT_RUNTIME_ERROR', 'Ошибка универсального анализатора сайта', { name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '').split('\n').slice(0, 10) });
  }
};

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { const error = new Error('IMPORT_ANALYSIS_TIMEOUT'); error.code = 'IMPORT_ANALYSIS_TIMEOUT'; error.status = 504; reject(error); }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
