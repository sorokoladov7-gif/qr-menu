'use strict';

const { analyzeSite } = require('../lib/site-menu-analyzer-v3');
const { renderMenuPages } = require('../lib/site-browser-renderer-v2');

const ANALYSIS_BUDGET_MS = 55000;
const MAX_DISCOVERY_CANDIDATES = 120;
const MAX_RENDER_TARGETS = 28;
const MAX_READER_TARGETS = 10;
const READER_CONCURRENCY = 3;
const LEARNING_MIN_CONFIDENCE = 0.65;
const LEARNING_MAX_PATTERNS = 80;
const LEARNING_MAX_WRITES = 60;
const SUPABASE_URL_FALLBACK = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPPORTED_PATTERN_TYPES = new Set([
  'card_structure','name_selector','price_selector','description_selector','image_selector',
  'category_selector','menu_link','api_endpoint','jsonld_structure','platform_signature','rejection_signal'
]);

const MENU_PATH_RE = /(?:^|[\/_-])(menu|menus|menyu|меню|catalog|catalogue|каталог|food|dishes|блюд|prices|price|pizza|пицц|sushi|суш|roll|ролл|dessert|deserts|десерт|drink|напит|breakfast|завтрак|bar|бар|гриль|шашлык|zakuski|закуск|salaty|salad|салат|soup|суп|goriachie|горяч|bluda|блюда|pasta|паста|garniry|гарнир|steak|стейк|osnovnye|основные|det|детск|children|детям|mangal|мангал|sousy|соус|napitki|напитки|pervye|перв)(?:[\/?#_.-]|$)/iu;
const MENU_TEXT_RE = /(?:^|\s)(меню|каталог|карта\s+меню|карта\s+блюд|цены|наше\s+меню|food\s+menu|menu|catalog)(?:\s|$)/iu;
const COMMON_MENU_PATHS = [
  'menu','menyu','catalog','catalogue','food','food-menu','menu-food','menu-list',
  'zakuski','salaty','goriachie-zakuski','goriachie-bliuda','goriachie-blyuda','osnovnye-bliuda','osnovnye-blyuda',
  'pasta','pizza','sushi','rolls','garniry','steak','steiki','shashlyk','grill','myaso','ryba',
  'soups','soup','supy','desert','dessert','desserty','zavtraki','breakfast','napitki','drinks','drink',
  'bar','sauces','sousy','deti','detskoe-menu','det-menu','mangal','pervye-bliuda'
];
const NOISE_RE = /^(главная|меню|каталог|о нас|о компании|доставка|акции|новости|контакты|отзывы|вакансии|заказать|корзина|войти|регистрация|подробнее|купить|добавить|калории|белки|жиры|углеводы|добавить в корзину|выбрать|колл-центр)$/iu;
const WEIGHT_RE = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
const CATEGORY_RE = /^(закуски|салаты?|супы?|бургеры?|горячие блюда.*|горячие закуски.*|пицца|.*роллы?|суши|десерты?|соусы?|карта бара|барная карта|напитки?|завтраки?|гарниры?|паста|стейки?|основные блюда|детское меню|детям|мангал|первые блюда)$/iu;

function cleanText(value, max = 600) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeName(value) { return cleanText(value, 300).toLowerCase(); }
function firstNonEmpty(...values) { return values.map(v => cleanText(v, 1200)).find(Boolean) || null; }
function getDomain(value) { try { return new URL(value).hostname.replace(/^www\./i, '').toLowerCase(); } catch (_) { return ''; } }
function normalizeUrl(value, baseUrl) {
  try {
    const url = new URL(String(value || ''), baseUrl);
    if (!/^https?:$/i.test(url.protocol)) return null;
    url.hash = '';
    return url.href.replace(/\/$/, '') || url.origin;
  } catch (_) { return null; }
}
function absoluteHttp(value, baseUrl) { return normalizeUrl(value, baseUrl); }
function sameHost(a, b) { return getDomain(a) === getDomain(b); }
function isAsset(url) { return /\.(?:css|js|mjs|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|mp4|mp3|zip|rar|pdf)(?:[?#].*)?$/iu.test(String(url || '')); }
function isMenuPage(url, menuPages = []) {
  const value = String(url || '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
  if (!value) return false;
  if (MENU_PATH_RE.test(value)) return true;
  return menuPages.some(page => { const p = String(page || '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase(); return p && (p === value || value.startsWith(`${p}/`)); });
}
function pathOf(url) { try { return new URL(url).pathname.toLowerCase() || '/'; } catch (_) { return ''; } }
function pathDepth(url) { const path = pathOf(url).replace(/^\/+|\/+$/g, ''); return path ? path.split('/').length : 0; }
function targetScore(url, anchorText = '', evidence = {}) {
  const value = String(url || '').toLowerCase();
  let score = 0;
  if (MENU_PATH_RE.test(value)) score += 30;
  if (MENU_TEXT_RE.test(anchorText)) score += 35;
  if (evidence.schemaMenu) score += 50;
  if (evidence.sitemap) score += 5;
  if (/(product|dish|item|food|menu|catalog|category|pizza|sushi|salad|breakfast|dessert|drink|mangal|napitki|sousy)/i.test(value)) score += 15;
  if (/(login|account|cart|checkout|privacy|terms|contact|delivery|news|blog|vacancy|career|offer)/i.test(value)) score -= 15;
  return score;
}
function cleanMenuProduct(item) {
  const name = cleanText(item?.name, 220);
  if (!name || NOISE_RE.test(name) || WEIGHT_RE.test(name)) return null;
  const price = Number(item?.price);
  return { name, description: item?.description ? cleanText(item.description, 600) : null, price: Number.isFinite(price) && price > 0 ? price : 0, category: item?.category ? cleanText(item.category, 120) : 'main', image_url: item?.image_url ? String(item.image_url).trim() : null, is_available: true, applies_to: 'all', source_url: item?.source_url || null, extraction_source: item?.extraction_source || 'site-import' };
}
function mergeProducts(existing, incoming) {
  const out = []; const byName = new Map();
  const add = raw => {
    const product = cleanMenuProduct(raw); if (!product) return;
    const key = normalizeName(product.name); const previous = byName.get(key);
    if (!previous) { byName.set(key, product); out.push(product); return; }
    if (!previous.image_url && product.image_url) previous.image_url = product.image_url;
    if (!previous.description && product.description) previous.description = product.description;
    if ((!previous.price || previous.price <= 0) && product.price > 0) previous.price = product.price;
    if ((!previous.category || previous.category === 'main') && product.category && product.category !== 'main') previous.category = product.category;
    if (!previous.source_url && product.source_url) previous.source_url = product.source_url;
  };
  for (const item of Array.isArray(existing) ? existing : []) add(item);
  for (const item of Array.isArray(incoming) ? incoming : []) add(item);
  return out;
}

async function fetchText(url, timeoutMs = 7000, headers = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 QR-Menu-Site-Analyzer/42.1', accept: 'text/html,application/xhtml+xml,application/xml,text/xml,application/json,text/plain,*/*;q=0.7', 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8', ...headers } });
    return { ok: response.ok, status: response.status, url: response.url || url, contentType: response.headers.get('content-type') || '', text: (await response.text()).slice(0, 10 * 1024 * 1024) };
  } catch (error) { return { ok: false, status: 0, url, contentType: '', text: '', error: String(error?.message || error) }; }
  finally { clearTimeout(timer); }
}
function looksBlocked(payload) {
  if (!payload) return true;
  if (!payload.ok && payload.status >= 400) return true;
  const text = cleanText(payload.text, 8000).toLowerCase();
  return /вы не робот|не робот|captcha|проверка безопасности|access denied|just a moment|checking your browser|verify you are human|too many requests|bot detection|antibot|cloudflare|yandex smart captcha/.test(text);
}
async function fetchThroughReader(url, timeoutMs = 14000) {
  return fetchText(`https://r.jina.ai/${String(url)}`, timeoutMs, { 'x-engine': 'browser', 'x-no-cache': 'true', 'x-respond-with': 'html', 'x-base': 'true' });
}

function parseLinks(html, baseUrl) {
  const out = []; const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu; let match;
  while ((match = re.exec(String(html || ''))) && out.length < 1000) { const url = normalizeUrl(match[1], baseUrl); if (!url || !sameHost(url, baseUrl) || isAsset(url)) continue; const text = cleanText(String(match[2]).replace(/<[^>]+>/g, ' '), 180); out.push({ url, text, score: targetScore(url, text) }); }
  return out;
}
function parseSitemap(xml, baseUrl) {
  const out = []; const re = /<loc>\s*([^<]+?)\s*<\/loc>/giu; let match;
  while ((match = re.exec(String(xml || ''))) && out.length < 2000) { const url = normalizeUrl(match[1], baseUrl); if (url && sameHost(url, baseUrl) && !isAsset(url)) out.push(url); }
  return [...new Set(out)];
}
function parseRobotsSitemaps(text, baseUrl) { const out = []; for (const line of String(text || '').split(/\r?\n/)) { const match = line.match(/^\s*sitemap\s*:\s*(\S+)/iu); const url = match ? normalizeUrl(match[1], baseUrl) : null; if (url && sameHost(url, baseUrl)) out.push(url); } return [...new Set(out)]; }
function parseJsonLdNodes(html) {
  const nodes = []; const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu; let match;
  while ((match = re.exec(String(html || '')))) { try { const parsed = JSON.parse(match[1].trim()); const walk = value => { if (!value) return; if (Array.isArray(value)) return value.forEach(walk); if (typeof value !== 'object') return; nodes.push(value); Object.values(value).forEach(walk); }; walk(parsed); } catch (_) {} }
  return nodes;
}
function parseSchemaMenuTargets(html, baseUrl) {
  const targets = []; const push = value => { const url = typeof value === 'string' ? normalizeUrl(value, baseUrl) : null; if (url && sameHost(url, baseUrl)) targets.push(url); };
  for (const node of parseJsonLdNodes(html)) { const type = Array.isArray(node?.['@type']) ? node['@type'].join(' ') : String(node?.['@type'] || ''); if (!/(restaurant|cafe|bar|foodestablishment)/i.test(type)) continue; const menu = node.hasMenu || node.menu; if (typeof menu === 'string') push(menu); else if (menu && typeof menu === 'object') { push(menu.url); push(menu['@id']); } }
  return [...new Set(targets)];
}
function parseIdentity(html, baseUrl) {
  const identity = { name:null, description:null, address:null, phone:null, logo_url:null, opening_hours:null, cuisine:[], sources:[] };
  for (const node of parseJsonLdNodes(html)) { const type = Array.isArray(node?.['@type']) ? node['@type'].join(' ') : String(node?.['@type'] || ''); if (!/(restaurant|cafe|bar|foodestablishment|localbusiness|organization)/i.test(type)) continue; identity.name ||= firstNonEmpty(node.name); identity.description ||= firstNonEmpty(node.description); if (!identity.address && node.address) identity.address = typeof node.address === 'string' ? cleanText(node.address,300) : cleanText([node.address.streetAddress,node.address.postalCode,node.address.addressLocality,node.address.addressRegion].filter(Boolean).join(', '),300); identity.phone ||= firstNonEmpty(node.telephone,node.phone); identity.opening_hours ||= node.openingHours || node.openingHoursSpecification || null; const image = typeof node.logo === 'object' ? node.logo?.url : node.logo; identity.logo_url ||= absoluteHttp(image || node.image, baseUrl); const cuisine = Array.isArray(node.servesCuisine) ? node.servesCuisine : [node.servesCuisine]; identity.cuisine.push(...cuisine.filter(Boolean).map(v => cleanText(v,80))); identity.sources.push('json-ld'); }
  identity.cuisine = [...new Set(identity.cuisine)]; identity.sources = [...new Set(identity.sources)]; return identity;
}
function visibleLines(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu,' ').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu,' ').replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/giu,' ').replace(/<br\s*\/?>/giu,'\n').replace(/<\/(?:div|p|li|section|article|h[1-6]|tr|td|th|a|button|label|option|form|header|footer|nav)>/giu,'\n').replace(/<[^>]+>/g,' ').split(/\r?\n/).map(x => cleanText(x,700)).filter(Boolean);
}
function priceValue(value) {
  const text = cleanText(value,700).replace(/[\u00a0\u202f]/g,' ');
  const match = text.match(/(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)(?=$|\s|[.,;:!?])/iu) || text.match(/(?:₽|руб(?:лей|ля|ль)?\.?|RUB)\s*((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?/iu);
  if (!match) return 0; const raw = match[1] || match[0].replace(/[^\d., ]/g,''); const price = Number(String(raw).replace(/[ .]/g,'').replace(',','.')); return price > 0 && price < 1000000 ? price : 0;
}
function readerProductsFromHtml(html, pageUrl) {
  const products = []; const seen = new Set();
  const add = (name, price, description = '', image = null, source = 'reader-structure', category = 'main') => { const normalized = normalizeName(name); if (!normalized || seen.has(normalized) || !price || NOISE_RE.test(name) || WEIGHT_RE.test(name) || CATEGORY_RE.test(name)) return; seen.add(normalized); products.push({ name: cleanText(name,220), description: cleanText(description,600), price, image_url: image ? absoluteHttp(image,pageUrl) : null, category: cleanText(category,120), source_url: pageUrl, extraction_source: source, is_available:true, applies_to:'all' }); };
  for (const node of parseJsonLdNodes(html)) { const type = Array.isArray(node?.['@type']) ? node['@type'].join(' ') : String(node?.['@type'] || ''); const offer = Array.isArray(node?.offers) ? node.offers[0] : node?.offers; const price = Number(String(node?.price ?? offer?.price ?? '').replace(/\s/g,'').replace(',','.')); if (/(product|menuitem)/i.test(type) && node?.name && price > 0) { const image = typeof node.image === 'string' ? node.image : node.image?.url; add(node.name,price,node.description,image,'reader-jsonld',node.category || 'main'); } }
  const structural = /<(?:article|li|div|section)[^>]*(?:class|id)=["'][^"']*(?:menu|dish|product|food|price|card|item)[^"']*["'][^>]*>[\s\S]{0,12000}?<\/(?:article|li|div|section)>/giu; let match;
  while ((match = structural.exec(String(html || ''))) && products.length < 500) { const block = match[0]; const lines = visibleLines(block); const prices = lines.map(priceValue).filter(Boolean); if (!prices.length) continue; const candidates = lines.filter(line => line.length >= 3 && line.length <= 220 && !priceValue(line) && !NOISE_RE.test(line) && !WEIGHT_RE.test(line) && !CATEGORY_RE.test(line) && /[A-Za-zА-Яа-яЁё]/.test(line)); if (!candidates.length) continue; const image = block.match(/<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|srcset)=["']([^"']+)/iu)?.[1] || null; const category = lines.find(line => CATEGORY_RE.test(line)) || 'main'; add(candidates[0],prices[0],candidates.slice(1,4).join(' '),image,'reader-structural-card',category); }
  const lines = visibleLines(html);
  for (let i=0;i<lines.length && products.length<500;i++) { const price = priceValue(lines[i]); if (!price) continue; let name = null; for (let d=1;d<=10;d++) { for (const candidate of [lines[i-d],lines[i+d]]) { if (!candidate || priceValue(candidate) || NOISE_RE.test(candidate) || WEIGHT_RE.test(candidate) || CATEGORY_RE.test(candidate)) continue; if (candidate.length>=3 && candidate.length<=220 && /[A-Za-zА-Яа-яЁё]/.test(candidate)) { name = candidate; break; } } if (name) break; } if (name) add(name,price,'',null,'reader-visible-text','main'); }
  return products;
}

async function discoverSite(rawUrl, diagnostics, learningPatterns = []) {
  const start = normalizeUrl(rawUrl, rawUrl); const candidates = new Map();
  const add = (url, score, reason, anchor='') => { const normalized = normalizeUrl(url,start); if (!normalized || !sameHost(normalized,start) || isAsset(normalized)) return; const entry = candidates.get(normalized) || { url:normalized,score:0,reasons:[],anchor:'' }; entry.score=Math.max(entry.score,Number(score||0)); if (reason && !entry.reasons.includes(reason)) entry.reasons.push(reason); if (anchor && !entry.anchor) entry.anchor=anchor; candidates.set(normalized,entry); };
  add(start,1,'start'); for (const path of COMMON_MENU_PATHS) add(`${start}/${path}`,25,'common-menu-path');
  const root = await fetchText(start,8000); diagnostics.site_discovery.root_status=root.status; diagnostics.site_discovery.root_blocked=looksBlocked(root);
  if (root.ok) { diagnostics.site_discovery.identity=parseIdentity(root.text,root.url); for (const link of parseLinks(root.text,root.url)) add(link.url,link.score,'homepage-link',link.text); for (const url of parseSchemaMenuTargets(root.text,root.url)) add(url,80,'schema-menu-url'); }
  const robots = await fetchText(new URL('/robots.txt',start).href,5000); const sitemapUrls = new Set(); if (robots.ok) parseRobotsSitemaps(robots.text,start).forEach(url=>sitemapUrls.add(url)); sitemapUrls.add(new URL('/sitemap.xml',start).href); sitemapUrls.add(new URL('/sitemap_index.xml',start).href);
  diagnostics.site_discovery.sitemaps_checked=[]; diagnostics.site_discovery.sitemap_urls_found=[];
  for (const sitemapUrl of sitemapUrls) { const sitemap=await fetchText(sitemapUrl,6000); if (!sitemap.ok) continue; diagnostics.site_discovery.sitemaps_checked.push(sitemapUrl); const urls=parseSitemap(sitemap.text,sitemap.url); diagnostics.site_discovery.sitemap_urls_found.push(...urls); for (const url of urls) add(url,targetScore(url,'',{sitemap:true}),'sitemap'); }
  const learnedPaths=learningPatterns.filter(p=>p.pattern_type==='menu_link').map(p=>String(p.pattern_value?.path||'').toLowerCase()).filter(Boolean);
  for (const item of candidates.values()) { for (const hint of learnedPaths) { if (hint && `${pathOf(item.url)} ${item.anchor||''}`.toLowerCase().includes(hint)) { item.score += Math.round(Math.max(0.65,Number(learningPatterns.find(p=>p.pattern_value?.path===hint)?.confidence||0.65))*25); if (!item.reasons.includes('learned-menu-pattern')) item.reasons.push('learned-menu-pattern'); break; } } }
  diagnostics.site_discovery.candidate_count=candidates.size; return [...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,MAX_DISCOVERY_CANDIDATES);
}
function chooseReaderTargets(discovery, rawUrl) { const base=normalizeUrl(rawUrl,rawUrl); return [...new Set(discovery.filter(item=>sameHost(item.url,base)&&!isAsset(item.url)&&isMenuPage(item.url,[])&&pathDepth(item.url)<=2).sort((a,b)=>((pathDepth(a.url)<=1?1:0)-(pathDepth(b.url)<=1?1:0))||(b.score-a.score)).map(item=>item.url))].slice(0,MAX_READER_TARGETS); }
async function readerFallbackProducts(targets, diagnostics) {
  const products=[]; if (!targets.length) return products; let cursor=0;
  const worker=async()=>{ while(cursor<targets.length){ const index=cursor++; const url=targets[index]; const response=await fetchThroughReader(url); const blocked=looksBlocked(response); diagnostics.reader_pages=Array.isArray(diagnostics.reader_pages)?diagnostics.reader_pages:[]; const page={url,status:response.status,ok:response.ok,blocked,bytes:response.text.length}; if(response.ok&&!blocked){try{const parsed=readerProductsFromHtml(response.text,url); page.products=parsed.length; products.push(...parsed);}catch(error){page.parse_error=String(error?.message||error);}} diagnostics.reader_pages.push(page); } };
  await Promise.all(Array.from({length:Math.min(READER_CONCURRENCY,targets.length)},()=>worker())); return products;
}
async function analyzeVenueIdentity(rawUrl, discoveryIdentity=null) {
  const base=discoveryIdentity||{}; const direct=await fetchText(rawUrl,7000); let source=direct; if(!direct.ok||looksBlocked(direct)) source=await fetchThroughReader(rawUrl,12000); if(!source?.ok||looksBlocked(source)) return base; const html=source.text; const identity=parseIdentity(html,source.url||rawUrl); const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||null; const meta=name=>{const safe=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); const a=new RegExp(`<meta[^>]+(?:property|name)=["']${safe}["'][^>]+content=["']([^"']+)["'][^>]*>`,'i'); const b=new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${safe}["'][^>]*>`,'i'); return html.match(a)?.[1]||html.match(b)?.[1]||null;}; return { name:firstNonEmpty(identity.name,base.name,meta('og:site_name'),meta('application-name'),title?.replace(/\s*[|—-]\s*(меню|menu|доставка|официальный сайт).*$/iu,'')), description:firstNonEmpty(identity.description,base.description,meta('description'),meta('og:description')), address:firstNonEmpty(identity.address,base.address,meta('street-address')), phone:firstNonEmpty(identity.phone,base.phone,meta('telephone')), logo_url:identity.logo_url||base.logo_url||absoluteHttp(meta('og:image'),source.url||rawUrl), opening_hours:identity.opening_hours||base.opening_hours||null, cuisine:[...new Set([...(base.cuisine||[]),...(identity.cuisine||[])])], sources:[...new Set([...(base.sources||[]),...(identity.sources||[]),source===direct?'meta/title':'reader/meta-title'])]};
}
function learningAuth(req){ return String(req?.headers?.authorization || req?.headers?.Authorization || '').trim(); }
function learningEndpoint(){ return `${String(process.env.SUPABASE_URL || SUPABASE_URL_FALLBACK).replace(/\/$/,'')}/functions/v1/site-analyzer-learning`; }
async function learningGatewayRequest(req,action,payload){ const auth=learningAuth(req); if(!auth) return null; try{const response=await fetch(learningEndpoint(),{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})}); if(!response.ok)return null; const text=await response.text(); return text?JSON.parse(text):null;}catch(_){return null;} }
async function loadLearningPatterns(req,domain){ const result=await learningGatewayRequest(req,'load',{domain,min_confidence:LEARNING_MIN_CONFIDENCE,limit:LEARNING_MAX_PATTERNS}); if(!result?.ok||!Array.isArray(result.patterns)) return {enabled:Boolean(learningAuth(req)),patterns:[],reused:0}; return {enabled:true,patterns:result.patterns,reused:result.patterns.length}; }
function evaluateProduct(product){ const reasons=[]; if(product?.name)reasons.push('name'); if(Number(product?.price)>0)reasons.push('price'); if(product?.description)reasons.push('description'); if(product?.image_url)reasons.push('image'); if(product?.category&&product.category!=='main')reasons.push('category'); if(product?.extraction_source)reasons.push(`source:${product.extraction_source}`); const fields=reasons.filter(x=>!x.startsWith('source:')).length; const score=Math.min(100,25+fields*14+(product?.extraction_source?8:0)+(/reader/i.test(String(product?.extraction_source||''))?4:0)); return {confidence:score,level:score>=75?'high':score>=50?'medium':'low',reasons}; }
function evaluateProducts(products,diagnostics){const evaluated=(Array.isArray(products)?products:[]).map(product=>{const e=evaluateProduct(product);product.import_confidence=e.confidence;product.import_confidence_level=e.level;product.import_confidence_reasons=e.reasons;return e;});diagnostics.product_confidence={high:evaluated.filter(x=>x.level==='high').length,medium:evaluated.filter(x=>x.level==='medium').length,low:evaluated.filter(x=>x.level==='low').length};}
function learningPatternKey(type,value){return `${type}:${normalizeName(value)}`.slice(0,500);}
function buildLearningObservations(products,discovery,browserResult,readerProducts,domain,antiBotUsed){const observations=[];const add=(pattern_type,pattern_key,pattern_value,scope='global',success=true)=>{if(!SUPPORTED_PATTERN_TYPES.has(pattern_type)||!pattern_key)return;observations.push({pattern_type,pattern_key:String(pattern_key).slice(0,500),pattern_value:pattern_value||{},scope,domain:scope==='domain'?domain:null,success});};const sourceCounts=new Map();for(const product of Array.isArray(products)?products:[]){const source=String(product?.extraction_source||'generic').toLowerCase();sourceCounts.set(source,(sourceCounts.get(source)||0)+1);const e=evaluateProduct(product);add('card_structure',learningPatternKey('card_structure',source),{extraction_source:source,fields:e.reasons.filter(x=>!x.startsWith('source:'))},'global',e.confidence>=50);add('name_selector',learningPatternKey('name_selector',source),{extraction_source:source},'global',Boolean(product?.name));add('price_selector',learningPatternKey('price_selector',source),{extraction_source:source},'global',Number(product?.price)>0);add('description_selector',learningPatternKey('description_selector',source),{extraction_source:source},'global',Boolean(product?.description));add('image_selector',learningPatternKey('image_selector',source),{extraction_source:source},'global',Boolean(product?.image_url));if(product?.category&&product.category!=='main')add('category_selector',learningPatternKey('category_selector',source),{extraction_source:source},'global',true);}for(const item of Array.isArray(discovery)?discovery.slice(0,50):[]){if(!isMenuPage(item.url,[]))continue;const path=pathOf(item.url);add('menu_link',learningPatternKey('menu_link',path),{path,score:item.score,reasons:item.reasons||[]},'domain',true);}if(Array.isArray(browserResult?.diagnostics?.discovered_menu_links)){for(const url of browserResult.diagnostics.discovered_menu_links.slice(0,30)){const path=pathOf(url);if(path)add('menu_link',learningPatternKey('menu_link',path),{path,discovered_by:'browser'},'domain',true);}}if(antiBotUsed)add('platform_signature',learningPatternKey('platform_signature','jina-reader'),{bypass:'reader',reason:'anti-bot-or-challenge'},'global',Boolean(readerProducts.length));if(!products.length&&antiBotUsed)add('rejection_signal',learningPatternKey('rejection_signal','reader-no-products'),{reason:'reader_no_products',domain},'domain',false);for(const [source,count]of sourceCounts.entries())if(count>=2)add('platform_signature',learningPatternKey('platform_signature',source),{extraction_source:source,observed_products:count},'global',true);return observations.slice(0,LEARNING_MAX_WRITES);}
async function persistLearning(req,observations,run,diagnostics){if(!learningAuth(req)){diagnostics.learning={enabled:false,patterns_discovered:observations.length,patterns_written:0,patterns_reused:Number(diagnostics.learning?.patterns_reused||0),run_recorded:false,reason:'authorization_header_missing'};return;}const response=await learningGatewayRequest(req,'learn',{observations,run});diagnostics.learning={enabled:true,patterns_discovered:observations.length,patterns_written:Number(response?.written||0),patterns_reused:Number(diagnostics.learning?.patterns_reused||0),run_recorded:Boolean(response?.run_recorded)};}

module.exports=async function(req,res){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Content-Type','application/json; charset=utf-8');const fail=(status,code,message,details={})=>res.status(status).json({ok:false,error:{code,message,details}});if(req.method!=='GET'&&req.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED','Метод не поддерживается');const raw=String((req.query&&req.query.url)||(req.body&&req.body.url)||'').trim();if(!raw)return fail(400,'URL_REQUIRED','Не передан адрес сайта');try{const domain=getDomain(raw);const learning=await loadLearningPatterns(req,domain);const discoveryDiagnostics={site_discovery:{candidates:[],identity:null,homepage_links:0,schema_menu_targets:[],sitemaps_checked:[],sitemap_urls_found:[]}};const discovery=await discoverSite(raw,discoveryDiagnostics,learning.patterns);discoveryDiagnostics.site_discovery.candidates=discovery;const [result,identity]=await Promise.all([withTimeout(analyzeSite(raw),ANALYSIS_BUDGET_MS),analyzeVenueIdentity(raw,discoveryDiagnostics.site_discovery.identity)]);const meta=result.meta||(result.meta={});const diagnostics=meta.diagnostics||(meta.diagnostics={});diagnostics.site_discovery=discoveryDiagnostics.site_discovery;diagnostics.learning={enabled:learning.enabled,patterns_loaded:learning.patterns.length,patterns_reused:learning.reused};diagnostics.analysis_steps=Array.isArray(diagnostics.analysis_steps)?diagnostics.analysis_steps:[];diagnostics.analysis_steps.push(`Site reconnaissance: ${discovery.length} кандидатов страниц`);diagnostics.analysis_steps.push(`Learning Engine: загружено ${learning.patterns.length} устойчивых паттернов`);diagnostics.analysis_steps.push(`Sitemap: найдено ${discoveryDiagnostics.site_discovery.sitemap_urls_found.length} URL`);const jsPages=Array.isArray(diagnostics.js_render?.pages)?diagnostics.js_render.pages.map(x=>x.url):[];const menuPages=Array.isArray(diagnostics.menu_pages)?diagnostics.menu_pages:[];const discoveredTargets=discovery.map(item=>item.url);const highValueTargets=discovery.filter(item=>item.score>=20).map(item=>item.url);const renderTargets=[...new Set([...highValueTargets,...menuPages,...jsPages,...discoveredTargets])].filter(url=>sameHost(url,raw)).slice(0,MAX_RENDER_TARGETS);diagnostics.analysis_steps.push(`Adaptive browser crawl: ${renderTargets.length} приоритетных URL`);let browserResult={ok:false,code:'NOT_RUN',products:[],diagnostics:{}};try{browserResult=await renderMenuPages(renderTargets);}catch(error){browserResult={ok:false,code:'BROWSER_DEPENDENCY_FAILED',products:[],diagnostics:{error_name:error?.name||'Error',error_message:String(error?.message||error)}};}diagnostics.browser_render=browserResult.diagnostics||{};diagnostics.browser_render_code=browserResult.code||null;diagnostics.browser_products_found=Array.isArray(browserResult.products)?browserResult.products.length:0;diagnostics.analysis_steps.push(`Adaptive browser crawl: ${browserResult.code||'UNKNOWN'}; найдено ${diagnostics.browser_products_found} позиций`);
const browserBlocked=Array.isArray(diagnostics.browser_render?.pages)&&diagnostics.browser_render.pages.some(page=>/вы не робот|не робот|captcha|cloudflare|checking your browser|verify you are human|access denied/i.test(String(page?.title||'')+String(page?.error||'')));const antiBotDetected=Boolean(discoveryDiagnostics.site_discovery.root_blocked||browserBlocked||browserResult.code==='BROWSER_ANTIBOT_BLOCKED');const readerTargets=chooseReaderTargets(discovery,raw);diagnostics.reader_fallback={considered:antiBotDetected,targets:readerTargets.length,used:false,products_found:0};let readerProducts=[];if(antiBotDetected&&readerTargets.length){readerProducts=await readerFallbackProducts(readerTargets,diagnostics);diagnostics.reader_fallback.used=true;diagnostics.reader_fallback.products_found=readerProducts.length;diagnostics.analysis_steps.push(`Anti-bot Reader fallback: ${readerTargets.length} страниц; найдено ${readerProducts.length} позиций`);}result.products=mergeProducts(result.products,browserResult.products);result.products=mergeProducts(result.products,readerProducts);diagnostics.products_found=result.products.length;diagnostics.venue_identity=identity;diagnostics.product_sources=[...new Set(result.products.map(x=>x?.extraction_source).filter(Boolean))];diagnostics.discovery_strategy='entity-catalog-multisource-v42-antibot-learning';evaluateProducts(result.products,diagnostics);const confidence=Math.min(100,Math.round((result.products.length?35:0)+(result.products.some(x=>x.price>0)?20:0)+(result.products.some(x=>x.description)?15:0)+(result.products.some(x=>x.image_url)?15:0)+(discoveryDiagnostics.site_discovery.sitemap_urls_found.length?5:0)+(diagnostics.reader_fallback.used?10:0)));diagnostics.confidence=confidence;diagnostics.confidence_reasons=[result.products.length?`найдено ${result.products.length} структурированных позиций`:'позиции не найдены',result.products.some(x=>x.price>0)?'есть ценовые доказательства':null,result.products.some(x=>x.description)?'есть описания':null,result.products.some(x=>x.image_url)?'есть изображения':null,discoveryDiagnostics.site_discovery.sitemap_urls_found.length?'использован sitemap':null,diagnostics.reader_fallback.used?'использован anti-bot Reader fallback':null].filter(Boolean);const observations=buildLearningObservations(result.products,discovery,browserResult,readerProducts,domain,diagnostics.reader_fallback.used);await persistLearning(req,observations,{domain,source_url:raw,products_high:diagnostics.product_confidence?.high||0,products_medium:diagnostics.product_confidence?.medium||0,products_low:diagnostics.product_confidence?.low||0,patterns_discovered:observations.length,patterns_reused:learning.reused,diagnostics:{confidence,product_sources:diagnostics.product_sources,browser_code:browserResult.code||null,reader_products:readerProducts.length,candidate_count:discovery.length,anti_bot_fallback:diagnostics.reader_fallback.used}},diagnostics);meta.diagnostics=diagnostics;meta.menu_found=result.products.length>0;meta.validation=result.products.length?'validated-multisource-catalog':'not_validated';meta.error=result.products.length?null:(meta.error||null);const sourceVenue=result.venue||{};const venue={name:firstNonEmpty(identity.name,sourceVenue.name,meta.name,meta.venue_name,meta.title),description:firstNonEmpty(identity.description,sourceVenue.description),address:firstNonEmpty(identity.address,sourceVenue.address,meta.address,meta.venue_address),phone:firstNonEmpty(identity.phone,sourceVenue.phone),website_url:sourceVenue.website_url||raw,logo_url:identity.logo_url||sourceVenue.logo_url||null,opening_hours:identity.opening_hours||sourceVenue.opening_hours||null,cuisine:identity.cuisine||[]};return res.status(200).json({ok:true,venue,products:result.products,meta:{menu_found:Boolean(meta.menu_found),products_found:result.products.length,validation:meta.validation,confidence,confidence_reasons:diagnostics.confidence_reasons||[],diagnostics,source_url:raw}});}catch(error){if(error?.code==='IMPORT_ANALYSIS_TIMEOUT')return fail(504,'IMPORT_ANALYSIS_TIMEOUT','Импорт сайта превысил допустимое время анализа. Попробуйте повторить анализ.',{budget_ms:ANALYSIS_BUDGET_MS});return fail(500,'IMPORT_RUNTIME_ERROR','Ошибка универсального анализатора сайта',{name:error?.name||'Error',message:String(error?.message||error),stack:String(error?.stack||'').split('\n').slice(0,10)});}};
function withTimeout(promise,ms){let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error('IMPORT_ANALYSIS_TIMEOUT');error.code='IMPORT_ANALYSIS_TIMEOUT';reject(error);},ms);});return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));}
