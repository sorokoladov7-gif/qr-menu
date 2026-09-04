import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors })
}

function customerPrice(providerFee: number, pricingMode: string, markupPercent: number, fixedFee: number) {
  if (pricingMode === 'fixed') return Math.max(0, Math.round(fixedFee))
  if (pricingMode === 'provider_plus_percent') return Math.max(0, Math.round(providerFee * (1 + Math.max(0, markupPercent) / 100)))
  return Math.max(0, Math.round(providerFee))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => {
    try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default } catch { return '' }
  })()
  if (!url || !serviceKey) return json({ ok: false, error: 'server_configuration_error' }, 500)

  const admin = createClient(url, serviceKey)
  try {
    const body = await req.json()
    const venueId = String(body?.venue_id || '').trim()
    const address = String(body?.customer_address || '').trim()
    const lat = Number(body?.customer_lat)
    const lng = Number(body?.customer_lng)
    if (!venueId || !address || !Number.isFinite(lat) || !Number.isFinite(lng)) return json({ ok: false, error: 'invalid_request' }, 400)

    const { data: venue, error: venueError } = await admin.from('venues').select('id,status,address,latitude,longitude,lat,lng,delivery_enabled,delivery_min_order_free,delivery_min_order,delivery_base_price,delivery_base_fee,delivery_fee,delivery_per_km,delivery_rate_per_km,delivery_max_km').eq('id', venueId).maybeSingle()
    if (venueError || !venue || venue.status !== 'active') return json({ ok: false, error: 'venue_not_found' }, 404)
    if (venue.delivery_enabled === false) return json({ ok: false, error: 'delivery_disabled' }, 409)

    const { data: integrations, error: intError } = await admin.from('delivery_integrations').select('id,provider,enabled,priority,pricing_mode,markup_percent,fixed_fee,api_token,config').eq('venue_id', venueId).eq('enabled', true).order('priority', { ascending: true })
    if (intError) throw intError
    const integration = (integrations || [])[0]
    if (!integration) return json({ ok: false, error: 'delivery_provider_not_configured' }, 409)

    if (integration.provider === 'custom') {
      const vLat = Number(venue.latitude ?? venue.lat), vLng = Number(venue.longitude ?? venue.lng)
      let distanceKm = 0
      if (Number.isFinite(vLat) && Number.isFinite(vLng)) {
        const r = 6371
        const dLat = (lat - vLat) * Math.PI / 180
        const dLng = (lng - vLng) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(vLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        distanceKm = Math.round((r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 100) / 100
      }
      const maxKm = Number(venue.delivery_max_km || 0)
      if (maxKm > 0 && distanceKm > maxKm) return json({ ok: false, error: 'too_far', distance_km: distanceKm }, 409)
      const providerFee = Math.max(0, Math.round((Number(venue.delivery_base_price ?? venue.delivery_base_fee ?? venue.delivery_fee ?? 0) + Number(venue.delivery_per_km ?? venue.delivery_rate_per_km ?? 0) * distanceKm)))
      const fee = customerPrice(providerFee, integration.pricing_mode, Number(integration.markup_percent || 0), Number(integration.fixed_fee || 0))
      const finalFee = Number(venue.delivery_min_order_free || 0) > 0 && Number(body?.cart_total || 0) >= Number(venue.delivery_min_order_free) ? 0 : fee
      const { data: quoteId, error: quoteError } = await admin.rpc('store_delivery_quote', { p_venue_id: venueId, p_provider: 'custom', p_customer_address: address, p_customer_lat: lat, p_customer_lng: lng, p_provider_fee: providerFee, p_customer_fee: finalFee, p_markup_percent: Number(integration.markup_percent || 0), p_eta_minutes: null, p_distance_meters: Math.round(distanceKm * 1000), p_metadata: { source: 'custom' } })
      if (quoteError) throw quoteError
      return json({ ok: true, quote_id: quoteId, provider: 'custom', provider_fee: providerFee, fee: finalFee, markup_percent: Number(integration.markup_percent || 0), distance_km: distanceKm })
    }

    if (!integration.api_token) return json({ ok: false, error: 'provider_not_connected', provider: integration.provider }, 409)
    if (integration.provider !== 'yandex') return json({ ok: false, error: 'provider_api_not_available', provider: integration.provider }, 409)

    const sourceLat = Number(venue.latitude ?? venue.lat), sourceLng = Number(venue.longitude ?? venue.lng)
    if (!Number.isFinite(sourceLat) || !Number.isFinite(sourceLng)) return json({ ok: false, error: 'venue_coordinates_required' }, 409)

    const yandexBody = {
      items: [{ size: { length: 0.2, width: 0.2, height: 0.2 }, weight: 0.5, quantity: 1, pickup_point: 1, dropoff_point: 2, age_restricted: false }],
      route_points: [
        { id: 1, coordinates: [sourceLng, sourceLat], fullname: String(venue.address || '') },
        { id: 2, coordinates: [lng, lat], fullname: address }
      ],
      requirements: { taxi_class: 'express', cargo_type: 'van', cargo_loaders: 0, pro_courier: false, cargo_options: ['thermobag'] },
      skip_door_to_door: false
    }

    const yandex = await fetch('https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${integration.api_token}`, 'Accept-Language': 'ru', 'Content-Type': 'application/json' },
      body: JSON.stringify(yandexBody)
    })
    const payload = await yandex.json().catch(() => ({}))
    if (!yandex.ok) {
      await admin.from('delivery_integrations').update({ last_error: String(payload?.message || payload?.code || `HTTP ${yandex.status}`), last_tested_at: new Date().toISOString() }).eq('id', integration.id)
      return json({ ok: false, error: 'provider_quote_failed', provider: integration.provider, provider_status: yandex.status }, 502)
    }

    const providerFee = Number(payload?.price)
    if (!Number.isFinite(providerFee) || providerFee < 0) return json({ ok: false, error: 'provider_invalid_price' }, 502)
    const fee = customerPrice(providerFee, integration.pricing_mode, Number(integration.markup_percent || 0), Number(integration.fixed_fee || 0))
    const finalFee = Number(venue.delivery_min_order_free || 0) > 0 && Number(body?.cart_total || 0) >= Number(venue.delivery_min_order_free) ? 0 : fee
    const { data: quoteId, error: quoteError } = await admin.rpc('store_delivery_quote', { p_venue_id: venueId, p_provider: integration.provider, p_customer_address: address, p_customer_lat: lat, p_customer_lng: lng, p_provider_fee: providerFee, p_customer_fee: finalFee, p_markup_percent: Number(integration.markup_percent || 0), p_eta_minutes: Number(payload?.eta || 0) || null, p_distance_meters: Number(payload?.distance_meters || 0) || null, p_metadata: { source: 'yandex', zone_id: payload?.zone_id || null } })
    if (quoteError) throw quoteError
    await admin.from('delivery_integrations').update({ last_error: null, last_tested_at: new Date().toISOString() }).eq('id', integration.id)
    return json({ ok: true, quote_id: quoteId, provider: integration.provider, provider_fee: Math.round(providerFee), fee: finalFee, markup_percent: Number(integration.markup_percent || 0), eta_minutes: Number(payload?.eta || 0) || null, distance_meters: Number(payload?.distance_meters || 0) || null })
  } catch (e) {
    console.error('[delivery-quote]', e)
    return json({ ok: false, error: e instanceof Error ? e.message : 'internal_error' }, 500)
  }
})
