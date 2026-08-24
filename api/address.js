module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const q = String((req.query && req.query.q) || '').trim();
  if (q.length < 3) {
    res.status(200).json({ suggestions: [] });
    return;
  }

  const token = process.env.DADATA_API_KEY || process.env.DADATA_TOKEN;
  if (!token) {
    console.error('[api/address] DADATA_API_KEY or DADATA_TOKEN is not configured');
    res.status(503).json({ error: 'dadata_not_configured' });
    return;
  }

  try {
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Token ' + token
      },
      body: JSON.stringify({
        query: q,
        count: 8,
        from_bound: { value: 'street' },
        to_bound: { value: 'house' },
        restrict_value: false
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[api/address] DaData HTTP', response.status, data);
      res.status(502).json({ error: 'dadata_request_failed' });
      return;
    }

    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    res.status(200).json({
      suggestions: suggestions.map(function (item) {
        const d = item.data || {};
        return {
          value: item.value || item.unrestricted_value || '',
          unrestricted_value: item.unrestricted_value || item.value || '',
          data: {
            city: d.city || d.settlement || null,
            settlement: d.settlement || null,
            street: d.street || null,
            house: d.house || null,
            flat: d.flat || null,
            fias_id: d.fias_id || null,
            geo_lat: d.geo_lat != null ? Number(d.geo_lat) : null,
            geo_lon: d.geo_lon != null ? Number(d.geo_lon) : null,
            region: d.region || null,
            region_with_type: d.region_with_type || null,
            city_with_type: d.city_with_type || null,
            street_with_type: d.street_with_type || null
          }
        };
      })
    });
  } catch (error) {
    console.error('[api/address] unexpected error', error);
    res.status(500).json({ error: 'address_service_error' });
  }
};
