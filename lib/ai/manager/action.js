'use strict';

const {MAP,fail,api,rpc,auth,entitlement,venue,str,product}=require('./context');
const menu=require('./mutations/menu');
const ingredients=require('./mutations/ingredients');
const staff=require('./mutations/staff');
const recipes=require('./mutations/recipes');
const venueSettings=require('./mutations/venue');
const delivery=require('./mutations/delivery');
const orders=require('./mutations/orders');
const hall=require('./mutations/hall');
const integrations=require('./mutations/integrations');

async function run(c,f,a,e){
  const type=str(a?.type,80),p=a?.payload&&typeof a.payload==='object'?Object.assign({},a.payload):{};
  if(!(MAP[f]||[]).includes(type))throw fail('ACTION_NOT_ALLOWED_FOR_FEATURE:'+type,403);
  if(type==='marketing_draft')return{type,status:'applied',result:{title:str(p.title,180),text:str(p.text,6000)}};
  const vid=str(p.venue_id,80);
  if(type==='create_venue'){
    const s=e.subscription;
    const prod=Array.isArray(p.products)?p.products.slice(0,100).map(product):[];
    return{type,status:'applied',result:await rpc('manager_import_venue',{p_name:str(p.name,220),p_slug:str(p.slug,80),p_plan:str(p.plan_id||s.plan_id,80),p_subscription_end:p.subscription_end||s.current_period_end||null,p_address:str(p.address,500)||null,p_phone:str(p.phone,80)||null,p_website_url:str(p.website_url,500)||null,p_description:str(p.description,4000)||null,p_logo_url:str(p.logo_url,1000)||null,p_opening_hours:p.opening_hours&&typeof p.opening_hours==='object'?p.opening_hours:null,p_products:prod},c.token)};
  }
  if(type==='change_trial_plan'){
    const pid=str(p.plan_id||p.p_plan_id,80);if(!pid)throw fail('PLAN_ID_REQUIRED',400);
    const sub=await api('subscriptions?manager_id=eq.'+encodeURIComponent(c.user.id)+'&venue_id=is.null&status=eq.trialing&select=id&limit=1',c.token);
    if(!sub?.[0])throw fail('TRIAL_SUBSCRIPTION_REQUIRED',400);
    return{type,status:'applied',result:await rpc('manager_change_trial_plan',{p_plan_id:pid},c.token)};
  }
  if(integrations.TYPES.has(type))return integrations.run(type,c,vid,p);
  if(menu.TYPES.has(type))return menu.run(type,c,vid,p,e);
  if(ingredients.TYPES.has(type))return ingredients.run(type,c,vid,p);
  if(staff.TYPES.has(type))return staff.run(type,c,vid,p);
  if(recipes.TYPES.has(type))return recipes.run(type,c,vid,p);
  if(venueSettings.TYPES.has(type))return venueSettings.run(type,c,vid,p);
  if(delivery.TYPES.has(type))return delivery.run(type,c,vid,p);
  if(orders.TYPES.has(type))return orders.run(type,c,vid,p);
  if(hall.TYPES.has(type))return hall.run(type,c,vid,p);
  throw fail('UNSUPPORTED_ACTION:'+type,400);
}

module.exports=async(req,res)=>{if(req.method!=='POST'){res.statusCode=405;return res.end(JSON.stringify({ok:false,error:'METHOD_NOT_ALLOWED'}))}try{const c=await auth(req),b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),f=str(b.feature||'assistant',40).toLowerCase(),action=b.action||{},e=await entitlement(c,f),r=await run(c,f,action,e);res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({ok:true,feature:f,plan:e.plan.name,result:r.result,type:r.type,status:r.status}))}catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:e.message||'MANAGER_AI_ACTION_FAILED'}))}};
