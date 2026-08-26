'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const MAX_PAGES = 2;
const NAV_TIMEOUT = 9000;
const SETTLE_MS = 900;
const BROWSER_TOTAL_BUDGET = 26000;

function clean(v, max = 600) { return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeUrl(v) { try { return new URL(v).href; } catch { return null; } }

async function renderMenuPages(urls) {
  const startedAt = Date.now();
  const targets = [...new Set((urls || []).map(normalizeUrl).filter(Boolean))].slice(0, MAX_PAGES);
  if (!targets.length) return { ok: false, code: 'NO_RENDER_TARGETS', products: [], diagnostics: {} };
  const diagnostics = { engine: 'puppeteer-core + @sparticuz/chromium', pages_attempted: targets.length, pages_rendered: 0, pages_failed: [], rendered_html_bytes: 0, network_json_responses: 0, price_nodes: 0, products_found: 0, pages: [] };
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
        diagnostics.pages_failed.push({ url, code: 'BROWSER_BUDGET_EXCEEDED', message: 'Остановлено по ограничению времени browser-rendering.' });
        break;
      }
      let page = null;
      try {
        page = await browser.newPage();
        page.setDefaultNavigationTimeout(NAV_TIMEOUT);
        page.setDefaultTimeout(5000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/147 Safari/537.36 QR-Menu-Importer/3.0');
        const jsonResponses = [];
        const responseHandler = response => {
          try {
            const type = String(response.headers()['content-type'] || '').toLowerCase();
            const requestUrl = response.url();
            if (!type.includes('json') || !/^https?:/i.test(requestUrl)) return;
            const len = Number(response.headers()['content-length'] || 0);
            if (len && len > 512 * 1024) return;
            if (!/api|menu|catalog|product|dish|food|item|graphql/i.test(requestUrl)) return;
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
          const step = Math.max(600, Math.floor(window.innerHeight * 0.9));
          for (let i = 0; i < 8; i++) { window.scrollBy(0, step); await new Promise(r => setTimeout(r, 100)); }
          window.scrollTo(0, 0);
        }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 300));

        const data = await page.evaluate(() => {
          const text = el => (el?.innerText || el?.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
          const priceRe = /(?:^|[^\d])((?:\d{1,3}(?:[ .]\d{3})+)|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\s*\.?|RUB)(?=$|\s|[.,;:!?])/iu;
          const numberPriceRe = /\b(\d{2,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)\b/iu;
          const weightRe = /^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|шт)\.?$/iu;
          const noiseRe = /^(главная|меню|каталог|о нас|доставка|акции|новости|контакты|заказать|корзина|купить|добавить|подробнее|войти|регистрация)$/iu;
          const result = [];
          const seen = new Set();
          const add = (name, price, description, image, source = 'rendered-dom') => {
            name = String(name || '').replace(/\s+/g, ' ').trim();
            const priceValue = Number(String(price || '').replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.'));
            if (!name || name.length < 3 || name.length > 220 || !priceValue || priceValue <= 0 || priceValue >= 1000000 || noiseRe.test(name) || weightRe.test(name)) return;
            const key = name.toLowerCase(); if (seen.has(key)) return; seen.add(key);
            result.push({ name, price: priceValue, description: String(description || '').slice(0, 600), image_url: image || null, source });
          };
          const candidateName = root => {
            const explicit = [...root.querySelectorAll('[itemprop="name"],[class*="name" i],[class*="title" i],h1,h2,h3,h4,h5,h6')].map(text).find(x => x && x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x));
            if (explicit) return explicit;
            const parts = (root.innerText || '').split(/\n+/).map(x => x.trim()).filter(x => x && x.length >= 3 && x.length <= 220 && !noiseRe.test(x) && !weightRe.test(x) && !priceRe.test(x));
            return parts[0] || '';
          };
          const priceElements = [...document.querySelectorAll('body *')].filter(el => {
            const t = text(el); return t && t.length <= 900 && (priceRe.test(t) || el.hasAttribute('data-price') || el.getAttribute('itemprop') === 'price');
          });
          for (const el of priceElements) {
            const t = text(el);
            const explicit = el.getAttribute('data-price') || (el.getAttribute('itemprop') === 'price' ? el.getAttribute('content') : '');
            const match = explicit || (t.match(priceRe)?.[0] || t.match(numberPriceRe)?.[0]);
            if (!match) continue;
            const price = String(match).match(/\d[\d\s.,]*/)?.[0]; if (!price) continue;
            let root = el;
            for (let i = 0; i < 6 && root.parentElement; i++) {
              const rt = text(root);
              if (rt.length >= 20 && rt.length <= 1800) {
                const name = candidateName(root);
                if (name) {
                  const img = root.querySelector('img[src],img[data-src],img[data-lazy-src]');
                  add(name, price, '', img?.currentSrc || img?.src || img?.dataset?.src || null);
                  break;
                }
              }
              root = root.parentElement;
            }
          }
          const bodyLines = text(document.body).split(/\n+/).map(x => x.trim()).filter(Boolean);
          for (let i = 0; i < bodyLines.length; i++) {
            const m = bodyLines[i].match(priceRe); if (!m) continue;
            for (let d = 1; d <= 4; d++) {
              for (const idx of [i - d, i + d]) {
                const name = bodyLines[idx];
                if (!name || priceRe.test(name) || weightRe.test(name) || noiseRe.test(name) || name.length < 3 || name.length > 220) continue;
                if (/[A-Za-zА-Яа-яЁё]/.test(name)) { add(name, m[0], '', null, 'rendered-text-near-price'); break; }
              }
              if (result.length) break;
            }
          }
          return { title: document.title, htmlBytes: document.documentElement.outerHTML.length, textChars: text(document.body).length, products: result, priceNodes: priceElements.length };
        });

        const jsonProducts = [];
        const jsonSeen = new Set();
        const walkJson = value => {
          if (!value) return;
          if (Array.isArray(value)) return value.forEach(walkJson);
          if (typeof value !== 'object') return;
          const name = value.name || value.title || value.productName || value.dishName;
          const rawPrice = value.price ?? value.cost ?? value.amount ?? value.priceValue;
          const price = Number(String(rawPrice ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
          if (name && price > 0 && price < 1000000) {
            const key = clean(name, 220).toLowerCase();
            if (!jsonSeen.has(key)) { jsonSeen.add(key); jsonProducts.push({ name: clean(name, 220), price, description: clean(value.description, 600), image_url: typeof value.image === 'string' ? value.image : (typeof value.image_url === 'string' ? value.image_url : null), source: 'network-json' }); }
          }
          Object.values(value).forEach(walkJson);
        };
        for (const response of jsonResponses.slice(0, 10)) {
          try {
            const body = await response.text();
            if (body && body.length <= 512 * 1024) walkJson(JSON.parse(body));
          } catch (_) {}
        }

        diagnostics.pages_rendered++;
        diagnostics.rendered_html_bytes += Number(data.htmlBytes || 0);
        diagnostics.price_nodes += Number(data.priceNodes || 0);
        for (const item of [...data.products, ...jsonProducts]) { const key = clean(item.name, 220).toLowerCase(); if (seen.has(key)) continue; seen.add(key); item.source_url = url; products.push(item); }
        diagnostics.pages.push({ url, title: clean(data.title, 180), price_nodes: data.priceNodes, dom_products: data.products.length, network_products: jsonProducts.length, json_responses: jsonResponses.length, rendered_text_chars: data.textChars });
      } catch (error) {
        diagnostics.pages_failed.push({ url, code: error?.name === 'TimeoutError' ? 'BROWSER_TIMEOUT' : 'BROWSER_PAGE_FAILED', message: String(error?.message || error).slice(0, 400) });
      } finally { if (page) await page.close().catch(() => {}); }
    }
    diagnostics.products_found = products.length;
    return { ok: true, code: products.length ? 'BROWSER_MENU_FOUND' : 'BROWSER_MENU_NOT_FOUND', products, diagnostics };
  } catch (error) {
    return { ok: false, code: 'BROWSER_ENGINE_FAILED', message: String(error?.message || error), products: [], diagnostics: { ...diagnostics, engine_error_name: error?.name || 'Error', engine_error_message: String(error?.message || error) } };
  } finally { if (browser) await browser.close().catch(() => {}); }
}

module.exports = { renderMenuPages };
