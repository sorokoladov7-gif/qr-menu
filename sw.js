var CACHE = 'kitchen-v1';
var CORE = ['/cook.html', '/css/style.css', '/js/config.js', '/js/app.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(CORE); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.hostname.indexOf('supabase') !== -1) return;
  e.respondWith(
    fetch(e.request).then(function(r) {
      var copy = r.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
      return r;
    }).catch(function() {
      return caches.match(e.request).then(function(m) { return m || caches.match('/cook.html'); });
    })
  );
});
