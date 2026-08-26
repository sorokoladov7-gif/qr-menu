module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const raw = String((req.query && req.query.url) || (req.body && req.body.url) || '').trim();
  if (!raw) return res.status(400).json({ error: 'url_required', message: 'Введите адрес сайта заведения' });

  let target;
  try { target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); }
  catch (_) { return res.status(400).json({ error: 'invalid_url', message: 'Некорректный адрес сайта' }); }

  if (!['http:', 'https:'].includes(target.protocol)) return res.status(400).json({ error: 'unsupported_protocol' });
  const host = target.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '169.254.169.254') {
    return res.status(400).json({ error: 'private_url_not_allowed' });
  }

  function clean(v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max || 1000); }
  function absolute(url, base) {
    try { return new URL(String(url || ''), base || target.href).href; } catch (_) { return null; }
  }
  function price(v) {
    const n = String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }
  function pushUnique(arr, value) { if (value && !arr.includes(value)) arr.push(value); }

  // Walk the whole JSON-LD tree. Restaurant menus are often nested inside @graph,
  // hasMenu, hasMenuSection, itemListElement, offers and arbitrary objects.
  function walkJson(value, out) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(v => walkJson(v, out)); return; }
    const type = Array.isArray(value['@type']) ? value['@type'].join(' ').toLowerCase() : String(value['@type'] || '').toLowerCase();
    if (/restaurant|cafe|bar|bakery|foodestablishment|localbusiness|coffee|fastfood/.test(type)) out.business.push(value);
    if (/menuitem|product|offer|recipe/.test(type) || value.offers || value.price || value.priceSpecification) out.items.push(value);
    if (value.address) out.addresses.push(value.address);
    if (value.openingHours || value.openingHoursSpecification) out.hours.push(value.openingHours || value.openingHoursSpecification);
    Object.keys(value).forEach(k => {
      if (k === '@context' || k === '@type') return;
      walkJson(value[k], out);
    });
  }

  async function fetchHtml(url) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 QR-Menu-Importer/2.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.7,en;q=0.5',
      'Cache-Control': 'no-cache'
    };
    const response = await fetch(url, { redirect: 'follow', headers, signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error('site_http_' + response.status);
    const type = response.headers.get('content-type') || '';
    if (!/html|xhtml|text/i.test(type)) throw new Error('site_not_html');
    const buf = Buffer.from(await response.arrayBuffer());
    return { html: buf.subarray(0, 5 * 1024 * 1024).toString('utf8'), finalUrl: response.url || url };
  }

  let html, finalUrl = target.href, source = 'direct';
  try {
    const r = await fetchHtml(target.href);
    html = r.html; finalUrl = r.finalUrl;
  } catch (directError) {
    // Fallback for sites that block server-to-server requests. Jina Reader is only
    // used as a reader fallback; the original URL remains the source of the venue.
    try {
      const jinaUrl = 'https://r.jina.ai/' + target.href;
      const jr = await fetch(jinaUrl, {
        headers: { 'User-Agent': 'QR-Menu-Importer/2.0', 'Accept': 'text/plain' },
        signal: AbortSignal.timeout(20000)
      });
      if (!jr.ok) throw new Error('reader_http_' + jr.status);
      const text = await jr.text();
      if (!text || text.length < 20) throw new Error('reader_empty');
      html = '<html><head><title>' + clean(host.split('.')[0], 120) + '</title></head><body>' + text.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</body></html>';
      source = 'reader_fallback';
    } catch (fallbackError) {
      return res.status(502).json({
        error: 'site_fetch_failed',
        message: 'Не удалось получить сайт. Сайт может блокировать автоматический доступ или требовать JavaScript.',
        details: clean(directError && directError.message, 180)
      });
    }
  }

  const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1].replace(/<[^>]+>/g, ''));
  const desc = clean((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i) || [,''])[1]);
  const image = absolute((html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']*)["']/i) || [,''])[1], finalUrl);
  const scripts = [];
  const sm = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  sm.forEach(s => { const m = s.match(/>([\s\S]*?)<\/script>/i); if (!m) return; try { scripts.push(JSON.parse(m[1].trim())); } catch (_) { try { scripts.push(JSON.parse(m[1].trim().replace(/&quot;/g, '\"'))); } catch (_) {} } });
  const found = { business: [], items: [], addresses: [], hours: [] };
  scripts.forEach(x => walkJson(x, found));
  const b = found.business[0] || {};
  const addr = b.address && typeof b.address === 'object' ? b.address : (found.addresses.find(x => x && typeof x === 'object') || {});
  const address = clean(typeof b.address === 'string' ? b.address : [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(', '));
  const phone = clean(b.telephone || (html.match(/(?:tel:|phone|telephone)[^>]*>([^<+\d]*\+?[\d ()\-]{7,})/i) || [,''])[1], 80);
  const logo = absolute(b.logo && (typeof b.logo === 'string' ? b.logo : b.logo.url), finalUrl) || image;
  const website = clean(b.url || target.href, 500);
  let openingHours = b.openingHours || b.openingHoursSpecification || found.hours[0] || null;
  if (openingHours && !Array.isArray(openingHours)) openingHours = [openingHours];

  const products = [];
  const seen = new Set();
  found.items.forEach((it) => {
    const name = clean(it.name || it.title);
    const offers = Array.isArray(it.offers) ? it.offers[0] : it.offers;
    const spec = offers && offers.priceSpecification ? (Array.isArray(offers.priceSpecification) ? offers.priceSpecification[0] : offers.priceSpecification) : null;
    const p = price((offers && (offers.price || offers.lowPrice)) || (spec && (spec.price || spec.minPrice)) || it.price);
    const imageUrl = absolute(typeof it.image === 'string' ? it.image : (it.image && it.image.url), finalUrl);
    if (name && !seen.has(name.toLowerCase()) && (p > 0 || /menuitem|product|recipe/i.test(String(it['@type'] || '')))) {
      seen.add(name.toLowerCase());
      products.push({ name, description: clean(it.description), price: p, category: clean(typeof it.category === 'string' ? it.category : 'main', 120) || 'main', image_url: imageUrl, is_available: true, applies_to: 'all' });
    }
  });

  // Generic HTML fallback for common menu/product cards.
  if (!products.length) {
    const blocks = html.match(/<(?:article|li|div)[^>]*(?:menu|product|dish|food|item|card)[^>]*>[\s\S]{0,2500}?<\/(?:article|li|div)>/gi) || [];
    blocks.slice(0, 150).forEach(block => {
      const text = clean(block.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '), 700);
      const pm = text.match(/(\d[\d\s]{1,7})(?:[.,]\d{1,2})?\s*(?:₽|руб\.?|р\.|RUB)/i);
      if (!pm) return;
      const p = price(pm[1]);
      const name = clean(text.replace(pm[0], '').split(/[|·•]{1,2}/)[0], 160);
      if (name && p > 0 && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); products.push({ name, description: null, price: p, category: 'main', image_url: null, is_available: true, applies_to: 'all' }); }
    });
  }

  return res.status(200).json({
    source_url: target.href,
    venue: { name: clean(b.name || title || host.split('.')[0], 180), description: clean(b.description || desc, 1200), address, phone, website_url: website, logo_url: logo, opening_hours: openingHours },
    products: products.slice(0, 500),
    meta: { products_found: products.length, structured_data: found.business.length > 0 || found.items.length > 0, source }
  });
};
