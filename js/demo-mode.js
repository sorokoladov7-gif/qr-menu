(function(){
'use strict';
var params=new URLSearchParams(location.search);
var path=location.pathname.toLowerCase();
var isStaff=/(cook|courier|waiter)\.html$/i.test(path);
var isManager=/manager\.html$/i.test(path);
var isManagerDemo=/manager-demo\.html$/i.test(path);
var isPublicMenu=/menu\.html$/i.test(path);
var demoPage=isStaff||isManager||isManagerDemo;
if(params.get('demo')==='0'||isPublicMenu)localStorage.removeItem('qr_demo_mode');
if(params.get('demo')==='1'&&demoPage)localStorage.setItem('qr_demo_mode','1');
var isDemo=localStorage.getItem('qr_demo_mode')==='1'&&demoPage;
window.__isDemoMode=isDemo;
if(!isDemo)return;
var D=window.QR_DEMO_DATA||{};
D.venue=D.venue||{id:'demo-venue',name:'Демо Кафе «Прованс»',slug:'demo-cafe',status:'active'};
D.session=D.session||{};D.user=D.user||{id:'demo-user',email:'demo@qr-setka.ru'};
D.profile=D.profile||{id:'demo-user',email:'demo@qr-setka.ru',display_name:'Демо Пользователь',role:'manager'};
D.orders=D.orders||[];D.tables=D.tables||[];D.products=D.products||[];D.cooks=D.cooks||[];D.couriers=D.couriers||[];D.waiters=D.waiters||[];
if(!Array.isArray(D.venues)||!D.venues.length)D.venues=[D.venue];
if(!D.venues.some(function(v){return String(v.id)===String(D.venue.id);}))D.venues.unshift(D.venue);
if(!isStaff)D.profile.role='manager';
function readOnlyResult(){return Promise.resolve({data:null,error:{message:'Демо-режим: изменение реальных данных отключено'}});}
var MUT_RPC=/(manager_(upsert|delete|set_|regenerate|create|update|remove|change)|cook_(start|release|update)|waiter_(start|release|update)|courier_(start|release|update)|.*_(insert|update|delete|upsert|create|remove|save|import|assign|approve|reject))/i;
function demoRpcData(n){
 if(/manager_staff_performance|staff_performance/i.test(n))return [{staff_id:'c1',staff_name:'Иван Петров',role:'Повар',orders_count:42,completed_orders:39,avg_time:12},{staff_id:'w1',staff_name:'Ольга Новикова',role:'Официант',orders_count:31,completed_orders:29,avg_time:8},{staff_id:'cr1',staff_name:'Алексей Козлов',role:'Курьер',orders_count:18,completed_orders:17,avg_time:24}];
 if(/manager.*analytics|analytics.*manager|manager_dashboard|manager_stats|venue_stats/i.test(n))return D.analytics||{};
 if(/manager.*orders|orders.*manager/i.test(n))return D.orders;
 if(/manager.*products|products.*manager|menu_products/i.test(n))return D.products;
 if(/manager.*(table|hall)|table.*manager/i.test(n))return {ok:true,venue_id:D.venue.id,tables:D.tables};
 if(/manager.*staff|staff.*manager/i.test(n))return [].concat(D.cooks||[],D.waiters||[],D.couriers||[]);
 if(/manager.*venue|venue.*manager/i.test(n))return D.venue;
 if(/public_venue_by_slug|venue_by_slug/i.test(n))return D.venue;
 if(/manager.*permission|venue.*permission/i.test(n))return {venue_id:D.venue.id,can_edit_menu:false,can_edit_design:false,can_manage_staff:false};
 if(/manager.*subscription|subscription.*manager/i.test(n))return {venue_id:null,plan_id:'demo-plan',status:'trialing',current_period_end:new Date(Date.now()+10*86400000).toISOString()};
 return null;
}
function slugifyDemo(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9а-яё\s_-]/gi,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').replace(/[а-яё]/g,function(c){return ({а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'})[c]||c;});return value||'demo-venue';}
function createDemoVenue(args){args=args||{};var name=String(args.p_name||args.name||'Новое заведение').trim()||'Новое заведение';var requested=slugifyDemo(args.p_slug||args.slug||name);var slug=requested;var used=D.venues.map(function(v){return String(v.slug||'').toLowerCase();});var n=1;while(used.indexOf(slug.toLowerCase())>=0){n++;slug=requested+'-'+n;}
 var id='demo-venue-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);var end=args.p_subscription_end||new Date(Date.now()+10*86400000).toISOString();var products=Array.isArray(args.p_products)?args.p_products:[];var venue={id:id,name:name,slug:slug,status:'active',subscription_end:end,created_at:new Date().toISOString(),plan_id:args.p_plan||'demo-plan',logo_url:null};venue.products=products;D.venues.unshift(venue);D.venue=venue;D.products=products.map(function(p){return Object.assign({},p,{venue_id:id});});
 try{localStorage.setItem('qr_demo_venues',JSON.stringify(D.venues));localStorage.setItem('manager_venue_id',id);}catch(e){}
 return venue;}
function patchDb(){if(!window.db||!window.db.rpc||window.__demoDbPatched)return;window.__demoDbPatched=true;
window.db.auth={getSession:function(){return Promise.resolve({data:{session:{user:D.user,access_token:'demo'}},error:null});},getUser:function(){return Promise.resolve({data:{user:D.user},error:null});},signInWithPassword:function(){return Promise.resolve({data:{user:D.user,session:{user:D.user}},error:null});},signOut:function(){localStorage.removeItem('qr_demo_mode');location.href='index.html';return Promise.resolve();},onAuthStateChange:function(){return{data:{subscription:{unsubscribe:function(){}}}};}};
var nativeRpc=window.db.rpc.bind(window.db);
window.db.rpc=function(name,args){var n=String(name||'');if(isStaff&&n==='staff_update_order'&&window.__qrDemoStaffUpdateOrder)return window.__qrDemoStaffUpdateOrder(args||{});
 if(isManager&&(n==='create_venue_for_manager'||n==='create_venue_from_template'))return Promise.resolve({data:createDemoVenue(args||{}),error:null});
 if(n==='staff_venue_by_slug')return Promise.resolve({data:D.venue,error:null});if(n==='staff_orders_json'||n==='staff_history_json')return Promise.resolve({data:D.orders,error:null});if(n==='manager_venue_by_slug')return Promise.resolve({data:D.venue,error:null});if(n==='manager_ensure_subscription')return Promise.resolve({data:{id:'demo-subscription',manager_id:D.profile.id,venue_id:null,plan_id:'demo-plan',status:'trialing',current_period_end:new Date(Date.now()+10*86400000).toISOString()},error:null});if(MUT_RPC.test(n))return readOnlyResult();var demo=demoRpcData(n);if(demo!==null)return Promise.resolve({data:demo,error:null});return nativeRpc?nativeRpc(name,args):Promise.resolve({data:null,error:null});};
window.db.from=function(table){
 function pick(){if(table==='profiles')return{data:D.profile,error:null};if(table==='venues')return{data:D.venues,error:null};if(table==='manager_venues')return{data:D.venues.map(function(v){return{venue_id:v.id,manager_id:D.profile.id,venues:v};}),error:null};if(table==='products')return{data:D.products,error:null};if(table==='orders')return{data:D.orders,error:null};if(table==='venue_tables')return{data:D.tables,error:null};if(table==='cooks')return{data:D.cooks,error:null};if(table==='couriers')return{data:D.couriers,error:null};if(table==='waiters')return{data:D.waiters,error:null};if(table==='subscriptions')return{data:[{id:'demo-subscription',manager_id:D.profile.id,venue_id:null,plan_id:'demo-plan',status:'trialing',current_period_end:new Date(Date.now()+10*86400000).toISOString(),created_at:new Date().toISOString()}],error:null};if(table==='plans')return{data:[{id:'demo-plan',name:'Демо Тариф',price:0,max_venues:3,max_cooks:10,max_couriers:10,max_waiters:10,max_products:100}],error:null};if(table==='menu_templates')return{data:D.menu_templates||[{id:'coffee',name:'Кофейня',slug:'coffee',emoji:'☕',description:'Готовое меню кофейни',is_active:true,sort_order:1,products:[{name:'Эспрессо',description:'30 мл.',price:150,category:'drink'}],niche:'coffee',scale_code:'M',target_product_count:1},{id:'shawarma',name:'Шаурма',slug:'shawarma',emoji:'🌯',description:'Готовое меню шаурмы',is_active:true,sort_order:2,products:[{name:'Шаурма классическая',description:'Курица, овощи, соус.',price:320,category:'main'}],niche:'shawarma_canteen',scale_code:'M',target_product_count:1}],error:null};return{data:[],error:null};}
 function chain(){var c={select:function(){return c;},eq:function(){return c;},in:function(){return c;},neq:function(){return c;},is:function(){return c;},or:function(){return c;},filter:function(){return c;},order:function(){return c;},limit:function(){return c;},range:function(){return c;},maybeSingle:function(){var p=pick();return Promise.resolve({data:Array.isArray(p.data)?(p.data[0]||null):p.data,error:p.error});},single:function(){var p=pick();return Promise.resolve({data:Array.isArray(p.data)?(p.data[0]||null):p.data,error:p.error});},then:function(a,b){return Promise.resolve(pick()).then(a,b);},catch:function(a){return Promise.resolve(pick()).catch(a);},insert:function(){return mutation();},update:function(){return mutation();},delete:function(){return mutation();},upsert:function(){return mutation();}};return c;}
 function mutation(){var c={eq:function(){return c;},in:function(){return c;},neq:function(){return c;},is:function(){return c;},or:function(){return c;},filter:function(){return c;},select:function(){return c;},single:function(){return readOnlyResult();},maybeSingle:function(){return readOnlyResult();},then:function(a,b){return readOnlyResult().then(a,b);},catch:function(a){return readOnlyResult().catch(a);}};return c;}
 return chain();};}
function blockRedirects(){if(typeof window.safeRedirect==='function')window.safeRedirect=function(){};if(typeof window.requireAuth==='function')window.requireAuth=function(){return Promise.resolve(D.profile);};if(typeof window.logout==='function')window.logout=function(){localStorage.removeItem('qr_demo_mode');location.href='index.html';};}
function installUi(){function enableCreateButtons(){if(isStaff)return;var els=document.querySelectorAll('button,input,select,textarea');for(var i=0;i<els.length;i++){var e=els[i],t=((e.innerText||e.textContent||e.value||e.getAttribute('aria-label')||'')+'').toLowerCase();if(/\+\s*создать|создать заведение|создать$/.test(t))e.disabled=false;}}
 function run(){var banner=document.getElementById('qr-demo-readonly');if(banner)banner.remove();if(isStaff)return;enableCreateButtons();var els=document.querySelectorAll('button,input,select,textarea');for(var i=0;i<els.length;i++){var e=els[i],t=((e.innerText||e.textContent||e.value||e.getAttribute('aria-label')||'')+'').toLowerCase();if(/\+\s*создать|создать заведение|создать$/.test(t))continue;var nav=e.closest('nav,.sidebar,.sidebar-nav,[role="navigation"],[data-nav],.mobile-menu,.mobile-nav,.menu-toggle,.hamburger');if(nav)continue;if(/выйти|закрыть|назад|список|вкладк|меню|просмотр|открыть/.test(t))continue;if(e.tagName==='INPUT'||e.tagName==='SELECT'||e.tagName==='TEXTAREA'||/сохран|созда|добав|удал|измен|редакт|импорт|назнач|сброс|генер|обнов|старт|закрыть смен|открыть смен/.test(t))e.disabled=true;}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();setTimeout(run,300);setTimeout(run,800);setTimeout(run,1500);setTimeout(run,3000);
 if(!isStaff&&window.MutationObserver){var observer=new MutationObserver(function(){enableCreateButtons();});try{observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});}catch(e){}}
}
function forceManagerDemoState(){if(!isManager)return;var tries=0;var timer=setInterval(function(){tries++;var root=document.getElementById('app');var inst=root&&root.__vue_app__&&root.__vue_app__._instance;var vm=inst&&inst.proxy;if(vm){if(!vm.managerSubscription)vm.managerSubscription={id:'demo-subscription',manager_id:D.profile.id,venue_id:null,plan_id:'demo-plan',status:'trialing',current_period_end:new Date(Date.now()+10*86400000).toISOString()};if(!Array.isArray(vm.plans)||!vm.plans.length)vm.plans=[{id:'demo-plan',name:'Демо Тариф',price:0,max_venues:3,max_cooks:10,max_couriers:10,max_waiters:10,max_products:100}];}if(tries>100)clearInterval(timer);},100);}
patchDb();blockRedirects();installUi();forceManagerDemoState();
})();