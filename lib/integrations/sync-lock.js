'use strict';

const crypto=require('crypto');
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';

function serviceHeaders(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}

async function rpc(path,body){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${path}`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify(body)});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=null;}if(!r.ok)throw new Error((data&&(data.message||data.error))||`Supabase RPC ${r.status}`);return data;}

async function claim(venueId,provider,ttlSeconds=900){const token=crypto.randomUUID();const locked=Boolean(await rpc('claim_integration_sync_lock',{p_venue_id:String(venueId),p_provider:String(provider),p_lock_token:token,p_ttl_seconds:ttlSeconds}));return {locked,token};}

async function release(venueId,provider,token){if(!token)return;try{await rpc('release_integration_sync_lock',{p_venue_id:String(venueId),p_provider:String(provider),p_lock_token:String(token)});}catch(_){} }

module.exports={claim,release};
