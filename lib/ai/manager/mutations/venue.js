'use strict';

const {fail,api,rpc,venue,venuePatch}=require('../context');

const TYPES=new Set(['update_venue_settings','update_delivery_settings','save_design']);

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_VENUE_ACTION:'+type,400);

  if(type==='save_design'){
    await venue(c,vid,'design');
    const ds=p.design_settings&&typeof p.design_settings==='object'?p.design_settings:null;
    if(!ds)throw fail('DESIGN_SETTINGS_REQUIRED',400);
    return{type,status:'applied',result:await rpc('manager_save_design',{p_venue_id:vid,p_design_settings:ds},c.token)};
  }

  await venue(c,vid,type==='update_delivery_settings'?'delivery':'venue');
  const patch=venuePatch(p);

  // Keep the AI mutation on the canonical PostgREST venue write path.
  // The database trigger/RLS remains the final venue+permission boundary.
  if(Object.keys(patch).length)await api('venues?id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch);
  return{type,status:'applied',result:{venue_id:vid,fields:Object.keys(patch)}};
}

module.exports={TYPES,run};
