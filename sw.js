const CACHE = 'qr-platform-v16';
const CORE = ['/', '/index.html', '/login.html', '/register.html', '/menu.html', '/menu-v2.html', '/venues.html', '/hall.html', '/staff-table.html', '/staff-history.html', '/admin-analytics.html', '/admin-permissions.html', '/venue-analytics.html', '/tables.html', '/cook.html', '/manager.html', '/courier.html', '/waiter.html', '/admin.html', '/admin_templates.html', '/manager_templates_v2.html', '/staff-guide.html', '/manager-demo.html', '/demo-staff.html', '/robots.txt', '/sitemap.xml', '/css/style.css', '/js/config.js', '/js/app.js', '/js/auth.js', '/js/staff-auth.js', '/js/manager-hall.js', '/js/manager-tables.js', '/js/staff-table-flow.js', '/js/menu-table-flow.js', '/js/admin-design-access.js', '/js/design-runtime.js', '/js/pwa-install.js', '/js/offline-sync.js', '/manifest.webmanifest', '/manifest-admin.webmanifest', '/manifest-manager.webmanifest', '/manifest-cook.webmanifest', '/manifest-courier.webmanifest', '/manifest-waiter.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-manager-192.png', '/icon-manager-512.png', '/icon-cook-192.png', '/icon-cook-512.png', '/icon-courier-192.png', '/icon-courier-512.png', '/icon-waiter-192.png', '/icon-waiter-512.png', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(url => c.add(url).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function enhanceHtml(r){
  const text=await r.text();
  if(!/<\/body>/i.test(text)) return new Response(text,{status:r.status,statusText:r.statusText,headers:r.headers});
  let extra='';
  if(!/pwa-install\.js/i.test(text)) extra+='<script src="/js/pwa-install.js"></script><script src="/js/offline-sync.js"></script>';
  const pathname=new URL(r.url).pathname;
  if(pathname==='/manager.html'){
    extra+='<script src="/js/manager-hall-ai.js?v=21" data-qr-manager-ai="21"></script>';
    extra+='<script>(function(){"use strict";if(window.__QR_MANAGER_CREATE_BUTTON_GUARD_V15__)return;window.__QR_MANAGER_CREATE_BUTTON_GUARD_V15__=true;function unlock(){var root=document.getElementById("app")||document.body;if(!root)return;Array.prototype.forEach.call(root.querySelectorAll("button"),function(b){var t=(b.textContent||"").replace(/\\s+/g," ").trim();if(/^\\+?\\s*Создать$/i.test(t)||/^\\+?\\s*Создать\\s+заведение$/i.test(t)){b.disabled=false;b.removeAttribute("disabled");b.setAttribute("aria-disabled","false");b.style.pointerEvents="auto";b.style.cursor="pointer";b.style.opacity="1";}});}function start(){unlock();var timer=0;var obs=new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(unlock,30);});obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["disabled","style"]});setTimeout(unlock,100);setTimeout(unlock,500);setTimeout(unlock,1500);setTimeout(unlock,3000);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();})();</script>';
  }
  return new Response(text.replace(/<\/body>/i,extra+'</body>'),{status:r.status,statusText:r.statusText,headers:r.headers});
}
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(/supabase|qrserver|fonts\.googleapis|fonts\.gstatic/.test(u.hostname))return;
  const isManagerAi=u.pathname==='/js/manager-hall-ai.js';
  e.respondWith(fetch(e.request,isManagerAi?{cache:'no-store'}:undefined).then(async r=>{const out=r.headers.get('content-type')?.includes('text/html')?await enhanceHtml(r.clone()):r.clone();caches.open(CACHE).then(c=>c.put(e.request,out.clone())).catch(()=>{});return out;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html'))));
});
