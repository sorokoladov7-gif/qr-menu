'use strict';

const crypto=require('crypto');
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';

function send(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').end(JSON.stringify(body));}
function loadHandler(pathname){
  switch(pathname){
    case '/api/integrations/iiko': return require('../lib/integrations/iiko');
    case '/api/integrations/pos': return require('../lib/integrations/pos');
    case '/api/integrations/saby-presto': return require('../lib/integrations/saby-presto');
    case '/api/integrations/poster': return require('../lib/integrations/poster');
    case '/api/integrations/syrve': return require('../lib/integrations/syrve');
    case '/api/integrations/evotor': return require('../lib/integrations/evotor');
    case '/api/integrations/frontpad': return require('../lib/integrations/frontpad');
    case '/api/integrations/manage': return require('../lib/integrations/manage');
    case '/api/integrations/test': return require('../lib/integrations/test');
    default: return null;
  }
}
const LOCKED=new Set(['/api/integrations/iiko','/api/integrations/pos','/api/integrations/saby-presto','/api/integrations/poster','/api/integrations/syrve','/api/integrations/evotor','/api/integrations/frontpad']);
function serviceHeaders(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
async function rpc(path,body){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${path}`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify(body)});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=null;}if(!r.ok)throw new Error((data&&(data.message||data.error))||`Supabase RPC ${r.status}`);return data;}
module.exports=async function handler(req,res){
  const pathname=String((req.url||'').split('?')[0]||'').replace(/\/$/,'')||'/';
  let target;
  try{target=loadHandler(pathname);}catch(e){return send(res,500,{ok:false,error:'integration_module_load_failed',route:pathname,message:e&&e.message?e.message:'Failed to load integration module'});}
  if(!target)return send(res,404,{ok:false,error:'integration_route_not_found',path:pathname});
  const body=req&&req.body&&typeof req.body==='object'?req.body:{};
  const action=String(body.action||'');
  if(!LOCKED.has(pathname)||action!=='import_menu')return target(req,res);
  const venue=String(body.venue_id||'').trim(),provider=String(body.provider||'').trim();
  if(!venue||!provider)return target(req,res);
  const lockToken=crypto.randomUUID();
  let locked=false;
  try{
    locked=Boolean(await rpc('claim_integration_sync_lock',{p_venue_id:venue,p_provider:provider,p_lock_token:lockToken,p_ttl_seconds:900}));
    if(!locked)return send(res,409,{ok:false,error:'integration_sync_in_progress',provider,venue_id:venue});
    return await target(req,res);
  }finally{
    if(locked){try{await rpc('release_integration_sync_lock',{p_venue_id:venue,p_provider:provider,p_lock_token:lockToken});}catch(_) {}}
  }
};
