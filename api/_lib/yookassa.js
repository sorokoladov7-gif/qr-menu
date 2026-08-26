const crypto = require('crypto');

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
function json(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').send(JSON.stringify(body));}
function redirect(res,url){res.statusCode=302;res.setHeader('Location',url);res.end();}
function base64url(buffer){return Buffer.from(buffer).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromBase64url(value){const n=String(value).replace(/-/g,'+').replace(/_/g,'/');return Buffer.from(n+'='.repeat((4-n%4)%4),'base64');}
function randomToken(bytes=32){return base64url(crypto.randomBytes(bytes));}
function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}

const PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';

function supabaseConfig(){
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    authKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_ANON_KEY
  };
}
async function supabase(path,options={}){
  const cfg=supabaseConfig();
  if(!cfg.url||!cfg.key)throw new Error('Supabase server environment is not configured');
  const headers=Object.assign({apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},options.headers||{});
  const response=await fetch(`${cfg.url.replace(/\/$/,'')}/rest/v1/${path}`,Object.assign({},options,{headers}));
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=text}
  if(!response.ok){const message=data&&(data.message||data.error||data.hint)||`Supabase HTTP ${response.status}`;const error=new Error(message);error.status=response.status;error.data=data;throw error;}
  return data;
}
async function getSupabaseUser(accessToken){
  const cfg=supabaseConfig();
  if(!cfg.url)return null;
  if(!accessToken)return null;
  const authKey=cfg.authKey;
  if(!authKey)return null;
  const response=await fetch(`${cfg.url.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:authKey,Authorization:`Bearer ${accessToken}`}});
  if(!response.ok){
    let details=null;try{details=await response.json();}catch(_){}
    const error=new Error('supabase_user_auth_failed');error.status=response.status;error.data=details;throw error;
  }
  return response.json();
}
function bearer(req){const value=req.headers.authorization||'';return value.startsWith('Bearer ')?value.slice(7).trim():'';}
async function assertManagerVenue(userId,venueId){if(!userId||!venueId)return null;const rows=await supabase(`manager_venues?manager_id=eq.${encodeURIComponent(userId)}&venue_id=eq.${encodeURIComponent(venueId)}&select=id,manager_id,venue_id&limit=1`);return Array.isArray(rows)&&rows.length?rows[0]:null;}
function callbackUrl(req){return process.env.YOOKASSA_OAUTH_CALLBACK_URL||`${origin(req)}/api/payments/yookassa/callback`;}
function origin(req){const configured=process.env.PUBLIC_APP_URL||process.env.NEXT_PUBLIC_APP_URL;if(configured)return configured.replace(/\/$/,'');const host=req.headers['x-forwarded-host']||req.headers.host;const proto=req.headers['x-forwarded-proto']||'https';return `${proto}://${host}`;}
async function yookassaToken(code){const clientId=env('YOOKASSA_CLIENT_ID');const clientSecret=env('YOOKASSA_CLIENT_SECRET');const basic=Buffer.from(`${clientId}:${clientSecret}`).toString('base64');const body=new URLSearchParams({grant_type:'authorization_code',code});const response=await fetch('https://yookassa.ru/oauth/v2/token',{method:'POST',headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/x-www-form-urlencoded'},body});const data=await response.json();if(!response.ok||!data.access_token){const error=new Error(data.error_description||data.error||'ЮKassa не вернула OAuth-токен');error.status=response.status;throw error;}return data;}
async function yookassaMe(accessToken){const response=await fetch('https://api.yookassa.ru/v3/me',{headers:{Authorization:`Bearer ${accessToken}`}});const data=await response.json();if(!response.ok){const error=new Error(data.description||data.message||'Не удалось получить настройки магазина ЮKassa');error.status=response.status;throw error;}return data;}
async function yookassaCreatePayment(accessToken,payload,idempotenceKey){const response=await fetch('https://api.yookassa.ru/v3/payments',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Idempotence-Key':idempotenceKey||randomToken(24),'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok||!data||!data.id){const error=new Error(data&&(data.description||data.message||data.code)||`ЮKassa HTTP ${response.status}`);error.status=response.status;error.data=data;throw error;}return data;}
async function yookassaGetPayment(accessToken,paymentId){const response=await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Bearer ${accessToken}`}});const data=await response.json();if(!response.ok||!data||data.id!==paymentId){const error=new Error(data&&(data.description||data.message)||`ЮKassa HTTP ${response.status}`);error.status=response.status;error.data=data;throw error;}return data;}
function platformBasic(){const shop=env('PLATFORM_YOOKASSA_SHOP_ID');const secret=env('PLATFORM_YOOKASSA_SECRET_KEY');return 'Basic '+Buffer.from(`${shop}:${secret}`).toString('base64');}
async function yookassaCreatePlatformPayment(payload,idempotenceKey){const response=await fetch('https://api.yookassa.ru/v3/payments',{method:'POST',headers:{Authorization:platformBasic(),'Idempotence-Key':idempotenceKey||randomToken(24),'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok||!data||!data.id){const error=new Error(data&&(data.description||data.message||data.code)||`ЮKassa HTTP ${response.status}`);error.status=response.status;error.data=data;throw error;}return data;}
async function yookassaGetPlatformPayment(paymentId){const response=await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:platformBasic()}});const data=await response.json();if(!response.ok||!data||data.id!==paymentId){const error=new Error(data&&(data.description||data.message)||`ЮKassa HTTP ${response.status}`);error.status=response.status;error.data=data;throw error;}return data;}
function encryptionKey(){const raw=env('PAYMENT_TOKEN_ENCRYPTION_KEY');const key=/^[0-9a-f]{64}$/i.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');if(key.length!==32)throw new Error('PAYMENT_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)');return key;}
function encryptSecret(value){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);const tag=cipher.getAuthTag();return `v1:${base64url(iv)}:${base64url(tag)}:${base64url(encrypted)}`;}
function decryptSecret(value){const parts=String(value||'').split(':');if(parts.length!==4||parts[0]!=='v1')throw new Error('Invalid encrypted payment token');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),fromBase64url(parts[1]));decipher.setAuthTag(fromBase64url(parts[2]));return Buffer.concat([decipher.update(fromBase64url(parts[3])),decipher.final()]).toString('utf8');}
module.exports={env,json,redirect,randomToken,sha256,supabase,getSupabaseUser,bearer,assertManagerVenue,callbackUrl,origin,yookassaToken,yookassaMe,yookassaCreatePayment,yookassaGetPayment,yookassaCreatePlatformPayment,yookassaGetPlatformPayment,encryptSecret,decryptSecret};
