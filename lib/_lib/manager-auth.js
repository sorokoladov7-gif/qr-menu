const crypto = require('crypto');

const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}
function base64urlDecode(value) { const normalized=String(value).replace(/-/g,'+').replace(/_/g,'/'); return Buffer.from(normalized+'='.repeat((4-normalized.length%4)%4),'base64'); }
function decodeJwt(token) { const parts=String(token).split('.'); if(parts.length!==3)return null; try{return {header:JSON.parse(base64urlDecode(parts[0]).toString('utf8')),payload:JSON.parse(base64urlDecode(parts[1]).toString('utf8')),signature:base64urlDecode(parts[2]),signingInput:`${parts[0]}.${parts[1]}`};}catch(_){return null;} }
function verifyJwtWithJwk(decoded,jwk){
  if(!decoded||!jwk)return false; const alg=decoded.header&&decoded.header.alg; if(!alg||alg==='none')return false;
  try{
    const publicKey=crypto.createPublicKey({key:jwk,format:'jwk'}),data=Buffer.from(decoded.signingInput,'utf8');
    if(alg.startsWith('RS'))return crypto.verify(alg.toLowerCase().replace('rs','RSA-SHA'),data,publicKey,decoded.signature);
    if(alg.startsWith('ES')){const size=Number(alg.slice(2))/8;if(!Number.isInteger(size)||decoded.signature.length!==size*2)return false;const r=decoded.signature.subarray(0,size),s=decoded.signature.subarray(size);const toDerInt=part=>{let v=Buffer.from(part);while(v.length>1&&v[0]===0)v=v.subarray(1);if(v[0]&0x80)v=Buffer.concat([Buffer.from([0]),v]);return Buffer.concat([Buffer.from([0x02,v.length]),v]);};const body=Buffer.concat([toDerInt(r),toDerInt(s)]);const der=Buffer.concat([Buffer.from([0x30,body.length]),body]);const hash=alg==='ES256'?'SHA256':alg==='ES384'?'SHA384':'SHA512';return crypto.verify(hash,data,publicKey,der);}
  }catch(_){return false;} return false;
}
async function fetchJwks(){const response=await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,{headers:{apikey:SUPABASE_PUBLIC_KEY,Accept:'application/json'}});if(!response.ok)return null;const data=await response.json();return Array.isArray(data.keys)?data.keys:[];}
async function verifyAccessToken(accessToken){const decoded=decodeJwt(accessToken);if(!decoded||!decoded.payload||!decoded.payload.sub)return null;const now=Math.floor(Date.now()/1000),{exp,nbf,iss,aud}=decoded.payload;if(typeof exp==='number'&&exp<=now)return null;if(typeof nbf==='number'&&nbf>now+30)return null;if(iss&&iss!==`${SUPABASE_URL}/auth/v1`)return null;if(aud&&aud!=='authenticated')return null;const keys=await fetchJwks();if(!keys||!keys.length)return null;const candidates=decoded.header.kid?keys.filter(k=>k.kid===decoded.header.kid):keys;if(!candidates.length||!candidates.some(k=>verifyJwtWithJwk(decoded,k)))return null;return decoded.payload;}
async function getProfile(userId){const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;if(!key)return null;const response=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,display_name,role&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'}});if(!response.ok)return null;const rows=await response.json();return Array.isArray(rows)&&rows[0]?rows[0]:null;}
async function getManagerUser(accessToken){
  if(!accessToken)throw Object.assign(new Error('auth_required'),{status:401});
  try{
    const authResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:`Bearer ${accessToken}`}});
    if(authResponse.ok){const user=await authResponse.json();if(user&&user.id){const profile=await getProfile(user.id);const role=profile&&profile.id===user.id?profile.role:(user.app_metadata&&user.app_metadata.role);if(role==='manager'||role==='admin')return {...user,role,user_metadata:{...(user.user_metadata||{}),display_name:profile?.display_name||user.user_metadata?.display_name||null}};}}
  }catch(_){}
  const claims=await verifyAccessToken(accessToken);if(!claims||!claims.sub)throw Object.assign(new Error('supabase_user_auth_failed'),{status:401});
  const profile=await getProfile(claims.sub);if(!profile||profile.id!==claims.sub||!['manager','admin'].includes(profile.role))throw Object.assign(new Error('manager_or_admin_access_required'),{status:403});
  return {id:claims.sub,email:profile.email||claims.email||null,user_metadata:{display_name:profile.display_name||null},role:profile.role};
}
module.exports={bearer,getManagerUser};
