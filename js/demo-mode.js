(function(){
'use strict';
var params=new URLSearchParams(location.search);
var path=location.pathname.toLowerCase();
var isStaff=/(cook|courier|waiter)\.html$/i.test(path);
var isManager=/manager\.html$/i.test(path);
var isManagerDemo=/manager-demo\.html$/i.test(path);
var isPublicMenu=/menu\.html$/i.test(path);
var demoPage=isStaff||isManager||isManagerDemo;

if(params.get('demo')==='0' || isPublicMenu){ localStorage.removeItem('qr_demo_mode'); }
if(params.get('demo')==='1' && demoPage){ localStorage.setItem('qr_demo_mode','1'); }

if(isPublicMenu && !window.__qrCustomerSbpPaymentPatched && window.db && typeof window.db.rpc==='function'){
  window.__qrCustomerSbpPaymentPatched=true;
  var originalPublicMenuRpc=window.db.rpc.bind(window.db);
  window.db.rpc=function(name,args,options){
    var result=originalPublicMenuRpc(name,args,options);
    if(name!=='create_public_order' || !args || args.p_payment_method!=='sbp') return result;
    return result.then(function(r){
      if(!r || r.error) return r;
      var order=r.data;
      if(order && typeof order==='object' && order.order) order=order.order;
      if(Array.isArray(order) && order.length) order=order[0];
      if(!order || !order.id) return {data:null,error:{message:'Не удалось определить созданный заказ для оплаты СБП'}};
      return fetch('/api/payments/yookassa/create-order',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({order_id:order.id})}).then(function(response){return response.text().then(function(text){var payload=null;try{payload=text?JSON.parse(text):null;}catch(e){}if(!response.ok||!payload||!payload.ok||!payload.confirmation_url)throw new Error(payload&&payload.error?payload.error:('HTTP '+response.status));return payload;});}).then(function(payload){try{sessionStorage.setItem('qr_sbp_order_id',String(order.id));}catch(e){}window.location.assign(payload.confirmation_url);return r;}).catch(function(e){console.error('[Menu] SBP payment creation:',e);return{data:null,error:{message:'Заказ создан, но не удалось открыть оплату СБП: '+(e.message||e)}};});
    });
  };
}

var isDemo=localStorage.getItem('qr_demo_mode')==='1' && demoPage;
window.__isDemoMode=isDemo;
if(!isDemo)return;

var D=window.QR_DEMO_DATA||{};
D.venue=D.venue||{id:'demo-venue',name:'Демо Кафе «Прованс»',slug:'demo-cafe',status:'active'};
D.session=D.session||{};
D.user=D.user||{id:'demo-user',email:'demo@qr-setka.ru',user_metadata:{display_name:'Демо Пользователь'}};
D.profile=D.profile||{id:'demo-user',email:'demo@qr-setka.ru',display_name:'Демо Пользователь',role:'manager'};
D.orders=D.orders||[];D.tables=D.tables||[];D.products=D.products||[];D.cooks=D.cooks||[];D.couriers=D.couriers||[];D.waiters=D.waiters||[];

(function(){var base={venueId:D.venue.id,venueName:D.venue.name,token:'demo-token-'+Date.now(),shiftOpen:true,shift_open:true};try{
localStorage.setItem('cook_session',JSON.stringify(Object.assign({},base,{cookName:D.session.cookName||'Иван Петров'})));
localStorage.setItem('courier_session',JSON.stringify(Object.assign({},base,{courierName:D.session.courierName||'Алексей Козлов'})));
localStorage.setItem('waiter_session',JSON.stringify(Object.assign({},base,{waiterName:D.session.waiterName||'Ольга Новикова'})));
localStorage.setItem('cook_token',base.token);localStorage.setItem('courier_token',base.token);localStorage.setItem('waiter_token',base.token);localStorage.setItem('staff_token',base.token);
localStorage.setItem('cook_shift_open','1');localStorage.setItem('courier_shift_open','1');localStorage.setItem('waiter_shift_open','1');localStorage.setItem('staff_shift_open','1');}catch(e){}})();

function shiftResponse(name,args){var s=String(name||'');if(/close/i.test(s))return{ok:true,open:false,is_open:false,shift_open:false,status:'closed'};var type=args&&(args.p_type||args.p_staff_type||args.staff_type)||(isStaff?(path.indexOf('cook')!==-1?'cook':path.indexOf('courier')!==-1?'courier':'waiter'):'staff');return{ok:true,open:true,is_open:true,shift_open:true,status:'open',id:'demo-shift',shift_id:'demo-shift',staff_id:'demo-'+type,venue_id:D.venue.id,opened_at:new Date().toISOString()};}

window.__patchQrDemoSupabaseFetch=function(){if(window.__demoFetchPatched||typeof window.fetch!=='function')return;window.__demoFetchPatched=true;var nativeFetch=window.fetch.bind(window);window.fetch=function(input,init){try{var url=typeof input==='string'?input:(input&&input.url)||'';var m=String(url).match(/\/rest\/v1\/rpc\/([^/?#]+)/i);if(m&&/^(open_staff_shift|current_staff_shift|get_staff_shift|check_staff_shift|staff_shift_status|close_staff_shift|open_shift|current_shift|check_shift)$/i.test(decodeURIComponent(m[1])))return Promise.resolve(new Response(JSON.stringify(shiftResponse(decodeURIComponent(m[1]),{})),{status:200,headers:{'Content-Type':'application/json'}}));}catch(e){}return nativeFetch(input,init);};};

function readOnlyResult(){return Promise.resolve({data:null,error:{message:'Демо-режим: изменение данных отключено'}});}
var MUT=/^(insert|update|delete|upsert|create|remove|add|save|set|change|reset|regenerate|import|assign|approve|reject|open|close|release|start|stop)/i;
var MUT_RPC=/(manager_(upsert|delete|set_|regenerate|create|update|remove|change)|staff_update_order|cook_(start|release|update)|waiter_(start|release|update)|courier_(start|release|update)|.*_(insert|update|delete|upsert|create|remove|save|import|assign|approve|reject))/i;

function demoRpcData(n,args){
  if(/manager_staff_performance|staff_performance/i.test(n))return [{staff_id:'c1',staff_name:'Иван Петров',role:'Повар',orders_count:42,completed_orders:39,avg_time:12},{staff_id:'w1',staff_name:'Ольга Новикова',role:'Официант',orders_count:31,completed_orders:29,avg_time:8},{staff_id:'cr1',staff_name:'Алексей Козлов',role:'Курьер',orders_count:18,completed_orders:17,avg_time:24}];
  if(/manager.*analytics|analytics.*manager|manager_dashboard|manager_stats|venue_stats/i.test(n))return D.analytics||{};
  if(/manager.*orders|orders.*manager/i.test(n))return D.orders;
  if(/manager.*products|products.*manager|menu_products/i.test(n))return D.products;
  if(/manager.*(table|hall)|table.*manager/i.test(n))return {ok:true,venue_id:D.venue.id,tables:D.tables};
  if(/manager.*staff|staff.*manager/i.test(n))return [].concat(D.cooks||[],D.waiters||[],D.couriers||[]);
  if(/manager.*venue|venue.*manager/i.test(n))return D.venue;
  if(/public_venue_by_slug|venue_by_slug/i.test(n))return D.venue;
  if(/manager.*permission|venue.*permission/i.test(n))return {venue_id:D.venue.id,can_edit_menu:false,can_edit_design:false,can_manage_staff:false};
  if(/manager.*subscription|subscription.*manager/i.test(n))return {venue_id:D.venue.id,plan_id:'demo-plan',status:'active',current_period_end:D.venue.subscription_end};
  return null;
}

function patchDb(){if(!window.db||!window.db.rpc||window.__demoDbPatched)return;window.__demoDbPatched=true;
window.db.auth={getSession:function(){return Promise.resolve({data:{session:{user:D.user,access_token:'demo'}},error:null});},getUser:function(){return Promise.resolve({data:{user:D.user},error:null});},signInWithPassword:function(){return Promise.resolve({data:{user:D.user,session:{user:D.user}},error:null});},signInWithOtp:function(){return Promise.resolve({data:{},error:null});},signUp:function(){return Promise.resolve({data:{user:D.user},error:null});},signOut:function(){localStorage.removeItem('qr_demo_mode');location.href='index.html';return Promise.resolve();},onAuthStateChange:function(){return{data:{subscription:{unsubscribe:function(){}}}};}};
window.db.rpc=function(name,args){var n=String(name||'');if(MUT_RPC.test(n))return readOnlyResult();if(/shift/i.test(n))return Promise.resolve({data:shiftResponse(n,args),error:null});if(n==='staff_login'){var type=args&&args.p_type;var nm=type==='cook'?D.session.cookName:type==='courier'?D.session.courierName:D.session.waiterName;return Promise.resolve({data:{staffId:'demo-'+type,staffName:nm,venueId:D.venue.id,venueName:D.venue.name,token:'demo-token-'+Date.now(),expiresAt:Date.now()+12*60*60*1000,shiftOpen:true,shift_open:true},error:null});}if(n==='staff_venue_by_slug')return Promise.resolve({data:D.venue,error:null});if(n==='staff_orders_json'||n==='staff_history_json')return Promise.resolve({data:D.orders,error:null});if(n==='manager_table_board')return Promise.resolve({data:{ok:true,venue_id:D.venue.id,tables:D.tables},error:null});if(n==='customer_track_order_json')return Promise.resolve({data:D.orders[0]||null,error:null});if(n==='get_public_table')return Promise.resolve({data:D.tables[0]||null,error:null});if(n==='create_public_order')return Promise.resolve({data:{id:'demo-order',order_number:999,status:'new'},error:null});var demo=demoRpcData(n,args);if(demo!==null)return Promise.resolve({data:demo,error:null});return Promise.resolve({data:null,error:null});};
window.db.from=function(table){function pick(){if(/shift/i.test(String(table)))return{data:[{id:'demo-shift',venue_id:D.venue.id,staff_id:'demo-staff',status:'open',is_open:true,open:true,opened_at:new Date().toISOString()}],error:null};if(table==='profiles')return{data:D.profile,error:null};if(table==='venues')return{data:[D.venue],error:null};if(table==='manager_venues')return{data:[{venue_id:D.venue.id,manager_id:'demo-user',venues:D.venue}],error:null};if(table==='products')return{data:D.products,error:null};if(table==='orders')return{data:D.orders,error:null};if(table==='venue_tables')return{data:D.tables,error:null};if(table==='cooks')return{data:D.cooks,error:null};if(table==='couriers')return{data:D.couriers,error:null};if(table==='waiters')return{data:D.waiters,error:null};if(table==='subscriptions')return{data:[{venue_id:D.venue.id,status:'active',current_period_end:D.venue.subscription_end}],error:null};if(table==='plans')return{data:[{id:'demo-plan',name:'Демо Тариф',price:1990,max_venues:3,max_cooks:10,max_couriers:10,max_waiters:10,max_products:100}],error:null};if(table==='menu_templates')return{data:[{id:'demo-template',name:'Кафе',slug:'cafe',emoji:'☕',description:'Демо-шаблон кафе',is_active:true,sort_order:1,products:D.products,niche:'cafe',scale_code:'M',target_product_count:D.products.length}],error:null};if(table==='manager_venue_permissions')return{data:[{manager_id:D.profile.id,venue_id:D.venue.id,can_edit_menu:false,can_edit_design:false}],error:null};if(table==='venue_settings')return{data:[{venue_id:D.venue.id}],error:null};return{data:[],error:null};}
function single(){var p=pick();return{data:Array.isArray(p.data)?(p.data[0]||null):p.data,error:p.error};}
var chain={select:function(){return chain;},insert:function(){return mutationChain;},update:function(){return mutationChain;},delete:function(){return mutationChain;},upsert:function(){return mutationChain;},eq:function(){return chain;},in:function(){return chain;},neq:function(){return chain;},is:function(){return chain;},or:function(){return chain;},filter:function(){return chain;},order:function(){return chain;},limit:function(){return chain;},range:function(){return chain;},maybeSingle:function(){return Promise.resolve(single());},single:function(){return Promise.resolve(single());},then:function(a,b){return Promise.resolve(pick()).then(a,b);},catch:function(a){return Promise.resolve(pick()).catch(a);}};
var mutationChain={eq:function(){return mutationChain;},in:function(){return mutationChain;},neq:function(){return mutationChain;},is:function(){return mutationChain;},or:function(){return mutationChain;},filter:function(){return mutationChain;},select:function(){return mutationChain;},single:function(){return readOnlyResult();},maybeSingle:function(){return readOnlyResult();},then:function(a,b){return readOnlyResult().then(a,b);},catch:function(a){return readOnlyResult().catch(a);}};
return chain;};}
function blockRedirects(){if(typeof window.safeRedirect==='function'&&!window.__demoSafePatched){window.__demoSafePatched=true;window.safeRedirect=function(){};}if(typeof window.requireAuth==='function'&&!window.__demoAuthPatched){window.__demoAuthPatched=true;window.requireAuth=function(){return Promise.resolve(D.profile);}}if(typeof window.logout==='function'&&!window.__demoLogoutPatched){window.__demoLogoutPatched=true;window.logout=function(){localStorage.removeItem('qr_demo_mode');location.href='index.html';};}}
function installReadOnlyUi(){if(window.__demoReadOnlyUi)return;window.__demoReadOnlyUi=true;function run(){var b=document.getElementById('qr-demo-readonly');if(!b){b=document.createElement('div');b.id='qr-demo-readonly';b.textContent='ДЕМО-РЕЖИМ · кабинет только для просмотра · изменения отключены';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#b45309;color:#fff;text-align:center;padding:7px 12px;font:700 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none';document.body.appendChild(b);}document.body.style.paddingTop='30px';var els=document.querySelectorAll('button,input,select,textarea');for(var i=0;i<els.length;i++){var e=els[i],t=((e.innerText||e.textContent||e.value||e.getAttribute('aria-label')||'')+'').toLowerCase();if(/выйти|закрыть|назад|список|вкладк|меню|просмотр|открыть/.test(t))continue;if(e.tagName==='INPUT'||e.tagName==='SELECT'||e.tagName==='TEXTAREA'||/сохран|созда|добав|удал|измен|редакт|импорт|назнач|сброс|генер|обнов|старт|закрыть смен|открыть смен/.test(t))e.disabled=true;}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();setTimeout(run,500);setTimeout(run,1500);}
function start(){if(typeof window.__patchQrDemoSupabaseFetch==='function')window.__patchQrDemoSupabaseFetch();patchDb();blockRedirects();installReadOnlyUi();}
start();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
})();