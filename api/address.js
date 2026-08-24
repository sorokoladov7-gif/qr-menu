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

  function normalizeDaData(items) {
    return (Array.isArray(items) ? items : []).map(function (item) {
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
    }).filter(function (item) {
      return item.value;
    });
  }

  async function fallbackNominatim() {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=ru&accept-language=ru&q=' + encodeURIComponent(q);
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'User-Agent': 'QR-Menu/1.0 (address suggestions)'
      }
    });
    if (!response.ok) throw new Error('nominatim_http_' + response.status);
    const items = await response.json();
    return (Array.isArray(items) ? items : []).map(function (item) {
      const a = item.address || {};
      const city = a.city || a.town || a.village || a.municipality || a.county || null;
      const street = a.road || null;
      const house = a.house_number || null;
      const value = [city, street, house].filter(Boolean).join(', ') || item.display_name || '';
      return {
        value: value,
        unrestricted_value: item.display_name || value,
        data: {
          city: city,
          settlement: a.village || a.hamlet || null,
          street: street,
          house: house,
          flat: null,
          fias_id: null,
          geo_lat: item.lat != null ? Number(item.lat) : null,
          geo_lon: item.lon != null ? Number(item.lon) : null,
          region: a.state || null,
          region_with_type: a.state || null,
          city_with_type: city,
          street_with_type: street
        }
      };
    }).filter(function (item) {
      return item.value && Number.isFinite(item.data.geo_lat) && Number.isFinite(item.data.geo_lon);
    });
  }

  async function fallbackPhoton() {
    const url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=8&lang=ru';
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'QR-Menu/1.0 (address suggestions)'
      }
    });
    if (!response.ok) throw new Error('photon_http_' + response.status);
    const data = await response.json();
    const features = data && Array.isArray(data.features) ? data.features : [];
    return features.map(function (feature) {
      const p = feature.properties || {};
      const coordinates = feature.geometry && feature.geometry.coordinates || [];
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      const city = p.city || p.town || p.village || p.municipality || null;
      const street = p.street || p.road || null;
      const house = p.housenumber || p.house_number || null;
      const value = [city, street, house].filter(Boolean).join(', ') || p.name || p.label || '';
      return {
        value: value,
        unrestricted_value: p.name ? ([value, p.state].filter(Boolean).join(', ')) : value,
        data: {
          city: city,
          settlement: p.village || null,
          street: street,
          house: house,
          flat: null,
          fias_id: null,
          geo_lat: lat,
          geo_lon: lng,
          region: p.state || null,
          region_with_type: p.state || null,
          city_with_type: city,
          street_with_type: street
        }
      };
    }).filter(function (item) {
      return item.value && Number.isFinite(item.data.geo_lat) && Number.isFinite(item.data.geo_lon);
    });
  }

  const token = process.env.DADATA_API_KEY || process.env.DADATA_TOKEN;

  // 1. DaData — primary provider when configured.
  if (token) {
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
      if (response.ok) {
        const suggestions = normalizeDaData(data.suggestions);
        if (suggestions.length) {
          res.status(200).json({ suggestions: suggestions });
          return;
        }
      } else {
        console.error('[api/address] DaData HTTP', response.status, data);
      }
    } catch (error) {
      console.error('[api/address] DaData error', error);
    }
  } else {
    console.warn('[api/address] DADATA_API_KEY/DADATA_TOKEN is not configured; using public geocoders');
  }

  // 2. Nominatim — free fallback.
  try {
    const suggestions = await fallbackNominatim();
    if (suggestions.length) {
      res.status(200).json({ suggestions: suggestions });
      return;
    }
  } catch (error) {
    console.error('[api/address] Nominatim fallback error', error);
  }

  // 3. Photon — second free fallback. This prevents a temporary Nominatim
  // outage/rate-limit from turning the address field into a dead end.
  try {
    const suggestions = await fallbackPhoton();
    res.status(200).json({ suggestions: suggestions });
    return;
  } catch (error) {
    console.error('[api/address] Photon fallback error', error);
  }

  res.status(503).json({ error: 'address_service_unavailable', suggestions: [] });
};
