'use strict';

const {fail,api,rpc,venue,num,str,venuePatch}=require('../context');

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

  if(type==='update_delivery_settings')return{type,status:'applied',result:await rpc('manager_save_venue_settings',{
    p_venue_id:vid,
    p_address:patch.address??null,
    p_latitude:patch.latitude??patch.lat??null,
    p_longitude:patch.longitude??patch.lng??null,
    p_delivery_enabled:patch.delivery_enabled??null,
    p_delivery_min_order:Math.max(0,Number(patch.delivery_min_order||0)),
    p_delivery_min_order_free:Math.max(0,Number(patch.delivery_min_order_free||0)),
    p_delivery_base_fee:Math.max(0,Number(patch.delivery_base_fee||0)),
    p_delivery_rate_per_km:Math.max(0,Number(patch.delivery_rate_per_km||0)),
    p_delivery_max_km:Math.max(0,Number(patch.delivery_max_km||0))
  },c.token)};

  if(Object.keys(patch).length)await api('venues?id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch);
  return{type,status:'applied',result:{venue_id:vid,fields:Object.keys(patch)}};
}

module.exports={TYPES,run};
