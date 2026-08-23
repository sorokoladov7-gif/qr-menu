(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname)) return;
if(window.__customerOrderLiveLoaded) return;
window.__customerOrderLiveLoaded=true;

var timer=null;
var current=null;
var venueId=null;

var LABELS={
  new:['🆕','Заказ принят','Мы получили заказ и скоро начнём готовить'],
  changed:['⚠️','Заказ изменён','Повар изменил состав заказа'],
  cooking:['👨‍🍳','Готовится','Повар уже готовит ваш заказ'],
  ready:['✅','Готов','Заказ готов — можно забирать'],
  delivery:['🚗','В доставке','Курьер направляется к вам'],
  done:['🎉','Выполнен','Спасибо за заказ!'],
  cancelled:['❌','Отменён','Заказ был отменён']
};

function esc(v){
  return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});
}
function label(status){return LABELS[status]||['📦','Статус заказа','Заказ обрабатывается'];}
function getPhone(){return String(localStorage.getItem('last_phone')||'').trim();}

function getVenue(){
  if(venueId) return Promise.resolve(venueId);
  var slug=new URLSearchParams(location.search).get('venue');
  if(!slug || !window.db || !window.db.rpc) return Promise.resolve(null);
  return window.db.rpc('public_venue_by_slug',{p_slug:slug}).then(function(r){
    var v=Array.isArray(r.data)?r.data[0]:r.data;
    venueId=v&&v.id||null;
    return venueId;
  });
}

function ensurePanel(){
  var p=document.getElementById('customer-live-order');
  if(p) return p;
  p=document.createElement('div');
  p.id='customer-live-order';
  p.style.cssText='position:fixed;left:50%;bottom:82px;transform:translateX(-50%);z-index:99990;width:min(560px,calc(100% - 28px));background:rgba(15,23,42,.97);border:1px solid rgba(129,140,248,.45);border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.45);padding:16px;color:#fff;backdrop-filter:blur(14px);font-family:inherit;display:none;';
  document.body.appendChild(p);
  return p;
}

function render(order){
  if(!order || !order.status) return;
  current=order;
  var p=ensurePanel();
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
  var phone=getPhone();
  if(!phone) return;
  getVenue().then(function(vid){
    if(!vid || !window.db || !window.db.rpc) return;
    return window.db.rpc('customer_track_order_json',{p_venue_id:vid,p_customer_phone:phone});
  }).then(function(r){
    if(!r || r.error || !r.data) return;
    var data=Array.isArray(r.data)?r.data[0]:r.data;
    if(data && data.id) render(data);
  }).catch(function(e){console.debug('[customer-order-live]',e);});
}

function start(){
  poll();
  if(timer) clearInterval(timer);
  timer=setInterval(poll,3000);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();
})();
