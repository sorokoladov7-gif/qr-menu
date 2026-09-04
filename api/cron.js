'use strict';
module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  if (pathname !== '/api/cron/integration-sync' && pathname !== '/api/cron') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'cron_route_not_found', path: pathname }));
  }
  try {
    const target = require('../lib/cron/integration-sync');
    return target(req, res);
  } catch (error) {
    console.error('[cron dispatcher]', error);
    res.statusCode = error && error.status || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: error && error.message || 'cron_dispatch_error' }));
  }
};
