const { analyzeSite } = require('../lib/site-menu-analyzer');

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const fail = (status, code, message, details = {}) => res.status(status).json({ ok: false, error: { code, message, details } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return fail(400, 'URL_REQUIRED', 'Не передан адрес сайта');
  try {
    const result = await analyzeSite(raw);
    return res.status(200).json(result);
  } catch (error) {
    return fail(500, 'IMPORT_RUNTIME_ERROR', 'Ошибка универсального анализатора сайта', {
      name: error?.name || 'Error',
      message: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 10)
    });
  }
};