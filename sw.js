const CACHE = 'qr-platform-v50';
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
  '/cook.html',
  '/courier.html',
  '/waiter.html',
  '/admin.html',
  '/admin_templates.html',
  '/manager-demo.html',
  '/demo-staff.html',
  '/robots.txt',
  '/sitemap.xml',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/js/staff-auth.js',
  '/js/manager/manager-hall.js',
  '/js/staff-table-flow.js',
  '/js/menu-table-flow.js',
  '/js/admin-design-access.js',
  '/js/design-runtime.js',
  '/js/pwa-install.js',
  '/js/offline-sync.js',
  '/js/delivery-calc.js',
  '/js/manager/manager-instruction-tab-v2.js',
  '/js/shared/qr-support.js',
  '/js/manager/manager-app.js',
  '/js/manager/manager-core.js',
  '/js/manager/manager-venues.js',
  '/js/manager/manager-billing.js',
  '/js/manager/manager-create-venue-flow.js',
  '/js/manager/manager-site-import.js',
  '/js/manager/manager-ai.js',
  '/js/manager/manager-chef-full.js',
  '/js/manager/manager-hall-view.js',
  '/manifest.webmanifest',
  '/manifest-admin.webmanifest',
  '/manifest-manager.webmanifest',
  '/manifest-cook.webmanifest',
  '/manifest-courier.webmanifest',
  '/manifest-waiter.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-manager-192.png',
  '/icons/icon-manager-512.png',
  '/icons/icon-cook-192.png',
  '/icons/icon-courier-192.png',
  '/icons/icon-courier-512.png',
  '/icons/icon-waiter-192.png',
  '/icons/icon-waiter-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function enhanceHtml(response) {
  const text = await response.text();
  if (!/<\\/body>/i.test(text)) {
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  let extra = '';
  if (!/pwa-install\\.js/i.test(text)) extra += '<script src="/js/pwa-install.js"></script><script src="/js/offline-sync.js"></script>';
  const pathname = new URL(response.url).pathname;
  if (pathname === '/menu.html' && !/delivery-calc\\.js/i.test(text)) extra += '<script src="/js/delivery-calc.js?v=24"></script>';
  if (pathname === '/manager.html' && !/manager-hall-ai\\.js/i.test(text)) extra += '<script src="/js/manager/manager-hall-ai.js?v=21" data-qr-manager-ai="21"></script>';
  if (pathname === '/manager.html' && !/js\\/manager\\/manager-ai\\.js/i.test(text)) extra += '<script src="/js/manager/manager-ai.js?v=4"></script>';
  if (pathname === '/manager.html' && !/js\\/manager\\/manager-chef-full\\.js/i.test(text)) extra += '<script src="/js/manager/manager-chef-full.js?v=1"></script>';
  if ((pathname === '/manager.html' || pathname === '/admin.html') && !/js\\/shared\\/qr-support\\.js/i.test(text)) extra += '<script src="/js/shared/qr-support.js?v=1"></script>';

  return new Response(text.replace(/<\\/body>/i, extra + '</body>'), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/supabase|qrserver|fonts\\.googleapis|fonts\\.gstatic/.test(url.hostname)) return;

  const noStore = [
    '/manager.html',
    '/admin.html',
    '/js/manager/manager-app.js',
    '/js/manager/manager-ai.js',
    '/js/manager/manager-chef-full.js',
    '/js/shared/qr-support.js',
    '/js/manager/manager-site-import.js',
    '/js/manager/manager-billing.js',
    '/js/manager/manager-recipes.js',
    '/js/manager/manager-recept-ai.js',
  ].includes(url.pathname);

  if (noStore) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(async (response) => {
        if ((url.pathname === '/manager.html' || url.pathname === '/admin.html') && response.ok && response.headers.get('content-type')?.includes('text/html')) {
          return enhanceHtml(response.clone());
        }
        return response;
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(async (response) => {
        const out = response.headers.get('content-type')?.includes('text/html') ? await enhanceHtml(response.clone()) : response.clone();
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, out.clone())).catch(() => undefined);
        return out;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error(`Offline resource unavailable: ${url.pathname}`);
      }),
  );
});
