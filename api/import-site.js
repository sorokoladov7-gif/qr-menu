module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const raw = String((req.query && req.query.url) || '').trim();
  if (!raw) return res.status(400).json({ error: 'url_required' });

  let target;
  try { target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); }
  catch (_) { return res.status(400).json({ error: 'invalid_url' }); }

  if (!['http:', 'https:'].includes(target.protocol)) return res.status(400).json({ error: 'unsupported_protocol' });
  const host = target.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === '169.254.169.254') {
    return res.status(400).json({ error: 'private_url_not_allowed' });
  }

  function clean(v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max || 1000); }
  function absolute(url) {
    try { return new URL(url, target.origin).href; } catch (_) { return null; }
  }
  function price(v) {
    const n = String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  }
  function walkJson(value, out) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(v => walkJson(v, out)); return; }
    if (value['@graph']) walkJson(value['@graph'], out);
    const type = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '').toLowerCase();
    if (/restaurant|cafe|bar|bakery|foodestablishment|localbusiness/.test(type)) out.business.push(value);
    if (/menuitem|product/.test(type) || value.offers) out.items.push(value);
    if (value.address && typeof value.address === 'object') out.addresses.push(value.address);
    if (value.openingHours || value.openingHoursSpecification) out.hours.push(value.openingHours || value.openingHoursSpecification);
  }

  let html;
  try {
    const response = await fetch(target.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QR-Menu Venue Importer/1.0)', 'Accept': 'text/html,application/xhtml+xml,application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return res.status(422).json({ error: 'site_http_' + response.status });
    const type = response.headers.get('content-type') || '';
    if (!/html|xhtml|text/i.test(type)) return res.status(422).json({ error: 'site_not_html' });
    const buf = Buffer.from(await response.arrayBuffer());
    html = buf.subarray(0, 3 * 1024 * 1024).toString('utf8');
  } catch (e) {
    return res.status(502).json({ error: 'site_fetch_failed', message: clean(e.message, 240) });
  }

  const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1].replace(/<[^>]+>/g, ''));
  const desc = clean((html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i) || [,''])[1]);
  const image = absolute((html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']*)["']/i) || [,''])[1]);
  const scripts = [];
  const sm = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  sm.forEach(s => { const m = s.match(/>([\s\S]*?)<\/script>/i); if (!m) return; try { scripts.push(JSON.parse(m[1].trim())); } catch (_) {} });
  const found = { business: [], items: [], addresses: [], hours: [] };
  scripts.forEach(x => walkJson(x, found));
  const b = found.business[0] || {};
  const addr = b.address && typeof b.address === 'object' ? b.address : (found.addresses[0] || {});
  const address = clean(typeof b.address === 'string' ? b.address : [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(', '));
  const phone = clean(b.telephone || (html.match(/(?:tel:|phone|telephone)[^>]*>([^<+\d]*\+?[\d ()\-]{7,})/i) || [,''])[1], 80);
  const logo = absolute(b.logo && (typeof b.logo === 'string' ? b.logo : b.logo.url)) || image;
  const website = clean(b.url || target.href, 500);
  let openingHours = b.openingHours || b.openingHoursSpecification || found.hours[0] || null;
  if (openingHours && !Array.isArray(openingHours)) openingHours = [openingHours];

  const products = [];
  const seen = new Set();
  found.items.forEach((it, idx) => {
    const name = clean(it.name || it.title);
    const offers = Array.isArray(it.offers) ? it.offers[0] : it.offers;
    const p = price((offers && (offers.price || offers.lowPrice)) || it.price);
    if (name && !seen.has(name.toLowerCase()) && (p > 0 || /menuitem/i.test(String(it['@type'] || '')))) {
      seen.add(name.toLowerCase());
      products.push({ name, description: clean(it.description), price: p, category: clean(it.category || 'main', 120) || 'main', image_url: absolute(it.image || (it.image && it.image.url)) || null, is_available: true, applies_to: 'all' });
    }
  });

  // Generic HTML fallback: extract obvious food-card names/prices from common item elements.
  if (!products.length) {
    const blocks = html.match(/<(?:article|li|div)[^>]*(?:menu|product|dish|item)[^>]*>[\s\S]{0,1800}?<\/(?:article|li|div)>/gi) || [];
    blocks.slice(0, 100).forEach(block => {
      const text = clean(block.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '), 500);
      const pm = text.match(/(\d[\d\s]{1,7})(?:[.,]\d{1,2})?\s*(?:₽|руб\.?|р\.)/i);
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
    meta: { products_found: products.length, structured_data: found.business.length > 0 || found.items.length > 0 }
  });
};
