var CACHE='qr-platform-v5';
var CORE=[
  '/','/index.html','/menu.html','/tables.html',
  '/cook.html','/manager.html','/courier.html','/waiter.html',
  '/admin.html','/admin_templates.html','/manager_templates_v2.html',
  '/css/style.css',
  '/js/config.js','/js/app.js','/js/auth.js','/js/staff-auth.js',
  '/js/manager-hall.js','/js/manager-tables.js',
  '/js/staff-table-flow.js','/js/menu-table-flow.js',
  '/js/admin-design-access.js','/js/design-runtime.js',
  '/manifest.webmanifest','/manifest-manager.webmanifest',
  '/manifest-courier.webmanifest','/manifest-waiter.webmanifest',
  '/icon-192.png','/icon-512.png',
  '/icon-manager-192.png','/icon-manager-512.png',
  '/icon-courier-192.png','/icon-courier-512.png',
  '/icon-waiter-192.png','/icon-waiter-512.png'
];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CORE.map(function(u){return c.add(u).catch(function(){}); }));
  }).then(function(){return self.skipWaiting();}));
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

self.addEventListener('fetch',function(e){
  var url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin)return;
  if(url.hostname.indexOf('supabase')!==-1)return;
  if(url.hostname.indexOf('qrserver')!==-1)return;
  if(url.hostname.indexOf('fonts.googleapis')!==-1)return;
  if(url.hostname.indexOf('fonts.gstatic')!==-1)return;
  e.respondWith(
    fetch(e.request).then(function(r){
      var copy=r.clone();
      caches.open(CACHE).then(function(c){c.put(e.request,copy);});
      return r;
    }).catch(function(){
      return caches.match(e.request).then(function(m){
        return m||caches.match('/menu.html');
      });
    })
  );
});
