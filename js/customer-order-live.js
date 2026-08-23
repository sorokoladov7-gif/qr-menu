(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname)) return;
if(window.__customerOrderLiveLoaded) return;
window.__customerOrderLiveLoaded=true;

var timer=null;
var contextTimer=null;
var current=null;
var venueId=null;
var lastPhone='';

var LABELS={
  new:['🆕','Заказ принят','Мы получили заказ и скоро начнём готовить'],
  changed:['⚠️','Заказ изменён','Повар изменил состав заказа'],
  cooking:['👨‍🍳','Готовится','Повар уже готовит ваш заказ'],
  ready:['✅','Готов','Заказ готов — можно забирать'],
  delivery:['🚗','В доставке','Курьер направляется к вам'],
  done:['🎉','Выполнен','Спасибо за заказ!'],
  cancelled:['❌','Отменён','Заказ был отменён']
};

function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function label(status){return LABELS[status]||['📦','Статус заказа','Заказ обрабатывается'];}

function getVm(){
  var app=document.getElementById('app');
  var inst=app&&app.__vue_app__&&app.__vue_app__._instance;
  return inst&&inst.proxy||null;
}

function getContext(){
  var vm=getVm();
  var v=vm&&vm.venue;
  var phone=String(localStorage.getItem('last_phone')||'').trim();
  if(!phone&&vm&&vm.form) phone=String(vm.form.phone||'').trim();
  if(!phone&&lastPhone) phone=lastPhone;
  if(v&&v.id){
    venueId=v.id;
    if(phone) lastPhone=phone;
    return {venueId:v.id,phone:phone,vm:vm};
  }
  var slug=new URLSearchParams(location.search).get('venue');
  if(!venueId&&slug&&window.db&&window.db.rpc){
    return window.db.rpc('public_venue_by_slug',{p_slug:slug}).then(function(r){
      var data=r&&!r.error?(Array.isArray(r.data)?r.data[0]:r.data):null;
      venueId=data&&data.id||null;
      return {venueId:venueId,phone:phone,vm:vm};
    });
  }
  return {venueId:venueId,phone:phone,vm:vm};
}

function ensurePanel(){
  var p=document.getElementById('customer-live-order');
  if(p) return p;
  if(!document.body)return null;
  p=document.createElement('div');
  p.id='customer-live-order';
  p.style.cssText='position:fixed;left:50%;bottom:82px;transform:translateX(-50%);z-index:99990;width:min(560px,calc(100% - 28px));background:rgba(15,23,42,.97);border:1px solid rgba(129,140,248,.45);border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.45);padding:16px;color:#fff;backdrop-filter:blur(14px);font-family:inherit;display:none;';
  document.body.appendChild(p);
  return p;
}

function syncVue(vm,order){
  if(!vm||!order)return;
  try{
    vm.tracking=order;
    vm.trackSearched=true;
    if(vm.view==='menu') vm.view='tracking';
  }catch(e){console.debug('[customer-order-live] vue sync',e);}
}

function render(order){
  if(!order || !order.status) return;
  current=order;
  var p=ensurePanel();
  if(!p)return;
  var l=label(order.status);
  var steps=['new','cooking','ready','done'];
  var idx=steps.indexOf(order.status);
  if(order.status==='delivery') idx=2;
  if(order.status==='cancelled') idx=-1;
  var html='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">';
  html+='<div><div style="font-size:12px;color:#94a3b8">Заказ №'+esc(order.order_number)+'</div>';
  html+='<div style="font-size:22px;font-weight:800;margin-top:2px">'+l[0]+' '+esc(l[1])+'</div></div>';
  html+='<button type="button" id="customer-live-close" style="border:0;background:rgba(255,255,255,.08);color:#cbd5e1;border-radius:9px;padding:7px 10px;cursor:pointer">✕</button></div>';
  html+='<div style="font-size:13px;color:#cbd5e1;margin-top:7px">'+esc(l[2])+'</div>';
  if(order.status!=='cancelled'){
    html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:14px">';
    ['Принят','Готовится','Готов','Выдан'].forEach(function(s,i){
      var active=i<=idx;
      html+='<div style="height:6px;border-radius:99px;background:'+(active?'#6366f1':'rgba(255,255,255,.12)')+'"></div>';
    });
    html+='</div>';
  }
  html+='<div style="display:flex;justify-content:space-between;margin-top:11px;font-size:13px;color:#94a3b8"><span>Обновляется автоматически</span><b style="color:#fff">'+Number(order.total_price||0).toLocaleString('ru-RU')+' ₽</b></div>';
  p.innerHTML=html;
  p.style.display='block';
  var close=document.getElementById('customer-live-close');
  if(close) close.onclick=function(){p.style.display='none';};
}

function poll(){
  var context=getContext();
  Promise.resolve(context).then(function(c){
    if(!c||!c.venueId||!c.phone||!window.db||!window.db.rpc)return null;
    lastPhone=c.phone;
    localStorage.setItem('last_phone',c.phone);
    return window.db.rpc('customer_track_order_json',{p_venue_id:c.venueId,p_customer_phone:c.phone}).then(function(r){
      if(!r||r.error){console.debug('[customer-order-live] RPC error',r&&r.error);return;}
      var data=Array.isArray(r.data)?r.data[0]:r.data;
      if(data&&data.id){syncVue(c.vm,data);render(data);}
    });
  }).catch(function(e){console.debug('[customer-order-live]',e);});
}

function start(){
  poll();
  if(timer)clearInterval(timer);
  timer=setInterval(poll,3000);
  if(contextTimer)clearInterval(contextTimer);
  contextTimer=setInterval(function(){
    var c=getContext();
    Promise.resolve(c).then(function(x){if(x&&x.venueId&&x.phone){poll();clearInterval(contextTimer);contextTimer=null;}});
  },500);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();
})();
