(function(){
'use strict';
if(!/\/(cook|courier|waiter)\.html$/i.test(location.pathname))return;

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
 s.textContent='.staff-table-badge{display:block!important;margin:7px 0 8px!important;padding:7px 10px!important;border-radius:10px!important;background:rgba(99,102,241,.16)!important;border:1px solid rgba(129,140,248,.3)!important;color:#c7d2fe!important;font-size:13px!important;font-weight:800!important}.staff-table-badge.no-table{background:rgba(148,163,184,.08)!important;border-color:rgba(148,163,184,.15)!important;color:#94a3b8!important}';
 document.head.appendChild(s);
}
function inject(){
 styles();
 var x=vm();
 if(!x||!Array.isArray(x.orders))return;
 var orders=x.orders;
 document.querySelectorAll('.wcard').forEach(function(card){
  var head=card.querySelector('.spread');
  if(!head)return;
  var b=head.querySelector('b');
  if(!b)return;
  var m=String(b.textContent||'').match(/\d+/);
  if(!m)return;
  var order=orders.find(function(o){return String(o.order_number)===String(m[0]);});
  if(!order)return;
  var old=card.querySelector('.staff-table-badge');
  var text=order.table_id?'🪑 '+(order.table_name||('Стол '+order.table_number)):'📦 Без стола';
  if(old){if(old.textContent!==text)old.textContent=text;return;}
  var badge=document.createElement('div');
  badge.className='staff-table-badge'+(order.table_id?'':' no-table');
  badge.textContent=text;
  head.insertAdjacentElement('afterend',badge);
 });
}
function start(){
 styles();
 inject();
 new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});
 setInterval(inject,1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();