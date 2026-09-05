'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MANAGER_MODEL || 'gemini-3.8-flash';

function bearer(req){
  const h=String(req.headers?.authorization||req.headers?.Authorization||'');
  const m=h.match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():'';
}
function httpError(message,status){return Object.assign(new Error(message),{status});}
async function supabaseGet(path,token,privileged){
  const key=privileged&&SUPABASE_SERVICE_ROLE_KEY?SUPABASE_SERVICE_ROLE_KEY:SUPABASE_ANON_KEY;
  const auth=privileged&&SUPABASE_SERVICE_ROLE_KEY?SUPABASE_SERVICE_ROLE_KEY:token;
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:key,authorization:'Bearer '+auth,accept:'application/json'}});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw httpError(data?.message||'SUPABASE_HTTP_'+r.status,r.status);
  return data;
}
async function authManager(req){
  const token=bearer(req);
  if(!token)throw httpError('AUTH_REQUIRED',401);
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});
  const user=await r.json().catch(()=>null);
  if(!r.ok||!user?.id)throw httpError('AUTH_INVALID',401);
  const profiles=await supabaseGet('profiles?id=eq.'+encodeURIComponent(user.id)+'&select=id,role,display_name,email&limit=1',token);
  const profile=profiles?.[0];
  if(!profile||String(profile.role).toLowerCase()!=='manager')throw httpError('MANAGER_ONLY',403);
  return {token,user,profile};
}
async function entitlement(ctx){
  const subs=await supabaseGet('subscriptions?manager_id=eq.'+encodeURIComponent(ctx.user.id)+'&venue_id=is.null&status=in.(trialing,active)&current_period_end=gte.'+encodeURIComponent(new Date().toISOString())+'&select=id,plan_id,status,current_period_end&order=created_at.desc&limit=1',ctx.token,true);
  const sub=subs?.[0];
  if(!sub)throw httpError('AI_SUBSCRIPTION_REQUIRED',403);
  const plans=await supabaseGet('plans?id=eq.'+encodeURIComponent(sub.plan_id)+'&is_active=eq.true&select=id,name,ai_enabled&limit=1',ctx.token,true);
  const plan=plans?.[0];
  if(!plan||plan.ai_enabled!==true)throw httpError('AI_NOT_INCLUDED_IN_PLAN',403);
  return {subscription:sub,plan};
}
async function callGemini(message,context){
  if(!GEMINI_API_KEY)throw httpError('AI_PROVIDER_NOT_CONFIGURED',503);
  const prompt=[
    'Ты ИИ-помощник платформы QR Menu для управляющего заведения.',
    'Отвечай на русском языке, конкретно и по делу.',
    'Помогай с меню, заказами, настройками, аналитикой, рецептами, персоналом и использованием платформы.',
    'Не выдавай себя за администратора. Не утверждай, что изменил БД или код, если это не было реально выполнено.',
    context ? 'Контекст подписки: '+context : '',
    'Сообщение управляющего: '+message
  ].filter(Boolean).join('\n\n');
  const body={contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:1600}};
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(GEMINI_MODEL)+':generateContent?key='+encodeURIComponent(GEMINI_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw httpError(data?.error?.message||'GEMINI_HTTP_'+r.status,r.status>=500?502:r.status);
  const text=(data?.candidates||[]).flatMap(c=>c?.content?.parts||[]).map(p=>p?.text||'').join('').trim();
  if(!text)throw httpError('AI_EMPTY_RESPONSE',502);
  return text;
}

module.exports=async function(req,res){
  if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');return res.end(JSON.stringify({error:'METHOD_NOT_ALLOWED'}));}
  try{
    const ctx=await authManager(req);
    const ent=await entitlement(ctx);
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const message=String(body.message||'').trim().slice(0,8000);
    if(!message)throw httpError('MESSAGE_REQUIRED',400);
    if(message==='__entitlement_check__'){
      res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.end(JSON.stringify({ok:true,answer:'',plan:ent.plan.name,ai_enabled:true,subscription_status:ent.subscription.status,subscription_end:ent.subscription.current_period_end}));
    }
    const answer=await callGemini(message,'Тариф: '+ent.plan.name+'. AI включён. Статус подписки: '+ent.subscription.status+'. До: '+ent.subscription.current_period_end+'.');
    res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.end(JSON.stringify({ok:true,answer,plan:ent.plan.name,ai_enabled:true,subscription_status:ent.subscription.status,subscription_end:ent.subscription.current_period_end}));
  }catch(e){
    const status=Number(e?.status)||500;
    res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.end(JSON.stringify({ok:false,error:e?.message||'MANAGER_AI_FAILED'}));
  }
};
