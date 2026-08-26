module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'method_not_allowed' });

  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return res.status(400).json({ error: 'url_required', message: 'Введите адрес сайта заведения' });

  let target;
  try { target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); }
  catch (_) { return res.status(400).json({ error: 'invalid_url', message: 'Некорректный адрес сайта' }); }

  const host = target.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(target.protocol) || /^(localhost|127\.0\.0\.1|169\.254\.169\.254)$/.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return res.status(400).json({ error: 'private_url_not_allowed' });
  }

  const clean = (v, n = 1000) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const abs = (u, base) => { try { return new URL(String(u || ''), base || target.href).href; } catch (_) { return null; } };
  const priceOf = v => {
    const m = String(v || '').replace(/\u00a0/g, ' ').match(/\d[\d\s]*(?:[.,]\d{1,2})?/);
    return m ? Number(m[0].replace(/\s/g, '').replace(',', '.')) : 0;
  };
  const isPrice = s => /(?:^|\s)\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|р\.?|руб(?:\.?|лей|ля)?|RUB)(?:\s|$)/i.test(String(s || ''));
  const isWeight = s => /^(?:\d[\d\s]*(?:[.,]\d+)?)\s*(?:г|гр|грамм(?:а|ов)?|кг|мл|л|шт)\.?$/i.test(clean(s));
  const isNoise = s => /^(?:добавить в корзину|купить|заказать|калории|белки|жиры|углеводы|вес порции|состав|подробнее|в корзину|0|1|2|3|4|5|6|7|8|9)$/i.test(clean(s));
  const looksLikeCategory = s => {
    const x = clean(s, 120);
    return x.length >= 3 && x.length <= 80 && /(закус|салат|суп|бургер|пицц|ролл|суш|десерт|соус|напит|бар|паст|горяч|детск|завтрак|основн|гарнир|стейк|breakfast|burger|pizza|sushi|dessert|drink|menu|catalog|food)/i.test(x);
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 QR-Menu-Importer/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.7,en;q=0.5',
    'Cache-Control': 'no-cache'
  };

  async function getHtml(url) {
    const r = await fetch(url, { redirect: 'follow', headers, signal: AbortSignal.timeout(18000) });
    if (!r.ok) throw Error('http_' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (!/html|xhtml|text/i.test(ct)) throw Error('not_html');
    const b = Buffer.from(await r.arrayBuffer());
    return { html: b.subarray(0, 12 * 1024 * 1024).toString('utf8'), url: r.url || url };
  }

  async function getReader(url) {
    const r = await fetch('https://r.jina.ai/' + url, {
      headers: { 'User-Agent': 'QR-Menu-Importer/5.0', 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) throw Error('reader_' + r.status);
    const text = await r.text();
    if (!text || text.length < 30) throw Error('reader_empty');
    return { text, url };
  }

  function htmlText(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '\n')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|section|article|h1|h2|h3|h4|h5|h6|tr|td|th|a)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
      .split(/\n+/).map(x => clean(x, 700)).filter(Boolean);
  }

  const pages = [];
  let source = 'direct';
  try { pages.push({ ...(await getHtml(target.href)), kind: 'home' }); }
  catch (e) {
    try { pages.push({ ...(await getReader(target.href)), kind: 'home-reader' }); source = 'reader_fallback'; }
    catch (_) { return res.status(502).json({ error: 'site_fetch_failed', message: 'Не удалось получить сайт. Сайт может блокировать автоматический доступ.', details: clean(e.message, 180) }); }
  }

  const home = pages[0];
  const sameHost = u => { try { return new URL(u).hostname.replace(/^www\./, '') === new URL(home.url).hostname.replace(/^www\./, ''); } catch (_) { return false; } };
  const menuLinks = new Set();
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lm;
  while ((lm = linkRe.exec(home.html || '')) && menuLinks.size < 120) {
    const u = abs(lm[1], home.url);
    const txt = clean(lm[2].replace(/<[^>]+>/g, ' '), 200);
    if (!u || !sameHost(u) || /\.pdf(?:$|[?#])/i.test(u)) continue;
    if (/(menu|меню|catalog|каталог|food|dish|блюд|еда|price|цены|ассортимент|бар|пицц|ролл|суши|салат|десерт)/i.test(u + ' ' + txt)) menuLinks.add(u.split('#')[0]);
  }

  // Common menu paths are checked even if navigation is generated by JavaScript.
  for (const p of ['/menu', '/Menu', '/menyu', '/catalog', '/catalogue', '/food', '/dishes', '/menu.html']) {
    const u = new URL(p, home.url).href;
    if (sameHost(u)) menuLinks.add(u);
  }

  for (const u of [...menuLinks].slice(0, 15)) {
    try { pages.push({ ...(await getHtml(u)), kind: 'menu' }); }
    catch (_) {
      try { pages.push({ ...(await getReader(u)), kind: 'menu-reader' }); source = source === 'direct' ? 'menu_reader' : source; }
      catch (_) {}
    }
  }

  const structured = { business: [], items: [] };
  const walk = x => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const t = Array.isArray(x['@type']) ? x['@type'].join(' ') : String(x['@type'] || '');
    if (/restaurant|cafe|bar|bakery|foodestablishment|localbusiness|coffee|fastfood/i.test(t)) structured.business.push(x);
    if (/menuitem|product|offer|recipe|food/i.test(t) || x.offers || x.price || x.priceSpecification) structured.items.push(x);
    Object.values(x).forEach(walk);
  };
  for (const p of pages.filter(x => x.html)) {
    const scripts = p.html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
    for (const s of scripts) {
      const q = s.replace(/^.*?>/, '').replace(/<\/script>.*$/i, '').trim();
      try { walk(JSON.parse(q)); } catch (_) { try { walk(JSON.parse(q.replace(/&quot;/g, '"'))); } catch (_) {} }
    }
  }

  const products = [];
  const seen = new Set();
  const categories = new Set();
  const add = (name, price, description, category, image) => {
    name = clean(name, 180); price = priceOf(price);
    if (!name || !price || price < 1 || price > 1000000 || isNoise(name)) return;
    const key = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (key.length < 3 || seen.has(key)) return;
    seen.add(key);
    products.push({ name, description: clean(description, 1200) || null, price, category: clean(category, 120) || 'main', image_url: abs(image, home.url) || null, is_available: true, applies_to: 'all' });
  };

  // Structured products remain the highest-confidence source.
  for (const it of structured.items) {
    const o = Array.isArray(it.offers) ? it.offers[0] : it.offers;
    const s = o && o.priceSpecification;
    add(it.name || it.title, (o && (o.price || o.lowPrice)) || it.price || (s && (s.price || s.minPrice)), it.description, it.category, typeof it.image === 'string' ? it.image : it.image && it.image.url);
  }

  // Visible-text parser. Crucially, a menu item is accepted only when a price is
  // followed by a real dish name. This prevents footer/phone/cookie text from
  // becoming the one bogus "dish" that the previous parser produced.
  function parseVisible(lines, forceMenu) {
    let category = 'main';
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i], 700);
      if (!line || isNoise(line)) continue;
      if (looksLikeCategory(line) && !isPrice(line) && !isWeight(line)) { category = line; categories.add(line); continue; }
      if (!isPrice(line)) continue;
      const p = priceOf(line);
      if (!p) continue;

      let name = null, description = '';
      let j = i + 1;
      let skippedWeight = false;
      while (j < Math.min(i + 9, lines.length)) {
        const x = clean(lines[j], 700);
        if (!x || isNoise(x)) { j++; continue; }
        if (isWeight(x)) { skippedWeight = true; j++; continue; }
        if (isPrice(x)) break;
        if (looksLikeCategory(x) && !name) break;
        if (!name) {
          // Dish names are normally short-ish. Reject navigation/legal/footer sentences.
          if (x.length > 220 || /(?:copyright|разработка сайта|политик|персональн|забронировать|связаться|главная|контакты|доставка)/i.test(x)) { j++; continue; }
          name = x; j++; continue;
        }
        if (description.length < 900 && x.length <= 500 && !looksLikeCategory(x)) description += (description ? ' ' : '') + x;
        j++;
      }
      if (name && (forceMenu || skippedWeight || category !== 'main')) add(name, p, description, category, null);
    }
  }

  for (const p of pages) {
    const lines = p.kind.includes('reader') ? String(p.text || '').split(/\n+/).map(x => clean(x, 700)).filter(Boolean) : htmlText(p.html);
    parseVisible(lines, p.kind.startsWith('menu'));
  }

  const b = structured.business[0] || {};
  const a = b.address || {};
  const title = clean((home.html && (home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1] || '').replace(/<[^>]+>/g, ''), 180);
  const desc = clean((home.html && (home.html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)/i) || [, ''])[1]) || '', 1200);
  const og = abs((home.html && (home.html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']*)/i) || [, ''])[1]) || '', home.url);
  const phone = clean(b.telephone || ((home.html && home.html.match(/(?:\+7|8)[\s()\-\d]{9,}/)) || [''])[0], 80);
  const address = clean(typeof a === 'string' ? a : [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', '), 500);
  const logo = abs(typeof b.logo === 'string' ? b.logo : b.logo && b.logo.url, home.url) || og;

  // Do not report "menu found" when the parser found only a single weak item.
  // A valid menu should contain at least 2 products OR structured product data.
  const menuFound = products.length >= 2 || structured.items.length >= 2;

  return res.status(200).json({
    source_url: target.href,
    venue: {
      name: clean(b.name || title || host.split('.')[0], 180),
      description: clean(b.description || desc, 1200),
      address,
      phone,
      website_url: clean(b.url || target.href, 500),
      logo_url: logo,
      opening_hours: b.openingHours || b.openingHoursSpecification || null
    },
    products: products.slice(0, 500),
    meta: {
      products_found: products.length,
      menu_found: menuFound,
      structured_data: structured.business.length > 0 || structured.items.length > 0,
      pages_checked: pages.length,
      menu_links_found: menuLinks.size,
      categories_found: [...categories],
      source
    }
  });
};
