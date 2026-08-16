(function(){
'use strict';
if(!/\/(cook|courier|waiter)\.html$/i.test(location.pathname))return;
var cache=[];
var tableMap={};
var loading=false;

function vm(){
 var el=document.getElementById('app');
 if(!el)return null;
 try{
  if(el.__vueParentComponent&&el.__vueParentComponent.proxy)return el.__vueParentComponent.proxy;
  if(el.__vue_app__&&el.__vue_app__._instance&&el.__vue_app__._instance.proxy)return el.__vue_app__._instance.proxy;
 }catch(e){}
 return null;
}
function styles(){
 if(document.getElementById('staff-table-style'))return;
 var s=document.createElement('style');s.id='staff-table-style';
 s.textContent='.staff-table-badge{display:block!important;margin:7px 0 8px!important;padding:8px 10px!important;border-radius:10px!important;background:rgba(99,102,241,.16)!important;border:1px solid rgba(129,140,248,.3)!important;color:#c7d2fe!important;font-size:13px!important;font-weight:800!important}.staff-table-badge.no-table{background:rgba(148,163,184,.08)!important;border-color:rgba(148,163,184,.15)!important;color:#94a3b8!important}';
 document.head.appendChild(s);
}
function currentOrders(x){
 var o=x&&x.orders;
 if(Array.isArray(o))return o;
 if(o&&Array.isArray(o.value))return o.value;
 return [];
}
function getSession(x){
 if(x&&x.session)return x.session;
 var key=location.pathname.toLowerCase().indexOf('waiter')>-1?'waiter_session':location.pathname.toLowerCase().indexOf('courier')>-1?'courier_session':'cook_session';
 try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}
}
async function loadTables(x,orders){
 var s=getSession(x);if(!s||!s.venueId)return;
 var ids=(orders||[]).map(function(o){return o&&o.table_id;}).filter(Boolean);
 if(!ids.length)return;
 try{
  var r=await db.from('venue_tables').select('id,table_number,name').eq('venue_id',s.venueId).in('id',ids);
  if(!r.error){tableMap={};(r.data||[]).forEach(function(t){tableMap[String(t.id)]=t;});}
 }catch(e){}
}
function inject(){
 styles();
 var x=vm();
 var orders=currentOrders(x);
 var source=orders.length?orders:cache;
 if(!source.length)return;
 document.querySelectorAll('.wcard').forEach(function(card){
  var head=card.querySelector('.spread');if(!head)return;
  var b=head.querySelector('b');if(!b)return;
  var m=String(b.textContent||'').match(/\d+/);if(!m)return;
  var order=source.find(function(o){return String(o.order_number)===String(m[0]);});if(!order)return;
  var t=order.table_id?tableMap[String(order.table_id)]:null;
  var has=!!(t||(order.table_number!=null)||order.table_name);
  var text=has?'🪑 '+((t&&t.name)||order.table_name||('Стол '+((t&&t.table_number)!=null?t.table_number:order.table_number))):'📦 Без стола';
  var old=card.querySelector('.staff-table-badge');
  if(old){old.textContent=text;old.className='staff-table-badge'+(has?'':' no-table');return;}
  var badge=document.createElement('div');badge.className='staff-table-badge'+(has?'':' no-table');badge.textContent=text;
  head.insertAdjacentElement('afterend',badge);
 });
}
async function run(){
 styles();
 var x=vm();if(!x)return;
 var orders=currentOrders(x);
 if(orders.length)cache=orders;
 await loadTables(x,orders.length?orders:cache);
 inject();
}
function start(){
 styles();run();
 new MutationObserver(function(){inject();}).observe(document.body,{childList:true,subtree:true});
 setInterval(run,2000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();