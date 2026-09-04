import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: cors }) }
function customerPrice(providerFee: number, mode: string, markup: number, fixed: number) {
  if (mode === 'fixed') return Math.max(0, Math.round(fixed))
  if (mode === 'provider_plus_percent') return Math.max(0, Math.round(providerFee * (1 + Math.max(0, markup) / 100)))
  return Math.max(0, Math.round(providerFee))
}
function haversineKm(lat1:number,lng1:number,lat2:number,lng2:number){const r=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;return r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok:false,error:'method_not_allowed' },405)
  const url=Deno.env.get('SUPABASE_URL')!
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||(()=>{try{return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default}catch{return ''}})()
  if(!url||!serviceKey)return json({ok:false,error:'server_configuration_error'},500)
  const admin=createClient(url,serviceKey)
  try{
    const body=await req.json(),venueId=String(body?.venue_id||'').trim(),address=String(body?.customer_address||'').trim(),lat=Number(body?.customer_lat),lng=Number(body?.customer_lng),cartTotal=Number(body?.cart_total||0)
    if(!venueId||!address||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return json({ok:false,error:'invalid_request'},400)
    const {data:venue,error:ve}=await admin.from('venues').select('id,status,address,latitude,longitude,lat,lng,delivery_enabled,delivery_min_order,delivery_min_order_free,delivery_base_price,delivery_base_fee,delivery_fee,delivery_per_km,delivery_rate_per_km,delivery_max_km').eq('id',venueId).maybeSingle()
    if(ve||!venue||venue.status!=='active')return json({ok:false,error:'venue_not_found'},404)
    if(venue.delivery_enabled===false)return json({ok:false,error:'delivery_disabled'},409)
    const minOrder=Number(venue.delivery_min_order||0)
    if(minOrder>0&&cartTotal<minOrder)return json({ok:false,error:'delivery_min_order_not_reached',min_order:minOrder},409)
    const {data:integrations,error:ie}=await admin.from('delivery_integrations').select('id,provider,enabled,priority,pricing_mode,markup_percent,fixed_fee,api_token,config').eq('venue_id',venueId).eq('enabled',true).order('priority',{ascending:true}).order('provider',{ascending:true})
    if(ie)throw ie
    if(!integrations?.length)return json({ok:false,error:'delivery_provider_not_configured'},409)
    const failures:Array<{provider:string;error:string;status?:number}>=[];let selected:any=null,providerFee=0,eta:number|null=null,distanceMeters:number|null=null,distanceKm=0
    for(const integration of integrations){
      try{
        let fee=0,providerEta:number|null=null,providerDistance:number|null=null,providerDistanceKm=0
        if(integration.provider==='custom'){
          const originLat=Number(venue.latitude??venue.lat),originLng=Number(venue.longitude??venue.lng)
          if(!Number.isFinite(originLat)||!Number.isFinite(originLng))throw new Error('venue_coordinates_required')
          providerDistanceKm=haversineKm(originLat,originLng,lat,lng);const max=Number(venue.delivery_max_km||0)
          if(max>0&&providerDistanceKm>max)throw new Error('too_far')
          const base=Number(venue.delivery_base_price??venue.delivery_base_fee??venue.delivery_fee??0),perKm=Number(venue.delivery_per_km??venue.delivery_rate_per_km??0)
          fee=Math.max(0,Math.round(base+perKm*providerDistanceKm));providerDistance=Math.round(providerDistanceKm*1000)
        }else if(integration.provider==='yandex'){
          if(!integration.api_token)throw new Error('provider_not_connected')
          const originLat=Number(venue.latitude??venue.lat),originLng=Number(venue.longitude??venue.lng)
          if(!Number.isFinite(originLat)||!Number.isFinite(originLng))throw new Error('venue_coordinates_required')
          const ybody={items:[{size:{length:0.2,width:0.2,height:0.2},weight:0.5,quantity:1,pickup_point:1,dropoff_point:2,age_restricted:false}],route_points:[{id:1,coordinates:[originLng,originLat],fullname:String(venue.address||'')},{id:2,coordinates:[lng,lat],fullname:address}],requirements:{taxi_class:'express',cargo_type:'van',cargo_loaders:0,pro_courier:false,cargo_options:['thermobag']},skip_door_to_door:false}
          const yr=await fetch('https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/check-price',{method:'POST',headers:{Authorization:`Bearer ${integration.api_token}`,'Accept-Language':'ru','Content-Type':'application/json'},body:JSON.stringify(ybody)}),yp=await yr.json().catch(()=>({}))
          if(!yr.ok)throw Object.assign(new Error(String(yp?.message||yp?.code||`provider_http_${yr.status}`)),{providerStatus:yr.status})
          fee=Number(yp?.price);providerEta=Number(yp?.eta||0)||null;providerDistance=Number(yp?.distance_meters||0)||null
          if(!Number.isFinite(fee)||fee<0)throw new Error('provider_invalid_price')
        }else throw new Error('provider_api_not_available')
        providerFee=fee;eta=providerEta;distanceMeters=providerDistance;distanceKm=providerDistance!=null?providerDistance/1000:providerDistanceKm;selected=integration;break
      }catch(err){
        const message=err instanceof Error?err.message:'provider_failed';failures.push({provider:integration.provider,error:message,status:Number((err as any)?.providerStatus)||undefined})
        await admin.from('delivery_integrations').update({last_error:message,last_tested_at:new Date().toISOString()}).eq('id',integration.id)
      }
    }
    if(!selected)return json({ok:false,error:'all_delivery_providers_failed',failures},502)
    const baseCustomerFee=customerPrice(providerFee,selected.pricing_mode,Number(selected.markup_percent||0),Number(selected.fixed_fee||0)),freeFrom=Number(venue.delivery_min_order_free||0),finalFee=freeFrom>0&&cartTotal>=freeFrom?0:baseCustomerFee
    const metadata={source:selected.provider,fallback_used:failures.length>0,attempted_providers:integrations.map((x:any)=>x.provider),failed_providers:failures,customer_coordinates:{lat,lng}}
    const {data:quoteId,error:qe}=await admin.rpc('store_delivery_quote',{p_venue_id:venueId,p_provider:selected.provider,p_customer_address:address,p_customer_lat:lat,p_customer_lng:lng,p_provider_fee:providerFee,p_customer_fee:finalFee,p_markup_percent:Number(selected.markup_percent||0),p_eta_minutes:eta,p_distance_meters:distanceMeters,p_metadata:metadata})
    if(qe)throw qe
    await admin.from('delivery_integrations').update({last_error:failures.length?JSON.stringify(failures):null,last_tested_at:new Date().toISOString()}).eq('id',selected.id)
    return json({ok:true,quote_id:quoteId,provider:selected.provider,provider_fee:Math.round(providerFee),fee:finalFee,markup_percent:Number(selected.markup_percent||0),eta_minutes:eta,distance_meters:distanceMeters,distance_km:distanceKm,fallback_used:failures.length>0})
  }catch(e){console.error('[delivery-quote]',e);return json({ok:false,error:e instanceof Error?e.message:'internal_error'},500)}
})
