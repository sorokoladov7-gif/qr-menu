'use strict';

const handlers = {
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

function send(res,status,body){
  res.status(status)
    .setHeader('Content-Type','application/json; charset=utf-8')
    .end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const pathname = String((req.url || '').split('?')[0] || '').replace(/\/$/, '') || '/';
  const modulePath = handlers[pathname];
  if (!modulePath) return send(res,404,{ok:false,error:'integration_route_not_found',path:pathname});

  let target;
  try {
    // Load only the requested adapter. A broken optional adapter must not crash
    // unrelated routes such as /api/integrations/manage.
    target = require(modulePath);
  } catch (e) {
    return send(res,500,{
      ok:false,
      error:'integration_module_load_failed',
      route:pathname,
      message:e&&e.message?e.message:'Failed to load integration module'
    });
  }

  return target(req,res);
};
