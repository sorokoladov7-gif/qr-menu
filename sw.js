const CACHE = 'qr-platform-v8';
const CORE = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/menu.html',
  '/menu-v2.html',
  '/venues.html',
  '/hall.html',
  '/staff-table.html',
  '/staff-history.html',
  '/admin-analytics.html',
  '/admin-permissions.html',
  '/venue-analytics.html',
  '/tables.html',
  '/cook.html',
  '/manager.html',
  '/courier.html',
  '/waiter.html',
  '/admin.html',
  '/admin_templates.html',
  '/manager_templates_v2.html',
  '/staff-guide.html',
  '/manager-demo.html',
  '/demo-staff.html',
  '/robots.txt',
  '/sitemap.xml',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/js/auth.js',
  '/js/staff-auth.js',
  '/js/manager-hall.js',
  '/js/manager-tables.js',
  '/js/staff-table-flow.js',
  '/js/menu-table-flow.js',
  '/js/admin-design-access.js',
  '/js/design-runtime.js',
  '/js/pwa-install.js',
  '/js/offline-sync.js',
  '/manifest.webmanifest',
  '/manifest-admin.webmanifest',
  '/manifest-manager.webmanifest',
  '/manifest-cook.webmanifest',
  '/manifest-courier.webmanifest',
  '/manifest-waiter.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-manager-192.png',
  '/icon-manager-512.png',
  '/icon-cook-192.png',
  '/icon-cook-512.png',
  '/icon-courier-192.png',
  '/icon-courier-512.png',
  '/icon-waiter-192.png',
  '/icon-waiter-512.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(
        CORE.map(url => c.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function enhanceHtml(r) {
  const text = await r.text();
  if (!/<\/body>/i.test(text) || /pwa-install\.js/i.test(text)) {
    return new Response(text, {
      status: r.status,
      statusText: r.statusText,
      headers: r.headers
    });
  }
  const extra = '<script src="/js/pwa-install.js"></script><script src="/js/offline-sync.js"></script>';
  return new Response(
    text.replace(/<\/body>/i, extra + '</body>'),
    {
      status: r.status,
      statusText: r.statusText,
      headers: r.headers
    }
  );
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/supabase|qrserver|fonts\.googleapis|fonts\.gstatic/.test(u.hostname)) return;

  e.respondWith(
    fetch(e.request)
      .then(async r => {
        const out = r.headers.get('content-type')?.includes('text/html')
          ? await enhanceHtml(r.clone())
          : r.clone();
        caches.open(CACHE)
          .then(c => c.put(e.request, out.clone()))
          .catch(() => {});
        return out;
      })
      .catch(() => caches.match(e.request)
        .then(r => r || caches.match('/index.html'))
      )
  );
});
