const CACHE = 'qr-platform-v20';
const CORE = [
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/manager-pwa.html',
  '/cook.html',
  '/waiter.html',
  '/courier.html',
  '/manager.html',
  '/manifest-kitchen.webmanifest',
  '/manifest-waiter.webmanifest',
  '/manifest-courier.webmanifest',
  '/manifest-manager.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-waiter-192.png',
  '/icon-waiter-512.png',
  '/icon-manager-192.png',
  '/icon-manager-512.png',
  '/icon-courier-192.png',
  '/icon-courier-512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-waiter.png',
  '/apple-touch-icon-manager.png',
  '/apple-touch-icon-courier.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(
        CORE.map(url =>
          fetch(url, { cache: 'no-store' })
            .then(response => response.ok ? cache.put(url, response) : null)
            .catch(() => null)
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('qr-platform-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => new Response('Офлайн. Страница недоступна.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }))
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || new Response('Offline', { status: 503 })
        )
      )
  );
});