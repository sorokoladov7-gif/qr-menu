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
    /["'`]((?:\/)(?:js|css|img|icons|assets|src\/assets)[^"'`\s)]*)["'`]/gi,
    /(?:location(?:\.href|\.assign|\.replace)|window\.open)\s*\(\s*["'`]([^"'`]+\.html(?:\?[^"'`]*)?(?:#[^"'`]*)?)["'`]/gi,
    /(?:location\.href|window\.location(?:\.href)?)\s*=\s*["'`]([^"'`]+\.html(?:\?[^"'`]*)?(?:#[^"'`]*)?)["'`]/gi
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(source))) refs.push(match[1]);
  }
  return refs;
}

test('all canonical HTML local resources resolve to files or declared Vercel routes', () => {
  const routes = getRoutes();
  const pagesRoot = path.join(root, 'src/pages');
  const htmlFiles = walk(pagesRoot).filter(file => file.endsWith('.html'));

  assert.ok(htmlFiles.length > 0, 'canonical pages directory must contain HTML pages');

  for (const file of htmlFiles) {
    const pagePath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const html = fs.readFileSync(file, 'utf8');
    for (const ref of collectHtmlRefs(html)) assertResolvable(ref, pagePath, routes, 'HTML path contract');
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
    for (const ref of collectJsLocalRefs(source)) assertResolvable(ref, ownerPath, routes, 'JS path contract');
  }
});

test('canonical CSS url() assets resolve to files or declared Vercel routes', () => {
  const routes = getRoutes();
  const cssRoot = path.join(root, 'src/assets/css');
  const cssFiles = walk(cssRoot).filter(file => file.endsWith('.css'));

  for (const file of cssFiles) {
    const ownerPath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const source = fs.readFileSync(file, 'utf8');
    for (const ref of collectCssRefs(source)) assertResolvable(ref, ownerPath, routes, 'CSS path contract');
  }
});

test('service worker precache URLs resolve to files or declared Vercel routes', () => {
  const routes = getRoutes();
  const source = read('sw.js');
  const arrayMatch = source.match(/(?:CORE|PRECACHE|ASSETS)\s*=\s*\[([\s\S]*?)\]/);
  if (!arrayMatch) return;

  const refs = [...arrayMatch[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]);
  for (const ref of refs) assertResolvable(ref, '/sw.js', routes, 'Service worker path contract');
});

test('canonical manifests and root service worker are physically present', () => {
  const required = [
    'sw.js',
    'src/assets/pwa/manifest.webmanifest',
    'src/assets/pwa/manifest-admin.webmanifest',
    'src/assets/pwa/manifest-cook.webmanifest',
    'src/assets/pwa/manifest-courier.webmanifest',
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
