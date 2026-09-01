'use strict';

const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

const ANALYSIS_BUDGET_MS = 55000;
const MAX_RENDER_TARGETS = 12;
const MENU_PATH_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|deserts|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|zakuski|закуск|salaty|salad|салат|soup|суп|goriachie|горяч|bluda|блюда|pasta|паста|garniry|гарнир|steak|стейк|osnovnye|основные|det|детск|children|детям)(?:[\/?#_.-]|$)/iu;

const COMMON_MENU_PATHS = [
  'menu', 'menyu', 'catalog', 'catalogue', 'food', 'food-menu', 'menu-food', 'menu-list',
  'zakuski', 'salaty', 'goriachie-zakuski', 'goriachie-bliuda', 'goriachie-blyuda',
  'osnovnye-bliuda', 'osnovnye-blyuda', 'pasta', 'pizza', 'sushi', 'rolls', 'garniry',
  'steak', 'steiki', 'shashlyk', 'grill', 'myaso', 'ryba', 'soups', 'soup', 'supy',
  'desert', 'dessert', 'desserty', 'zavtraki', 'breakfast', 'napitki', 'drinks', 'drink',
  'bar', 'sauces', 'sousy', 'deti', 'detskoe-menu', 'det-menu'
];

function normalizeName(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function isMenuPage(url, menuPages) {
  const value = String(url || '').trim();
  if (!value) return false;
  const normalized = value.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
  if (MENU_PATH_RE.test(normalized)) return true;
  return menuPages.some(page => {
    const p = String(page || '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
    return p && (p === normalized || normalized.startsWith(`${p}/`));
  });
}
function cleanMenuProduct(item) {
  const name = String(item?.name || '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const price = Number(item?.price);
  return { name, description: item?.description ? String(item.description).replace(/\s+/g, ' ').trim().slice(0, 600) : null, price: Number.isFinite(price) && price > 0 ? price : 0, category: item?.category ? String(item.category).replace(/\s+/g, ' ').trim().slice(0, 120) : 'main', image_url: item?.image_url ? String(item.image_url).trim() : null, is_available: true, applies_to: 'all' };
}
function mergeProducts(existing, rendered, menuPages) {
  const out = [];
  const byName = new Map();
  const add = raw => {
    if (!raw) return;
    const sourceUrl = String(raw.source_url || '').trim();
    if (!isMenuPage(sourceUrl, menuPages)) return;
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
function fallbackMenuTargets(raw, diagnostics) {
  const base = String(raw || '').replace(/#.*$/, '').replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) return [];
  const discovered = [];
  const push = value => {
    if (!value) return;
    try {
      const url = new URL(value, `${base}/`).href.replace(/#.*$/, '').replace(/\/$/, '');
      if (url === base || !discovered.includes(url)) discovered.push(url);
    } catch (_) {}
  };
  for (const url of Array.isArray(diagnostics?.menu_pages) ? diagnostics.menu_pages : []) push(url);
  for (const url of Array.isArray(diagnostics?.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : []) push(url);
  for (const path of COMMON_MENU_PATHS) push(`${base}/${path}`);
  return discovered;
}

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const fail = (status, code, message, details = {}) => res.status(status).json({ ok: false, error: { code, message, details } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return fail(400, 'URL_REQUIRED', 'Не передан адрес сайта');

  try {
    const result = await withTimeout(analyzeSite(raw), ANALYSIS_BUDGET_MS);
    const meta = result.meta || (result.meta = {});
    const diagnostics = meta.diagnostics || (meta.diagnostics = {});
    const jsPages = Array.isArray(diagnostics.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : [];
    const menuPages = Array.isArray(diagnostics.menu_pages) ? diagnostics.menu_pages : [];
    const productSourcePages = Array.isArray(result.products) ? result.products.map(item => item && item.source_url).filter(Boolean) : [];
    const effectiveMenuPages = [...new Set([...menuPages, ...productSourcePages.filter(url => isMenuPage(url, menuPages))])];

    let fallbackTargets = [];
    if (!result.products.length) {
      fallbackTargets = fallbackMenuTargets(raw, diagnostics);
      diagnostics.analysis_steps = Array.isArray(diagnostics.analysis_steps) ? diagnostics.analysis_steps : [];
      diagnostics.analysis_steps.push(`Расширенный резервный поиск меню: ${fallbackTargets.length} URL-кандидатов`);
    }

    const renderTargets = [...new Set([...effectiveMenuPages, ...jsPages, ...fallbackTargets])].slice(0, MAX_RENDER_TARGETS);
    if (renderTargets.length) {
      diagnostics.analysis_steps = Array.isArray(diagnostics.analysis_steps) ? diagnostics.analysis_steps : [];
      diagnostics.analysis_steps.push(`Adaptive browser crawl: ${renderTargets.length} стартовых страниц`);
      let browserResult;
      try {
        const { renderMenuPages } = require('../lib/site-browser-renderer-v2');
        browserResult = await renderMenuPages(renderTargets);
      } catch (browserLoadError) {
        browserResult = { ok: false, code: 'BROWSER_DEPENDENCY_FAILED', products: [], diagnostics: { error_name: browserLoadError?.name || 'Error', error_message: String(browserLoadError?.message || browserLoadError), stack: String(browserLoadError?.stack || '').split('\n').slice(0, 12) } };
      }
      diagnostics.browser_render = browserResult.diagnostics || {};
      diagnostics.browser_render_code = browserResult.code || null;
      diagnostics.browser_products_found = Array.isArray(browserResult.products) ? browserResult.products.length : 0;
      diagnostics.analysis_steps.push(`Adaptive browser crawl: ${browserResult.code || 'UNKNOWN'}; найдено ${diagnostics.browser_products_found} позиций`);
      if (Array.isArray(browserResult.diagnostics?.discovered_menu_links) && browserResult.diagnostics.discovered_menu_links.length) diagnostics.analysis_steps.push(`Динамически обнаружено разделов меню: ${browserResult.diagnostics.discovered_menu_links.length}`);
      result.products = mergeProducts(result.products, browserResult.products, effectiveMenuPages.concat(renderTargets));
    } else {
      result.products = mergeProducts(result.products, [], effectiveMenuPages);
    }

    diagnostics.products_found = result.products.length;
    meta.diagnostics = diagnostics;
    meta.menu_found = result.products.length > 0;
    meta.validation = result.products.length ? 'validated-menu-pages-only' : 'not_validated';
    meta.error = result.products.length ? null : normalizeError(meta.error);

    const sourceVenue = result.venue || {};
    const venue = { name: sourceVenue.name || meta.name || meta.venue_name || meta.title || null, description: sourceVenue.description || null, address: sourceVenue.address || meta.address || meta.venue_address || null, phone: sourceVenue.phone || null, website_url: sourceVenue.website_url || raw, logo_url: sourceVenue.logo_url || null, opening_hours: sourceVenue.opening_hours || null };
    return res.status(200).json({ ok: true, venue, products: result.products, meta: { menu_found: Boolean(meta.menu_found), products_found: result.products.length, validation: meta.validation, confidence: Number(diagnostics.confidence || 0), confidence_reasons: Array.isArray(diagnostics.confidence_reasons) ? diagnostics.confidence_reasons : [], diagnostics, source_url: raw } });
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
