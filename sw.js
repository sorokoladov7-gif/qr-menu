const CACHE = 'qr-platform-v25';
const CORE = ['/', '/index.html', '/login.html', '/register.html', '/menu.html', '/menu-v2.html', '/venues.html', '/hall.html', '/staff-table.html', '/staff-history.html', '/admin-analytics.html', '/admin-permissions.html', '/venue-analytics.html', '/tables.html', '/cook.html', '/manager.html', '/courier.html', '/waiter.html', '/admin.html', '/admin_templates.html', '/manager_templates_v2.html', '/manager-demo.html', '/demo-staff.html', '/robots.txt', '/sitemap.xml', '/css/style.css', '/js/config.js', '/js/app.js', '/js/auth.js', '/js/staff-auth.js', '/js/manager-hall.js', '/js/manager-tables.js', '/js/staff-table-flow.js', '/js/menu-table-flow.js', '/js/admin-design-access.js', '/js/design-runtime.js', '/js/pwa-install.js', '/js/offline-sync.js', '/js/delivery-calc.js', '/js/manager-instruction-tab-v2.js', '/js/manager/manager-app.js', '/js/manager/manager-core.js', '/js/manager/manager-venues.js', '/js/manager/manager-billing.js', '/js/manager/manager-create-venue-flow.js', '/js/manager/manager-site-import.js', '/manifest.webmanifest', '/manifest-admin.webmanifest', '/manifest-manager.webmanifest', '/manifest-cook.webmanifest', '/manifest-courier.webmanifest', '/manifest-waiter.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-manager-192.png', '/icon-manager-512.png', '/icon-cook-192.png', '/icon-cook-512.png', '/icon-courier-192.png', '/icon-courier-512.png', '/icon-waiter-192.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(url => c.add(url).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))).then(() => self.clients.claim()))));

async function enhanceHtml(r){
  const text=await r.text();
  if(!/<\\/body>/i.test(text)) return new Response(text,{status:r.status,statusText:r.statusText,headers:r.headers});
  let extra='';
  if(!/pwa-install\\.js/i.test(text)) extra+='<script src="/js/pwa-install.js"></script><script src="/js/offline-sync.js"></script>';
  const pathname=new URL(r.url).pathname;
  if(pathname==='/menu.html' && !/delivery-calc\\.js/i.test(text)) extra+='<script src="/js/delivery-calc.js?v=24"></script>';
  if(pathname==='/manager.html' && !/manager-hall-ai\\.js/i.test(text)) extra+='<script src="/js/manager-hall-ai.js?v=21" data-qr-manager-ai="21"></script>';
  if(pathname==='/admin.html' && !/qr-ai-assistant\\.js/i.test(text)) extra+='<script src="/js/qr-ai-assistant.js?v=25" data-qr-ai-assistant="25"></script>';
  return new Response(text.replace(/<\\/body>/i,extra+'</body>'),{status:r.status,statusText:r.statusText,headers:r.headers});
}

self.addEventListener('fetch', e => {
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(/supabase|qrserver|fonts\\.googleapis|fonts\\.gstatic/.test(u.hostname))return;

  const noStore=u.pathname==='/integrations.html' || u.pathname==='/js/manager-hall-ai.js' || u.pathname==='/js/qr-ai-assistant.js';
  if(noStore){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}

  e.respondWith(fetch(e.request).then(async r=>{
    const out=r.headers.get('content-type')?.includes('text/html')?await enhanceHtml(r.clone()):r.clone();
    if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,out.clone())).catch(()=>{});
    return out;
  }).catch(async()=>{
    const cached=await caches.match(e.request);
    if(cached)return cached;
    throw new Error('Offline resource unavailable: '+u.pathname);
  }));
});