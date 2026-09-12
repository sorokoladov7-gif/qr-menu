'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function normalizeLocalRef(value) {
  return value.split('#', 1)[0].split('?', 1)[0].trim();
}

function isExternal(value) {
  return !value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:') || /^[a-z][a-z\d+.-]*:/i.test(value);
}

function hasWildcard(value) {
  return /:[A-Za-z][A-Za-z\d]*\*/.test(value);
}

function routePattern(source) {
  const token = '__WILDCARD__';
  let pattern = source.replace(/:path\*/g, token).replace(/:role/g, '__ROLE__');
  pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  pattern = pattern.replace(token, '.*').replace('__ROLE__', '[^/]+');
  return new RegExp(`^${pattern}$`);
}

function getRoutes() {
  const vercel = JSON.parse(read('vercel.json'));
  return [...(vercel.redirects || []), ...(vercel.rewrites || [])];
}

function coveredByVercelRoute(urlPath, routes) {
  return routes.some(route => route && typeof route.source === 'string' && routePattern(route.source).test(urlPath));
}

function localPathExists(urlPath) {
  const relative = urlPath.replace(/^\/+/, '');
  return fs.existsSync(path.join(root, relative));
}

function resolveRef(ref, ownerPath) {
  const clean = normalizeLocalRef(ref);
  if (!clean || isExternal(clean)) return null;
  if (clean.startsWith('/')) return clean;
  return `/${path.posix.normalize(path.posix.join(path.posix.dirname(ownerPath), clean))}`;
}

function assertResolvable(ref, ownerPath, routes, label) {
  const urlPath = resolveRef(ref, ownerPath);
  if (!urlPath) return;
  assert.ok(
    localPathExists(urlPath) || coveredByVercelRoute(urlPath, routes),
    `${label}: ${ownerPath} -> ${ref} resolves to ${urlPath}, but no file or Vercel route covers it`
  );
}

function collectHtmlRefs(html) {
  const refs = [];
  const attrRe = /\b(?:src|href|poster|action)=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrRe.exec(html))) refs.push(match[1]);
  return refs;
}

function collectCssRefs(source) {
  const refs = [];
  const urlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let match;
  while ((match = urlRe.exec(source))) refs.push(match[1]);
  return refs;
}

function collectJsLocalRefs(source) {
  const refs = [];
  const patterns = [
    /(?:src|href)\s*[:=]\s*["'`]([^"'`\s<>]+)["'`]/gi,
    /(?:fetch|import|window\.open|location(?:\.assign|\.replace)?|window\.location(?:\.assign|\.replace)?)\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /(?:location\.href|window\.location(?:\.href)?)\s*=\s*["'`]([^"'`]+)["'`]/gi,
    /\badd\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /["'`]((?:\/)(?:js|css|img|icons|assets|src\/assets)[^"'`\s)]*)["'`]/gi
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(source))) refs.push(match[1]);
  }
  return refs;
}

function isLegacyRuntimePath(ref) {
  const clean = normalizeLocalRef(ref).replace(/^\.\//, '');
  if (!clean || isExternal(clean)) return false;
  return /^(?:\/?(?:js|css|img|icons|pwa)\/|\/?(?:manifest(?:-[A-Za-z0-9_-]+)?\.webmanifest|favicon\.svg|apple-touch-icon\.png)$)/i.test(clean)
    || /^(?:\/?(?:index|menu|waiter|cook|courier|hall|staff-history|staff-table|manager|manager-demo|manager-staff-statistics|integrations|admin|login|register|forgot-password|reset-password|staff-guide)\.html)$/i.test(clean);
}

function assertNoLegacyRuntimePath(ref, ownerPath, label) {
  assert.equal(
    isLegacyRuntimePath(ref),
    false,
    `${label}: ${ownerPath} still references legacy runtime path ${ref}; use the physical src/pages/... or src/assets/... path`
  );
}

test('all canonical HTML local resources resolve to files or declared Vercel routes', () => {
  const routes = getRoutes();
  const pagesRoot = path.join(root, 'src/pages');
  const htmlFiles = walk(pagesRoot).filter(file => file.endsWith('.html'));

  assert.ok(htmlFiles.length > 0, 'canonical pages directory must contain HTML pages');

  for (const file of htmlFiles) {
    const pagePath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const html = fs.readFileSync(file, 'utf8');
    for (const ref of collectHtmlRefs(html)) {
      assertNoLegacyRuntimePath(ref, pagePath, 'HTML path contract');
      assertResolvable(ref, pagePath, routes, 'HTML path contract');
    }
  }
});

test('repository JavaScript local asset and page navigation URLs resolve', () => {
  const routes = getRoutes();
  const jsRoot = path.join(root, 'src/assets/js');
  const jsFiles = walk(jsRoot).filter(file => /\.(?:js|cjs|mjs)$/.test(file));

  assert.ok(jsFiles.length > 0, 'canonical JS asset directory must contain files');

  for (const file of jsFiles) {
    const ownerPath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const source = fs.readFileSync(file, 'utf8');
    for (const ref of collectJsLocalRefs(source)) {
      assertNoLegacyRuntimePath(ref, ownerPath, 'JS path contract');
      assertResolvable(ref, ownerPath, routes, 'JS path contract');
    }
  }
});

test('canonical CSS url() assets resolve to files or declared Vercel routes', () => {
  const routes = getRoutes();
  const cssRoot = path.join(root, 'src/assets/css');
  const cssFiles = walk(cssRoot).filter(file => file.endsWith('.css'));

  for (const file of cssFiles) {
    const ownerPath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const source = fs.readFileSync(file, 'utf8');
    for (const ref of collectCssRefs(source)) {
      assertNoLegacyRuntimePath(ref, ownerPath, 'CSS path contract');
      assertResolvable(ref, ownerPath, routes, 'CSS path contract');
    }
  }
});

test('service worker precache and generated runtime resources use canonical physical paths', () => {
  const routes = getRoutes();
  const source = read('sw.js');
  const arrays = [...source.matchAll(/(?:CORE|PRECACHE|ASSETS)\s*=\s*\[([\s\S]*?)\]/g)];
  const refs = arrays.flatMap(array => [...array[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]));
  for (const ref of refs) {
    assertNoLegacyRuntimePath(ref, '/sw.js', 'Service worker path contract');
    assertResolvable(ref, '/sw.js', routes, 'Service worker path contract');
  }

  const generatedRefs = [];
  const generatedRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = generatedRe.exec(source))) generatedRefs.push(match[1]);
  for (const ref of generatedRefs) assertNoLegacyRuntimePath(ref, '/sw.js', 'Service worker generated resource contract');
});

test('no canonical runtime source embeds a legacy resource URL in an HTML/JS/CSS resource context', () => {
  const files = [
    ...walk(path.join(root, 'src/pages')).filter(file => file.endsWith('.html')),
    ...walk(path.join(root, 'src/assets/js')).filter(file => /\.(?:js|cjs|mjs)$/.test(file)),
    ...walk(path.join(root, 'src/assets/css')).filter(file => file.endsWith('.css')),
    root / 'sw.js'
  ];
  const legacyResource = /(?:src|href)\s*[:=]\s*["'`]((?:\/?(?:js|css|img|icons|pwa)\/|\/?(?:manifest(?:-[A-Za-z0-9_-]+)?\.webmanifest|favicon\.svg|apple-touch-icon\.png))[^"'`]*)["'`]/gi;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const owner = `/${path.relative(root, file).split(path.sep).join('/')}`;
    let match;
    while ((match = legacyResource.exec(source))) {
      assert.fail(`${owner} contains legacy resource URL ${match[1]}; compatibility rewrites are not an internal fix`);
    }
  }
});

test('declared Vercel redirects and rewrites do not point at missing static destinations', () => {
  const routes = getRoutes();
  for (const route of routes) {
    if (!route || typeof route.destination !== 'string') continue;
    const destination = route.destination;
    if (isExternal(destination) || hasWildcard(destination)) continue;

    assert.ok(
      localPathExists(destination) || coveredByVercelRoute(destination, routes),
      `Vercel route destination is not backed by a file or another route: ${route.source} -> ${destination}`
    );
  }
});

test('canonical manifests and root service worker are physically present', () => {
  const required = [
    'sw.js',
    'src/assets/pwa/manifest.webmanifest',
    'src/assets/pwa/manifest-admin.webmanifest',
    'src/assets/pwa/manifest-cook.webmanifest',
    'src/assets/pwa/manifest-courier.webmanifest',
    'src/assets/pwa/manifest-manager.webmanifest',
    'src/assets/pwa/manifest-waiter.webmanifest'
  ];
  for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `required runtime file is missing: ${file}`);
});

test('guest manager compatibility URL is explicitly routed to the canonical manager page', () => {
  const routes = getRoutes();
  assert.ok(
    coveredByVercelRoute('/src/pages/guest/manager.html', routes),
    'legacy guest manager URL must remain routable after filesystem reorganization'
  );
});
