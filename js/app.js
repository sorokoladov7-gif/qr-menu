window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',arrived:'📍 Курьер на месте',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',arrived:'#f472b6',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ return ({main:'🍽 Блюдо',drink:'🥤 Напиток',addon:'🧂 Доп',breakfast:'🍳 Завтрак',salad:'🥗 Салат',soup:'🍲 Суп',dessert:'🍰 Десерт',sauce:'🌶 Соус',snack:'🥨 Закуска',hot:'🔥 Горячее',bbq:'🥩 Гриль'}[c]||'🍽 Блюдо'); };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

function safeRedirect(fallbackUrl, reason) {
  var last = parseInt(sessionStorage.getItem('last_redirect') || '0', 10), now = Date.now();
  if (now - last < 3000) {
    document.body.innerHTML = '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Ваш email авторизован, но профиль не найден в базе данных.</p><p><b>Причина:</b> '+(reason||'неизвестно')+'</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px">🔄 Очистить и попробовать снова</button></div>';
    return;
  }
  sessionStorage.setItem('last_redirect',String(now)); location.href=fallbackUrl;
}
async function requireAuth(roles){
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session){safeRedirect('index.html','нет активной сессии');return null;}
    const {data:profile,error}=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(error){console.error('Profile fetch error:',error);safeRedirect('index.html','ошибка чтения профиля: '+error.message);return null;}
    if(!profile){const {data:newProfile,error:insertError}=await db.from('profiles').insert({id:session.user.id,email:session.user.email,display_name:session.user.user_metadata?.display_name||session.user.email,role:'manager'}).select().single();if(insertError||!newProfile){safeRedirect('index.html','профиль не найден и не создан. Выполните SQL в Supabase');return null;}return newProfile;}
    if(roles&&roles.length&&roles.indexOf(profile.role)===-1){safeRedirect('index.html','нет доступа: нужна роль '+roles.join('/')+', у вас '+profile.role);return null;}
    return profile;
  }catch(e){console.error(e);safeRedirect('index.html','исключение: '+e.message);return null;}
}
async function logout(){try{await db.auth.signOut();}catch(e){}sessionStorage.clear();location.href='index.html';}

/* MENU: bind the legacy DELIVERY_FEE global used by menu.html to the selected venue. */
(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname))return;
var lastVenueId=null,lastFee=null;
function sync(){
  var el=document.getElementById('app');
  if(!el)return;
  try{
    var vm=el.__vueParentComponent?.proxy||el.__vue_app__?._instance?.proxy||null;
    if(!vm||!vm.venue)return;
    var id=vm.venue.id, raw=vm.venue.delivery_fee;
    var fee=raw===null||raw===undefined||raw===''?150:Number(raw);
    if(!isFinite(fee)||fee<0)fee=150;
    if(id!==lastVenueId||fee!==lastFee){window.DELIVERY_FEE=fee;lastVenueId=id;lastFee=fee;}
  }catch(e){}
}
if(typeof window.DELIVERY_FEE==='undefined')window.DELIVERY_FEE=150;
function start(){sync();setInterval(sync,250);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* Manager: secure PIN reset controls for cooks, couriers and waiters. */
(function(){
'use strict';
function getVue(){var el=document.getElementById('app');if(!el)return null;try{return el.__vueParentComponent?.proxy||el.__vue_app__?._instance?.proxy||null;}catch(e){return null;}}
function staffTypeFromCard(card){var t=(card.textContent||'').toLowerCase();if(t.indexOf('cook.html')>=0)return 'cook';if(t.indexOf('курьер')>=0)return 'courier';if(t.indexOf('официант')>=0)return 'waiter';return null;}
function staffArray(vm,type){return type==='cook'?vm.cooks:type==='courier'?vm.couriers:vm.waiters;}
window.resetStaffPin=async function(type,index,button){var vm=getVue();if(!vm)return;var arr=staffArray(vm,type)||[],staff=arr[Number(index)];if(!staff||!staff.id)return;if(!confirm('Сбросить PIN сотрудника «'+staff.name+'»? Старый PIN перестанет работать.'))return;if(button){button.disabled=true;button.textContent='⏳ Сброс...';}try{var r=await db.rpc('manager_reset_staff_pin',{p_staff_type:type,p_staff_id:staff.id});if(r.error)throw r.error;var data=r.data||{};alert('Новый PIN для '+staff.name+': '+data.pin+'\n\nСообщите его сотруднику. Старый PIN больше не действует.');if(type==='cook'&&vm.loadCooks)await vm.loadCooks();if(type==='courier'&&vm.loadCouriers)await vm.loadCouriers();if(type==='waiter'&&vm.loadWaiters)await vm.loadWaiters();}catch(e){console.error('PIN reset error',e);alert('Не удалось сбросить PIN: '+(e.message||String(e)));}finally{if(button){button.disabled=false;button.textContent='🔄 Сбросить PIN';}}};
function installManagerResetButtons(){if(!/\/manager\.html$/i.test(location.pathname))return;var vm=getVue();if(!vm)return;var cards=[].slice.call(document.querySelectorAll('#app .menu-item')).filter(function(c){return staffTypeFromCard(c);});cards.forEach(function(card){if(card.querySelector('.manager-reset-pin'))return;var type=staffTypeFromCard(card),arr=staffArray(vm,type)||[];var name=(card.textContent||'').replace(/\s+/g,' ').trim(),idx=-1;arr.some(function(s,i){if(name.indexOf(s.name)>=0){idx=i;return true;}return false;});if(idx<0)return;var pinLine=card.querySelector('.muted');if(pinLine)pinLine.innerHTML=pinLine.innerHTML.replace(/PIN:\s*<b[^>]*>.*?<\/b>/i,'PIN: <b style="color:#a5b4fc">скрыт</b>');var btn=document.createElement('button');btn.type='button';btn.className='btn btn-ghost btn-sm manager-reset-pin';btn.textContent='🔄 Сбросить PIN';btn.onclick=function(ev){ev.stopPropagation();window.resetStaffPin(type,idx,btn);};var del=card.querySelector('.btn-danger');if(del)del.parentNode.insertBefore(btn,del);else card.appendChild(btn);});}
function startManagerReset(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installManagerResetButtons);else installManagerResetButtons();new MutationObserver(installManagerResetButtons).observe(document.body,{childList:true,subtree:true});setInterval(installManagerResetButtons,1500);}if(/\/manager\.html$/i.test(location.pathname))startManagerReset();
})();

/* QR TABLE DISPLAY */
(function(){
'use strict';var tableCache={},busy={};
function css(){if(document.getElementById('qr-table-display-css'))return;var s=document.createElement('style');s.id='qr-table-display-css';s.textContent='.qr-table-badge{display:block!important;box-sizing:border-box!important;margin:8px 0!important;padding:9px 12px!important;border-radius:11px!important;background:rgba(99,102,241,.18)!important;border:1px solid rgba(129,140,248,.38)!important;color:#e0e7ff!important;font-size:14px!important;font-weight:800!important;line-height:1.3!important}.qr-table-menu{display:block!important;box-sizing:border-box!important;margin:12px 0!important;padding:12px 14px!important;border-radius:13px!important;background:linear-gradient(135deg,rgba(99,102,241,.22),rgba(139,92,246,.12))!important;border:1px solid rgba(129,140,248,.4)!important;color:#fff!important;font-weight:800!important;text-align:center!important}.qr-table-floating{position:sticky!important;top:8px!important;z-index:30!important}';document.head.appendChild(s);}
function getVue(){var el=document.getElementById('app');if(!el)return null;try{return el.__vueParentComponent?.proxy||el.__vue_app__?._instance?.proxy||null;}catch(e){return null;}}
function session(){var p=location.pathname.toLowerCase(),k=p.indexOf('waiter')>=0?'waiter_session':p.indexOf('courier')>=0?'courier_session':'cook_session';try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function orderNumberFromCard(card){var b=card.querySelector('.spread b');var m=b&&String(b.textContent||'').match(/№\s*(\d+)/);return m?m[1]:null;}
async function tableById(id,venueId){if(!id)return null;var key=String(id);if(tableCache[key])return tableCache[key];if(busy[key])return null;busy[key]=1;try{var q=db.from('venue_tables').select('id,table_number,name,venue_id').eq('id',id);if(venueId)q=q.eq('venue_id',venueId);var r=await q.maybeSingle();if(!r.error&&r.data)tableCache[key]=r.data;return r.data||null;}catch(e){return null}finally{delete busy[key];}}
function label(t){if(!t)return '📦 Без стола';var n=t.table_number!=null?'Стол '+t.table_number:(t.name||'Стол');return '🪑 '+(t.name&&t.name!==n?t.name:n);}
async function staff(){var x=getVue();if(!x)return;var orders=Array.isArray(x.orders)?x.orders:[];var s=session();var venueId=s&&s.venueId;document.querySelectorAll('.wcard').forEach(async function(card){var no=orderNumberFromCard(card);if(!no)return;var o=orders.find(function(v){return String(v.order_number)===String(no);});if(!o)return;var t=o.table_id?await tableById(o.table_id,venueId):null;var text=label(t);var old=card.querySelector('.qr-table-badge');if(old){old.textContent=text;return;}var badge=document.createElement('div');badge.className='qr-table-badge';badge.textContent=text;var head=card.querySelector('.spread');if(head)head.insertAdjacentElement('afterend',badge);});}
async function client(){var x=getVue();if(!x||!x.venue)return;var venueId=x.venue.id;var token=new URLSearchParams(location.search).get('table');if(token){var r=await db.from('venue_tables').select('id,table_number,name,venue_id').eq('venue_id',venueId).eq('qr_token',token).maybeSingle();if(!r.error&&r.data){window.__qrTable=r.data;var host=document.querySelector('.hero');if(host&&!document.querySelector('.qr-table-menu')){var b=document.createElement('div');b.className='qr-table-menu qr-table-floating';b.textContent='🪑 '+(r.data.name||('Стол '+r.data.table_number));host.insertAdjacentElement('afterend',b);}}}var tr=x.tracking;if(tr&&tr.id){var t=null;if(tr.table_id)t=await tableById(tr.table_id,venueId);if(!t&&tr.table_number!=null)t={table_number:tr.table_number,name:tr.table_name};var card=document.querySelector('.order-card');if(card){var old=card.querySelector('.qr-table-badge');var b=old||document.createElement('div');b.className='qr-table-badge';b.textContent=label(t);if(!old){var sp=card.querySelector('.spread');if(sp)sp.insertAdjacentElement('afterend',b);}}}}
function run(){
  css();
  var p=location.pathname.toLowerCase();
  // client() убран — бейдж стола в меню обрабатывает config.js bootQrTable
  if(/(cook|waiter|courier).html$/i.test(p))staff();
}
function start(){run();new MutationObserver(run).observe(document.body,{childList:true,subtree:true});setInterval(run,1500);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

/* ADMIN: platform-controlled design access UI. */
(function(){
'use strict';
if(!/\/admin\.html$/i.test(location.pathname))return;
var s=document.createElement('script');s.src='/js/admin-design-access.js?v=1';s.defer=true;document.head.appendChild(s);
})();

/* ===== PWA: Service Worker registration and install prompt ===== */
(function(){
'use strict';

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(function(reg) {
      console.log('✅ Service Worker registered successfully.');
    })
    .catch(function(error) {
      console.warn('❌ Service Worker registration failed:', error);
    });
}

// Обработка beforeinstallprompt (показываем кнопку установки)
let deferredPrompt;

window.addEventListener('beforeinstallprompt', function(e) {
  // Предотвращаем автоматическое появление окна установки
  e.preventDefault();
  deferredPrompt = e;

  // Создаём кнопку установки
  var installBtn = document.getElementById('pwa-install-btn');
  if (!installBtn) {
    installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.textContent = '📲 Установить приложение';
    installBtn.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:9999',
      'background:linear-gradient(135deg,#6366f1,#8b5cf6)',
      'color:#fff',
      'border:none',
      'border-radius:12px',
      'padding:12px 24px',
      'font-weight:700',
      'font-size:15px',
      'box-shadow:0 8px 25px rgba(99,102,241,0.5)',
      'cursor:pointer',
      'transition:transform 0.2s',
      'animation: slideUp 0.4s ease'
    ].join(';');
    installBtn.onmouseenter = function() { this.style.transform = 'translateX(-50%) scale(1.02)'; };
    installBtn.onmouseleave = function() { this.style.transform = 'translateX(-50%) scale(1)'; };
    installBtn.onclick = function() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choiceResult) {
          if (choiceResult.outcome === 'accepted') {
            console.log('Пользователь установил PWA');
          } else {
            console.log('Пользователь отклонил установку');
          }
          deferredPrompt = null;
          installBtn.remove();
        });
      }
    };
    document.body.appendChild(installBtn);

    // Анимация появления (добавляем в head)
    var style = document.createElement('style');
    style.textContent = '@keyframes slideUp { from { transform: translateX(-50%) translateY(30px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }';
    document.head.appendChild(style);
  }
});

// Также можно показывать кнопку, если приложение уже установлено, скрываем её
window.addEventListener('appinstalled', function() {
  var btn = document.getElementById('pwa-install-btn');
  if (btn) btn.remove();
});

// Если пользователь уже установил, но кнопка всё ещё видна, проверяем display-mode
if (window.matchMedia('(display-mode: standalone)').matches) {
  var btn = document.getElementById('pwa-install-btn');
  if (btn) btn.remove();
}

})();
/* ===== END PWA ===== */
