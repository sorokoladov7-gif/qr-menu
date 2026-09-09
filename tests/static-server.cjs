const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const legacyRedirects = new Map([
  ['/index.html', '/src/pages/guest/index.html'],
  ['/menu.html', '/src/pages/guest/menu.html'],
  ['/menu-v2.html', '/src/pages/guest/menu-v2.html'],
  ['/venues.html', '/src/pages/guest/venues.html'],
  ['/waiter.html', '/src/pages/staff/waiter.html'],
  ['/cook.html', '/src/pages/staff/cook.html'],
  ['/courier.html', '/src/pages/staff/courier.html'],
  ['/hall.html', '/src/pages/staff/hall.html'],
  ['/staff-history.html', '/src/pages/staff/staff-history.html'],
  ['/staff-table.html', '/src/pages/staff/staff-table.html'],
  ['/manager.html', '/src/pages/manager/manager.html'],
  ['/manager-demo.html', '/src/pages/manager/manager-demo.html'],
  ['/manager-staff-statistics.html', '/src/pages/manager/manager-staff-statistics.html'],
  ['/integrations.html', '/src/pages/manager/integrations.html'],
  ['/staff-guide.html', '/src/pages/manager/staff-guide.html'],
  ['/admin.html', '/src/pages/admin/admin.html'],
  ['/admin-analytics.html', '/src/pages/admin/admin-analytics.html'],
  ['/admin-permissions.html', '/src/pages/admin/admin-permissions.html'],
  ['/venue-analytics.html', '/src/pages/admin/venue-analytics.html'],
  ['/admin_templates.html', '/src/pages/admin/admin_templates.html'],
  ['/login.html', '/src/pages/auth/login.html'],
  ['/register.html', '/src/pages/auth/register.html'],
  ['/manifest.webmanifest', '/src/assets/pwa/manifest.webmanifest'],
  ['/manifest-admin.webmanifest', '/src/assets/pwa/manifest-admin.webmanifest'],
  ['/manifest-cook.webmanifest', '/src/assets/pwa/manifest-cook.webmanifest'],
  ['/manifest-courier.webmanifest', '/src/assets/pwa/manifest-courier.webmanifest'],
  ['/manifest-manager.webmanifest', '/src/assets/pwa/manifest-manager.webmanifest'],
  ['/manifest-waiter.webmanifest', '/src/assets/pwa/manifest-waiter.webmanifest'],
]);

const roleAssetRewrites = /^\/src\/pages\/(guest|staff|manager|admin|auth)\/(css|js|img|icons)\/(.+)$/;
const rolePageRewrites = new Map([
  ['/src/pages/guest/login.html', '/src/pages/auth/login.html'],
  ['/src/pages/guest/register.html', '/src/pages/auth/register.html'],
  ['/src/pages/guest/manager-demo.html', '/src/pages/manager/manager-demo.html'],
  ['/src/pages/guest/demo-staff.html', '/demo-staff.html'],
  ['/src/pages/auth/menu.html', '/src/pages/guest/menu.html'],
  ['/src/pages/guest/cook.html', '/src/pages/staff/cook.html'],
  ['/src/pages/guest/courier.html', '/src/pages/staff/courier.html'],
  ['/src/pages/guest/waiter.html', '/src/pages/staff/waiter.html'],
]);

function resolveRequestPath(requestPath) {
  if (requestPath === '/') {
    return '/src/pages/guest/index.html';
  }

  const legacyTarget = legacyRedirects.get(requestPath);
  if (legacyTarget) {
    return legacyTarget;
  }

  const roleTarget = rolePageRewrites.get(requestPath);
  if (roleTarget) {
    return roleTarget;
  }

  const assetMatch = requestPath.match(roleAssetRewrites);
  if (assetMatch) {
    return `/${assetMatch[2]}/${assetMatch[3]}`;
  }

  return requestPath;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const requestPath = decodeURIComponent(url.pathname);

  const legacyTarget = legacyRedirects.get(requestPath);
  if (legacyTarget) {
    const query = url.search || '';
    res.writeHead(308, { Location: `${legacyTarget}${query}` });
    res.end();
    return;
  }

  const resolvedPath = resolveRequestPath(requestPath);
  const relative = resolvedPath.replace(/^\/+/, '') || 'index.html';
  const target = path.resolve(root, relative);

  if (!target.startsWith(root + path.sep) && target !== root) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Static server listening on http://127.0.0.1:${port}\n`);
});
