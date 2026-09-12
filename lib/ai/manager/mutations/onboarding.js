'use strict';

const {rpc,str,product}=require('../context');

const TYPES=new Set(['create_venue']);

async function run(type,c,f,p,e){
  const s=e.subscription;
  const prod=Array.isArray(p.products)?p.products.slice(0,100).map(product):[];
  return{type,status:'applied',result:await rpc('manager_import_venue',{p_name:str(p.name,220),p_slug:str(p.slug,80),p_plan:str(p.plan_id||s.plan_id,80),p_subscription_end:p.subscription_end||s.current_period_end||null,p_address:str(p.address,500)||null,p_phone:str(p.phone,80)||null,p_website_url:str(p.website_url,500)||null,p_description:str(p.description,4000)||null,p_logo_url:str(p.logo_url,1000)||null,p_opening_hours:p.opening_hours&&typeof p.opening_hours==='object'?p.opening_hours:null,p_products:prod},c.token)};
}

module.exports={TYPES,run};
