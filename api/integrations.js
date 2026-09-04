'use strict';

const routes = {
  '/api/integrations/iiko': '../lib/integrations/iiko',
  '/api/integrations/pos': '../lib/integrations/pos',
  '/api/integrations/saby-presto': '../lib/integrations/saby-presto',
  '/api/integrations/poster': '../lib/integrations/poster',
  '/api/integrations/syrve': '../lib/integrations/syrve',
  '/api/integrations/evotor': '../lib/integrations/evotor',
  '/api/integrations/frontpad': '../lib/integrations/frontpad',
  '/api/integrations/manage': '../lib/integrations/manage',
  '/api/integrations/test': '../lib/integrations/test'
};

module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  const modulePath = routes[pathname];
  if (!modulePath) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'integration_route_not_found', path: pathname }));
  }
  try {
    const target = require(modulePath);
    return target(req, res);
  } catch (error) {
    console.error('[integrations dispatcher]', error);
    res.statusCode = error && error.status || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: error && error.message || 'integration_dispatch_error' }));
  }
};
