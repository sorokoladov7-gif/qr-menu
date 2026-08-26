'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const MAX_PAGES = 3;
const NAV_TIMEOUT = 15000;
const SETTLE_MS = 1800;

function clean(v, max = 500) {
  return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeUrl(value) {
  try { return new URL(value).href; } catch { return null; }
}

async function renderMenuPages(urls) {
  const targets = [...new Set((urls || []).map(normalizeUrl).filter(Boolean))].slice(0, MAX_PAGES);
  if (!targets.length) return { ok: false, code: 'NO_RENDER_TARGETS', pages: [], products: [], diagnostics: {} };

  const diagnostics = {
    engine: 'puppeteer-core + @sparticuz/chromium',
    pages_attempted: targets.length,
    pages_rendered: 0,
    pages_failed: [],
    rendered_html_bytes: 0,
    network_json_responses: 0,
    price_nodes: 0,
    products_found: 0,
    pages: []
  };

  let browser = null;
  try {
    chromium.setGraphicsMode = false;
    const executablePath = await chromium.executablePath();
    if (!executablePath) throw new Error('Chromium executablePath() вернул пустой путь');

    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1365, height: 900, deviceScaleFactor: 1 },
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true
    });

    const products = [];
    const seen = new Set();

    for (const url of targets) {
      let page = null;
      try {
        page = await browser.newPage();
        page.setDefaultNavigationTimeout(NAV_TIMEOUT);
        const jsonResponses = [];

        page.on('response', async response => {
          try {
            const type = String(response.headers()['content-type'] || '').toLowerCase();
            if (!type.includes('json')) return;
            const requestUrl = response.url();
            if (!/^https?:/i.test(requestUrl)) return;
            const body = await response.text();
            if (body && body.length <= 512 * 1024) {
              jsonResponses.push({ url: requestUrl, body: body.slice(0, 512 * 1024) });
              diagnostics.network_json_responses++;
            }
          } catch (_) {}
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
        await page.evaluate(async () => {
          const step = Math.max(350, Math.floor(window.innerHeight * 0.75));
          for (let i = 0; i < 10; i++) {
            window.scrollBy(0, step);
            await new Promise(resolve => setTimeout(resolve, 120));
          }
          window.scrollTo(0, 0);
        });
        await new Promise(resolve => setTimeout(resolve, 700));

        const data = await page.evaluate(() => {
          const text = el => (el?.innerText || el?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          const priceRe = /(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu;
          const weightRe = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
          const noiseRe = /^(главная|меню|каталог|о нас|доставка|акции|новости|контакты|заказать|корзина|купить|добавить|подробнее|войти|регистрация)$/iu;
          const result = [];
          let priceNodes = 0;

          const add = (name, price, description, image, source) => {
            name = String(name || '').replace(/\s+/g, ' ').trim();
            const priceValue = Number(String(price || '').replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.'));
            if (!name || name.length < 2 || name.length > 220 || !priceValue || priceValue <= 0 || priceValue >= 1000000 || noiseRe.test(name) || weightRe.test(name)) return;
            const key = name.toLowerCase();
            if (result.some(x => x.key === key)) return;
            result.push({ key, name, price: priceValue, description: String(description || '').slice(0, 600), image_url: image || null, source });
          };

          const elements = [...document.querySelectorAll('article, li, [class*="card" i], [class*="product" i], [class*="menu" i], [class*="dish" i], [data-price], [itemprop="price"]')];
          for (const el of elements) {
            const t = text(el);
            const match = t.match(priceRe);
            const explicit = el.getAttribute('data-price') || (el.matches('[itemprop="price"]') ? el.getAttribute('content') || t : '');
            if (!match && !explicit) continue;
            const priceMatch = String(explicit || match?.[0] || '').match(/\d[\d\s.,]*/);
            if (!priceMatch) continue;
            priceNodes++;
            const names = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6,[itemprop="name"],[class*="name" i],[class*="title" i]')].map(text).filter(x => x && !noiseRe.test(x) && !weightRe.test(x));
            const parts = t.split(/\n|\s{2,}/).map(x => x.trim()).filter(x => x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x));
            const img = el.querySelector('img[src],img[data-src],img[data-lazy-src]');
            add(names[0] || parts[0], priceMatch[0], names[1] || parts.slice(1, 3).join(' '), img?.currentSrc || img?.src || img?.dataset?.src || null, 'rendered-dom');
          }

          return {
            title: document.title,
            html: document.documentElement.outerHTML,
            text: text(document.body),
            products: result,
            priceNodes
          };
        });

        diagnostics.pages_rendered++;
        diagnostics.rendered_html_bytes += Buffer.byteLength(data.html, 'utf8');
        diagnostics.price_nodes += data.priceNodes;

        for (const item of data.products) {
          const key = item.name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          delete item.key;
          item.source_url = url;
          products.push(item);
        }

        diagnostics.pages.push({
          url,
          title: clean(data.title, 180),
          price_nodes: data.priceNodes,
          products: data.products.length,
          json_responses: jsonResponses.length,
          rendered_text_chars: data.text.length
        });
      } catch (error) {
        diagnostics.pages_failed.push({
          url,
          code: error?.name === 'TimeoutError' ? 'BROWSER_TIMEOUT' : 'BROWSER_PAGE_FAILED',
          message: String(error?.message || error).slice(0, 300)
        });
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }

    diagnostics.products_found = products.length;
    return {
      ok: true,
      code: products.length ? 'BROWSER_MENU_FOUND' : 'BROWSER_MENU_NOT_FOUND',
      pages: diagnostics.pages,
      products,
      diagnostics
    };
  } catch (error) {
    return {
      ok: false,
      code: 'BROWSER_ENGINE_FAILED',
      message: String(error?.message || error),
      pages: [],
      products: [],
      diagnostics: {
        ...diagnostics,
        engine_error_name: error?.name || 'Error',
        engine_error_message: String(error?.message || error)
      }
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { renderMenuPages };
