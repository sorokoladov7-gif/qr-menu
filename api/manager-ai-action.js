'use strict';

const SUPABASE_URL=process.env.SUPABASE_URL||'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';

const FEATURE_ACTIONS={
  menu_analysis:['update_product','update_product_price'],
  recipes:['save_recipe'],
  chef:['update_product','update_product_price','save_recipe'],
  marketing:['marketing_draft'],
  settings:['update_venue_settings'],
  assistant:[],
  menu_import:[],
  analytics:[],
  staff:[],
  engineer:[]
};

const PRODUCT_FIELDS=['name','description','price','category','image_url','is_available','applies_to'];
const VENUE_FIELDS=['name','description','brand_color','logo_url','address','latitude','longitude','lat','lng','delivery_min_order','delivery_min_order_free','delivery_base_fee','delivery_rate_per_km','delivery_max_km'];

function error(message,status){return Object.assign(new Error(message),{status});}
function bearer(req){const h=String(req.headers?.authorization||req.headers?.Authorization||'');const m=h.match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function rest(path,token,method='GET',body){
  const key=SUPABASE_SERVICE_ROLE_KEY||SUPABASE_ANON_KEY;
  const auth=SUPABASE_SERVICE_ROLE_KEY||token;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{method,headers:{apikey:key,authorization:'Bearer '+auth,accept:'application/json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw error(data?.message||data?.hint||'SUPABASE_HTTP_'+r.status,r.status);
  return data;
}
async function authManager(req){
  const token=bearer(req);if(!token)throw error('AUTH_REQUIRED',401);
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});
  const user=await r.json().catch(()=>null);if(!r.ok||!user?.id)throw error('AUTH_INVALID',401);
  const profiles=await rest('profiles?id=eq.'+encodeURIComponent(user.id)+'&select=id,role&limit=1',token);
  if(!profiles?.[0]||String(profiles[0].role).toLowerCase()!=='manager')throw error('MANAGER_ONLY',403);
  return {token,user};
}
async function entitlement(ctx,feature){
  if(!Object.prototype.hasOwnProperty.call(FEATURE_ACTIONS,feature))throw error('AI_FEATURE_UNKNOWN',400);
  const subs=await rest('subscriptions?manager_id=eq.'+encodeURIComponent(ctx.user.id)+'&venue_id=is.null&status=in.(trialing,active)&current_period_end=gte.'+encodeURIComponent(new Date().toISOString())+'&select=id,plan_id,status,current_period_end&order=created_at.desc&limit=1',ctx.token);
  const sub=subs?.[0];if(!sub)throw error('AI_SUBSCRIPTION_REQUIRED',403);
  const plans=await rest('plans?id=eq.'+encodeURIComponent(sub.plan_id)+'&is_active=eq.true&select=id,name,ai_enabled,ai_features&limit=1',ctx.token);
  const plan=plans?.[0],features=plan?.ai_features&&typeof plan.ai_features==='object'?plan.ai_features:{};
  if(!plan||plan.ai_enabled!==true)throw error('AI_NOT_INCLUDED_IN_PLAN',403);
  if(features[feature]!==true)throw error('AI_FEATURE_NOT_INCLUDED:'+feature,403);
  return {sub,plan,features};
}
async function assertVenue(ctx,venueId){
  if(!venueId)throw error('VENUE_REQUIRED',400);
  const rows=await rest('manager_venues?manager_id=eq.'+encodeURIComponent(ctx.user.id)+'&venue_id=eq.'+encodeURIComponent(venueId)+'&select=id,venue_id&limit=1',ctx.token);
  if(!rows?.[0])throw error('VENUE_ACCESS_DENIED',403);
}
function cleanProductPayload(payload){
  const out={};PRODUCT_FIELDS.forEach(k=>{if(Object.prototype.hasOwnProperty.call(payload||{},k))out[k]=payload[k];});
  if(!Object.keys(out).length)throw error('PRODUCT_PAYLOAD_EMPTY',400);
  if(Object.prototype.hasOwnProperty.call(out,'name')){out.name=String(out.name||'').trim().slice(0,220);if(!out.name)throw error('PRODUCT_NAME_REQUIRED',400);}
  if(Object.prototype.hasOwnProperty.call(out,'price')){out.price=Number(out.price);if(!Number.isFinite(out.price)||out.price<0||out.price>10000000)throw error('PRODUCT_PRICE_INVALID',400);}
  if(Object.prototype.hasOwnProperty.call(out,'description'))out.description=String(out.description||'').trim().slice(0,3000)||null;
  if(Object.prototype.hasOwnProperty.call(out,'category'))out.category=String(out.category||'main').trim().slice(0,120)||'main';
  if(Object.prototype.hasOwnProperty.call(out,'is_available'))out.is_available=!!out.is_available;
  if(Object.prototype.hasOwnProperty.call(out,'applies_to'))out.applies_to=String(out.applies_to||'all').slice(0,50);
  return out;
}
function cleanVenuePayload(payload){
  const out={};VENUE_FIELDS.forEach(k=>{if(Object.prototype.hasOwnProperty.call(payload||{},k))out[k]=payload[k];});
  if(!Object.keys(out).length)throw error('VENUE_PAYLOAD_EMPTY',400);
  if(out.name!==undefined){out.name=String(out.name||'').trim().slice(0,220);if(!out.name)throw error('VENUE_NAME_REQUIRED',400);}
  ['delivery_min_order','delivery_min_order_free','delivery_base_fee','delivery_rate_per_km','delivery_max_km','latitude','longitude','lat','lng'].forEach(k=>{if(out[k]!==undefined){out[k]=Number(out[k]);if(!Number.isFinite(out[k]))throw error('VENUE_NUMBER_INVALID:'+k,400);}});
  if(out.brand_color!==undefined&&!/^#[0-9a-fA-F]{6}$/.test(String(out.brand_color||'')))throw error('BRAND_COLOR_INVALID',400);
  ['description','logo_url','address'].forEach(k=>{if(out[k]!==undefined)out[k]=String(out[k]||'').trim().slice(0,3000)||null;});
  if(out.delivery_min_order_free!==undefined&&out.delivery_min_order!==undefined&&out.delivery_min_order_free>0&&out.delivery_min_order_free<out.delivery_min_order)throw error('FREE_DELIVERY_THRESHOLD_INVALID',400);
  return out;
}
async function apply(ctx,ent,feature,action){
  const type=String(action?.type||'').trim();const payload=action?.payload&&typeof action.payload==='object'?action.payload:{};
  if(!(FEATURE_ACTIONS[feature]||[]).includes(type))throw error('ACTION_NOT_ALLOWED_FOR_FEATURE:'+type,403);
  if(type==='marketing_draft')return {type,status:'applied',result:{text:String(payload.text||'').trim().slice(0,12000),title:String(payload.title||'').trim().slice(0,300)}};
  const venueId=String(payload.venue_id||'').trim();await assertVenue(ctx,venueId);
  if(type==='update_product'||type==='update_product_price'){
    const productId=String(payload.product_id||'').trim();if(!productId)throw error('PRODUCT_ID_REQUIRED',400);
    const owned=await rest('products?id=eq.'+encodeURIComponent(productId)+'&venue_id=eq.'+encodeURIComponent(venueId)+'&select=id,venue_id&limit=1',ctx.token);if(!owned?.[0])throw error('PRODUCT_ACCESS_DENIED',403);
    const data=type==='update_product_price'?{price:Number(payload.price)}:cleanProductPayload(payload);
    if(data.price!==undefined&&(!Number.isFinite(data.price)||data.price<0||data.price>10000000))throw error('PRODUCT_PRICE_INVALID',400);
    await rest('products?id=eq.'+encodeURIComponent(productId)+'&venue_id=eq.'+encodeURIComponent(venueId),ctx.token,'PATCH',data);
    return {type,status:'applied',result:{product_id:productId,fields:Object.keys(data)}};
  }
  if(type==='save_recipe'){
    const productId=String(payload.product_id||'').trim();if(!productId)throw error('PRODUCT_ID_REQUIRED',400);
    const owned=await rest('products?id=eq.'+encodeURIComponent(productId)+'&venue_id=eq.'+encodeURIComponent(venueId)+'&select=id,venue_id&limit=1',ctx.token);if(!owned?.[0])throw error('PRODUCT_ACCESS_DENIED',403);
    const rows=Array.isArray(payload.rows)?payload.rows.slice(0,100):null;if(!rows)throw error('RECIPE_ROWS_REQUIRED',400);
    const normalized=rows.map(r=>{const x={ingredient_id:String(r?.ingredient_id||'').trim(),quantity:Number(r?.quantity)};if(!x.ingredient_id||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>1000000)throw error('RECIPE_ROW_INVALID',400);return x;});
    const rpc=await fetch(SUPABASE_URL+'/rest/v1/rpc/manager_product_recipe_save',{method:'POST',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY||SUPABASE_ANON_KEY,authorization:'Bearer '+(SUPABASE_SERVICE_ROLE_KEY||ctx.token),'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({p_venue_id:venueId,p_product_id:productId,p_rows:normalized})});
    const data=await rpc.json().catch(()=>null);if(!rpc.ok)throw error(data?.message||'RECIPE_SAVE_FAILED',rpc.status);
    return {type,status:'applied',result:{product_id:productId,rows:normalized.length}};
  }
  if(type==='update_venue_settings'){
    const data=cleanVenuePayload(payload);delete data.venue_id;await rest('venues?id=eq.'+encodeURIComponent(venueId),ctx.token,'PATCH',data);return {type,status:'applied',result:{venue_id:venueId,fields:Object.keys(data)}};
  }
  throw error('ACTION_UNSUPPORTED',400);
}
module.exports=async function(req,res){
  if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end(JSON.stringify({ok:false,error:'METHOD_NOT_ALLOWED'}));}
  try{
    const ctx=await authManager(req);const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const feature=String(body.feature||'').trim().toLowerCase();const ent=await entitlement(ctx,feature);const action=body.action;
    if(!action||typeof action!=='object')throw error('ACTION_REQUIRED',400);
    const result=await apply(ctx,ent,feature,action);
    res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,feature,plan:ent.plan.name,result}));
  }catch(e){const status=Number(e?.status)||500;res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:e?.message||'MANAGER_AI_ACTION_FAILED'}));}
};
