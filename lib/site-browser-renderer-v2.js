'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const MAX_PAGES = 12;
const NAV_TIMEOUT = 9000;
const SETTLE_MS = 1200;
const BROWSER_TOTAL_BUDGET = 40000;

function clean(v, max = 600) { return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeUrl(v) { try { return new URL(v).href; } catch { return null; } }
function absoluteUrl(v, base) { try { return new URL(String(v || ''), base).href; } catch { return null; } }

async function renderMenuPages(urls) {
  const startedAt = Date.now();
  const targets = [...new Set((urls || []).map(normalizeUrl).filter(Boolean))].slice(0, MAX_PAGES);
  if (!targets.length) return { ok: false, code: 'NO_RENDER_TARGETS', products: [], diagnostics: {} };

  const diagnostics = {
    engine: 'puppeteer-core + @sparticuz/chromium',
    pages_attempted: targets.length,
    pages_rendered: 0,
    pages_failed: [],
    rendered_html_bytes: 0,
    network_json_responses: 0,
    price_nodes: 0,
    image_nodes: 0,
    products_found: 0,
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
    const seen = new Set();

    for (const url of targets) {
      if (Date.now() - startedAt > BROWSER_TOTAL_BUDGET) {
        diagnostics.pages_failed.push({ url, code: 'BROWSER_BUDGET_EXCEEDED' });
        break;
      }

      let page = null;
      try {
        page = await browser.newPage();
        page.setDefaultNavigationTimeout(NAV_TIMEOUT);
        page.setDefaultTimeout(6000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/147 Safari/537.36 QR-Menu-Importer/5.0');

        const jsonResponses = [];
        const responseHandler = response => {
          try {
            const type = String(response.headers()['content-type'] || '').toLowerCase();
            const requestUrl = response.url();
            if (!type.includes('json') || !/^https?:/i.test(requestUrl)) return;
            const len = Number(response.headers()['content-length'] || 0);
            if (len && len > 1024 * 1024) return;
            if (!/api|menu|catalog|product|dish|food|item|graphql|order|category/i.test(requestUrl)) return;
            jsonResponses.push(response);
            diagnostics.network_json_responses++;
          } catch (_) {}
        };
        page.on('response', responseHandler);

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        } catch (error) {
          if (!/timeout/i.test(String(error?.message || error))) throw error;
        }

        await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
        await page.evaluate(async () => {
          const step = Math.max(500, Math.floor(window.innerHeight * 0.85));
          for (let i = 0; i < 14; i++) {
            window.scrollBy(0, step);
            await new Promise(r => setTimeout(r, 140));
          }
          window.scrollTo(0, 0);
        }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 350));

        const data = await page.evaluate((baseUrl) => {
          const text = el => (el?.innerText || el?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          const priceRe = /(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu;
          const loosePriceRe = /(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{2,6})(?:[.,]\d{1,2})?\s*(?:₽|руб|руб\.|р\.|RUB)?(?=$|\s|[.,;:!?])/iu;
          const weightRe = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
          const noiseRe = /^(главная|меню|каталог|о нас|доставка|акции|новости|контакты|заказать|корзина|купить|добавить|подробнее|войти|регистрация|цены|колл-центр|самовывоз|доставка)$/iu;
          const foodClassRe = /(menu|dish|product|food|meal|card|item|catalog|pizza|sushi|roll|dessert|burger|drink|coffee|restaurant|goods|position|category)/i;
          const badImageRe = /(logo|favicon|sprite|icon|avatar|qr-code|payment|social|instagram|telegram|facebook)/i;
          const result = [];
          const seen = new Set();

          const imageFrom = root => {
            const nodes = [...root.querySelectorAll('img, source')];
            for (const img of nodes) {
              const values = [
                img.currentSrc,
                img.getAttribute('src'),
                img.getAttribute('data-src'),
                img.getAttribute('data-lazy-src'),
                img.getAttribute('data-original'),
                img.getAttribute('data-image'),
                img.getAttribute('data-url'),
                img.getAttribute('data-filename'),
                img.getAttribute('srcset')?.split(',')?.pop()?.trim()?.split(/\s+/)[0],
                img.getAttribute('data-srcset')?.split(',')?.pop()?.trim()?.split(/\s+/)[0]
              ];
              for (const value of values) {
                if (!value) continue;
                try {
                  const url = new URL(value, baseUrl).href;
                  if (/^https?:/i.test(url) && !badImageRe.test(url)) return url;
                } catch (_) {}
              }
            }
            const styled = [...root.querySelectorAll('[style*="background-image" i]')];
            for (const node of styled) {
              const match = String(node.getAttribute('style') || '').match(/url\(["']?([^"')]+)["']?\)/i);
              if (!match || badImageRe.test(match[1])) continue;
              try {
                const url = new URL(match[1], baseUrl).href;
                if (/^https?:/i.test(url)) return url;
              } catch (_) {}
            }
            return null;
          };

          const candidateName = root => {
            const explicit = [...root.querySelectorAll('[itemprop="name"],[class*="name" i],[class*="title" i],h1,h2,h3,h4,h5,h6')]
              .map(text)
              .find(x => x && x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x));
            if (explicit) return explicit;
            const parts = (root.innerText || '').split(/\n+/).map(x => x.trim()).filter(x => x && x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x));
            return parts[0] || '';
          };

          const candidateDescription = root => {
            const nodes = [...root.querySelectorAll('[itemprop="description"],[class*="description" i],[class*="desc" i],[class*="subtitle" i],p')];
            const value = nodes.map(text).find(x => x && x.length >= 8 && x.length <= 600 && !priceRe.test(x));
            return value || '';
          };

          const candidatePrice = root => {
            const el = root.querySelector('[itemprop="price"],meta[itemprop="price"],[data-price],[data-cost],[data-value],[class*="price" i],[class*="cost" i]');
            if (el) {
              const raw = el.getAttribute('content') || el.getAttribute('data-price') || el.getAttribute('data-cost') || el.getAttribute('data-value') || text(el);
              const m = String(raw).match(/\d[\d\s.,]*/);
              if (m) {
                const n = Number(m[0].replace(/\s/g, '').replace(',', '.'));
                if (n > 0 && n < 1000000) return n;
              }
            }
            const m = text(root).match(priceRe);
            if (!m) return 0;
            const n = Number((m[1] || '').replace(/[ .]/g, '').replace(',', '.'));
            return n > 0 && n < 1000000 ? n : 0;
          };

          const add = (root, source = 'rendered-dom') => {
            const image = imageFrom(root);
            if (!image) return;
            const name = candidateName(root);
            if (!name || name.length < 3 || name.length > 220 || noiseRe.test(name) || weightRe.test(name)) return;
            const price = candidatePrice(root);
            if (!price) return;
            const description = candidateDescription(root);
            const key = name.toLowerCase().replace(/\s+/g, ' ');
            if (seen.has(key)) return;
            seen.add(key);
            result.push({ name, price, description, image_url: image, source, image_confirmed: true });
          };

          const imageNodes = [...document.querySelectorAll('img,source')];
          for (const image of imageNodes) {
            let root = image;
            let best = null;
            for (let i = 0; i < 8 && root.parentElement; i++, root = root.parentElement) {
              const rt = text(root);
              const cls = `${root.className || ''} ${root.id || ''}`;
              if (rt.length >= 20 && rt.length <= 2600 && (foodClassRe.test(cls) || root.matches('article,li'))) { best = root; break; }
              if (rt.length >= 20 && rt.length <= 2000) best = best || root;
            }
            if (best) add(best, 'rendered-image-card');
          }

          for (const el of [...document.querySelectorAll('[itemprop="price"],[data-price],[data-cost],[data-value],[class*="price" i],[class*="cost" i]')]) {
            let root = el;
            for (let i = 0; i < 7 && root.parentElement; i++, root = root.parentElement) {
              const rt = text(root);
              if (rt.length >= 20 && rt.length <= 2600) add(root, 'rendered-price-card');
              if (root.matches('article,li')) break;
            }
          }

          for (const root of [...document.querySelectorAll('article,li,[class*="menu-item" i],[class*="dish" i],[class*="product" i],[class*="food-card" i],[class*="card" i],[class*="item" i]')].slice(0, 4000)) {
            add(root, 'rendered-menu-card');
          }

          // Last resort: inspect compact DOM blocks around visible price text.
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const priceTextNodes = [];
          while (walker.nextNode()) {
            const value = String(walker.currentNode.nodeValue || '').trim();
            if (priceRe.test(value)) priceTextNodes.push(walker.currentNode);
          }
          for (const node of priceTextNodes.slice(0, 1000)) {
            let root = node.parentElement;
            for (let i = 0; i < 6 && root; i++, root = root.parentElement) {
              const rt = text(root);
              if (rt.length >= 20 && rt.length <= 1800) { add(root, 'rendered-price-text-context'); if (root.matches('article,li')) break; }
            }
          }

          return { title: document.title, htmlBytes: document.documentElement.outerHTML.length, textChars: text(document.body).length, products: result, priceNodes: [...document.querySelectorAll('[itemprop="price"],[data-price],[data-cost],[data-value],[class*="price" i],[class*="cost" i]')].length, imageNodes: imageNodes.length };
        }, url);

        const jsonProducts = [];
        const jsonSeen = new Set();
        const walkJson = value => {
          if (!value) return;
          if (Array.isArray(value)) return value.forEach(walkJson);
          if (typeof value !== 'object') return;
          const name = value.name || value.title || value.productName || value.dishName || value.itemName;
          const image = typeof value.image === 'string' ? value.image : (typeof value.image_url === 'string' ? value.image_url : (Array.isArray(value.image) && typeof value.image[0] === 'string' ? value.image[0] : null));
          if (name && image) {
            const key = clean(name, 220).toLowerCase();
            if (!jsonSeen.has(key)) {
              jsonSeen.add(key);
              const rawPrice = value.price ?? value.cost ?? value.amount ?? value.priceValue ?? value.offers?.price ?? value.value;
              const price = Number(String(rawPrice ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
              if (price > 0 && price < 1000000) jsonProducts.push({ name: clean(name, 220), price, description: clean(value.description, 600), image_url: absoluteUrl(image, url), source: 'network-json', image_confirmed: true });
            }
          }
          Object.values(value).forEach(walkJson);
        };
        for (const response of jsonResponses.slice(0, 30)) {
          try {
            const body = await response.text();
            if (body && body.length <= 1024 * 1024) walkJson(JSON.parse(body));
          } catch (_) {}
        }

        diagnostics.pages_rendered++;
        diagnostics.rendered_html_bytes += Number(data.htmlBytes || 0);
        diagnostics.price_nodes += Number(data.priceNodes || 0);
        diagnostics.image_nodes += Number(data.imageNodes || 0);

        for (const item of [...data.products, ...jsonProducts]) {
          const key = clean(item.name, 220).toLowerCase();
          if (!key || !item.image_url || seen.has(key)) continue;
          seen.add(key);
          products.push({ ...item, source_url: url });
        }

        diagnostics.pages.push({ url, title: clean(data.title, 180), price_nodes: data.priceNodes, image_nodes: data.imageNodes, dom_products: data.products.length, network_products: jsonProducts.length, json_responses: jsonResponses.length, rendered_text_chars: data.textChars });
      } catch (error) {
        diagnostics.pages_failed.push({ url, code: error?.name === 'TimeoutError' ? 'BROWSER_TIMEOUT' : 'BROWSER_PAGE_FAILED', message: String(error?.message || error).slice(0, 400) });
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
