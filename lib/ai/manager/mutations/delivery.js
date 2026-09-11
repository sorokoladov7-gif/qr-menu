'use strict';

const {fail,rpc,venue,num,str}=require('../context');

const TYPES=new Set(['update_delivery_integration','delete_delivery_integration']);
const PROVIDERS=['yandex_delivery','delivery_club','cdek','dalli','fivepost'];

async function run(type,c,vid,p){
  if(!TYPES.has(type))throw fail('UNSUPPORTED_DELIVERY_ACTION:'+type,400);
  await venue(c,vid,'delivery');
  const provider=str(p.provider,40);
  if(!PROVIDERS.includes(provider))throw fail('DELIVERY_PROVIDER_INVALID',400);

  if(type==='delete_delivery_integration')return{type,status:'applied',result:await rpc('manager_delivery_integration_delete',{p_venue_id:vid,p_provider:provider},c.token)};

  const mode=['provider','provider_plus_percent','fixed'].includes(str(p.pricing_mode,40))?str(p.pricing_mode,40):'provider_plus_percent';
  return{type,status:'applied',result:await rpc('manager_delivery_integration_upsert',{
    p_venue_id:vid,
    p_provider:provider,
    p_enabled:!!p.enabled,
    p_priority:Math.max(1,Math.min(999,num(p.priority,100))),
    p_pricing_mode:mode,
    p_markup_percent:Math.max(0,Math.min(1000,num(p.markup_percent,0))),
    p_fixed_fee:Math.max(0,num(p.fixed_fee,0)),
    p_api_token:str(p.api_token,2000)||null,
    p_config:p.config&&typeof p.config==='object'?p.config:{}
  },c.token)};
}

module.exports={TYPES,run};
