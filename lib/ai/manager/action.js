'use strict';

const {MAP,fail,auth,entitlement,str}=require('./context');
const marketing=require('./actions/marketing');
const menu=require('./mutations/menu');
const ingredients=require('./mutations/ingredients');
const staff=require('./mutations/staff');
const recipes=require('./mutations/recipes');
const venueSettings=require('./mutations/venue');
const delivery=require('./mutations/delivery');
const orders=require('./mutations/orders');
const hall=require('./mutations/hall');
const integrations=require('./mutations/integrations');
const subscription=require('./mutations/subscription');
const onboarding=require('./mutations/onboarding');

async function run(c,f,a,e){
  const type=str(a?.type,80),p=a?.payload&&typeof a.payload==='object'?Object.assign({},a.payload):{};
  if(!(MAP[f]||[]).includes(type))throw fail('ACTION_NOT_ALLOWED_FOR_FEATURE:'+type,403);
  if(marketing.TYPES.has(type))return marketing.run(type,c,f,p,e);
  const vid=str(p.venue_id,80);
  if(onboarding.TYPES.has(type))return onboarding.run(type,c,f,p,e);
  if(subscription.TYPES.has(type))return subscription.run(type,c,f,p,e);
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
