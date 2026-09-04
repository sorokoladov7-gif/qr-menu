'use strict';

const handlers = {
  '/api/integrations/iiko': require('../lib/integrations/iiko'),
  '/api/integrations/pos': require('../lib/integrations/pos'),
  '/api/integrations/saby-presto': require('../lib/integrations/saby-presto'),
  '/api/integrations/poster': require('../lib/integrations/poster'),
  '/api/integrations/syrve': require('../lib/integrations/syrve'),
  '/api/integrations/evotor': require('../lib/integrations/evotor'),
  '/api/integrations/frontpad': require('../lib/integrations/frontpad'),
  '/api/integrations/manage': require('../lib/integrations/manage'),
  '/api/integrations/test': require('../lib/integrations/test')
};

module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  const target = handlers[pathname];
  if (!target) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'integration_route_not_found', path: pathname }));
  }
  return target(req, res);
};
