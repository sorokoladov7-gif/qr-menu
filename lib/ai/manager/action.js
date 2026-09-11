'use strict';

const {H,POS,DEL,MAP,fail,api,rpc,auth,entitlement,venue,num,str,product,venuePatch,resolveProduct,resolveIngredient,resolveStaff}=require('./context');

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
  if(type==='disconnect_integration'){
    await venue(c,vid,'venue');const provider=str(p.provider,80);
    if(!POS.includes(provider))throw fail('INTEGRATION_PROVIDER_INVALID',400);
    const rows=await api('venue_integrations?venue_id=eq.'+encodeURIComponent(vid)+'&provider=eq.'+encodeURIComponent(provider)+'&select=id&limit=1',c.token);
    if(!rows?.[0])throw fail('INTEGRATION_NOT_FOUND',404);
    await api('venue_integrations?id=eq.'+encodeURIComponent(rows[0].id)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'DELETE');
    return{type,status:'applied',result:{provider,disconnected:true}};
  }
  if(type==='create_product'){
    await venue(c,vid,'menu');const row=product(p);row.venue_id=vid;const max=Number(e.plan.max_products||0);
    if(max){const total=await api('products?venue_id=eq.'+encodeURIComponent(vid)+'&select=id',c.token);if((total||[]).length>=max)throw fail('PRODUCT_LIMIT_REACHED',403);}
    row.category=({'бургеры':'burger','бургер':'burger'})[String(row.category||'').toLowerCase()]||row.category||'main';
    const out=await api('products',c.token,'POST',row);return{type,status:'applied',result:Array.isArray(out)?out[0]:out};
  }
  if(type==='update_product'||type==='update_product_price'||type==='delete_product'){
    await venue(c,vid,type==='update_product_price'?'price':'menu');const pid=await resolveProduct(c,p);
    const own=await api('products?id=eq.'+encodeURIComponent(pid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=id,price&limit=1',c.token);
    if(!own?.[0])throw fail('PRODUCT_ACCESS_DENIED',403);
    if(type==='delete_product'){await api('products?id=eq.'+encodeURIComponent(pid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'DELETE');return{type,status:'applied',result:{product_id:pid,deleted:true}};}
    const patch=type==='update_product_price'?{price:Number(p.price)}:product(p);
    if(patch.price!==undefined&&!Number.isFinite(Number(patch.price)))throw fail('PRODUCT_PRICE_INVALID',400);
    if(patch.price!==undefined){const next=Number(patch.price),old=Number(own[0].price);if(!Number.isFinite(next)||next<0)throw fail('PRODUCT_PRICE_INVALID',400);if(Number.isFinite(old)&&old>0&&(next<old*0.9||next>old*1.1))throw fail('PRODUCT_PRICE_CHANGE_LIMIT_EXCEEDED',400);patch.price=Math.round(next*100)/100;}
    await api('products?id=eq.'+encodeURIComponent(pid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch);return{type,status:'applied',result:{product_id:pid,fields:Object.keys(patch)}};
  }
  if(type==='create_ingredient'){
    await venue(c,vid,'menu');const name=str(p.name,220);if(!name)throw fail('INGREDIENT_NAME_REQUIRED',400);const unit=['g','kg','ml','l','pcs'].includes(str(p.unit,10))?str(p.unit,10):'g';
    return{type,status:'applied',result:await rpc('manager_ingredient_upsert',{p_venue_id:vid,p_name:name,p_unit:unit,p_purchase_quantity:num(p.purchase_quantity,1),p_purchase_price:num(p.purchase_price,0),p_id:null},c.token)};
  }
  if(type==='update_ingredient'||type==='delete_ingredient'){
    await venue(c,vid,'menu');const iid=await resolveIngredient(c,p);
    if(type==='delete_ingredient')return{type,status:'applied',result:await rpc('manager_ingredient_delete',{p_venue_id:vid,p_ingredient_id:iid},c.token)};
    const old=(await api('ingredients?id=eq.'+encodeURIComponent(iid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=name,unit,purchase_quantity,purchase_price&limit=1',c.token))?.[0];if(!old)throw fail('INGREDIENT_ACCESS_DENIED',403);
    return{type,status:'applied',result:await rpc('manager_ingredient_upsert',{p_venue_id:vid,p_name:p.name===undefined?old.name:str(p.name,220),p_unit:p.unit===undefined?old.unit:(['g','kg','ml','l','pcs'].includes(str(p.unit,10))?str(p.unit,10):old.unit),p_purchase_quantity:p.purchase_quantity===undefined?Number(old.purchase_quantity||1):num(p.purchase_quantity,1),p_purchase_price:p.purchase_price===undefined?Number(old.purchase_price||0):num(p.purchase_price,0),p_id:iid},c.token)};
  }
  if(type==='create_staff'){
    await venue(c,vid,'venue');const st=str(p.type,20);if(!['cook','waiter','courier'].includes(st))throw fail('STAFF_TYPE_INVALID',400);const pin=str(p.pin,10);if(!/^\d{4}$/.test(pin))throw fail('STAFF_PIN_INVALID',400);
    return{type,status:'applied',result:await rpc('manager_create_staff',{p_venue_id:vid,p_type:st,p_name:str(p.name,220),p_phone:str(p.phone,80)||null,p_pin:pin},c.token)};
  }
  if(type==='reset_staff_pin'||type==='delete_staff'){
    await venue(c,vid,'venue');const sid=await resolveStaff(c,p),st=['cook','waiter','courier'].includes(str(p.type,20))?str(p.type,20):'';if(!st)throw fail('STAFF_TYPE_REQUIRED',400);const table=st==='cook'?'cooks':st==='courier'?'couriers':'waiters';
    const own=await api(table+'?id=eq.'+encodeURIComponent(sid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=id&limit=1',c.token);if(!own?.[0])throw fail('STAFF_ACCESS_DENIED',403);
    if(type==='reset_staff_pin')return{type,status:'applied',result:await rpc('manager_reset_staff_pin',{p_venue_id:vid,p_staff_id:sid,p_type:st},c.token)};
    await api(table+'?id=eq.'+encodeURIComponent(sid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'DELETE');return{type,status:'applied',result:{staff_id:sid,type:st,deleted:true}};
  }
  if(type==='update_order'){
    await venue(c,vid,'venue');const oid=str(p.order_id,80);if(!oid)throw fail('ORDER_ID_REQUIRED',400);const own=await api('orders?id=eq.'+encodeURIComponent(oid)+'&venue_id=eq.'+encodeURIComponent(vid)+'&select=id&limit=1',c.token);if(!own?.[0])throw fail('ORDER_ACCESS_DENIED',403);
    const status=str(p.status,30);if(!['new','cooking','ready','delivery','arrived','done','cancelled','changed'].includes(status))throw fail('ORDER_STATUS_INVALID',400);const patch={status};if(status==='cooking')patch.cooking_started_at=new Date().toISOString();if(status==='ready')patch.ready_at=new Date().toISOString();
    return{type,status:'applied',result:await api('orders?id=eq.'+encodeURIComponent(oid)+'&venue_id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch)};
  }
  if(type==='update_venue_settings'||type==='update_delivery_settings'){
    await venue(c,vid,type==='update_delivery_settings'?'delivery':'venue');const patch=venuePatch(p);
    if(type==='update_delivery_settings')return{type,status:'applied',result:await rpc('manager_save_venue_settings',{p_venue_id:vid,p_address:patch.address??null,p_latitude:patch.latitude??patch.lat??null,p_longitude:patch.longitude??patch.lng??null,p_delivery_enabled:patch.delivery_enabled??null,p_delivery_min_order:Math.max(0,Number(patch.delivery_min_order||0)),p_delivery_min_order_free:Math.max(0,Number(patch.delivery_min_order_free||0)),p_delivery_base_fee:Math.max(0,Number(patch.delivery_base_fee||0)),p_delivery_rate_per_km:Math.max(0,Number(patch.delivery_rate_per_km||0)),p_delivery_max_km:Math.max(0,Number(patch.delivery_max_km||0))},c.token)};
    if(Object.keys(patch).length)await api('venues?id=eq.'+encodeURIComponent(vid),c.token,'PATCH',patch);return{type,status:'applied',result:{venue_id:vid,fields:Object.keys(patch)}};
  }
  if(type==='save_design'){
    await venue(c,vid,'design');const ds=p.design_settings&&typeof p.design_settings==='object'?p.design_settings:null;if(!ds)throw fail('DESIGN_SETTINGS_REQUIRED',400);
    return{type,status:'applied',result:await rpc('manager_save_design',{p_venue_id:vid,p_design_settings:ds},c.token)};
  }
  if(type==='update_delivery_integration'||type==='delete_delivery_integration'){
    await venue(c,vid,'delivery');const provider=str(p.provider,40);if(!DEL.includes(provider))throw fail('DELIVERY_PROVIDER_INVALID',400);
    if(type==='delete_delivery_integration')return{type,status:'applied',result:await rpc('manager_delivery_integration_delete',{p_venue_id:vid,p_provider:provider},c.token)};
    const mode=['provider','provider_plus_percent','fixed'].includes(str(p.pricing_mode,40))?str(p.pricing_mode,40):'provider_plus_percent';
    return{type,status:'applied',result:await rpc('manager_delivery_integration_upsert',{p_venue_id:vid,p_provider:provider,p_enabled:!!p.enabled,p_priority:Math.max(1,Math.min(999,num(p.priority,100))),p_pricing_mode:mode,p_markup_percent:Math.max(0,Math.min(1000,num(p.markup_percent,0))),p_fixed_fee:Math.max(0,num(p.fixed_fee,0)),p_api_token:str(p.api_token,2000)||null,p_config:p.config&&typeof p.config==='object'?p.config:{}},c.token)};
  }
  if(type==='recipe_auto_sync'){
    await venue(c,vid,'menu');const pid=await resolveProduct(c,p);return{type,status:'applied',result:await rpc('manager_recipe_auto_sync',{p_venue_id:vid,p_product_id:pid},c.token)};
  }
  if(['attach_ingredients','create_tech_card','save_recipe'].includes(type)){
    await venue(c,vid,'menu');const pid=await resolveProduct(c,p);const rows=Array.isArray(p.rows)?p.rows:(Array.isArray(p.ingredients)?p.ingredients:[]);if(!rows.length)throw fail('RECIPE_ROWS_REQUIRED',400);
    const ids=new Set(),norm=[];for(const r of rows){const iid=await resolveIngredient(c,Object.assign({},r,{venue_id:vid})),q=num(r.quantity,NaN);if(!iid||!Number.isFinite(q)||q<=0||ids.has(iid))throw fail('RECIPE_ROW_INVALID',400);ids.add(iid);norm.push({ingredient_id:iid,quantity:q,note:r.note?str(r.note,500):null});}
    return{type,status:'applied',result:await rpc('manager_product_recipe_save',{p_venue_id:vid,p_product_id:pid,p_rows:norm},c.token)};
  }
  if(H.includes(type)){
    await venue(c,vid,'venue');const tid=str(p.table_id,80);if(type!=='create_table'&&!tid)throw fail('TABLE_ID_REQUIRED',400);let out;
    if(type==='create_table')out=await rpc('manager_create_table',{p_venue_id:vid,p_number:num(p.number,null),p_name:str(p.name,120),p_shape:['round','square','rectangle'].includes(str(p.shape,20))?str(p.shape,20):'round',p_seats:num(p.seats,4),p_x:num(p.x,80),p_y:num(p.y,80)},c.token);
    else if(type==='update_table')out=await rpc('manager_update_table',{p_venue_id:vid,p_table_id:tid,p_number:num(p.number,null),p_name:str(p.name,120),p_shape:['round','square','rectangle'].includes(str(p.shape,20))?str(p.shape,20):'round',p_seats:num(p.seats,4),p_active:p.active!==false},c.token);
    else if(type==='move_table')out=await rpc('manager_move_table',{p_venue_id:vid,p_table_id:tid,p_x:num(p.x,80),p_y:num(p.y,80)},c.token);
    else if(type==='delete_table')out=await rpc('manager_delete_table',{p_venue_id:vid,p_table_id:tid},c.token);
    else if(type==='regenerate_table_qr')out=await rpc('manager_regenerate_table_qr',{p_venue_id:vid,p_table_id:tid},c.token);
    else if(type==='set_table_status')out=await rpc('manager_set_table_status',{p_venue_id:vid,p_table_id:tid,p_status:str(p.status,30)||'free',p_reserved_until:p.reserved_until||null,p_note:p.guest_name||null},c.token);
    else if(type==='seat_table')out=await rpc('manager_seat_table',{p_venue_id:vid,p_table_id:tid,p_guest_count:num(p.guest_count,1),p_guest_name:str(p.guest_name,220),p_guest_phone:str(p.phone||p.guest_phone,80)},c.token);
    else if(type==='set_table_reservation_guest')out=await rpc('manager_set_table_reservation_guest',{p_venue_id:vid,p_table_id:tid,p_guest_name:str(p.guest_name,220),p_guest_phone:str(p.phone||p.guest_phone,80)},c.token);
    else if(type==='close_table_session')out=await rpc('manager_close_table_session',{p_venue_id:vid,p_table_id:tid},c.token);
    else if(type==='save_hall_plan')out=await rpc('manager_save_hall_plan',{p_venue_id:vid,p_image_data:str(p.image_data||p.data,2000000),p_image_name:str(p.image_name||p.name||'hall-plan',220),p_image_width:num(p.image_width,p.width?num(p.width,1200):1200),p_image_height:num(p.image_height,p.height?num(p.height,800):800)},c.token);
    else if(type==='delete_hall_plan')out=await rpc('manager_delete_hall_plan',{p_venue_id:vid},c.token);
    return{type,status:'applied',result:out};
  }
  throw fail('UNSUPPORTED_ACTION:'+type,400);
}

module.exports=async(req,res)=>{if(req.method!=='POST'){res.statusCode=405;return res.end(JSON.stringify({ok:false,error:'METHOD_NOT_ALLOWED'}))}try{const c=await auth(req),b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),f=str(b.feature||'assistant',40).toLowerCase(),action=b.action||{},e=await entitlement(c,f),r=await run(c,f,action,e);res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({ok:true,feature:f,plan:e.plan.name,result:r.result,type:r.type,status:r.status}))}catch(e){res.statusCode=e.status||500;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:e.message||'MANAGER_AI_ACTION_FAILED'}))}};