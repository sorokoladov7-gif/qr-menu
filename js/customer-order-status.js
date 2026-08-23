(function(){
'use strict';
if(window.__customerOrderStatusLoaded)return;
window.__customerOrderStatusLoaded=true;

var timer=null;
var lastOrderId=null;

function statusLabel(status){
  return ({new:'Принят',changed:'Изменён',cooking:'Готовится',ready:'Готов',delivery:'Передан в доставку',done:'Выполнен',cancelled:'Отменён'})[status]||status||'Ожидание';
}
function statusStep(status){return ({new:1,changed:1,cooking:2,ready:3,delivery:3,done:4,cancelled:0})[status]||1;}
function esc(v){var d=document.createElement('div');d.textContent=String(v==null?'':v);return d.innerHTML;}

function getVm(){
  var app=document.getElementById('app');
  var inst=app&&app.__vue_app__&&app.__vue_app__._instance;
  return inst&&inst.proxy||null;
}
function getContext(){
  var vm=getVm();
  var venue=vm&&vm.venue;
  var phone=localStorage.getItem('last_phone')||'';
  if(!phone&&vm&&vm.form)phone=vm.form.phone||'';
  if(venue&&venue.id&&phone)return {venueId:venue.id,phone:String(phone).trim()};
  return null;
}
function ensurePanel(){
  var p=document.getElementById('customer-order-status-live');
  if(p)return p;
  if(!document.body)return null;
  p=document.createElement('div');
  p.id='customer-order-status-live';
  p.style.cssText='position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:100000;width:min(520px,calc(100% - 24px));padding:16px;background:rgba(15,23,42,.98);color:#fff;border:1px solid rgba(99,102,241,.5);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.45);font-family:inherit;display:none;';
  document.body.appendChild(p);
  return p;
}
function render(order){
  if(!order||!order.status)return;
  var p=ensurePanel();
  if(!p)return;
  var s=order.status, step=statusStep(s);
  var labels=['Принят','Готовится','Готов','Выполнен'];
  var html='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">'
    +'<div><div style="font-size:12px;color:#94a3b8">Заказ №'+esc(order.order_number||'')+'</div>'
    +'<div style="font-size:22px;font-weight:800;margin-top:3px">'+esc(statusLabel(s))+'</div></div>'
    +'<button id="customer-order-status-close" type="button" style="border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:9px;padding:7px 10px;cursor:pointer">✕</button></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:14px">';
  labels.forEach(function(x,i){html+='<div title="'+x+'" style="height:7px;border-radius:99px;background:'+(step>=i+1?'#6366f1':'rgba(255,255,255,.12)')+'"></div>';});
  html+='</div><div style="display:flex;justify-content:space-between;margin-top:9px;font-size:12px;color:#94a3b8"><span>'+esc(labels[Math.max(0,Math.min(step-1,3))])+'</span><span>обновление каждые 3 сек.</span></div>';
  if(s==='cancelled')html+='<div style="margin-top:8px;color:#f87171"><b>Заказ отменён</b></div>';
  p.innerHTML=html;
  p.style.display='block';
  var close=document.getElementById('customer-order-status-close');
  if(close)close.onclick=function(){p.style.display='none';};
}
function poll(){
  var c=getContext();
  if(!c||!window.db||typeof window.db.rpc!=='function')return;
  window.db.rpc('customer_track_order_json',{p_venue_id:c.venueId,p_customer_phone:c.phone}).then(function(r){
    if(r.error||!r.data)return;
    var order=Array.isArray(r.data)?r.data[0]:r.data;
    if(order&&order.id){lastOrderId=order.id;render(order);}
  }).catch(function(e){console.debug('[customer-order-status]',e);});
}
function start(){
  poll();
  if(timer)clearInterval(timer);
  timer=setInterval(poll,3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
