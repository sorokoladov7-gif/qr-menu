const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

const ANALYSIS_BUDGET_MS = 25000;
const MAX_RENDER_TARGETS = 6;

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function mergeProducts(existing, rendered) {
  const out = Array.isArray(existing) ? existing.map(x => ({ ...x })) : [];
  const byName = new Map();
  for (const item of out) {
    const key = normalizeName(item.name);
    if (key) byName.set(key, item);
  }

  for (const item of Array.isArray(rendered) ? rendered : []) {
    const name = String(item.name || '').replace(/\s+/g, ' ').trim();
    const image = String(item.image_url || '').trim();
    if (!name || !image) continue;
    const key = normalizeName(name);
    const existingItem = byName.get(key);
    if (existingItem) {
      if (!existingItem.image_url) existingItem.image_url = image;
      if (!existingItem.description && item.description) existingItem.description = item.description;
      if ((!existingItem.price || Number(existingItem.price) <= 0) && Number(item.price) > 0) existingItem.price = Number(item.price);
      if (!existingItem.source_url && item.source_url) existingItem.source_url = item.source_url;
      if (!existingItem.extraction_source) existingItem.extraction_source = item.source || 'rendered-dom';
      continue;
    }
    const product = {
      name,
      description: item.description || null,
      price: Number(item.price) > 0 ? Number(item.price) : 0,
      category: item.category || 'main',
      image_url: image,
      is_available: true,
      applies_to: 'all',
      source_url: item.source_url || null,
      extraction_source: item.source || 'rendered-dom'
    };
    out.push(product);
    byName.set(key, product);
  }

  // Import only dish records that contain both a name and an image.
  return out.filter(item => normalizeName(item.name) && String(item.image_url || '').trim());
}

function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { code: 'IMPORT_ERROR', message: error, details: {} };
  return {
    code: String(error.code || 'IMPORT_ERROR'),
    message: String(error.message || 'Ошибка импорта'),
    details: error.details && typeof error.details === 'object' ? error.details : {}
  };
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('IMPORT_ANALYSIS_TIMEOUT');
      error.code = 'IMPORT_ANALYSIS_TIMEOUT';
      error.status = 504;
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
    const renderTargets = [...new Set([...menuPages, ...jsPages])].slice(0, MAX_RENDER_TARGETS);

    if (renderTargets.length) {
      diagnostics.analysis_steps = Array.isArray(diagnostics.analysis_steps) ? diagnostics.analysis_steps : [];
      diagnostics.analysis_steps.push(`Browser-анализ меню: ${renderTargets.length} страниц`);
      let browserResult;
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
      diagnostics.analysis_steps.push(`Browser-анализ: ${browserResult.code || 'UNKNOWN'}`);
      result.products = mergeProducts(result.products, browserResult.products);
      diagnostics.products_found = result.products.length;
      meta.diagnostics = diagnostics;
      meta.menu_found = result.products.length > 0;
      meta.validation = result.products.length ? 'validated-browser-menu' : 'not_validated';
      meta.error = result.products.length ? null : normalizeError(meta.error);
    }

    result.products = (Array.isArray(result.products) ? result.products : []).filter(item =>
      normalizeName(item.name) && String(item.image_url || '').trim()
    );

    diagnostics.products_found = result.products.length;
    if (result.products.length) {
      meta.menu_found = true;
      meta.error = null;
      meta.validation = 'validated-name-image-menu';
    }
    return res.status(200).json(result);
  } catch (error) {
    if (error?.code === 'IMPORT_ANALYSIS_TIMEOUT') {
      return fail(504, 'IMPORT_ANALYSIS_TIMEOUT', 'Импорт сайта превысил допустимое время анализа. Попробуйте повторить анализ.', { budget_ms: ANALYSIS_BUDGET_MS });
    }
    return fail(500, 'IMPORT_RUNTIME_ERROR', 'Ошибка универсального анализатора сайта', {
      name: error?.name || 'Error',
      message: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 10)
    });
  }
};
