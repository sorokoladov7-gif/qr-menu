(function(){
'use strict';
if(window.__customerOrderStatusLoaded)return;
window.__customerOrderStatusLoaded=true;

var pollTimer=null;
var hookTimer=null;
var hookedVm=null;

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
function getPhone(vm){var p=String(localStorage.getItem('last_phone')||'').trim();if(!p&&vm&&vm.form)p=String(vm.form.phone||'').trim();return p;}
function getVenueId(vm){return vm&&vm.venue&&vm.venue.id?vm.venue.id:null;}
function saveContext(vm){var p=getPhone(vm),v=getVenueId(vm);if(p)localStorage.setItem('last_phone',p);if(v)localStorage.setItem('last_venue_id',String(v));return{phone:p,venueId:v};}

function ensurePanel(){
  var p=document.getElementById('customer-order-status-live');
  if(p)return p;
  if(!document.body)return null;
  p=document.createElement('div');
  p.id='customer-order-status-live';
  p.style.cssText='position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:2147483647;width:min(560px,calc(100% - 24px));padding:16px;background:rgba(15,23,42,.98);color:#fff;border:1px solid rgba(99,102,241,.55);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.5);font-family:inherit;display:none;pointer-events:auto;';
  document.body.appendChild(p);
  return p;
}
function render(order){
  if(!order||!order.status)return;
  var p=ensurePanel();if(!p)return;
  var l=LABELS[order.status]||['📦','Статус заказа','Заказ обрабатывается'];
  var steps=['new','cooking','ready','done'];
  var idx=steps.indexOf(order.status);if(order.status==='delivery')idx=2;if(order.status==='cancelled')idx=-1;
  var h='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">';
  h+='<div><div style="font-size:12px;color:#94a3b8">Заказ №'+esc(order.order_number||'')+'</div><div style="font-size:22px;font-weight:800;margin-top:3px">'+l[0]+' '+esc(l[1])+'</div></div>';
  h+='<button id="customer-order-status-close" type="button" style="border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:9px;padding:7px 10px;cursor:pointer">✕</button></div>';
  h+='<div style="font-size:13px;color:#cbd5e1;margin-top:7px">'+esc(l[2])+'</div>';
  if(order.status!=='cancelled'){
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:14px">';
    ['Принят','Готовится','Готов','Выдан'].forEach(function(x,i){h+='<div style="height:7px;border-radius:99px;background:'+(i<=idx?'#6366f1':'rgba(255,255,255,.12)')+'"></div>';});
    h+='</div>';
  }
  h+='<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#94a3b8"><span>Обновляется автоматически</span><b style="color:#fff">'+Number(order.total_price||0).toLocaleString('ru-RU')+' ₽</b></div>';
  p.innerHTML=h;p.style.display='block';
  var close=document.getElementById('customer-order-status-close');if(close)close.onclick=function(){p.style.display='none';};
}

function fetchOrder(vm){
  var c=saveContext(vm);
  if(!c.venueId||!c.phone||!window.db||typeof window.db.rpc!=='function')return Promise.resolve(null);
  return window.db.rpc('customer_track_order_json',{p_venue_id:c.venueId,p_customer_phone:c.phone}).then(function(r){
    if(r&&r.error){console.error('[customer-order-status] tracking RPC error',r.error);return null;}
    var o=r&&r.data; if(Array.isArray(o))o=o[0]||null;
    if(o&&o.id){
      try{vm.tracking=o;vm.trackSearched=true;}catch(e){}
      render(o);
      return o;
    }
    return null;
  });
}

function installVueHook(vm){
  if(!vm||hookedVm===vm)return;
  hookedVm=vm;
  var originalTrack=vm.trackOrder;
  vm.trackOrder=function(){return fetchOrder(vm);};
  vm.startTrackingTimer=function(){
    if(vm.trackTimer)clearInterval(vm.trackTimer);
    vm.trackTimer=setInterval(function(){if(vm.view==='tracking')fetchOrder(vm);},3000);
  };
  if(vm.view==='tracking'&&getPhone(vm))fetchOrder(vm);
  else if(getPhone(vm)){
    setTimeout(function(){
      var current=getVm();
      if(current===vm&&current.view==='tracking')fetchOrder(current);
    },100);
  }
  // Preserve the original method only as a diagnostic reference; all customer tracking now uses the RPC.
  vm.__legacyTrackOrder=originalTrack;
}

function boot(){
  var attempts=0;
  function tick(){
    var vm=getVm();
    if(vm){installVueHook(vm);saveContext(vm);}
    if(++attempts<120)hookTimer=setTimeout(tick,250);
  }
  tick();
  if(pollTimer)clearInterval(pollTimer);
  pollTimer=setInterval(function(){var vm=getVm();if(vm){installVueHook(vm);if(getPhone(vm))fetchOrder(vm);}},3000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
