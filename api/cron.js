'use strict';
/* Production cron dispatcher. Integration auto-sync is handled by lib/jobs/integration-sync.js. */
const integrationSync = require('../lib/jobs/integration-sync');

module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  if (pathname !== '/api/cron/integration-sync' && pathname !== '/api/cron') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'cron_route_not_found', path: pathname }));
  }
  return integrationSync(req, res);
};
