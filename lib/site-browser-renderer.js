'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const MAX_PAGES = 8;
const NAV_TIMEOUT = 22000;
const SETTLE_MS = 1800;

function clean(v, max = 500) {
  return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeUrl(value) {
  try { return new URL(value).href; } catch { return null; }
}

async function renderMenuPages(urls) {
  const targets = [...new Set((urls || []).map(normalizeUrl).filter(Boolean))].slice(0, MAX_PAGES);
  if (!targets.length) return { ok: false, code: 'NO_RENDER_TARGETS', message: 'Не найдено страниц для браузерного анализа.', pages: [], products: [], diagnostics: {} };

  let browser;
  const diagnostics = {
    engine: 'puppeteer-core + @sparticuz/chromium',
    pages_attempted: targets.length,
    pages_rendered: 0,
    pages_failed: [],
    rendered_html_bytes: 0,
    network_json_responses: 0,
    price_nodes: 0,
    product_candidates: 0,
    products_found: 0,
    pages: []
  };

  try {
    chromium.setGraphicsMode = false;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: 'shell'
    });

    const products = [];
    const seen = new Set();

    for (const url of targets) {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(NAV_TIMEOUT);
      const jsonResponses = [];
      page.on('response', async response => {
        try {
          const type = (response.headers()['content-type'] || '').toLowerCase();
          if (!type.includes('json')) return;
          const requestUrl = response.url();
          if (!/^https?:/i.test(requestUrl)) return;
          const body = await response.text();
          if (body && body.length <= 2 * 1024 * 1024) {
            jsonResponses.push({ url: requestUrl, body: body.slice(0, 2 * 1024 * 1024) });
            diagnostics.network_json_responses++;
          }
        } catch (_) {}
      });

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await new Promise(resolve => setTimeout(resolve, SETTLE_MS));

        // Trigger lazy-loaded menu sections/images and infinite-scroll content.
        await page.evaluate(async () => {
          const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
          for (let i = 0; i < 18; i++) {
            window.scrollBy(0, step);
            await new Promise(r => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
        await new Promise(resolve => setTimeout(resolve, 900));

        const data = await page.evaluate(() => {
          const text = el => (el?.innerText || el?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          const priceRe = /(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu;
          const weightRe = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
          const noiseRe = /^(главная|меню|каталог|о нас|доставка|акции|новости|контакты|заказать|корзина|купить|добавить|подробнее|войти|регистрация)$/iu;
          const result = [];
          const elements = [...document.querySelectorAll('article, li, [class*="card" i], [class*="product" i], [class*="menu" i], [class*="dish" i], [class*="item" i], [data-price], [itemprop="price"]')];
          const priceElements = [...document.querySelectorAll('[itemprop="price"], [data-price], [class*="price" i], [class*="cost" i], span, div, p, strong, b')];
          let priceNodes = 0;
          const add = (name, price, description, image, source) => {
            name = String(name || '').replace(/\s+/g, ' ').trim();
            price = Number(String(price || '').replace(/\s/g, '').replace(',', '.'));
            if (!name || name.length < 2 || name.length > 220 || !price || price <= 0 || price >= 1000000 || noiseRe.test(name) || weightRe.test(name)) return;
            const key = name.toLowerCase();
            if (result.some(x => x.key === key)) return;
            result.push({ key, name, price, description: String(description || '').slice(0, 600), image_url: image || null, source });
          };
          for (const el of elements) {
            const t = text(el);
            const m = t.match(priceRe);
            if (!m && !el.getAttribute('data-price') && !el.getAttribute('itemprop')) continue;
            const rawPrice = el.getAttribute('data-price') || el.getAttribute('content') || (m && m[0]);
            const priceMatch = String(rawPrice || '').match(/\d[\d\s.,]*/);
            if (!priceMatch) continue;
            priceNodes++;
            const candidates = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6,[itemprop="name"],[class*="name" i],[class*="title" i],[class*="product" i],[class*="dish" i]')].map(text).filter(x => x && !noiseRe.test(x) && !weightRe.test(x));
            const fallback = t.split(/\n|\s{2,}/).map(x => x.trim()).filter(x => x.length >= 3 && x.length <= 220 && !priceRe.test(x) && !noiseRe.test(x) && !weightRe.test(x));
            const name = candidates[0] || fallback[0];
            const img = el.querySelector('img[src],img[data-src],img[data-lazy-src]');
            add(name, priceMatch[0], candidates[1] || fallback.slice(1,3).join(' '), img?.currentSrc || img?.src || img?.dataset?.src || null, 'rendered-dom');
          }
          if (!result.length) {
            for (const el of priceElements) {
              const t = text(el);
              const m = t.match(priceRe);
              if (!m) continue;
              priceNodes++;
              let parent = el;
              for (let level = 0; level < 5 && parent; level++, parent = parent.parentElement) {
                const pt = text(parent);
                const names = [...parent.querySelectorAll('h1,h2,h3,h4,h5,h6,[itemprop="name"],[class*="name" i],[class*="title" i]')].map(text).filter(x => x && !noiseRe.test(x) && !weightRe.test(x));
                const fallback = pt.split(/\n|\s{2,}/).map(x => x.trim()).filter(x => x.length >= 3 && x.length <= 220 && !priceRe.test(x) && !noiseRe.test(x) && !weightRe.test(x));
                add(names[0] || fallback[0], m[0], names[1] || fallback.slice(1,3).join(' '), null, 'rendered-dom-near-price');
                if (result.length) break;
              }
            }
          }
          return { title: document.title, html: document.documentElement.outerHTML, text: text(document.body), products: result, priceNodes };
        });

        diagnostics.pages_rendered++;
        diagnostics.rendered_html_bytes += Buffer.byteLength(data.html, 'utf8');
        diagnostics.price_nodes += data.priceNodes;
        diagnostics.product_candidates += data.products.length;
        for (const item of data.products) {
          if (seen.has(item.name.toLowerCase())) continue;
          seen.add(item.name.toLowerCase());
          delete item.key;
          item.source_url = url;
          products.push(item);
        }
        diagnostics.pages.push({ url, title: clean(data.title, 180), price_nodes: data.priceNodes, products: data.products.length, json_responses: jsonResponses.length, rendered_text_chars: data.text.length });
      } catch (error) {
        diagnostics.pages_failed.push({ url, code: error?.name === 'TimeoutError' ? 'BROWSER_TIMEOUT' : 'BROWSER_RENDER_FAILED', message: String(error?.message || error).slice(0, 240) });
      } finally {
        await page.close().catch(() => {});
      }
    }

    diagnostics.products_found = products.length;
    return { ok: true, code: products.length ? 'BROWSER_MENU_FOUND' : 'BROWSER_MENU_NOT_FOUND', pages: diagnostics.pages, products, diagnostics };
  } catch (error) {
    return { ok: false, code: 'BROWSER_ENGINE_FAILED', message: String(error?.message || error), pages: [], products: [], diagnostics };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { renderMenuPages };
