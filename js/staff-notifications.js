(function(){
'use strict';
var path = location.pathname.toLowerCase();
var isStaff = /\/(cook|courier|waiter)\.html$/i.test(path);
if(!isStaff) return;
if(window.__staffNotifications) return;
window.__staffNotifications = true;

var knownIds = new Set();
var firstLoad = true;
var audioCtx = null;
var permissionAsked = false;

// Запрос разрешения на уведомления при первом взаимодействии
function requestPermission(){
  if(permissionAsked) return;
  permissionAsked = true;
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
  // Разблокировка аудио
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var buf = audioCtx.createBuffer(1, 1, 22050);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  }catch(e){}
}
document.addEventListener('click', requestPermission);
document.addEventListener('touchstart', requestPermission);

// Звук нового заказа (генерируется программно)
function playSound(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var now = audioCtx.currentTime;
    // Два тона: короткий сигнал
    [0, 0.15].forEach(function(offset, i){
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1100;
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }catch(e){}
}

// Показ уведомления
function showNotification(order){
  var typeLabel = order.order_type === 'delivery' ? '🚗 Доставка' : '🏠 Самовывоз';
  var title = '🆕 Новый заказ №' + order.order_number;
  var body = typeLabel + ' · ' + (order.customer_name || 'Клиент') + ' · ' + Number(order.total_price || 0).toLocaleString('ru-RU') + ' ₽';

  // Браузерное уведомление
  if('Notification' in window && Notification.permission === 'granted'){
    try{
      var n = new Notification(title, { body: body, tag: 'order-' + order.id, requireInteraction: false });
      n.onclick = function(){ window.focus(); n.close(); };
    }catch(e){}
  }

  // Звук
  playSound();

  // Визуальный toast на странице
  showToast(title + ' · ' + body);
}

function showToast(text){
  var t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff;padding:12px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:100002;box-shadow:0 8px 25px rgba(0,0,0,.4);animation:sn-slide .3s ease';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(function(){
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(function(){ t.remove(); }, 300);
  }, 4000);
}

// Добавляем CSS анимацию
(function(){
  var s = document.createElement('style');
  s.textContent = '@keyframes sn-slide{from{transform:translate(-50%,-20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}';
  document.head.appendChild(s);
})();

// Проверка новых заказов (читает window.__staffTableOrders из config.js)
function checkOrders(){
  var orders = window.__staffTableOrders;
  if(!orders || !Array.isArray(orders)) return;

  // При первой загрузке — запоминаем все текущие без уведомлений
  if(firstLoad){
    orders.forEach(function(o){ knownIds.add(o.id); });
    firstLoad = false;
    return;
  }

  orders.forEach(function(o){
    if(!knownIds.has(o.id)){
      knownIds.add(o.id);
      // Уведомляем только о новых и изменённых заказах
      if(o.status === 'new' || o.status === 'changed'){
        showNotification(o);
      }
    }
  });
}

// Запускаем проверку каждые 2 секунды
setInterval(checkOrders, 2000);
console.info('[notifications] Уведомления о новых заказах активны');
})();
