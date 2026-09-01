'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const MAX_PAGES = 16;
const NAV_TIMEOUT = 9000;
const SETTLE_MS = 1200;
const BROWSER_TOTAL_BUDGET = 40000;

function clean(v, max = 600) { return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeUrl(v) { try { return new URL(v).href; } catch { return null; } }
function absoluteUrl(v, base) { try { return new URL(String(v || ''), base).href; } catch { return null; } }
function sameHost(a, b) { try { return new URL(a).hostname.replace(/^www\./, '').toLowerCase() === new URL(b).hostname.replace(/^www\./, '').toLowerCase(); } catch { return false; } }
function menuScore(url, text = '') {
  const s = `${url} ${text}`.toLowerCase();
  let score = 0;
  if (/(menu|menyu|меню|catalog|каталог|food|dishes|блюд|price|prices|pizza|пицц|sushi|суш|roll|ролл|dessert|десерт|drink|напит|breakfast|завтрак|bar|бар|grill|гриль|шашлык|zakus|закуск|salat|салат|soup|суп|pasta|паста|garnir|гарнир|steak|стейк|osnov|основн|det|детск|sauce|соус)/iu.test(s)) score += 10;
  if (/(menu|catalog|food|dish|product|category|item|section|restaurant|delivery)/i.test(s)) score += 3;
  return score;
}

async function renderMenuPages(urls) {
  const startedAt = Date.now();
  const initialTargets = [...new Set((urls || []).map(normalizeUrl).filter(Boolean))];
  if (!initialTargets.length) return { ok: false, code: 'NO_RENDER_TARGETS', products: [], diagnostics: {} };

  const diagnostics = {
    engine: 'puppeteer-core + @sparticuz/chromium',
    pages_attempted: 0,
    pages_rendered: 0,
    pages_failed: [],
    rendered_html_bytes: 0,
    network_json_responses: 0,
    price_nodes: 0,
    image_nodes: 0,
    products_found: 0,
    discovered_menu_links: [],
    pages: []
  };

  let browser = null;
  try {
    chromium.setGraphicsMode = false;
    const executablePath = await chromium.executablePath();
    if (!executablePath) throw new Error('Chromium executablePath() вернул пустой путь');
    const args = [...(Array.isArray(chromium.args) ? chromium.args : []), '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'];
    browser = await puppeteer.launch({ args, executablePath, headless: true, ignoreHTTPSErrors: true, defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 } });

    const products = [];
    const seenProducts = new Set();
    const seenPages = new Set();
    const queue = initialTargets.map((url, index) => ({ url, score: 100 - index }));
    const rootUrl = initialTargets[0];

    const enqueue = (url, score = 0) => {
      const normalized = normalizeUrl(url);
      if (!normalized || !sameHost(normalized, rootUrl) || seenPages.has(normalized)) return;
      if (queue.some(x => x.url === normalized)) return;
      queue.push({ url: normalized, score });
      queue.sort((a, b) => b.score - a.score);
      if (queue.length > 40) queue.length = 40;
    };

    for (let pageIndex = 0; queue.length && pageIndex < MAX_PAGES; pageIndex++) {
      if (Date.now() - startedAt > BROWSER_TOTAL_BUDGET) {
        diagnostics.pages_failed.push({ url: queue[0]?.url || null, code: 'BROWSER_BUDGET_EXCEEDED' });
        break;
      }

      queue.sort((a, b) => b.score - a.score);
      const target = queue.shift();
      if (!target || seenPages.has(target.url)) { pageIndex--; continue; }
      seenPages.add(target.url);
      diagnostics.pages_attempted++;

      let page = null;
      try {
        page = await browser.newPage();
        page.setDefaultNavigationTimeout(NAV_TIMEOUT);
        page.setDefaultTimeout(6000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/147 Safari/537.36 QR-Menu-Importer/6.0');

        const jsonResponses = [];
        const responseHandler = response => {
          try {
            const type = String(response.headers()['content-type'] || '').toLowerCase();
            const requestUrl = response.url();
            if (!/^https?:/i.test(requestUrl)) return;
            if (!type.includes('json') && !/\/api\/|graphql|menu|catalog|product|dish|food|category/i.test(requestUrl)) return;
            const len = Number(response.headers()['content-length'] || 0);
            if (len && len > 1024 * 1024) return;
            jsonResponses.push(response);
            if (type.includes('json')) diagnostics.network_json_responses++;
          } catch (_) {}
        };
        page.on('response', responseHandler);

        try {
          await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        } catch (error) {
          if (!/timeout/i.test(String(error?.message || error))) throw error;
        }

        await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
        await page.evaluate(async () => {
          const step = Math.max(500, Math.floor(window.innerHeight * 0.85));
          for (let i = 0; i < 18; i++) {
            window.scrollBy(0, step);
            await new Promise(r => setTimeout(r, 130));
          }
          window.scrollTo(0, 0);
        }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 450));

        const data = await page.evaluate((baseUrl) => {
          const text = el => (el?.innerText || el?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          const priceRe = /(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu;
          const numericPriceRe = /(?:^|[\s:])((?:\d{2,3}|\d{1,3}[ .]\d{3}))(?:[.,]\d{1,2})?\s*(?=$|[\s₽р])/iu;
          const weightRe = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
          const noiseRe = /^(главная|меню|каталог|о нас|доставка|акции|новости|контакты|заказать|корзина|купить|добавить|подробнее|войти|регистрация|цены|колл-центр|самовывоз|доставка|выбрать|открыть)$/iu;
          const foodClassRe = /(menu|dish|product|food|meal|card|item|catalog|pizza|sushi|roll|dessert|burger|drink|coffee|restaurant|goods|position|category|section|price|cost)/i;
          const badImageRe = /(logo|favicon|sprite|icon|avatar|qr-code|payment|social|instagram|telegram|facebook|youtube|vk\.com)/i;
          const result = [];
          const seen = new Set();

          const imageFrom = root => {
            const nodes = [...root.querySelectorAll('img, source')];
            for (const img of nodes) {
              const values = [img.currentSrc, img.getAttribute('src'), img.getAttribute('data-src'), img.getAttribute('data-lazy-src'), img.getAttribute('data-original'), img.getAttribute('data-image'), img.getAttribute('data-url'), img.getAttribute('data-filename'), img.getAttribute('srcset')?.split(',')?.pop()?.trim()?.split(/\s+/)[0], img.getAttribute('data-srcset')?.split(',')?.pop()?.trim()?.split(/\s+/)[0]];
              for (const value of values) {
                if (!value) continue;
                try { const url = new URL(value, baseUrl).href; if (/^https?:/i.test(url) && !badImageRe.test(url)) return url; } catch (_) {}
              }
            }
            const styled = [...root.querySelectorAll('[style*="background-image" i]')];
            for (const node of styled) {
              const match = String(node.getAttribute('style') || '').match(/url\(["']?([^"')]+)["']?\)/i);
              if (!match || badImageRe.test(match[1])) continue;
              try { const url = new URL(match[1], baseUrl).href; if (/^https?:/i.test(url)) return url; } catch (_) {}
            }
            return null;
          };

          const candidateName = root => {
            const explicit = [...root.querySelectorAll('[itemprop="name"],[class*="name" i],[class*="title" i],h1,h2,h3,h4,h5,h6,[data-name],[data-title]')].map(text).find(x => x && x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x));
            if (explicit) return explicit;
            const parts = (root.innerText || '').split(/\n+/).map(x => x.trim()).filter(x => x && x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x) && !/^\d+[\s₽р]/.test(x));
            return parts[0] || '';
          };

          const candidateDescription = root => {
            const nodes = [...root.querySelectorAll('[itemprop="description"],[class*="description" i],[class*="desc" i],[class*="subtitle" i],p,[data-description]')];
            return nodes.map(text).find(x => x && x.length >= 8 && x.length <= 600 && !priceRe.test(x)) || '';
          };

          const candidatePrice = root => {
            const el = root.querySelector('[itemprop="price"],meta[itemprop="price"],[data-price],[data-cost],[data-value],[data-amount],[class*="price" i],[class*="cost" i],[class*="amount" i]');
            if (el) {
              const raw = el.getAttribute('content') || el.getAttribute('data-price') || el.getAttribute('data-cost') || el.getAttribute('data-value') || el.getAttribute('data-amount') || text(el);
              const m = String(raw).match(/\d[\d\s.,]*/);
              if (m) { const n = Number(m[0].replace(/\s/g, '').replace(',', '.')); if (n > 0 && n < 1000000) return n; }
            }
            const t = text(root);
            const m = t.match(priceRe) || t.match(numericPriceRe);
            if (!m) return 0;
            const n = Number((m[1] || '').replace(/[ .]/g, '').replace(',', '.'));
            return n > 0 && n < 1000000 ? n : 0;
          };

          const add = (root, source = 'rendered-dom') => {
            const name = candidateName(root);
            const price = candidatePrice(root);
            if (!name || name.length < 3 || name.length > 220 || noiseRe.test(name) || weightRe.test(name) || !price) return;
            const image = imageFrom(root);
            const key = name.toLowerCase().replace(/\s+/g, ' ');
            if (seen.has(key)) return;
            seen.add(key);
            result.push({ name, price, description: candidateDescription(root), image_url: image, source, image_confirmed: Boolean(image) });
          };

          const imageNodes = [...document.querySelectorAll('img,source')];
          for (const image of imageNodes) {
            let root = image;
            let best = null;
            for (let i = 0; i < 9 && root.parentElement; i++, root = root.parentElement) {
              const rt = text(root);
              const cls = `${root.className || ''} ${root.id || ''}`;
              if (rt.length >= 20 && rt.length <= 2600 && (foodClassRe.test(cls) || root.matches('article,li'))) { best = root; break; }
              if (rt.length >= 20 && rt.length <= 2000) best = best || root;
            }
            if (best) add(best, 'rendered-image-card');
          }

          for (const el of [...document.querySelectorAll('[itemprop="price"],[data-price],[data-cost],[data-value],[data-amount],[class*="price" i],[class*="cost" i],[class*="amount" i]')]) {
            let root = el;
            for (let i = 0; i < 8 && root.parentElement; i++, root = root.parentElement) {
              const rt = text(root);
              if (rt.length >= 20 && rt.length <= 2600) add(root, 'rendered-price-card');
              if (root.matches('article,li')) break;
            }
          }

          for (const root of [...document.querySelectorAll('article,li,[class*="menu-item" i],[class*="dish" i],[class*="product" i],[class*="food-card" i],[class*="card" i],[class*="item" i],[data-product],[data-dish],[data-menu-item]')].slice(0, 5000)) add(root, 'rendered-menu-card');

          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const priceTextNodes = [];
          while (walker.nextNode()) { const value = String(walker.currentNode.nodeValue || '').trim(); if (priceRe.test(value)) priceTextNodes.push(walker.currentNode); }
          for (const node of priceTextNodes.slice(0, 1200)) {
            let root = node.parentElement;
            for (let i = 0; i < 7 && root; i++, root = root.parentElement) { const rt = text(root); if (rt.length >= 20 && rt.length <= 1800) { add(root, 'rendered-price-text-context'); if (root.matches('article,li')) break; } }
          }

          const links = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: text(a), score: 0 })).filter(x => /^https?:/i.test(x.href) && x.href.split('#')[0] !== baseUrl.split('#')[0]);
          for (const link of links) link.score = /(?:menu|catalog|food|dish|product|category|section|zakus|salat|soup|sup|pasta|pizza|sushi|dessert|drink|breakfast|bar|grill|steak|garnir|blud|блюд|меню|каталог|закуск|салат|суп|паста|десерт|напит|завтрак|бар|гриль|стейк|гарнир)/iu.test(`${link.href} ${link.text}`) ? 20 : 0;
          const visible = text(document.body);
          const menuWords = (visible.match(/\b(меню|каталог|закуски|салаты|супы|горячие|паста|пицца|десерты|напитки|завтраки|соусы|блюда|menu|catalog|dessert|drinks|breakfast)\b/giu) || []).length;
          return { title: document.title, htmlBytes: document.documentElement.outerHTML.length, textChars: visible.length, products: result, priceNodes: document.querySelectorAll('[itemprop="price"],[data-price],[data-cost],[data-value],[data-amount],[class*="price" i],[class*="cost" i],[class*="amount" i]').length, imageNodes: imageNodes.length, links: links.sort((a,b) => b.score-a.score).slice(0, 80), menuWords };
        }, target.url);

        const jsonProducts = [];
        const jsonSeen = new Set();
        const walkJson = value => {
          if (!value) return;
          if (Array.isArray(value)) return value.forEach(walkJson);
          if (typeof value !== 'object') return;
          const type = String(value['@type'] || '').toLowerCase();
          const name = value.name || value.title || value.productName || value.dishName || value.itemName;
          const image = typeof value.image === 'string' ? value.image : (typeof value.image_url === 'string' ? value.image_url : (Array.isArray(value.image) && typeof value.image[0] === 'string' ? value.image[0] : null));
          const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers;
          const rawPrice = value.price ?? value.cost ?? value.amount ?? value.priceValue ?? offer?.price ?? value.value;
          const price = Number(String(rawPrice ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
          const isMenuObject = type.includes('menuitem') || type === 'product' || type.includes('menu') || value.offers || value.hasMenuItem;
          if (isMenuObject && name && price > 0 && price < 1000000) {
            const key = clean(name, 220).toLowerCase();
            if (!jsonSeen.has(key)) { jsonSeen.add(key); jsonProducts.push({ name: clean(name, 220), price, description: clean(value.description, 600), image_url: image ? absoluteUrl(image, target.url) : null, source: 'structured-data', image_confirmed: Boolean(image) }); }
          }
          Object.values(value).forEach(walkJson);
        };
        for (const response of jsonResponses.slice(0, 40)) {
          try { const body = await response.text(); if (body && body.length <= 1024 * 1024) walkJson(JSON.parse(body)); } catch (_) {}
        }

        diagnostics.pages_rendered++;
        diagnostics.rendered_html_bytes += Number(data.htmlBytes || 0);
        diagnostics.price_nodes += Number(data.priceNodes || 0);
        diagnostics.image_nodes += Number(data.imageNodes || 0);

        for (const item of [...data.products, ...jsonProducts]) {
          const key = clean(item.name, 220).toLowerCase();
          if (!key || seenProducts.has(key)) continue;
          // Text-only fallback products are allowed here; the importer can enrich them later.
          seenProducts.add(key);
          products.push({ ...item, source_url: target.url });
        }

        const discovered = [];
        for (const link of data.links || []) {
          const score = menuScore(link.href, link.text) + Number(link.score || 0);
          if (score >= 10) {
            const u = normalizeUrl(link.href);
            if (u && sameHost(u, rootUrl) && !seenPages.has(u)) { enqueue(u, score); discovered.push({ url: u, text: clean(link.text, 120), score }); }
          }
        }
        for (const item of discovered) if (diagnostics.discovered_menu_links.length < 100) diagnostics.discovered_menu_links.push(item);

        diagnostics.pages.push({ url: target.url, title: clean(data.title, 180), price_nodes: data.priceNodes, image_nodes: data.imageNodes, dom_products: data.products.length, network_products: jsonProducts.length, json_responses: jsonResponses.length, rendered_text_chars: data.textChars, menu_words: data.menuWords, discovered_links: discovered.length });
      } catch (error) {
        diagnostics.pages_failed.push({ url: target.url, code: error?.name === 'TimeoutError' ? 'BROWSER_TIMEOUT' : 'BROWSER_PAGE_FAILED', message: String(error?.message || error).slice(0, 400) });
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }

    diagnostics.products_found = products.length;
    return { ok: true, code: products.length ? 'BROWSER_MENU_FOUND' : 'BROWSER_MENU_NOT_FOUND', products, diagnostics };
  } catch (error) {
    return { ok: false, code: 'BROWSER_ENGINE_FAILED', message: String(error?.message || error), products: [], diagnostics: { ...diagnostics, engine_error_name: error?.name || 'Error', engine_error_message: String(error?.message || error) } };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { renderMenuPages };