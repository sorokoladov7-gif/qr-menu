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
  return value.split('#', 1)[0].split('?', 1)[0];
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

function coveredByVercelRoute(urlPath, routes) {
  return routes.some(route => route && typeof route.source === 'string' && routePattern(route.source).test(urlPath));
}

function localPathExists(urlPath) {
  const relative = urlPath.replace(/^\/+/, '');
  return fs.existsSync(path.join(root, relative));
}

function assertResolvable(ref, pagePath, routes, label) {
  if (isExternal(ref)) return;

  const clean = normalizeLocalRef(ref);
  if (!clean) return;

  const urlPath = clean.startsWith('/')
    ? clean
    : `/${path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), clean))}`;

  assert.ok(
    localPathExists(urlPath) || coveredByVercelRoute(urlPath, routes),
    `${label}: ${pagePath} -> ${ref} resolves to ${urlPath}, but no file or Vercel route covers it`
  );
}

test('all canonical HTML local resources resolve to files or declared Vercel routes', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const routes = [...(vercel.redirects || []), ...(vercel.rewrites || [])];
  const pagesRoot = path.join(root, 'src/pages');
  const htmlFiles = walk(pagesRoot).filter(file => file.endsWith('.html'));

  assert.ok(htmlFiles.length > 0, 'canonical pages directory must contain HTML pages');

  for (const file of htmlFiles) {
    const pagePath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const html = fs.readFileSync(file, 'utf8');
    const refs = [];
    const attrRe = /\b(?:src|href|poster|action)=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = attrRe.exec(html))) refs.push(match[1]);

    for (const ref of refs) assertResolvable(ref, pagePath, routes, 'HTML path contract');
  }
});

test('repository JavaScript local asset URLs resolve to files or declared Vercel routes', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const routes = [...(vercel.redirects || []), ...(vercel.rewrites || [])];
  const jsRoot = path.join(root, 'src/assets/js');
  const jsFiles = walk(jsRoot).filter(file => /\.(?:js|cjs|mjs)$/.test(file));

  const assetRefRe = /["'`]((?:\/)(?:js|css|img|icons|assets|src\/assets)[^"'`\s)]*)["'`]/gi;
  for (const file of jsFiles) {
    const pagePath = `/${path.relative(root, file).split(path.sep).join('/')}`;
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = assetRefRe.exec(source))) {
      const ref = normalizeLocalRef(match[1]);
      assert.ok(
        localPathExists(ref) || coveredByVercelRoute(ref, routes),
        `JS path contract: ${pagePath} -> ${ref} has no file or Vercel route`
      );
    }
  }
});

test('guest manager compatibility URL is explicitly routed to the canonical manager page', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const routes = [...(vercel.redirects || []), ...(vercel.rewrites || [])];
  assert.ok(
    coveredByVercelRoute('/src/pages/guest/manager.html', routes),
    'legacy guest manager URL must remain routable after filesystem reorganization'
  );
});
