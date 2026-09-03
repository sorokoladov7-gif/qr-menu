const CACHE = 'qr-platform-v19';
const CORE = ['/', '/index.html', '/login.html', '/register.html', '/menu.html', '/menu-v2.html', '/venues.html', '/hall.html', '/staff-table.html', '/staff-history.html', '/admin-analytics.html', '/admin.html', '/manager.html', '/cook.html', '/courier.html', '/waiter.html'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(url => c.add(url).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function enhanceHtml(r){
  const text=await r.text();
  if(!/<\/body>/i.test(text)) return new Response(text,{status:r.status,statusText:r.statusText,headers:r.headers});
  let extra='';
  if(!/pwa-install\.js/i.test(text)) extra+='<script src="/js/pwa-install.js"><\/script><script src="/js/offline-sync.js"><\/script>';
  const pathname=new URL(r.url).pathname;
  if(pathname==='/manager.html'){
    extra+='<script src="/js/manager-hall-ai.js?v=21" data-qr-manager-ai="21"><\/script>';
  }
  return new Response(text.replace(/<\/body>/i,extra+'</body>'),{status:r.status,statusText:r.statusText,headers:r.headers});
}
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(/supabase|qrserver|fonts\.googleapis|fonts\.gstatic/.test(u.hostname))return;
  const isManagerAi=u.pathname==='/js/manager-hall-ai.js';
  e.respondWith(fetch(e.request,isManagerAi?{cache:'no-store'}:undefined).then(async r=>{const out=r.headers.get('content-type')?.includes('text/html')?await enhanceHtml(r.clone()):r.clone();return caches.open(CACHE).then(c=>{try{if(r.ok)c.put(e.request,out.clone());}catch(e){console.warn('Cache write failed',e);}return out;});}).catch(async()=>{return caches.match(e.request).then(cached=>cached||new Response('offline',{status:503}));}));
});
