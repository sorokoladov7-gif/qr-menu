window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',arrived:'📍 Курьер на месте',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',arrived:'#f472b6',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ return ({main:'🍽 Блюдо',drink:'🥤 Напиток',addon:'🧂 Доп',breakfast:'🍳 Завтрак',salad:'🥗 Салат',soup:'🍲 Суп',dessert:'🍰 Десерт',sauce:'🌶 Соус',snack:'🥨 Закуска',hot:'🔥 Горячее',bbq:'🥩 Гриль'}[c]||'🍽 Блюдо'); };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

(function(){
  'use strict';
  if(window.__QR_PWA_REFRESH__) return;
  window.__QR_PWA_REFRESH__ = true;
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width: 900px)').matches; }
  function createButton(){
    if(!isMobile() || document.getElementById('qr-pwa-refresh')) return;
    var btn=document.createElement('button'); btn.id='qr-pwa-refresh'; btn.type='button'; btn.setAttribute('aria-label','Очистить кэш и обновить приложение'); btn.innerHTML='<span aria-hidden="true">↻</span><b>Обновить</b>'; btn.style.cssText='position:fixed;right:max(12px,env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));bottom:auto;z-index:1100;display:flex;align-items:center;gap:7px;min-height:42px;padding:8px 12px;border:1px solid rgba(148,163,184,.28);border-radius:14px;background:rgba(15,23,42,.96);color:#fff;font:700 12px/1 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);cursor:pointer;touch-action:manipulation;transition:transform .18s ease,opacity .18s ease;';
    var icon=btn.querySelector('span'); icon.style.cssText='font-size:20px;line-height:1;display:inline-block;'; btn.addEventListener('pointerdown',function(){btn.style.transform='scale(.96)';}); btn.addEventListener('pointerup',function(){btn.style.transform='scale(1)';}); btn.addEventListener('pointercancel',function(){btn.style.transform='scale(1)';}); btn.addEventListener('click',refreshPWA); document.body.appendChild(btn);
  }
  async function refreshPWA(){var btn=document.getElementById('qr-pwa-refresh');if(!btn||btn.dataset.busy==='1')return;btn.dataset.busy='1';btn.disabled=true;btn.innerHTML='<span aria-hidden="true">⟳</span><b>Обновление…</b>';btn.style.opacity='.75';try{if('serviceWorker' in navigator){try{var registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(function(reg){return reg.unregister().catch(function(){return false;});}));}catch(e){console.warn('[QR PWA] Service Worker cleanup:',e);}}if('caches' in window){try{var names=await caches.keys();await Promise.all(names.map(function(name){return caches.delete(name);}));}catch(e){console.warn('[QR PWA] Cache Storage cleanup:',e);}}}finally{var url=location.href.split('#')[0];url+=(url.indexOf('?')===-1?'?':'&')+'_pwa_refresh='+Date.now();location.replace(url);}}
  function init(){createButton();if(window.matchMedia){var mq=window.matchMedia('(max-width: 900px)');var handler=function(){var btn=document.getElementById('qr-pwa-refresh');if(mq.matches)createButton();else if(btn)btn.remove();};if(mq.addEventListener)mq.addEventListener('change',handler);else if(mq.addListener)mq.addListener(handler);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(function(){'use strict';if(!/\/(admin|manager)\.html$/i.test(location.pathname))return;function initCorporateNavigation(){if(document.body.dataset.qrCorpNav==='1')return;var app=document.getElementById('app');if(!app)return;document.body.dataset.qrCorpNav='1';var toggle=document.createElement('button');toggle.className='qr-corp-nav-toggle';toggle.type='button';toggle.setAttribute('aria-label','Открыть навигацию');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';var overlay=document.createElement('div');overlay.className='qr-corp-nav-overlay';overlay.setAttribute('aria-hidden','true');document.body.appendChild(toggle);document.body.appendChild(overlay);function close(){document.body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';}function open(){document.body.classList.add('nav-open');toggle.setAttribute('aria-expanded','true');toggle.textContent='×';}toggle.addEventListener('click',function(){document.body.classList.contains('nav-open')?close():open();});overlay.addEventListener('click',close);document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('.tabs button');if(t&&window.matchMedia('(max-width:900px)').matches)setTimeout(close,0);},true);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(initCorporateNavigation,0);});else setTimeout(initCorporateNavigation,0);var observer=new MutationObserver(function(){if(!document.body.dataset.qrCorpNav)initCorporateNavigation();});if(document.body)observer.observe(document.body,{childList:true,subtree:true});})();

(function(){'use strict';if(!/(?:^|\/)manager\.html$/i.test(location.pathname))return;var LINK_ID='qr-manager-integrations-link';function ensure(){var tabs=document.querySelector('.tabs');if(!tabs)return;var existing=document.getElementById(LINK_ID);if(existing&&existing.parentNode===tabs)return;if(existing)existing.remove();var link=document.createElement('a');link.id=LINK_ID;link.href='/src/pages/manager/integrations.html';link.className='btn btn-ghost';link.textContent='🔗 Интеграции';link.setAttribute('aria-label','Открыть интеграции');link.style.cssText='text-decoration:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;';tabs.appendChild(link);}function start(){ensure();var attempts=0;var timer=setInterval(function(){ensure();if(++attempts>=60)clearInterval(timer);},500);var observer=new MutationObserver(function(){ensure();});if(document.body)observer.observe(document.body,{childList:true,subtree:true});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();

(function(){'use strict';if(!/(?:^|\/)manager\.html$/i.test(location.pathname))return;var SCRIPT_ID='qr-manager-site-import-loader',SCRIPT_SRC='/src/assets/js/manager/manager-site-import.js',started=false;function loadSiteImport(){if(window.QRManagerSiteImport){if(typeof window.QRManagerSiteImport.scan==='function')window.QRManagerSiteImport.scan();return;}if(document.getElementById(SCRIPT_ID))return;var script=document.createElement('script');script.id=SCRIPT_ID;script.src=SCRIPT_SRC;script.async=false;script.onload=function(){if(window.QRManagerSiteImport&&typeof window.QRManagerSiteImport.scan==='function')window.QRManagerSiteImport.scan();};script.onerror=function(){console.error('[QR Manager] Не удалось загрузить manager-site-import.js:',SCRIPT_SRC);var existing=document.getElementById(SCRIPT_ID);if(existing)existing.remove();};(document.head||document.documentElement).appendChild(script);}function start(){if(started)return;started=true;loadSiteImport();var attempts=0;var timer=setInterval(function(){attempts++;loadSiteImport();if(window.QRManagerSiteImport||attempts>=60)clearInterval(timer);},500);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();

function safeRedirect(fallbackUrl, reason){var last=parseInt(sessionStorage.getItem('last_redirect')||'0',10),now=Date.now();if(now-last<3000){document.body.innerHTML='<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Ваш email авторизован, но профиль не найден в базе данных.</p><p><b>Причина:</b> '+(reason||'неизвестно')+'</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px">🔄 Очистить и попробовать снова</button></div>';return;}sessionStorage.setItem('last_redirect',String(now));location.replace(fallbackUrl);}
async function requireAuth(roles){try{const {data:{session}}=await db.auth.getSession();if(!session){safeRedirect('/src/pages/auth/login.html','нет активной сессии');return null;}const {data:profile,error}=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();if(error){console.error('Profile fetch error:',error);safeRedirect('/src/pages/auth/login.html','ошибка чтения профиля: '+error.message);return null;}if(!profile){safeRedirect('/src/pages/auth/login.html','профиль ещё не создан серверной системой регистрации');return null;}if(roles&&roles.length&&roles.indexOf(profile.role)===-1){safeRedirect('/src/pages/auth/login.html','нет доступа: нужна роль '+roles.join('/')+', у вас '+profile.role);return null;}return profile;}catch(e){console.error(e);safeRedirect('/src/pages/auth/login.html','исключение: '+e.message);}}
async function logout(){try{await db.auth.signOut();}catch(e){}sessionStorage.clear();location.href='/src/pages/auth/login.html';}

(function(){'use strict';if(!/(?:^|\/)menu\.html$/i.test(location.pathname))return;var lastVenueId=null,lastFee=null;function sync(){var el=document.getElementById('app');if(!el)return;try{var vm=el.__vueParentComponent?.proxy||el.vue_app?._instance?.proxy||null;if(!vm||!vm.venue)return;var id=vm.venue.id,raw=vm.venue.delivery_fee;var fee=raw===null||raw===undefined||raw===''?150:Number(raw);if(!isFinite(fee)||fee<0)fee=150;if(id!==lastVenueId||fee!==lastFee){window.DELIVERY_FEE=fee;lastVenueId=id;lastFee=fee;}}catch(e){}}if(typeof window.DELIVERY_FEE==='undefined')window.DELIVERY_FEE=150;function start(){sync();setInterval(sync,250);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start;})();

(function(){'use strict';if(!/(?:^|\/)menu\.html$/i.test(location.pathname))return;var ID='qr-menu-modifiers-loader';function load(){if(document.getElementById(ID)||window.__QR_MENU_MODIFIERS__)return;var s=document.createElement('script');s.id=ID;s.src='/src/assets/js/guest/menu-modifiers.js';s.async=false;s.onload=function(){console.log('[QR Menu] modifiers UI loaded');};s.onerror=function(){console.error('[QR Menu] failed to load modifiers UI');};(document.head||document.documentElement).appendChild(s);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();setTimeout(load,1000);})();

/* QR MENU — Manager AI assistant. Access is enforced server-side by /api/manager-ai. */
(function(){'use strict';if(!/(?:^|\/)manager\.html$/i.test(location.pathname))return;var ID='qr-ai-assistant-loader';function load(){if(window.__QR_AI_ASSISTANT__||document.getElementById(ID))return;var s=document.createElement('script');s.id=ID;s.src='/src/assets/js/manager/qr-ai-assistant.js?v=2';s.async=false;s.onload=function(){console.log('[QR MENU] Manager AI assistant loaded');};s.onerror=function(){console.error('[QR MENU] Manager AI assistant failed to load:',s.src);};(document.head||document.documentElement).appendChild(s);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();})();

/* QR MENU — Smart Table 2.0 guest bridge. QR token is the authority for table/session context. */
(function(){
  'use strict';
  if(!/(?:^|\/)menu\.html$/i.test(location.pathname))return;
  if(window.__QR_SMART_TABLE_BRIDGE__)return;
  window.__QR_SMART_TABLE_BRIDGE__=true;
  var params=new URLSearchParams(location.search);
  var venueSlug=params.get('venue');
  var tableToken=(params.get('token')||'').trim();
  var tableNumber=(params.get('table')||'').trim();
  if(!tableToken)return;
  var guestStorageKey='qr-smart-table-guest:'+tableToken;
  var guestToken='';
  try{guestToken=sessionStorage.getItem(guestStorageKey)||'';}catch(e){}
  if(!guestToken){
    guestToken=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():('g-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    try{sessionStorage.setItem(guestStorageKey,guestToken);}catch(e){}
  }
  var state={venueId:null,sessionId:null,guestId:null,context:null,ready:false,error:null,busy:false};
  window.QRSmartTable=state;

  function rpc(name,args){return window.db&&typeof window.db.rpc==='function'?window.db.rpc(name,args):Promise.reject(new Error('Supabase client не найден'));}
  function applyContext(context){
    if(!context||!context.table)return;
    state.context=context;
    state.venueId=context.restaurant&&context.restaurant.id||state.venueId||null;
    state.sessionId=context.table.session_id||state.sessionId||null;
    var app=document.getElementById('app');
    try{
      var vm=app&&(app.__vueParentComponent&&app.__vueParentComponent.proxy||app.__vue_app__&&app.__vue_app__._instance&&app.__vue_app__._instance.proxy);
      if(vm&&vm.form&&context.table.number!=null){
        vm.form.type='table';
        vm.form.table_number=String(context.table.number);
        vm.form.table_token=tableToken;
        vm.msg='🪑 Вы заказываете за столом №'+context.table.number;
        vm.msgType='ok';
      }
    }catch(e){}
  }
  async function resolve(){
    if(state.busy)return state.context;
    state.busy=true;state.error=null;
    try{
      var r=await rpc('smart_table_get_context_by_token',{p_qr_token:tableToken,p_language:'ru'});
      if(r.error)throw r.error;
      var context=Array.isArray(r.data)?r.data[0]:r.data;
      if(!context||context.ok===false)throw new Error('table_context_unavailable');
      applyContext(context);
      state.ready=true;
      return context;
    }catch(e){state.error=e;return null;}finally{state.busy=false;}
  }
  async function join(guestName){
    var context=await resolve();
    var venueId=context&&context.restaurant&&context.restaurant.id||state.venueId;
    if(!venueId)throw new Error('table_context_unavailable');
    var r=await rpc('smart_table_join',{p_venue_id:venueId,p_qr_token:tableToken,p_guest_token:guestToken,p_guest_name:guestName||null,p_language:'ru'});
    if(r.error)throw r.error;
    var data=Array.isArray(r.data)?r.data[0]:r.data;
    if(!data||data.ok===false)throw new Error('table_join_failed');
    state.venueId=venueId;state.sessionId=data.session_id||state.sessionId;state.guestId=data.guest_id||state.guestId;
    if(data.context)applyContext(data.context);
    state.ready=true;
    return data;
  }
  var originalRpc=window.db&&typeof window.db.rpc==='function'?window.db.rpc.bind(window.db):null;
  if(originalRpc){
    window.db.rpc=function(name,args,options){
      if(name!=='create_public_order'||!args||args.p_order_type!=='table'||!args.p_table_token)return originalRpc(name,args,options);
      var guestName=args.p_customer_name||null;
      return join(guestName).then(function(){return originalRpc(name,args,options);});
    };
  }
  function poll(){
    if(document.hidden)return;
    resolve().catch(function(){});
  }
  function start(){
    resolve();
    setInterval(poll,5000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
