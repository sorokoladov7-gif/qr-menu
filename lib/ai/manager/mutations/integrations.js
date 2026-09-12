'use strict';

const {POS,fail,api,venue,str}=require('../context');

const TYPES=new Set(['disconnect_integration']);

async function run(type,c,vid,p){
  await venue(c,vid,'venue');
  const provider=str(p.provider,80);
  if(!POS.includes(provider))throw fail('INTEGRATION_PROVIDER_INVALID',400);
  const rows=await api('venue_integrations?venue_id=eq.'+encodeURIComponent(vid)+'&provider=eq.'+encodeURIComponent(provider)+'&select=id&limit=1',c.token);
  if(!rows?.[0])throw fail('INTEGRATION_NOT_FOUND',404);
  await api('venue_integrations?id=eq.'+encodeURIComponent(rows[0].id)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'DELETE');
  return{type,status:'applied',result:{provider,disconnected:true}};
}

module.exports={TYPES,run};
