'use strict';

const { analyzeSite } = require('../lib/site-menu-analyzer-v3');

const ANALYSIS_BUDGET_MS = 55000;
const MAX_RENDER_TARGETS = 28;
const LEARNING_MIN_CONFIDENCE = 0.65;
const LEARNING_MAX_PATTERNS = 80;
const LEARNING_MAX_WRITES = 60;
const MENU_PATH_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|deserts|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|zakuski|закуск|salaty|salad|салат|soup|суп|goriachie|горяч|bluda|блюда|pasta|паста|garniry|гарнир|steak|стейк|osnovnye|основные|det|детск|children|детям)(?:[\/?#_.-]|$)/iu;
const MENU_TEXT_RE = /(?:^|\s)(меню|каталог|карта\s+меню|карта\s+блюд|цены|наше\s+меню|food\s+menu|menu|catalog)(?:\s|$)/iu;
const COMMON_MENU_PATHS = [
  'menu','menyu','catalog','catalogue','food','food-menu','menu-food','menu-list',
  'zakuski','salaty','goriachie-zakuski','goriachie-bliuda','goriachie-blyuda',
  'osnovnye-bliuda','osnovnye-blyuda','pasta','pizza','sushi','rolls','garniry',
  'steak','steiki','shashlyk','grill','myaso','ryba','soups','soup','supy',
  'desert','dessert','desserty','zavtraki','breakfast','napitki','drinks','drink',
  'bar','sauces','sousy','deti','detskoe-menu','det-menu'
];

function normalizeName(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function cleanText(value, max = 600) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function firstNonEmpty(...values) { return values.map(v => cleanText(v, 1000)).find(Boolean) || null; }
function absoluteHttp(value, baseUrl) {
  try {
    const url = new URL(String(value || ''), baseUrl);
    return /^https?:$/i.test(url.protocol) ? url.href : null;
  } catch (_) { return null; }
}
function normalizeUrl(value, baseUrl) {
  try {
    const url = new URL(String(value || ''), baseUrl);
    if (!/^https?:$/i.test(url.protocol)) return null;
    url.hash = '';
    return url.href.replace(/\/$/, '') || url.origin;
  } catch (_) { return null; }
}
function sameHost(a, b) {
  try { return new URL(a).hostname.replace(/^www\./i, '').toLowerCase() === new URL(b).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch (_) { return false; }
}
function getDomain(value) {
  try { return new URL(value).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch (_) { return ''; }
}
function isAsset(url) { return /\.(?:css|js|mjs|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|pdf)(?:[?#].*)?$/iu.test(String(url || '')); }
function isMenuPage(url, menuPages = []) {
  const value = String(url || '').trim().replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
  if (!value) return false;
  if (MENU_PATH_RE.test(value)) return true;
  return menuPages.some(page => {
    const p = String(page || '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
    return p && (p === value || value.startsWith(`${p}/`));
  });
}
function targetScore(url, anchorText = '', evidence = {}) {
  const value = String(url || '').toLowerCase();
  let score = 0;
  if (MENU_PATH_RE.test(value)) score += 30;
  if (MENU_TEXT_RE.test(anchorText)) score += 35;
  if (evidence.schemaMenu) score += 50;
  if (evidence.sitemap) score += 5;
  if (/(product|dish|item|food|menu|catalog|category|pizza|sushi|salad|breakfast|dessert|drink)/i.test(value)) score += 15;
  if (/(login|account|cart|checkout|privacy|terms|contact|delivery|news|blog|vacancy|career)/i.test(value)) score -= 15;
  return score;
}
function cleanMenuProduct(item) {
  const name = cleanText(item?.name, 220);
  if (!name) return null;
  const price = Number(item?.price);
  return {
    name,
    description: item?.description ? cleanText(item.description, 600) : null,
    price: Number.isFinite(price) && price > 0 ? price : 0,
    category: item?.category ? cleanText(item.category, 120) : 'main',
    image_url: item?.image_url ? String(item.image_url).trim() : null,
    is_available: true,
    applies_to: 'all'
  };
}
function mergeProducts(existing, rendered) {
  const out = [];
  const byName = new Map();
  const add = raw => {
    const product = cleanMenuProduct(raw);
    if (!product) return;
    const key = normalizeName(product.name);
    if (!key) return;
    const previous = byName.get(key);
    if (previous) {
      if (!previous.image_url && product.image_url) previous.image_url = product.image_url;
      if (!previous.description && product.description) previous.description = product.description;
      if ((!previous.price || previous.price <= 0) && product.price > 0) previous.price = product.price;
      if ((!previous.category || previous.category === 'main') && product.category) previous.category = product.category;
      return;
    }
    byName.set(key, product);
    out.push(product);
  };
  for (const item of Array.isArray(existing) ? existing : []) add(item);
  for (const item of Array.isArray(rendered) ? rendered : []) add(item);
  return out;
}
function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { code: 'IMPORT_ERROR', message: error, details: {} };
  return { code: String(error.code || 'IMPORT_ERROR'), message: String(error.message || 'Ошибка импорта'), details: error.details && typeof error.details === 'object' ? error.details : {} };
}

function learningConfig() {
  const url = firstNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const key = firstNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_KEY, process.env.SUPABASE_SECRET_KEY);
  return { url: url ? String(url).replace(/\/$/, '') : null, key: key || null, enabled: Boolean(url && key) };
}

async function learningRequest(path, options = {}) {
  const config = learningConfig();
  if (!config.enabled) return null;
  try {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {})
      }
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  } catch (_) { return null; }
}

async function loadLearningPatterns(domain) {
  const config = learningConfig();
  if (!config.enabled) return { enabled: false, patterns: [], reused: 0 };
  const query = [
    `confidence=gte.${LEARNING_MIN_CONFIDENCE}`,
    `or=(scope.eq.global,scope.eq.platform,scope.eq.domain)`,
    'order=confidence.desc,observations.desc',
    `limit=${LEARNING_MAX_PATTERNS}`
  ].join('&');
  const rows = await learningRequest(`site_analyzer_learning_patterns?select=*&${query}`);
  const patterns = Array.isArray(rows) ? rows.filter(row => {
    if (row.scope !== 'domain') return true;
    return String(row.domain || '').toLowerCase() === domain;
  }) : [];
  return { enabled: true, patterns, reused: patterns.length };
}

function applyLearningToDiscovery(discovery, patterns, diagnostics) {
  if (!Array.isArray(discovery) || !patterns.length) return discovery;
  const menuLinks = patterns.filter(p => p.pattern_type === 'menu_link');
  const boosts = new Map();
  for (const pattern of menuLinks) {
    const value = pattern.pattern_value || {};
    const hint = String(value.path || value.url_path || value.url_pattern || value.anchor || '').toLowerCase();
    if (!hint) continue;
    for (const item of discovery) {
      const haystack = `${item.url} ${item.anchor || ''}`.toLowerCase();
      if (haystack.includes(hint)) boosts.set(item.url, Math.max(boosts.get(item.url) || 0, Math.round(Number(pattern.confidence || 0) * 25)));
    }
  }
  for (const item of discovery) {
    const boost = boosts.get(item.url) || 0;
    if (boost) {
      item.score += boost;
      if (!Array.isArray(item.reasons)) item.reasons = [];
      item.reasons.push('learned-menu-pattern');
    }
  }
  diagnostics.learning_reused_menu_hints = boosts.size;
  return discovery.sort((a, b) => b.score - a.score);
}

function evaluateProduct(product, source = 'unknown') {
  const evidence = [];
  if (product?.name) evidence.push('name');
  if (Number(product?.price) > 0) evidence.push('price');
  if (product?.description) evidence.push('description');
  if (product?.image_url) evidence.push('image');
  if (product?.category && product.category !== 'main') evidence.push('category');
  if (product?.extraction_source) evidence.push(`source:${product.extraction_source}`);
  const completeness = evidence.filter(x => !x.startsWith('source:')).length;
  let score = 25 + completeness * 14;
  if (product?.extraction_source) score += 8;
  if (source === 'browser') score += 5;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
  return { confidence: score, level, evidence };
}

function evaluateProducts(products, diagnostics) {
  const evaluated = [];
  for (const product of Array.isArray(products) ? products : []) {
    const evaluation = evaluateProduct(product, product?.extraction_source ? 'analyzer' : 'unknown');
    product.import_confidence = evaluation.confidence;
    product.import_confidence_level = evaluation.level;
    product.import_confidence_reasons = evaluation.evidence;
    evaluated.push(evaluation);
  }
  diagnostics.product_confidence = {
    high: evaluated.filter(x => x.level === 'high').length,
    medium: evaluated.filter(x => x.level === 'medium').length,
    low: evaluated.filter(x => x.level === 'low').length
  };
  return evaluated;
}

function learningPatternKey(type, value) {
  return `${type}:${normalizeName(value)}`.slice(0, 500);
}

function buildLearningObservations(products, discovery, browserResult, domain) {
  const observations = [];
  const add = (pattern_type, pattern_key, pattern_value, scope = 'global', success = true) => {
    if (!pattern_key) return;
    observations.push({ pattern_type, pattern_key: String(pattern_key).slice(0, 500), pattern_value: pattern_value || {}, scope, domain: scope === 'domain' ? domain : null, success });
  };

  const sourceCounts = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const source = String(product?.extraction_source || 'generic').trim().toLowerCase();
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const evaluation = evaluateProduct(product);
    add('card_structure', learningPatternKey('card_structure', source), { extraction_source: source, fields: evaluation.evidence.filter(x => !x.startsWith('source:')) }, 'global', evaluation.confidence >= 50);
    add('name_selector', learningPatternKey('name_selector', source), { extraction_source: source }, 'global', Boolean(product?.name));
    add('price_selector', learningPatternKey('price_selector', source), { extraction_source: source }, 'global', Number(product?.price) > 0);
    add('description_selector', learningPatternKey('description_selector', source), { extraction_source: source }, 'global', Boolean(product?.description));
    add('image_selector', learningPatternKey('image_selector', source), { extraction_source: source }, 'global', Boolean(product?.image_url));
    if (product?.category && product.category !== 'main') add('category_selector', learningPatternKey('category_selector', source), { extraction_source: source }, 'global', true);
  }

  for (const item of Array.isArray(discovery) ? discovery.slice(0, 40) : []) {
    if (isMenuPage(item.url, [])) {
      const path = (() => { try { return new URL(item.url).pathname.toLowerCase(); } catch (_) { return ''; } })();
      add('menu_link', learningPatternKey('menu_link', path), { path, score: item.score, reasons: item.reasons || [] }, 'global', true);
    }
  }

  if (browserResult?.diagnostics?.discovered_menu_links) {
    for (const url of browserResult.diagnostics.discovered_menu_links.slice(0, 30)) {
      let path = '';
      try { path = new URL(url).pathname.toLowerCase(); } catch (_) {}
      if (path) add('menu_link', learningPatternKey('menu_link', path), { path, discovered_by: 'browser' }, 'global', true);
    }
  }

  for (const [source, count] of sourceCounts.entries()) {
    if (count >= 2) add('platform_signature', learningPatternKey('platform_signature', source), { extraction_source: source, observed_products: count }, 'global', true);
  }
  return observations.slice(0, LEARNING_MAX_WRITES);
}

async function persistLearning(observations, run, diagnostics) {
  const config = learningConfig();
  if (!config.enabled) {
    diagnostics.learning = { enabled: false, patterns_discovered: 0, patterns_reused: Number(diagnostics.learning?.patterns_reused || 0), reason: 'server_supabase_credentials_not_configured' };
    return;
  }
  let written = 0;
  for (const item of observations) {
    const body = {
      p_pattern_type: item.pattern_type,
      p_pattern_key: item.pattern_key,
      p_pattern_value: item.pattern_value,
      p_scope: item.scope,
      p_domain: item.domain,
      p_success: Boolean(item.success)
    };
    const result = await learningRequest('rpc/update_site_analyzer_learning_pattern', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (result) written += 1;
  }
  const runResult = await learningRequest('site_analyzer_learning_runs', {
    method: 'POST',
    body: JSON.stringify(run)
  });
  diagnostics.learning = {
    enabled: true,
    patterns_discovered: observations.length,
    patterns_written: written,
    patterns_reused: Number(diagnostics.learning?.patterns_reused || 0),
    run_recorded: Boolean(runResult)
  };
}

async function fetchText(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 QR-Menu-Site-Analyzer/40.0',
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml,application/json,text/plain,*/*;q=0.7',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) return null;
    return { url: response.url || url, contentType: response.headers.get('content-type') || '', text: (await response.text()).slice(0, 8 * 1024 * 1024) };
  } catch (_) { return null; }
  finally { clearTimeout(timer); }
}

function parseLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu;
  let match;
  while ((match = re.exec(String(html || ''))) && out.length < 800) {
    const url = normalizeUrl(match[1], baseUrl);
    if (!url || !sameHost(url, baseUrl) || isAsset(url)) continue;
    const text = cleanText(String(match[2]).replace(/<[^>]+>/g, ' '), 180);
    out.push({ url, text, score: targetScore(url, text) });
  }
  return out;
}

function parseSitemap(xml, baseUrl) {
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/giu;
  let match;
  while ((match = re.exec(String(xml || ''))) && out.length < 1200) {
    const url = normalizeUrl(match[1], baseUrl);
    if (url && sameHost(url, baseUrl) && !isAsset(url)) out.push(url);
  }
  return [...new Set(out)];
}

function parseRobotsSitemaps(text, baseUrl) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap\s*:\s*(\S+)/iu);
    if (match) {
      const url = normalizeUrl(match[1], baseUrl);
      if (url && sameHost(url, baseUrl)) out.push(url);
    }
  }
  return [...new Set(out)];
}

function parseJsonLdNodes(html, baseUrl) {
  const nodes = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;
  let match;
  while ((match = re.exec(String(html || '')))) {
    try {
      const value = JSON.parse(match[1].trim());
      const walk = node => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node !== 'object') return;
        nodes.push(node);
        if (Array.isArray(node['@graph'])) node['@graph'].forEach(walk);
        Object.values(node).forEach(value => {
          if (value && typeof value === 'object') walk(value);
        });
      };
      walk(value);
    } catch (_) {}
  }
  return nodes;
}

function parseSchemaMenuTargets(html, baseUrl) {
  const targets = [];
  const nodes = parseJsonLdNodes(html, baseUrl);
  const push = value => {
    if (typeof value !== 'string') return;
    const url = normalizeUrl(value, baseUrl);
    if (url && sameHost(url, baseUrl)) targets.push({ url, score: 80, reason: 'schema-menu-url' });
  };
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
    if (/(restaurant|cafe|bar|foodestablishment)/i.test(type)) {
      const menu = node.hasMenu || node.menu;
      if (typeof menu === 'string') push(menu);
      else if (menu && typeof menu === 'object') { push(menu.url); push(menu['@id']); }
    }
    if (/(menu|menusection)/i.test(type)) push(node.url);
    Object.values(node).forEach(value => { if (value && typeof value === 'object') walk(value); });
  };
  nodes.forEach(walk);
  return targets;
}

function parseJsonLdIdentity(html, baseUrl) {
  const identity = { name: null, description: null, address: null, phone: null, logo_url: null, opening_hours: null, cuisine: [], sources: [] };
  const nodes = parseJsonLdNodes(html, baseUrl);
  const addressText = a => {
    if (!a) return null;
    if (typeof a === 'string') return cleanText(a, 300);
    return [a.streetAddress, a.postalCode, a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(', ');
  };
  for (const item of nodes) {
    const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : String(item['@type'] || '');
    if (!/(restaurant|cafe|bar|foodestablishment|localbusiness|organization)/i.test(type)) continue;
    identity.name ||= firstNonEmpty(item.name);
    identity.description ||= firstNonEmpty(item.description);
    identity.address ||= addressText(item.address);
    identity.phone ||= firstNonEmpty(item.telephone, item.phone);
    identity.opening_hours ||= item.openingHours || item.openingHoursSpecification || null;
    const logo = typeof item.logo === 'object' ? item.logo?.url : item.logo;
    const image = typeof item.image === 'object' ? item.image?.url : item.image;
    identity.logo_url ||= absoluteHttp(logo || image, baseUrl);
    const cuisine = Array.isArray(item.servesCuisine) ? item.servesCuisine : [item.servesCuisine];
    identity.cuisine.push(...cuisine.filter(Boolean).map(x => cleanText(x, 80)));
    identity.sources.push('json-ld');
  }
  identity.cuisine = [...new Set(identity.cuisine)];
  identity.sources = [...new Set(identity.sources)];
  return identity;
}

async function discoverSite(rawUrl, diagnostics) {
  const start = normalizeUrl(rawUrl, rawUrl);
  const candidates = new Map();
  const add = (url, score, reason, anchor = '') => {
    const normalized = normalizeUrl(url, start);
    if (!normalized || !sameHost(normalized, start) || isAsset(normalized)) return;
    const existing = candidates.get(normalized);
    const entry = { url: normalized, score: Number(score || 0), reasons: existing?.reasons || [], anchor: existing?.anchor || anchor };
    if (reason && !entry.reasons.includes(reason)) entry.reasons.push(reason);
    entry.score = Math.max(entry.score, Number(score || 0));
    candidates.set(normalized, entry);
  };
  add(start, 1, 'start');
  for (const path of COMMON_MENU_PATHS) add(`${start}/${path}`, 25, 'common-menu-path');
  const root = await fetchText(start, 8000);
  if (root) {
    const identity = parseJsonLdIdentity(root.text, root.url);
    diagnostics.site_discovery.identity = identity;
    const links = parseLinks(root.text, root.url);
    for (const item of links) add(item.url, item.score, 'homepage-link', item.text);
    for (const item of parseSchemaMenuTargets(root.text, root.url)) add(item.url, item.score, item.reason);
    diagnostics.site_discovery.homepage_links = links.length;
    diagnostics.site_discovery.schema_menu_targets = parseSchemaMenuTargets(root.text, root.url).map(x => x.url);
  }
  const robots = await fetchText(new URL('/robots.txt', start).href, 5000);
  const sitemapUrls = new Set();
  if (robots) parseRobotsSitemaps(robots.text, start).forEach(x => sitemapUrls.add(x));
  sitemapUrls.add(new URL('/sitemap.xml', start).href);
  sitemapUrls.add(new URL('/sitemap_index.xml', start).href);
  diagnostics.site_discovery.sitemaps_checked = [];
  diagnostics.site_discovery.sitemap_urls_found = [];
  for (const sitemapUrl of sitemapUrls) {
    const sitemap = await fetchText(sitemapUrl, 6000);
    if (!sitemap) continue;
    diagnostics.site_discovery.sitemaps_checked.push(sitemapUrl);
    const urls = parseSitemap(sitemap.text, sitemap.url);
    diagnostics.site_discovery.sitemap_urls_found.push(...urls);
    for (const url of urls) add(url, targetScore(url, '', { sitemap: true }), 'sitemap');
    if (urls.length) {
      const nested = urls.filter(url => /sitemap/i.test(url)).slice(0, 8);
      for (const nestedUrl of nested) {
        const child = await fetchText(nestedUrl, 5000);
        if (!child) continue;
        for (const url of parseSitemap(child.text, nestedUrl)) add(url, targetScore(url, '', { sitemap: true }), 'nested-sitemap');
      }
    }
  }
  diagnostics.site_discovery.candidate_count = candidates.size;
  return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 120);
}

function fallbackMenuTargets(raw, diagnostics) {
  const base = String(raw || '').replace(/#.*$/, '').replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) return [];
  const discovered = [];
  const push = value => {
    const url = normalizeUrl(value, base);
    if (url && !discovered.includes(url)) discovered.push(url);
  };
  for (const url of Array.isArray(diagnostics?.menu_pages) ? diagnostics.menu_pages : []) push(url);
  for (const url of Array.isArray(diagnostics?.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : []) push(url);
  for (const item of Array.isArray(diagnostics?.site_discovery?.candidates) ? diagnostics.site_discovery.candidates : []) push(item.url);
  for (const path of COMMON_MENU_PATHS) push(`${base}/${path}`);
  return discovered;
}

async function analyzeVenueIdentity(rawUrl, discoveryIdentity = null) {
  const base = discoveryIdentity || {};
  try {
    const response = await fetchText(rawUrl, 8000);
    if (!response) return base;
    const html = response.text;
    const identity = parseJsonLdIdentity(html, response.url || rawUrl);
    const meta = name => {
      const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${safe}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
      return html.match(re)?.[1] || null;
    };
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null;
    const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const addressMatch = bodyText.match(/(?:адрес|address|г\.|город|city)\s*[:\-]?\s*([^|]{8,180}?)(?=\s+(?:тел|phone|режим|время|часы|email|e-mail)\b|$)/iu);
    const logo = html.match(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || null;
    return {
      name: firstNonEmpty(identity.name, base.name, meta('og:site_name'), meta('application-name'), title?.replace(/\s*[|—-]\s*(меню|menu|доставка|официальный сайт).*$/iu, '')),
      description: firstNonEmpty(identity.description, base.description, meta('description'), meta('og:description')),
      address: firstNonEmpty(identity.address, base.address, meta('street-address'), addressMatch?.[1]),
      phone: firstNonEmpty(identity.phone, base.phone, meta('telephone')),
      logo_url: identity.logo_url || base.logo_url || absoluteHttp(meta('og:image'), response.url || rawUrl) || absoluteHttp(logo, response.url || rawUrl),
      opening_hours: identity.opening_hours || base.opening_hours || null,
      cuisine: [...new Set([...(base.cuisine || []), ...(identity.cuisine || [])])],
      sources: [...new Set([...(base.sources || []), ...(identity.sources || []), 'meta/title'])]
    };
  } catch (_) { return base; }
}

module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const fail = (status, code, message, details = {}) => res.status(status).json({ ok: false, error: { code, message, details } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return fail(400, 'URL_REQUIRED', 'Не передан адрес сайта');

  try {
    const domain = getDomain(raw);
    const learning = await loadLearningPatterns(domain);
    const discoveryDiagnostics = { site_discovery: { candidates: [], identity: null, homepage_links: 0, schema_menu_targets: [], sitemaps_checked: [], sitemap_urls_found: [] } };
    const discovery = await discoverSite(raw, discoveryDiagnostics);
    discoveryDiagnostics.site_discovery.candidates = applyLearningToDiscovery(discovery, learning.patterns, discoveryDiagnostics);

    const [result, identity] = await Promise.all([
      withTimeout(analyzeSite(raw), ANALYSIS_BUDGET_MS),
      analyzeVenueIdentity(raw, discoveryDiagnostics.site_discovery.identity)
    ]);

    const meta = result.meta || (result.meta = {});
    const diagnostics = meta.diagnostics || (meta.diagnostics = {});
    diagnostics.site_discovery = discoveryDiagnostics.site_discovery;
    diagnostics.analysis_steps = Array.isArray(diagnostics.analysis_steps) ? diagnostics.analysis_steps : [];
    diagnostics.learning = { enabled: learning.enabled, patterns_loaded: learning.patterns.length, patterns_reused: learning.reused };
    diagnostics.analysis_steps.push(`Site reconnaissance: ${discovery.length} кандидатов страниц`);
    diagnostics.analysis_steps.push(`Learning Engine: загружено ${learning.patterns.length} устойчивых паттернов`);
    diagnostics.analysis_steps.push(`Sitemap: найдено ${discoveryDiagnostics.site_discovery.sitemap_urls_found.length} URL`);
    diagnostics.analysis_steps.push(`Schema.org menu: найдено ${discoveryDiagnostics.site_discovery.schema_menu_targets.length} прямых ссылок на меню`);

    const jsPages = Array.isArray(diagnostics.js_render?.pages) ? diagnostics.js_render.pages.map(x => x.url) : [];
    const menuPages = Array.isArray(diagnostics.menu_pages) ? diagnostics.menu_pages : [];
    const discoveredTargets = discovery.map(item => item.url);
    const highValueTargets = discovery.filter(item => item.score >= 20).map(item => item.url);
    const fallbackTargets = fallbackMenuTargets(raw, diagnostics);
    const renderTargets = [...new Set([...highValueTargets, ...menuPages, ...jsPages, ...fallbackTargets, ...discoveredTargets])]
      .filter(url => sameHost(url, raw)).slice(0, MAX_RENDER_TARGETS);
    diagnostics.analysis_steps.push(`Adaptive browser crawl: ${renderTargets.length} приоритетных URL`);

    let browserResult = { ok: false, code: 'NOT_RUN', products: [], diagnostics: {} };
    try {
      const { renderMenuPages } = require('../lib/site-browser-renderer-v2');
      browserResult = await renderMenuPages(renderTargets);
    } catch (browserLoadError) {
      browserResult = {
        ok: false,
        code: 'BROWSER_DEPENDENCY_FAILED',
        products: [],
        diagnostics: {
          error_name: browserLoadError?.name || 'Error',
          error_message: String(browserLoadError?.message || browserLoadError),
          stack: String(browserLoadError?.stack || '').split('\n').slice(0, 12)
        }
      };
    }

    diagnostics.browser_render = browserResult.diagnostics || {};
    diagnostics.browser_render_code = browserResult.code || null;
    diagnostics.browser_products_found = Array.isArray(browserResult.products) ? browserResult.products.length : 0;
    diagnostics.analysis_steps.push(`Adaptive browser crawl: ${browserResult.code || 'UNKNOWN'}; найдено ${diagnostics.browser_products_found} позиций`);
    if (Array.isArray(browserResult.diagnostics?.discovered_menu_links) && browserResult.diagnostics.discovered_menu_links.length) {
      diagnostics.analysis_steps.push(`Динамически обнаружено ссылок меню: ${browserResult.diagnostics.discovered_menu_links.length}`);
    }

    result.products = mergeProducts(result.products, browserResult.products);
    diagnostics.products_found = result.products.length;
    diagnostics.venue_identity = identity;
    diagnostics.product_sources = [...new Set(result.products.map(x => x?.extraction_source).filter(Boolean))];
    diagnostics.discovery_strategy = 'entity-catalog-multisource-v41-adaptive-learning';
    evaluateProducts(result.products, diagnostics);

    const evidenceScore = Math.min(100, Math.round(
      (result.products.length ? 35 : 0) +
      (result.products.filter(x => x.price > 0).length ? 20 : 0) +
      (result.products.filter(x => x.description).length ? 15 : 0) +
      (result.products.filter(x => x.image_url).length ? 15 : 0) +
      (discoveryDiagnostics.site_discovery.schema_menu_targets.length ? 10 : 0) +
      (discoveryDiagnostics.site_discovery.sitemap_urls_found.length ? 5 : 0)
    ));
    diagnostics.confidence = evidenceScore;
    diagnostics.confidence_reasons = [
      result.products.length ? `найдено ${result.products.length} структурированных позиций` : 'позиции не найдены',
      result.products.some(x => x.price > 0) ? 'есть ценовые доказательства' : null,
      result.products.some(x => x.description) ? 'есть описания' : null,
      result.products.some(x => x.image_url) ? 'есть изображения' : null,
      discoveryDiagnostics.site_discovery.schema_menu_targets.length ? 'обнаружена Schema.org связь с меню' : null,
      discoveryDiagnostics.site_discovery.sitemap_urls_found.length ? 'использован sitemap' : null,
      diagnostics.product_confidence?.high ? `${diagnostics.product_confidence.high} позиций с высокой уверенностью` : null
    ].filter(Boolean);

    const observations = buildLearningObservations(result.products, discovery, browserResult, domain);
    await persistLearning(observations, {
      domain,
      source_url: raw,
      products_high: diagnostics.product_confidence?.high || 0,
      products_medium: diagnostics.product_confidence?.medium || 0,
      products_low: diagnostics.product_confidence?.low || 0,
      patterns_discovered: observations.length,
      patterns_reused: learning.reused,
      diagnostics: {
        confidence: diagnostics.confidence,
        product_sources: diagnostics.product_sources,
        browser_code: browserResult.code || null,
        candidate_count: discovery.length
      }
    }, diagnostics);

    meta.diagnostics = diagnostics;
    meta.menu_found = result.products.length > 0;
    meta.validation = result.products.length ? 'validated-multisource-catalog' : 'not_validated';
    meta.error = result.products.length ? null : normalizeError(meta.error);

    const sourceVenue = result.venue || {};
    const venue = {
      name: firstNonEmpty(identity.name, sourceVenue.name, meta.name, meta.venue_name, meta.title),
      description: firstNonEmpty(identity.description, sourceVenue.description),
      address: firstNonEmpty(identity.address, sourceVenue.address, meta.address, meta.venue_address),
      phone: firstNonEmpty(identity.phone, sourceVenue.phone),
      website_url: sourceVenue.website_url || raw,
      logo_url: identity.logo_url || sourceVenue.logo_url || null,
      opening_hours: identity.opening_hours || sourceVenue.opening_hours || null,
      cuisine: identity.cuisine || []
    };

    return res.status(200).json({
      ok: true,
      venue,
      products: result.products,
      meta: {
        menu_found: Boolean(meta.menu_found),
        products_found: result.products.length,
        validation: meta.validation,
        confidence: Number(diagnostics.confidence || 0),
        confidence_reasons: Array.isArray(diagnostics.confidence_reasons) ? diagnostics.confidence_reasons : [],
        diagnostics,
        source_url: raw
      }
    });
  } catch (error) {
    if (error?.code === 'IMPORT_ANALYSIS_TIMEOUT') return fail(504, 'IMPORT_ANALYSIS_TIMEOUT', 'Импорт сайта превысил допустимое время анализа. Попробуйте повторить анализ.', { budget_ms: ANALYSIS_BUDGET_MS });
    return fail(500, 'IMPORT_RUNTIME_ERROR', 'Ошибка универсального анализатора сайта', { name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '').split('\n').slice(0, 10) });
  }
};

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { const error = new Error('IMPORT_ANALYSIS_TIMEOUT'); error.code = 'IMPORT_ANALYSIS_TIMEOUT'; error.status = 504; reject(error); }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}