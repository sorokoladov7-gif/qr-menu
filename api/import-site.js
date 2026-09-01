'use strict';

const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

const ANALYSIS_BUDGET_MS = 30000;
const BROWSER_FALLBACK_MS = 12000;
const LEARNING_MIN_CONFIDENCE = 0.65;
const LEARNING_MAX_PATTERNS = 80;
const LEARNING_MAX_WRITES = 60;

function clean(value, max = 800) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function firstNonEmpty(...values) { return values.map(v => clean(v, 1200)).find(Boolean) || null; }
function domainOf(value) { try { return new URL(value).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } }
function normalizeName(value) { return clean(value, 300).toLowerCase(); }
function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { code: 'IMPORT_ERROR', message: error, details: {} };
  return { code: String(error.code || 'IMPORT_ERROR'), message: String(error.message || 'Ошибка импорта'), details: error.details && typeof error.details === 'object' ? error.details : {} };
}

function learningGateway() {
  const url = firstNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  return url ? String(url).replace(/\/$/, '') : null;
}
async function learningCall(req, action, payload) {
  const base = learningGateway();
  const auth = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  if (!base || !auth) return null;
  try {
    const response = await fetch(`${base}/functions/v1/site-analyzer-learning`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (_) { return null; }
}

function evaluateProduct(product) {
  const evidence = [];
  if (product?.name) evidence.push('name');
  if (Number(product?.price) > 0) evidence.push('price');
  if (product?.description) evidence.push('description');
  if (product?.image_url) evidence.push('image');
  if (product?.category && product.category !== 'main') evidence.push('category');
  if (product?.extraction_source) evidence.push(`source:${product.extraction_source}`);
  let confidence = 25 + evidence.filter(x => !x.startsWith('source:')).length * 14;
  if (product?.extraction_source) confidence += 8;
  confidence = Math.min(100, confidence);
  const level = confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low';
  product.import_confidence = confidence;
  product.import_confidence_level = level;
  product.import_confidence_reasons = evidence;
  return { confidence, level, evidence };
}
function evaluateProducts(products) {
  const stats = { high: 0, medium: 0, low: 0 };
  for (const product of Array.isArray(products) ? products : []) stats[evaluateProduct(product).level] += 1;
  return stats;
}
function buildObservations(products, diagnostics) {
  const out = [];
  const push = (type, key, value, success = true, scope = 'global', domain = null) => {
    if (!key || out.length >= LEARNING_MAX_WRITES) return;
    out.push({ pattern_type: type, pattern_key: String(key).slice(0, 500), pattern_value: value || {}, success, scope, domain });
  };
  const counts = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const source = String(product?.extraction_source || 'generic').toLowerCase();
    counts.set(source, (counts.get(source) || 0) + 1);
    const ev = evaluateProduct({ ...product });
    push('card_structure', `card:${source}`, { extraction_source: source, fields: ev.evidence.filter(x => !x.startsWith('source:')) }, ev.confidence >= 50);
    push('name_selector', `name:${source}`, { extraction_source: source }, Boolean(product?.name));
    push('price_selector', `price:${source}`, { extraction_source: source }, Number(product?.price) > 0);
    push('description_selector', `description:${source}`, { extraction_source: source }, Boolean(product?.description));
    push('image_selector', `image:${source}`, { extraction_source: source }, Boolean(product?.image_url));
  }
  const menuPages = Array.isArray(diagnostics?.menu_pages_by_products) ? diagnostics.menu_pages_by_products : [];
  for (const url of menuPages.slice(0, 20)) {
    try { const path = new URL(url).pathname.toLowerCase(); push('menu_link', `menu:${path}`, { path }, true); } catch (_) {}
  }
  for (const [source, count] of counts.entries()) if (count >= 2) push('platform_signature', `platform:${source}`, { extraction_source: source, observed_products: count }, true);
  return out;
}
async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('IMPORT_TIMEOUT'), { code: 'IMPORT_TIMEOUT' })), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
}

async function venueIdentity(rawUrl) {
  try {
    const response = await fetch(rawUrl, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 QR-Menu-Identity/42.0', accept: 'text/html,*/*;q=0.5' } });
    if (!response.ok) return {};
    const html = (await response.text()).slice(0, 2 * 1024 * 1024);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null;
    const description = html.match(/<meta[^>]+(?:property|name)=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || null;
    const ogImage = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || null;
    return { name: firstNonEmpty(title), description: firstNonEmpty(description), logo_url: ogImage || null, sources: ['meta/title'] };
  } catch (_) { return {}; }
}

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const fail = (status, code, message, details = {}) => res.status(status).json({ ok: false, error: { code, message, details } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return fail(400, 'URL_REQUIRED', 'Не передан адрес сайта');
  const sourceUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const started = Date.now();

  try {
    const domain = domainOf(sourceUrl);
    if (!domain) return fail(400, 'INVALID_URL', 'Некорректный адрес сайта');

    let learningLoaded = null;
    let learningPatterns = [];
    try {
      learningLoaded = await learningCall(req, 'load', { domain, min_confidence: LEARNING_MIN_CONFIDENCE, limit: LEARNING_MAX_PATTERNS });
      learningPatterns = Array.isArray(learningLoaded?.patterns) ? learningLoaded.patterns : [];
    } catch (_) {}

    let result;
    try { result = await withTimeout(analyzeSite(sourceUrl), ANALYSIS_BUDGET_MS); }
    catch (error) { result = { ok: false, products: [], meta: { diagnostics: { error: error?.code || error?.message || 'ANALYZER_FAILED' } } }; }

    const diagnostics = result.meta?.diagnostics || {};
    const initialProducts = Array.isArray(result.products) ? result.products : [];
    let products = initialProducts;

    diagnostics.source_url = sourceUrl;
    diagnostics.learning = { enabled: Boolean(learningLoaded), patterns_loaded: learningPatterns.length, patterns_reused: learningPatterns.length };

    if (!products.length && diagnostics.blocked_pages === 0 && Date.now() - started < ANALYSIS_BUDGET_MS - BROWSER_FALLBACK_MS) {
      try {
        const { renderMenuPages } = require('../lib/site-browser-renderer-v2');
        const candidates = Array.isArray(diagnostics.menu_pages) ? diagnostics.menu_pages.slice(0, 6) : [];
        if (candidates.length) {
          const browserResult = await withTimeout(renderMenuPages(candidates), BROWSER_FALLBACK_MS);
          const browserProducts = Array.isArray(browserResult?.products) ? browserResult.products : [];
          const seen = new Set(products.map(x => normalizeName(x?.name)).filter(Boolean));
          products = [...products];
          for (const item of browserProducts) { const key = normalizeName(item?.name); if (key && !seen.has(key)) { seen.add(key); products.push(item); } }
          diagnostics.browser_render_code = browserResult?.code || null;
          diagnostics.browser_products_found = browserProducts.length;
        }
      } catch (error) { diagnostics.browser_render_code = error?.code || 'BROWSER_FALLBACK_FAILED'; }
    }

    result.products = products;
    const stats = evaluateProducts(products);
    diagnostics.products_found = products.length;
    diagnostics.product_confidence = stats;
    diagnostics.analysis_duration_ms = Date.now() - started;
    diagnostics.discovery_strategy = 'single-pass-bounded-analyzer-v42';

    const identity = await venueIdentity(sourceUrl);
    const sourceVenue = result.venue || {};
    const venue = {
      name: firstNonEmpty(identity.name, sourceVenue.name, result.meta?.title, result.meta?.name),
      description: firstNonEmpty(identity.description, sourceVenue.description),
      address: firstNonEmpty(sourceVenue.address),
      phone: firstNonEmpty(sourceVenue.phone),
      website_url: sourceVenue.website_url || sourceUrl,
      logo_url: identity.logo_url || sourceVenue.logo_url || null,
      opening_hours: sourceVenue.opening_hours || null,
      cuisine: Array.isArray(sourceVenue.cuisine) ? sourceVenue.cuisine : []
    };

    const observations = buildObservations(products, diagnostics);
    const learned = await learningCall(req, 'learn', { observations, run: {
      domain, source_url: sourceUrl, products_high: stats.high, products_medium: stats.medium, products_low: stats.low,
      patterns_discovered: observations.length, patterns_reused: learningPatterns.length,
      diagnostics: { duration_ms: diagnostics.analysis_duration_ms, products: products.length, confidence: diagnostics.confidence || 0 }
    }});
    diagnostics.learning.patterns_discovered = observations.length;
    diagnostics.learning.patterns_written = Number(learned?.written || 0);
    diagnostics.learning.run_recorded = Boolean(learned?.run_recorded);

    const confidence = Math.min(100, Math.round(
      (products.length ? 40 : 0) +
      (products.some(x => x.price > 0) ? 20 : 0) +
      (products.some(x => x.description) ? 15 : 0) +
      (products.some(x => x.image_url) ? 10 : 0) +
      (diagnostics.menu_pages_by_products?.length ? 10 : 0) +
      (diagnostics.pdf_fallback?.products_found ? 5 : 0)
    ));
    diagnostics.confidence = confidence;
    diagnostics.confidence_reasons = [
      products.length ? `найдено ${products.length} позиций` : 'позиции не найдены',
      products.some(x => x.price > 0) ? 'есть цены' : null,
      products.some(x => x.description) ? 'есть описания' : null,
      products.some(x => x.image_url) ? 'есть изображения' : null,
      diagnostics.blocked_pages ? `обнаружено антибот-блокировок: ${diagnostics.blocked_pages}` : null
    ].filter(Boolean);

    result.meta = result.meta || {};
    result.meta.diagnostics = diagnostics;
    result.meta.menu_found = products.length > 0;
    result.meta.validation = products.length ? 'validated-multisource-catalog' : 'not_validated';
    result.meta.error = products.length ? null : normalizeError(result.meta.error);

    return res.status(200).json({ ok: true, venue, products, meta: {
      menu_found: products.length > 0,
      products_found: products.length,
      validation: result.meta.validation,
      confidence,
      confidence_reasons: diagnostics.confidence_reasons,
      diagnostics,
      source_url: sourceUrl
    }});
  } catch (error) {
    return fail(500, 'IMPORT_RUNTIME_ERROR', 'Ошибка универсального анализатора сайта', { message: String(error?.message || error) });
  }
};