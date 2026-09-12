const CACHE = 'qr-platform-v53';
const CORE = [
  '/', '/src/pages/guest/index.html', '/src/pages/guest/menu.html', '/src/pages/guest/menu-v2.html',
  '/src/pages/staff/demo-staff.html', '/src/pages/staff/hall.html', '/src/pages/staff/cook.html', '/src/pages/staff/courier.html', '/src/pages/staff/waiter.html',
  '/src/pages/manager/manager.html', '/src/pages/manager/manager-demo.html', '/src/pages/manager/manager-staff-statistics.html',
  '/src/pages/admin/admin.html', '/src/pages/admin/admin-analytics.html', '/src/pages/admin/admin-permissions.html', '/src/pages/admin/venue-analytics.html',
  '/src/pages/auth/login.html', '/src/pages/auth/register.html', '/src/pages/guest/venues.html', '/src/pages/staff/staff-table.html', '/src/pages/staff/staff-history.html',
  '/src/pages/admin/admin_templates.html', '/src/pages/manager/integrations.html', '/src/pages/manager/staff-guide.html', '/robots.txt', '/sitemap.xml',
  '/src/assets/css/style.css', '/src/assets/js/shared/config.js', '/src/assets/js/shared/app.js', '/src/assets/js/staff/staff-auth.js',
  '/src/assets/js/manager/manager-hall.js', '/src/assets/js/guest/menu-table-flow.js', '/src/assets/js/admin/admin-design-access.js', '/src/assets/js/guest/design-runtime.js',
  '/src/assets/js/pwa/pwa-install.js', '/src/assets/js/shared/offline-sync.js', '/src/assets/js/guest/delivery-calc.js', '/src/assets/js/shared/qr-support.js',
  '/src/assets/js/manager/manager-app.js', '/src/assets/js/manager/manager-core.js', '/src/assets/js/manager/manager-venues.js', '/src/assets/js/manager/manager-billing.js',
  '/src/assets/js/manager/manager-site-import.js', '/src/assets/js/manager/manager-ai.js', '/src/assets/js/manager/manager-hall-view.js',
  '/src/assets/pwa/manifest.webmanifest', '/src/assets/pwa/manifest-admin.webmanifest', '/src/assets/pwa/manifest-manager.webmanifest', '/src/assets/pwa/manifest-cook.webmanifest', '/src/assets/pwa/manifest-courier.webmanifest', '/src/assets/pwa/manifest-waiter.webmanifest',
  '/src/assets/icons/icon-192.png', '/src/assets/icons/icon-512.png', '/src/assets/icons/icon-manager-192.png', '/src/assets/icons/icon-manager-512.png', '/src/assets/icons/icon-courier-192.png', '/src/assets/icons/icon-courier-512.png', '/src/assets/icons/icon-waiter-192.png', '/src/assets/icons/icon-waiter-512.png'
];

self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => undefined)))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));

async function enhanceHtml(response) {
  const text = await response.text();
  if (!/<\/body>/i.test(text)) return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  let extra = '';
  if (!/pwa-install\.js/i.test(text)) extra += '<script src="/src/assets/js/pwa/pwa-install.js"></script><script src="/src/assets/js/shared/offline-sync.js"></script>';
  const pathname = new URL(response.url).pathname;
  if (pathname === '/src/pages/guest/menu.html' && !/delivery-calc\.js/i.test(text)) extra += '<script src="/src/assets/js/guest/delivery-calc.js?v=24"></script>';
  if (pathname === '/src/pages/manager/manager.html' && !/manager-hall-ai\.js/i.test(text)) extra += '<script src="/src/assets/js/manager/manager-hall-ai.js?v=21" data-qr-manager-ai="21"></script>';
  if (pathname === '/src/pages/manager/manager.html' && !/js\/manager\/manager-ai\.js/i.test(text)) extra += '<script src="/src/assets/js/manager/manager-ai.js?v=4"></script>';
  if ((pathname === '/src/pages/manager/manager.html' || pathname === '/src/pages/admin/admin.html') && !/js\/shared\/qr-support\.js/i.test(text)) extra += '<script src="/src/assets/js/shared/qr-support.js?v=1"></script>';

  if (pathname === '/src/pages/manager/manager.html' && !/qr-manager-mobile-nav-hardening/i.test(text)) {
    extra += `<style id="qr-manager-mobile-nav-hardening">
@media (max-width:900px){#qr-manager-mobile-nav-toggle{display:flex!important;position:fixed!important;left:10px!important;top:max(10px,env(safe-area-inset-top))!important;width:44px!important;height:44px!important;z-index:2147483000!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;border:1px solid rgba(148,163,184,.3)!important;border-radius:12px!important;background:rgba(7,12,24,.96)!important;color:#fff!important;font:700 25px/1 system-ui,sans-serif!important;box-shadow:0 8px 28px rgba(0,0,0,.45)!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}#qr-manager-mobile-nav-overlay{display:block!important;position:fixed!important;inset:0!important;z-index:2147482990!important;border:0!important;padding:0!important;margin:0!important;background:rgba(0,0,0,.55)!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}body.qr-manager-mobile-nav-open #qr-manager-mobile-nav-overlay{opacity:1!important;visibility:visible!important;pointer-events:auto!important}}@media(min-width:901px){#qr-manager-mobile-nav-toggle,#qr-manager-mobile-nav-overlay{display:none!important}}</style><script id="qr-manager-mobile-nav-hardening">(function(){
'use strict';
function boot(){
 var body=document.body;if(!body)return;
 var toggle=document.getElementById('qr-manager-mobile-nav-toggle');
 if(!toggle){toggle=document.createElement('button');toggle.id='qr-manager-mobile-nav-toggle';toggle.type='button';toggle.setAttribute('aria-label','Открыть меню');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';body.appendChild(toggle)}
 var overlay=document.getElementById('qr-manager-mobile-nav-overlay');
 if(!overlay){overlay=document.createElement('button');overlay.id='qr-manager-mobile-nav-overlay';overlay.type='button';overlay.setAttribute('aria-label','Закрыть меню');body.appendChild(overlay)}
 function nav(){return document.querySelector('#app .tabs')||document.querySelector('.qr-corp-shell .tabs')||document.querySelector('.tabs')}
 function apply(open){
  var tabs=nav(),mobile=window.innerWidth<=900;
  body.classList.toggle('qr-manager-mobile-nav-open',!!open);toggle.setAttribute('aria-expanded',String(!!open));toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');toggle.textContent=open?'×':'☰';
  if(!tabs)return;
  if(mobile){
   [['position','fixed'],['left','0'],['top','0'],['bottom','0'],['width','min(82vw,300px)'],['height','100dvh'],['max-height','100dvh'],['box-sizing','border-box'],['display','flex'],['flex-direction','column'],['flex-wrap','nowrap'],['align-items','stretch'],['overflow-y','auto'],['overflow-x','hidden'],['padding','74px 12px 20px'],['margin','0'],['z-index','2147482995'],['transform',open?'translateX(0)':'translateX(-105%)'],['visibility',open?'visible':'hidden'],['opacity',open?'1':'0'],['pointer-events',open?'auto':'none'],['transition','transform .24s ease,opacity .18s ease']].forEach(function(p){tabs.style.setProperty(p[0],p[1],'important')});
  }else{['position','left','top','bottom','width','height','max-height','box-sizing','display','flex-direction','flex-wrap','align-items','overflow-y','overflow-x','padding','margin','z-index','transform','visibility','opacity','pointer-events','transition'].forEach(function(p){tabs.style.removeProperty(p)})}
 }
 if(!toggle.__bound){toggle.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();apply(!body.classList.contains('qr-manager-mobile-nav-open'))});toggle.__bound=true}
 if(!overlay.__bound){overlay.addEventListener('click',function(e){e.preventDefault();apply(false)});overlay.__bound=true}
 if(!body.__qrManagerMobileNavEvents){document.addEventListener('keydown',function(e){if(e.key==='Escape')apply(false)});window.addEventListener('resize',function(){apply(body.classList.contains('qr-manager-mobile-nav-open'))});body.__qrManagerMobileNavEvents=true}
 apply(body.classList.contains('qr-manager-mobile-nav-open'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true});
})();</script>`;
  }
  return new Response(text.replace(/<\/body>/i, extra + '</body>'), { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/supabase|qrserver|fonts\.googleapis|fonts\.gstatic/.test(url.hostname)) return;
  const noStore = ['/src/pages/manager/manager.html','/src/pages/admin/admin.html','/src/assets/js/manager/manager-app.js','/src/assets/js/manager/manager-ai.js','/src/assets/js/shared/qr-support.js','/src/assets/js/manager/manager-site-import.js','/src/assets/js/manager/manager-billing.js','/src/assets/js/manager/manager-recipes.js','/src/assets/js/manager/manager-recept-ai.js'].includes(url.pathname);
  if (noStore) {
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response => {
      if ((url.pathname === '/src/pages/manager/manager.html' || url.pathname === '/src/pages/admin/admin.html') && response.ok && response.headers.get('content-type')?.includes('text/html')) return enhanceHtml(response.clone());
      return response;
    }));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(async response => {
    const out = response.headers.get('content-type')?.includes('text/html') ? await enhanceHtml(response.clone()) : response.clone();
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request,out.clone())).catch(() => undefined);
    return out;
  }).catch(async () => {const cached=await caches.match(event.request);if(cached)return cached;throw new Error(`Offline resource unavailable: ${url.pathname}`)}));
});
