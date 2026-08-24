const ALLOWED_ORIGINS = new Set([
  'https://qr-menu-russia.ru',
  'https://www.qr-menu-russia.ru',
  'https://qr-menu-sar64.vercel.app',
  'https://qr-menu-sqki-64-reg.vercel.app',
  'https://qr-menu-sqki-git-main-64-reg.vercel.app'
]);

function setCors(res, origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  setCors(res, origin);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const token = process.env.DADATA_API_KEY;
  if (!token) {
    return res.status(503).json({ error: 'address_service_not_configured' });
  }

  const query = String(req.query?.q || '').trim();
  if (query.length < 3) return res.status(200).json({ suggestions: [] });
  if (query.length > 200) return res.status(400).json({ error: 'query_too_long' });

  const body = {
    query,
    count: 7,
    locations: [{ country: 'Россия' }],
    restrict_value: true
  };

  try {
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('DaData error', response.status, text.slice(0, 500));
      return res.status(502).json({ error: 'address_provider_error' });
    }

    const data = await response.json();
    const suggestions = (data.suggestions || []).map((item) => {
      const d = item.data || {};
      return {
        value: item.value,
        unrestricted_value: item.unrestricted_value,
        data: {
          country: d.country || null,
          region: d.region || null,
          city: d.city || d.settlement || null,
          street: d.street || null,
          house: d.house || null,
          flat: d.flat || null,
          postal_code: d.postal_code || null,
          fias_id: d.fias_id || null,
          geo_lat: d.geo_lat ? Number(d.geo_lat) : null,
          geo_lon: d.geo_lon ? Number(d.geo_lon) : null
        }
      };
    }).filter((item) => item.data.city || item.data.street || item.data.house);

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('Address proxy error', error);
    return res.status(500).json({ error: 'address_service_unavailable' });
  }
}
