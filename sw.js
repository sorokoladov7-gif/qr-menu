const CACHE = 'qr-platform-v56';
const CORE = [
  '/', '/src/pages/guest/index.html', '/src/pages/guest/menu.html', '/src/pages/guest/menu-v2.html',
  '/src/pages/staff/demo-staff.html', '/src/pages/staff/hall.html', '/src/pages/staff/cook.html', '/src/pages/staff/courier.html', '/src/pages/staff/waiter.html',
  '/src/pages/manager/manager.html', '/src/pages/manager/manager-demo.html', '/src/pages/manager/manager-staff-statistics.html',
  '/src/pages/admin/admin.html', '/src/pages/admin/admin-analytics.html', '/src/pages/admin/admin-permissions.html', '/src/pages/admin/venue-analytics.html',
  '/src/pages/auth/login.html', '/src/pages/auth/register.html', '/src/pages/guest/venues.html', '/src/pages/staff/staff-table.html', '/src/pages/staff/staff-history.html',
  '/src/pages/admin/admin_templates.html', '/src/pages/manager/integrations.html', '/src/pages/manager/staff-guide.html', '/robots.txt', '/sitemap.xml',
  '/src/assets/css/style.css', '/src/assets/js/shared/config.js', '/src/assets/js/shared/app.js', '/src/assets/js/staff/staff-auth.js',
  '/src/assets/js/manager/manager-hall.js', '/src/assets/js/guest/menu-table-flow.js', '/src/assets/js/admin/admin-design-access.js', '/src/assets/js/guest/design-runtime.js',
  '/src/assets/js/pwa/pwa-install.js', '/src/assets/js/shared/offline-sync.js', '/src/assets/js/guest/delivery-calc.js', '/src/assets/js/shared/qr-support.js',
  '/src/assets/js/manager/manager-app.js', '/src/assets/js/manager/manager-core.js', '/src/assets/js/manager/manager-venues.js', '/src/assets/js/manager/manager-billing.js',
  '/src/assets/js/manager/manager-site-import.js', '/src/assets/js/manager/manager-ai.js', '/src/assets/js/manager/manager-hall-view.js',
  '/src/assets/pwa/manifest.webmanifest', '/src/assets/pwa/manifest-admin.webmanifest', '/src/assets/pwa/manifest-manager.webmanifest', '/src/assets/pwa/manifest-cook.webmanifest', '/src/assets/pwa/manifest-courier.webmanifest', '/src/assets/pwa/manifest-waiter.webmanifest',
  '/src/assets/icons/icon-192.png', '/src/assets/icons/icon-512.png', '/src/assets/icons/icon-manager-192.png', '/src/assets/icons/icon-manager-512.png', '/src/assets/icons/icon-courier-192.png', '/src/assets/icons/icon-courier-512.png', '/src/assets/icons/icon-waiter-192.png', '/src/assets/icons/icon-waiter-512.png'
];

self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => undefined)))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));

async function enhanceHtml(response) {
  const text = await response.text();
  if (!/<\/body>/i.test(text)) return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  let extra = '';
  if (!/pwa-install\.js/i.test(text)) extra += '<script src="/src/assets/js/pwa/pwa-install.js"></script><script src="/src/assets/js/shared/offline-sync.js"></script>';
  const pathname = new URL(response.url).pathname;
  if (pathname === '/src/pages/guest/menu.html' && !/delivery-calc\.js/i.test(text)) extra += '<script src="/src/assets/js/guest/delivery-calc.js?v=24"></script>';
  if (pathname === '/src/pages/manager/manager.html' && !/manager-hall-ai\.js/i.test(text)) extra += '<script src="/src/assets/js/manager/manager-hall-ai.js?v=21" data-qr-manager-ai="21"></script>';
  if (pathname === '/src/pages/manager/manager.html' && !/js\/manager\/manager-ai\.js/i.test(text)) extra += '<script src="/src/assets/js/manager/manager-ai.js?v=4"></script>';
  if ((pathname === '/src/pages/manager/manager.html' || pathname === '/src/pages/admin/admin.html') && !/js\/shared\/qr-support\.js/i.test(text)) extra += '<script src="/src/assets/js/shared/qr-support.js?v=1"></script>';
  return new Response(text.replace(/<\/body>/i, extra + '</body>'), { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/supabase|qrserver|fonts\.googleapis|fonts\.gstatic/.test(url.hostname)) return;
  const noStore = ['/src/pages/manager/manager.html','/src/pages/admin/admin.html','/src/assets/js/manager/manager-app.js','/src/assets/js/manager/manager-ai.js','/src/assets/js/shared/qr-support.js','/src/assets/js/manager/manager-site-import.js','/src/assets/js/manager/manager-billing.js','/src/assets/js/manager/manager-recipes.js','/src/assets/js/manager/manager-recept-ai.js'].includes(url.pathname);
  if (noStore) {
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response => {
      if ((url.pathname === '/src/pages/manager/manager.html' || url.pathname === '/src/pages/admin/admin.html') && response.ok && response.headers.get('content-type')?.includes('text/html')) return enhanceHtml(response.clone());
      return response;
    }));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(async response => {
    const out = response.headers.get('content-type')?.includes('text/html') ? await enhanceHtml(response.clone()) : response.clone();
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request,out.clone())).catch(() => undefined);
    return out;
  }).catch(async () => {const cached=await caches.match(event.request);if(cached)return cached;throw new Error(`Offline resource unavailable: ${url.pathname}`)}));
});
