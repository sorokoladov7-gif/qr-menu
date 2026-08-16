const CACHE = 'qr-platform-v13';
const CORE = [
  '/waiter.html','/cook.html','/manager.html','/courier.html',
  '/css/style.css','/js/config.js','/js/app.js',
  '/manifest.webmanifest','/manifest-kitchen.webmanifest','/manifest-waiter.webmanifest','/manifest-manager.webmanifest','/manifest-courier.webmanifest',
  '/icon-192.png','/icon-512.png','/icon-waiter-192.png','/icon-waiter-512.png','/icon-manager-192.png','/icon-manager-512.png','/icon-courier-192.png','/icon-courier-512.png',
  '/apple-touch-icon.png','/apple-touch-icon-waiter.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(CORE.map(url=>fetch(url,{cache:'no-store'}).then(r=>r.ok?cache.put(url,r):null).catch(()=>null)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;if(req.mode==='navigate'||req.destination==='document'){event.respondWith(fetch(req,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return response}).catch(()=>caches.match(req).then(cached=>cached||new Response('Офлайн. Страница недоступна.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));return}event.respondWith(fetch(req,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return response}).catch(()=>caches.match(req).then(cached=>cached||new Response('Offline',{status:503})))});
