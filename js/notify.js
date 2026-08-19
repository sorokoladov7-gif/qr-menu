/**
 * notify.js — звук + вибрация + push-уведомления для персонала.
 * Подключать в cook.html, courier.html, waiter.html ПОСЛЕ config.js.
 */
(function(){
'use strict';
if(!/(cook|courier|waiter)\.html$/i.test(location.pathname)) return;

let audioCtx = null;
const seen = new Set();       // уже уведомлённые заказы
const seenReady = new Set();  // уже уведомлённые "готово"

function ensureAudio(){
  if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
}

function beep(times, freq){
  ensureAudio(); if(!audioCtx) return;
  try{
    for(let i=0;i<times;i++){
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type='sine'; o.frequency.value=freq||880;
      const t=audioCtx.currentTime+i*0.35;
      g.gain.setValueAtTime(0.001,t);
      g.gain.exponentialRampToValueAtTime(0.4,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      o.start(t); o.stop(t+0.3);
    }
  }catch(e){}
}

function vibrate(pattern){ try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){} }

function requestPerm(){
  if('Notification' in window && Notification.permission==='default') Notification.requestPermission();
}

function notify(title, body){
  if('Notification' in window && Notification.permission==='granted'){
    try{ new Notification(title,{body,icon:'/icon-192.png'}); }catch(e){}
  }
}

function tableTxt(o){ return o.table_number!=null ? ' · Стол '+o.table_number : ''; }

function watch(){
  const orders = window.__staffTableOrders;
  if(!Array.isArray(orders) || !orders.length) return;
  const path = location.pathname.toLowerCase();
  const isCook = path.indexOf('cook')>=0;
  const isCourier = path.indexOf('courier')>=0;
  const isWaiter = path.indexOf('waiter')>=0;

  orders.forEach(function(o){
    // Новый / изменённый заказ → повару и официанту
    if((o.status==='new'||o.status==='changed') && (isCook||isWaiter) && !seen.has(o.id)){
      seen.add(o.id);
      beep(2, 880);
      vibrate([200,100,200]);
      notify('🆕 Новый заказ №'+o.order_number,
        (o.customer_name||'Клиент')+tableTxt(o)+' · '+Number(o.total_price||0).toLocaleString('ru-RU')+' ₽');
    }
    // Готов → официанту и курьеру
    if(o.status==='ready' && (isWaiter||isCourier) && !seenReady.has(o.id)){
      seenReady.add(o.id);
      beep(1, 660);
      vibrate([150]);
      notify('✅ Заказ №'+o.order_number+' готов',
        o.order_type==='delivery'?'Заберите для доставки':'Выдайте клиенту');
    }
  });
}

requestPerm();
// Разблокировать звук при первом касании (требование мобильных браузеров)
document.addEventListener('touchstart', function unlock(){
  ensureAudio();
  document.removeEventListener('touchstart', unlock);
}, {once:true});
document.addEventListener('click', ensureAudio);

setInterval(watch, 1500);
})();
