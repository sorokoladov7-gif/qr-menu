'use strict';

const {claim,release}=require('./sync-lock');

function send(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').end(JSON.stringify(body));}
function loadHandler(pathname){
  switch(pathname){
    case '/api/integrations/iiko': return require('./iiko');
    case '/api/integrations/pos': return require('./pos');
    case '/api/integrations/saby-presto': return require('./saby-presto');
    case '/api/integrations/poster': return require('./poster');
    case '/api/integrations/syrve': return require('./syrve');
    case '/api/integrations/evotor': return require('./evotor');
    case '/api/integrations/frontpad': return require('./frontpad');
    case '/api/integrations/manage': return require('./manage');
    case '/api/integrations/test': return require('./test');
    default: return null;
  }
}
const LOCKED=new Map([
  ['/api/integrations/iiko','iiko'],
  ['/api/integrations/pos',new Set(['quick_resto','r_keeper'])],
  ['/api/integrations/saby-presto','saby_presto'],
  ['/api/integrations/poster','poster'],
  ['/api/integrations/syrve','syrve'],
  ['/api/integrations/evotor','evotor'],
  ['/api/integrations/frontpad','frontpad']
]);
module.exports=async function handler(req,res){
  const pathname=String((req.url||'').split('?')[0]||'').replace(/\/$/,'')||'/';
  let target;
  try{target=loadHandler(pathname);}catch(e){return send(res,500,{ok:false,error:'integration_module_load_failed',route:pathname,message:e&&e.message?e.message:'Failed to load integration module'});}
  if(!target)return send(res,404,{ok:false,error:'integration_route_not_found',path:pathname});
  const body=req&&req.body&&typeof req.body==='object'?req.body:{};
  const action=String(body.action||'');
  const expected=LOCKED.get(pathname);
  if(!expected||action!=='import_menu')return target(req,res);
  const venue=String(body.venue_id||'').trim(),provider=String(body.provider||'').trim();
  if(!venue)return send(res,400,{ok:false,error:'venue_id_required'});
  const validProvider=expected instanceof Set?expected.has(provider):provider===expected;
  if(!validProvider)return send(res,400,{ok:false,error:'provider_route_mismatch',route:pathname,provider});
  const {locked,token}=await claim(venue,provider,900);
  if(!locked)return send(res,409,{ok:false,error:'integration_sync_in_progress',provider,venue_id:venue});
  try{return await target(req,res);}finally{await release(venue,provider,token);}
};
