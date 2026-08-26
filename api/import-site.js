const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

function mergeProducts(existing, rendered) {
  const out = Array.isArray(existing) ? existing.slice() : [];
  const keys = new Set(out.map(x => String(x.name || '').trim().toLowerCase()).filter(Boolean));
  for (const item of Array.isArray(rendered) ? rendered : []) {
    const key = String(item.name || '').trim().toLowerCase();
    if (!key || keys.has(key)) continue;
    keys.add(key);
    out.push({
      name: item.name,
      description: item.description || null,
      price: Number(item.price) || 0,
      category: item.category || 'main',
      image_url: item.image_url || null,
      is_available: true,
      applies_to: 'all',
      source_url: item.source_url || null,
      extraction_source: item.source || 'rendered-dom'
    });
  }
  return out;
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

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const fail = (status, code, message, details = {}) => res.status(status).json({ ok: false, error: { code, message, details } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return fail(400, 'URL_REQUIRED', 'Не передан адрес сайта');

  try {
    const result = await analyzeSite(raw);
    const meta = result.meta || (result.meta = {});
    const diagnostics = meta.diagnostics || (meta.diagnostics = {});
    const jsPages = Array.isArray(diagnostics.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : [];
    const menuPages = Array.isArray(diagnostics.menu_pages) ? diagnostics.menu_pages : [];

    // Сначала рендерим реальные страницы меню, затем JS-кандидатов. Главная
    // больше не должна автоматически попадать в browser-render только потому,
    // что в её JS-коде встретилось слово menu.
    const renderTargets = [...new Set([...menuPages, ...jsPages])].slice(0, 5);
    const shouldRender = Boolean(diagnostics.js_render?.required || !Array.isArray(result.products) || result.products.length < 5);

    if (shouldRender && renderTargets.length) {
      diagnostics.analysis_steps = Array.isArray(diagnostics.analysis_steps) ? diagnostics.analysis_steps : [];
      diagnostics.analysis_steps.push(`Запуск browser-rendering: ${renderTargets.length} страниц`);
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
      diagnostics.analysis_steps.push(`Browser-rendering: ${browserResult.code || 'UNKNOWN'}`);

      if (browserResult.ok) {
        result.products = mergeProducts(result.products, browserResult.products);
        diagnostics.products_found = result.products.length;
        if (result.products.length >= 5) {
          meta.menu_found = true;
          meta.validation = 'validated-browser-rendered';
          meta.error = null;
        }
      }

      if (result.products.length < 5) {
        if (browserResult.code === 'BROWSER_ENGINE_FAILED' || browserResult.code === 'BROWSER_DEPENDENCY_FAILED') {
          meta.error = {
            code: 'MENU_BROWSER_RENDER_FAILED',
            message: 'Меню требует браузерного JavaScript-анализа, но серверный Chromium недоступен.',
            details: { browser_code: browserResult.code, browser: browserResult.diagnostics || {}, original: normalizeError(meta.error) }
          };
        } else if (diagnostics.js_render?.required) {
          meta.error = {
            code: 'MENU_JS_RENDERED_NOT_EXTRACTED',
            message: 'Страница была обработана браузером, но товарные позиции не удалось извлечь.',
            details: { browser: browserResult.diagnostics || {}, original: normalizeError(meta.error) }
          };
        }
      }
      meta.diagnostics = diagnostics;
    }

    return res.status(200).json(result);
  } catch (error) {
    return fail(500, 'IMPORT_RUNTIME_ERROR', 'Ошибка универсального анализатора сайта', {
      name: error?.name || 'Error',
      message: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 10)
    });
  }
};
