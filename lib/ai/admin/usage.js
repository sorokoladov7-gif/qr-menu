'use strict';
const SUPABASE_URL=process.env.SUPABASE_URL||'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
const SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
function err(message,status){return Object.assign(new Error(message),{status});}
function bearer(req){const h=String(req.headers?.authorization||req.headers?.Authorization||'');const m=h.match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function authAdmin(req){const token=bearer(req);if(!token)throw err('AUTH_REQUIRED',401);const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});const u=await r.json().catch(()=>null);if(!r.ok||!u?.id)throw err('AUTH_INVALID',401);const p=await fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(u.id)+'&select=id,role,display_name,email&limit=1',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token,accept:'application/json'}});const rows=await p.json().catch(()=>[]);if(!p.ok||String(rows?.[0]?.role||'').toLowerCase()!=='admin')throw err('ADMIN_ONLY',403);return {id:u.id,email:u.email||rows?.[0]?.email||''};}
async function query(path){if(!SUPABASE_SERVICE_ROLE_KEY)throw err('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED',503);const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,accept:'application/json'}});const d=await r.json().catch(()=>null);if(!r.ok)throw err(d?.message||'SUPABASE_HTTP_'+r.status,r.status);return d||[];}
function num(v){return Number.isFinite(Number(v))?Number(v):0;}
function summarize(rows){const x={requests:rows.length,prompt_tokens:0,output_tokens:0,thoughts_tokens:0,total_tokens:0,cached_tokens:0,tool_tokens:0,fallback_requests:0,avg_tokens_per_request:0};for(const r of rows){x.prompt_tokens+=num(r.prompt_tokens);x.output_tokens+=num(r.output_tokens);x.thoughts_tokens+=num(r.thoughts_tokens);x.total_tokens+=num(r.total_tokens);x.cached_tokens+=num(r.cached_tokens);x.tool_tokens+=num(r.tool_tokens);if(r.fallback_used)x.fallback_requests++;}x.avg_tokens_per_request=x.requests?Math.round(x.total_tokens/x.requests):0;return x;}
function add(map,key,seed,r){const x=map[key]||(map[key]=Object.assign({},seed));x.requests++;x.total_tokens+=num(r.total_tokens);x.prompt_tokens+=num(r.prompt_tokens);x.output_tokens+=num(r.output_tokens);if(r.fallback_used)x.fallback_requests=(x.fallback_requests||0)+1;return x;}
module.exports=async function(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end(JSON.stringify({error:'METHOD_NOT_ALLOWED'}));}
 try{
  await authAdmin(req);const days=Math.min(90,Math.max(1,Number(req.query?.days)||30));const since=new Date(Date.now()-days*86400000).toISOString();
  const rows=await query('manager_ai_usage?created_at=gte.'+encodeURIComponent(since)+'&select=id,manager_id,venue_id,feature,model,plan_id,subscription_status,prompt_tokens,output_tokens,thoughts_tokens,total_tokens,cached_tokens,tool_tokens,request_ms,fallback_used,fallback_attempts,created_at&order=created_at.desc&limit=50000');
  const [managers,venues,plans]=await Promise.all([query('profiles?role=eq.manager&select=id,display_name,email'),query('venues?select=id,name'),query('plans?select=id,name,price')]);
  const mm=Object.fromEntries((managers||[]).map(x=>[x.id,x]));const vm=Object.fromEntries((venues||[]).map(x=>[x.id,x]));const pm=Object.fromEntries((plans||[]).map(x=>[x.id,x]));
  const now=Date.now();const p24=rows.filter(r=>new Date(r.created_at).getTime()>=now-86400000);const p7=rows.filter(r=>new Date(r.created_at).getTime()>=now-7*86400000);
  const byManager={},byModel={},byFeature={},byPlan={},byVenue={};
  for(const r of rows){
   add(byManager,r.manager_id,{manager_id:r.manager_id,name:mm[r.manager_id]?.display_name||mm[r.manager_id]?.email||r.manager_id,requests:0,total_tokens:0,prompt_tokens:0,output_tokens:0,fallback_requests:0},r);
   add(byModel,r.model,{model:r.model,requests:0,total_tokens:0,prompt_tokens:0,output_tokens:0,fallback_requests:0},r);
   add(byFeature,r.feature,{feature:r.feature,requests:0,total_tokens:0,prompt_tokens:0,output_tokens:0,fallback_requests:0},r);
   if(r.plan_id)add(byPlan,r.plan_id,{plan_id:r.plan_id,name:pm[r.plan_id]?.name||r.plan_id,price:pm[r.plan_id]?.price??null,requests:0,total_tokens:0,prompt_tokens:0,output_tokens:0,fallback_requests:0},r);
   if(r.venue_id)add(byVenue,r.venue_id,{venue_id:r.venue_id,name:vm[r.venue_id]?.name||r.venue_id,requests:0,total_tokens:0,prompt_tokens:0,output_tokens:0,fallback_requests:0},r);
  }
  const sort=a=>a.sort((x,y)=>y.total_tokens-x.total_tokens);
  res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, max-age=30');
  return res.end(JSON.stringify({ok:true,days,since,summary:summarize(rows),periods:{'24h':summarize(p24),'7d':summarize(p7),'30d':summarize(rows)},by_manager:sort(Object.values(byManager)),by_model:sort(Object.values(byModel)),by_feature:sort(Object.values(byFeature)),by_plan:sort(Object.values(byPlan)),by_venue:sort(Object.values(byVenue)),recent:rows.slice(0,100).map(r=>Object.assign({},r,{manager_name:mm[r.manager_id]?.display_name||mm[r.manager_id]?.email||r.manager_id,venue_name:r.venue_id?vm[r.venue_id]?.name||r.venue_id:null,plan_name:r.plan_id?pm[r.plan_id]?.name||r.plan_id:null}))}));
 }catch(e){const status=Number(e?.status)||500;res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:e?.message||'ADMIN_AI_USAGE_FAILED'}));}
};
