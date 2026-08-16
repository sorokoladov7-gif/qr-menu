(function(){
'use strict';

var staffPath=/\/(cook|courier|waiter)\.html$/i;
if(!staffPath.test(location.pathname)) return;

function getVM(){
  var root=document.getElementById('app');
  if(!root) return null;
  try{
    if(root.__vueParentComponent&&root.__vueParentComponent.proxy) return root.__vueParentComponent.proxy;
    if(root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy) return root.__vue_app__._instance.proxy;
  }catch(e){}
  return null;
}

function addStyles(){
  if(document.getElementById('staff-table-badge-style')) return;
  var s=document.createElement('style');
  s.id='staff-table-badge-style';
  s.textContent='.staff-table-badge{display:inline-flex;align-items:center;gap:5px;margin:6px 0 2px;padding:5px 9px;border-radius:999px;background:rgba(99,102,241,.14);border:1px solid rgba(129,140,248,.28);color:#c7d2fe;font-size:12px;font-weight:700}.staff-table-badge.no-table{background:rgba(148,163,184,.08);border-color:rgba(148,163,184,.16);color:#94a3b8}';
  document.head.appendChild(s);
}

function inject(){
  var vm=getVM();
  if(!vm||!vm.orders||!vm.orders.length) return;
  var byNumber={};
  vm.orders.forEach(function(o){byNumber[String(o.order_number)]=o;});
  document.querySelectorAll('.wcard').forEach(function(card){
    if(card.querySelector('.staff-table-badge')) return;
    var first=card.querySelector('.spread b');
    if(!first) return;
    var m=String(first.textContent||'').match(/(\d+)/);
    if(!m) return;
    var order=byNumber[m[1]];
    if(!order) return;
    var badge=document.createElement('div');
    badge.className='staff-table-badge'+(order.table_id?'':' no-table');
    badge.textContent=order.table_id?'🪑 '+(order.table_name||('Стол '+order.table_number)):'📦 Без стола';
    first.parentElement.parentElement.insertAdjacentElement('afterend',badge);
  });
}

function start(){
  addStyles();
  inject();
  var observer=new MutationObserver(function(){inject();});
  if(document.body) observer.observe(document.body,{childList:true,subtree:true});
  [300,800,1500,3000,5000].forEach(function(ms){setTimeout(inject,ms);});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();