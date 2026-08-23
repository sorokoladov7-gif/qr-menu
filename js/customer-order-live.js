(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname)) return;
if(window.__customerOrderLiveLoaded) return;
window.__customerOrderLiveLoaded=true;

var timer=null;
var hookTimer=null;
var hookedVm=null;
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
function getVm(){var app=document.getElementById('app');var inst=app&&app.__vue_app__&&app.__vue_app__._instance;return inst&&inst.proxy||null;}
function context(vm){
  var phone=String(localStorage.getItem('last_phone')||'').trim();
  if(!phone&&vm&&vm.form)phone=String(vm.form.phone||'').trim();
  var v=vm&&vm.venue;
  if(v&&v.id){venueId=v.id;if(phone)lastPhone=phone;}
  if(!phone)phone=lastPhone;
  if(!venueId){var stored=localStorage.getItem('last_venue_id');if(stored)venueId=stored;}
  return {venueId:venueId,phone:phone,vm:vm};
}
function ensurePanel(){
  var p=document.getElementById('customer-live-order');
  if(p)return p;
  if(!document.body)return null;
  p=document.createElement('div');p.id='customer-live-order';
  p.style.cssText='position:fixed;left:50%;bottom:82px;transform:translateX(-50%);z-index:2147483647;width:min(560px,calc(100% - 28px));background:rgba(15,23,42,.98);border:1px solid rgba(129,140,248,.55);border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.5);padding:16px;color:#fff;backdrop-filter:blur(14px);font-family:inherit;display:none;';
  document.body.appendChild(p);return p;
}
function render(order){
  if(!order||!order.status)return;
  var p=ensurePanel();if(!p)return;
  var l=LABELS[order.status]||['📦','Статус заказа','Заказ обрабатывается'];
  var steps=['new','cooking','ready','done'];var idx=steps.indexOf(order.status);if(order.status==='delivery')idx=2;if(order.status==='cancelled')idx=-1;
  var h='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-size:12px;color:#94a3b8">Заказ №'+esc(order.order_number)+'</div><div style="font-size:22px;font-weight:800;margin-top:2px">'+l[0]+' '+esc(l[1])+'</div></div><button type="button" id="customer-live-close" style="border:0;background:rgba(255,255,255,.08);color:#cbd5e1;border-radius:9px;padding:7px 10px;cursor:pointer">✕</button></div>';
  h+='<div style="font-size:13px;color:#cbd5e1;margin-top:7px">'+esc(l[2])+'</div>';
  if(order.status!=='cancelled'){h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:14px">';['Принят','Готовится','Готов','Выдан'].forEach(function(s,i){h+='<div style="height:6px;border-radius:99px;background:'+(i<=idx?'#6366f1':'rgba(255,255,255,.12)')+'"></div>';});h+='</div>';}
  h+='<div style="display:flex;justify-content:space-between;margin-top:11px;font-size:13px;color:#94a3b8"><span>Обновляется автоматически</span><b style="color:#fff">'+Number(order.total_price||0).toLocaleString('ru-RU')+' ₽</b></div>';
  p.innerHTML=h;p.style.display='block';var close=document.getElementById('customer-live-close');if(close)close.onclick=function(){p.style.display='none';};
}
function fetchOrder(vm){
  var c=context(vm);
  if(!c.venueId||!c.phone||!window.db||typeof window.db.rpc!=='function')return Promise.resolve(null);
  localStorage.setItem('last_phone',c.phone);localStorage.setItem('last_venue_id',String(c.venueId));
  return window.db.rpc('customer_track_order_json',{p_venue_id:c.venueId,p_customer_phone:c.phone}).then(function(r){
    if(r&&r.error){console.error('[customer-order-live] tracking RPC error',r.error);return null;}
    var data=r&&r.data;if(Array.isArray(data))data=data[0]||null;
    if(data&&data.id){
      try{vm.tracking=data;vm.trackSearched=true;}catch(e){}
      render(data);return data;
    }
    return null;
  }).catch(function(e){console.error('[customer-order-live] tracking failed',e);return null;});
}
function installHook(vm){
  if(!vm||hookedVm===vm)return;
  hookedVm=vm;
  vm.trackOrder=function(){return fetchOrder(vm);};
  vm.startTrackingTimer=function(){if(vm.trackTimer)clearInterval(vm.trackTimer);vm.trackTimer=setInterval(function(){if(vm.view==='tracking')fetchOrder(vm);},3000);};
  if(vm.view==='tracking'&&context(vm).phone)fetchOrder(vm);
}
function boot(){
  var n=0;
  function hook(){var vm=getVm();if(vm)installHook(vm);if(++n<120)hookTimer=setTimeout(hook,250);}
  hook();
  if(timer)clearInterval(timer);
  timer=setInterval(function(){var vm=getVm();if(vm){installHook(vm);if(context(vm).phone)fetchOrder(vm);}},3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
