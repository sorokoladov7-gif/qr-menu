/* QR Menu — demo staff workflow bridge */
(function(){
'use strict';
var qs=new URLSearchParams(location.search),role=(qs.get('role')||'').toLowerCase();
if(!role){var m=location.pathname.toLowerCase().match(/\/(cook|courier|waiter)\.html$/i);if(m)role=m[1].toLowerCase();}
var D=window.QR_DEMO_DATA||{};
if(!D.venue||['cook','courier','waiter'].indexOf(role)<0)return;
var names={cook:D.session.cookName,courier:D.session.courierName,waiter:D.session.waiterName};
var token='demo-'+role+'-'+Date.now();
function put(k,v){try{localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));}catch(e){try{sessionStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));}catch(x){}}}
function get(k){try{return localStorage.getItem(k)||sessionStorage.getItem(k);}catch(e){return null;}}
var session={venueId:D.venue.id,venueName:D.venue.name,staffName:names[role]||'Демо сотрудник'};
put(role+'_token',token);put('staff_token',token);put(role+'_session',session);put('qr_demo_mode','1');
var STORAGE='qr_demo_orders';
var orders=[];
function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(e){return[];}}
function loadOrders(){try{var saved=get(STORAGE);if(saved){var parsed=JSON.parse(saved);if(Array.isArray(parsed))orders=parsed;}}catch(e){}if(!orders.length)orders=clone(D.orders||[]);return orders;}
function saveOrders(){put(STORAGE,orders);try{window.dispatchEvent(new StorageEvent('storage',{key:STORAGE,newValue:JSON.stringify(orders)}));}catch(e){}}
loadOrders();
function orderId(o){return o&&String(o.id||o.order_id||o.orderId);}
function getStatus(o){return String(o&&(o.status||o.order_status||o.state)||'new').toLowerCase();}
function setStatus(o,s){o.status=s;o.order_status=s;o.state=s;o.updated_at=new Date().toISOString();}
function transition(id,next){
 var o=orders.find(function(x){return orderId(x)===String(id);});if(!o)return null;
 var s=getStatus(o),n=String(next||'').toLowerCase();
 if(['taken','accepted','cooking','preparing','in_progress','processing'].indexOf(n)>=0){if(['completed','issued','delivered','cancelled','canceled'].indexOf(s)>=0)return null;setStatus(o,'cooking');}
 else if(['ready','prepared','done'].indexOf(n)>=0){if(['completed','issued','delivered','cancelled','canceled'].indexOf(s)>=0)return null;setStatus(o,'ready');}
 else if(['completed','issued','delivered','given','served'].indexOf(n)>=0){if(['cancelled','canceled'].indexOf(s)>=0)return null;setStatus(o,'completed');}
 else return null;
 saveOrders();return o;
}
function createDemoOrder(){
 var nums=orders.map(function(o){return Number(o.order_number)||0;}),next=Math.max.apply(Math,[100].concat(nums))+1;
 var products=D.products||[],p1=products[0]||{id:'p1',name:'Капучино',price:250},p2=products[1]||{id:'p2',name:'Сырники',price:450};
 var o={id:'demo-live-'+Date.now(),order_number:next,status:'new',order_type:'pickup',customer_name:['Ирина','Максим','Елена','Роман'][next%4],customer_phone:'+7 999 100-20-30',delivery_address:null,payment_method:'card',total_price:Number(p1.price||250)+Number(p2.price||450),comment:'Демо-заказ — новый',table_id:'t1',table_number:1,table_name:'Стол 1',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),items:[{product_id:p1.id,name:p1.name,price:p1.price,qty:1},{product_id:p2.id,name:p2.name,price:p2.price,qty:1}],addons:[]};
 orders.unshift(o);saveOrders();return o;
}
/* A demo order appears automatically, then more arrive periodically. This is local-only. */
if(!get('qr_demo_orders_seeded')){put('qr_demo_orders_seeded','1');setTimeout(function(){createDemoOrder();},2500);}
setInterval(function(){loadOrders();if(document.visibilityState!=='hidden')window.dispatchEvent(new Event('qr-demo-orders-updated'));},1500);
setInterval(function(){createDemoOrder();},30000);
window.addEventListener('storage',function(e){if(e.key===STORAGE){loadOrders();window.dispatchEvent(new Event('qr-demo-orders-updated'));}});
function installUi(){
 if(window.__qrDemoStaffUiInstalled)return;window.__qrDemoStaffUiInstalled=true;
 var css=document.createElement('style');css.textContent='button[disabled],input[disabled],select[disabled],textarea[disabled]{opacity:.55!important;cursor:not-allowed!important}.qr-demo-live-order{animation:qrDemoPulse 1.2s ease-in-out 2}@keyframes qrDemoPulse{50%{transform:scale(1.015)}}';document.head.appendChild(css);
 function removeDemoBanners(){document.querySelectorAll('#qr-demo-readonly,.qr-demo-readonly-banner,.demo-banner,.demo-mode-banner').forEach(function(e){e.remove();});}
 removeDemoBanners();new MutationObserver(removeDemoBanners).observe(document.body,{childList:true,subtree:true});
}
function install(){
 if(!window.db){setTimeout(install,50);return;}if(window.__qrDemoStaffInstalled)return;window.__qrDemoStaffInstalled=true;
 window.__qrDemoStaffUpdateOrder=function(args){args=args||{};var id=args.p_order_id||args.order_id||args.p_id||args.id,next=args.p_status||args.status||args.new_status||args.order_status;var changed=transition(id,next);return Promise.resolve(changed?{data:changed,error:null}:{data:null,error:{message:'Демо: переход статуса недоступен'}});};
 var oldRpc=window.db.rpc&&window.db.rpc.bind(window.db);
 window.db.rpc=function(name,args){args=args||{};var n=String(name||'');
  if(n==='staff_login')return Promise.resolve({data:{staffId:'demo-'+role,staffName:names[role],venueId:D.venue.id,venueName:D.venue.name,token:token,expiresAt:Date.now()+43200000,shiftOpen:true,shift_open:true},error:null});
  if(n==='staff_venue_by_slug')return Promise.resolve({data:D.venue,error:null});
  if(n==='staff_orders_json'||n==='staff_history_json'){loadOrders();return Promise.resolve({data:clone(orders),error:null});}
  if(n==='staff_update_order'||n==='staff_update_order_status')return window.__qrDemoStaffUpdateOrder(args);
  if(n==='cook_get_table_dashboard'||n==='waiter_get_dashboard'||n==='staff_table_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:false},error:null});
  if(n==='cook_start_table_session'||n==='waiter_start_table_session'||n==='cook_release_table'||n==='waiter_release_table')return Promise.resolve({data:null,error:{message:'Демо: изменение столов отключено'}});
  return oldRpc?oldRpc(name,args):Promise.resolve({data:null,error:null});
 };
 installUi();
 /* Ask the real cabinet to refresh when a demo order/status changes. */
 var refresh=function(){try{var root=document.getElementById('app'),inst=root&&root.__vue_app__&&root.__vue_app__._instance,vm=inst&&inst.proxy;if(vm){if(typeof vm.load==='function')vm.load();else if(typeof vm.loadOrders==='function')vm.loadOrders();else if(typeof vm.refresh==='function')vm.refresh();}}catch(e){}};
 window.addEventListener('qr-demo-orders-updated',refresh);
 var tries=0,timer=setInterval(function(){tries++;var root=document.getElementById('app');var inst=root&&root.__vue_app__&&root.__vue_app__._instance;var vm=inst&&inst.proxy;if(vm){if(!vm.session&&typeof vm.login==='function'){vm.form=vm.form||{};vm.form.slug=D.venue.slug;vm.form.pin=role==='cook'?'1234':role==='courier'?'1111':'2222';try{vm.login();}catch(e){}}if(vm.session){clearInterval(timer);timer=null;}}if(tries>100&&timer){clearInterval(timer);timer=null;}},100);
}
install();
})();
