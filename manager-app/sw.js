const CACHE='qr-manager-pwa-v2';
const CORE=['/manager-app/','/manifest-manager.webmanifest','/icon-manager-192.png','/icon-manager-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(u=>fetch(u,{cache:'no-store'}).then(r=>r.ok?c.put(u,r):null).catch(()=>null)))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==self.location.origin)return;event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));});
