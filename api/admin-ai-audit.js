'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_MANAGEMENT_API_TOKEN = process.env.SUPABASE_MANAGEMENT_API_TOKEN || process.env.SUPABASE_ACCESS_TOKEN || '';
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ulxfsozdryqrnlxzlblt';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_AUDIT_MODEL || 'gemini-3.7-flash';
const GITHUB_REPO = 'sorokoladov7-gif/qr-menu';
const GITHUB_BRANCH = 'main';
const VERCEL_PROJECT = process.env.VERCEL_PROJECT_ID || 'prj_LGw7oYwZum4EsfmY3J0QiLDU4mzq';
const VERCEL_TEAM = process.env.VERCEL_TEAM_ID || 'team_8QI087XOgioMrRulnW2TdDDF';
const MAX_FILES = 140;
const MAX_FILE_CHARS = 32000;
const MAX_CONTEXT_CHARS = 1000000;
const MAX_CHANGES = 20;
const MAX_DB_CHANGES = 10;
const MAX_DB_SQL_CHARS = 60000;

function clean(v,n=500){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);}
function bearer(req){const h=String(req.headers?.authorization||req.headers?.Authorization||'');const m=h.match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function adminAuth(req){
  const token=bearer(req);if(!token)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});
  const u=await r.json().catch(()=>null);if(!r.ok||!u?.id)throw Object.assign(new Error('AUTH_INVALID'),{status:401});
  const p=await fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(u.id)+'&select=role&limit=1',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token,accept:'application/json'}});
  const rows=await p.json().catch(()=>[]);const role=String(rows?.[0]?.role||'').toLowerCase();
  if(!p.ok||role!=='admin')throw Object.assign(new Error('ADMIN_ONLY'),{status:403});
  return {id:u.id,email:u.email||''};
}
function githubHeaders(){const h={'User-Agent':'QR-Menu-Admin-Gemini','Accept':'application/vnd.github+json'};if(process.env.GITHUB_TOKEN)h.Authorization='Bearer '+process.env.GITHUB_TOKEN;return h;}
async function gh(path,opts){const r=await fetch('https://api.github.com/repos/'+GITHUB_REPO+path,Object.assign({headers:githubHeaders()},opts||{}));const b=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(b?.message||'GITHUB_HTTP_'+r.status),{status:r.status});return b;}
function shouldSkip(path){return /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|\.vercel)(\/|$)/.test(path)||/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|zip)$/i.test(path);}
async function repoSnapshot(){
  const tree=await gh('/git/trees/'+encodeURIComponent(GITHUB_BRANCH)+'?recursive=1');
  const files=(tree.tree||[]).filter(x=>x.type==='blob'&&!shouldSkip(x.path)&&/\.(js|mjs|cjs|ts|tsx|html|css|json|sql|md)$/i.test(x.path)).slice(0,MAX_FILES);
  const chunks=[];let total=0;
  for(const f of files){
    try{
      const rawUrl='https://raw.githubusercontent.com/'+GITHUB_REPO+'/'+encodeURIComponent(GITHUB_BRANCH)+'/'+f.path.split('/').map(encodeURIComponent).join('/');
      const r=await fetch(rawUrl,{headers:{'User-Agent':'QR-Menu-Admin-Gemini'}});if(!r.ok)throw new Error('RAW_HTTP_'+r.status);
      const text=await r.text();const part='===== FILE: '+f.path+' =====\n'+text.slice(0,MAX_FILE_CHARS);if(total+part.length>MAX_CONTEXT_CHARS)break;chunks.push(part);total+=part.length;
    }catch(e){chunks.push('===== FILE: '+f.path+' =====\n[UNREADABLE]');}
  }
  return {files:files.map(x=>x.path),context:chunks.join('\n\n')};
}
async function vercelSnapshot(){
  const token=process.env.VERCEL_TOKEN;if(!token)return {available:false,reason:'VERCEL_TOKEN_NOT_CONFIGURED'};
  try{
    const r=await fetch('https://api.vercel.com/v3/now/deployments?projectId='+encodeURIComponent(VERCEL_PROJECT)+'&teamId='+encodeURIComponent(VERCEL_TEAM)+'&limit=8',{headers:{Authorization:'Bearer '+token}});
    const d=await r.json().catch(()=>({}));
    return {available:r.ok,deployments:d?.deployments||[],error:r.ok?'':clean(d?.error?.message||'VERCEL_HTTP_'+r.status,300)};
  }catch(e){return {available:false,error:clean(e?.message||'VERCEL_UNAVAILABLE',300)};}
}
async function vercelRuntimeSnapshot(){
  const token=process.env.VERCEL_TOKEN;if(!token)return {available:false};
  try{
    const qs='projectId='+encodeURIComponent(VERCEL_PROJECT)+'&teamId='+encodeURIComponent(VERCEL_TEAM)+'&environment=production&limit=60';
    const r=await fetch('https://api.vercel.com/v2/deployments/events?'+qs,{headers:{Authorization:'Bearer '+token}});
    const d=await r.json().catch(()=>null);
    return {available:r.ok,events:Array.isArray(d)?d.slice(-60):[],error:r.ok?'':clean(d?.error?.message||'VERCEL_EVENTS_HTTP_'+r.status,300)};
  }catch(e){return {available:false,error:clean(e?.message||'VERCEL_EVENTS_UNAVAILABLE',300)};}
}
async function supabaseSnapshot(){
  if(SUPABASE_MANAGEMENT_API_TOKEN){
    try{
      const sql="select jsonb_build_object(\n        'schemas',(select coalesce(jsonb_agg(jsonb_build_object('schema',nspname) order by nspname),'[]'::jsonb) from pg_namespace where nspname not in ('pg_catalog','information_schema') and nspname !~ '^pg_temp'),\n        'tables',(select coalesce(jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name) order by table_schema,table_name),'[]'::jsonb) from information_schema.tables where table_schema not in ('pg_catalog','information_schema') and table_type='BASE TABLE'),\n        'columns',(select coalesce(jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable) order by table_schema,table_name,ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema not in ('pg_catalog','information_schema')),'policies',(select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'policy',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check) order by schemaname,tablename,policyname),'[]'::jsonb) from pg_policies where schemaname not in ('pg_catalog','information_schema')),'functions',(select coalesce(jsonb_agg(jsonb_build_object('schema',routine_schema,'name',routine_name,'type',routine_type,'return',data_type) order by routine_schema,routine_name),'[]'::jsonb) from information_schema.routines where routine_schema not in ('pg_catalog','information_schema'))\n      ) as snapshot;";
      const d=await supabaseManagementQuery(sql,true);
      return {available:true,source:'management_api',snapshot:extractDbResult(d)};
    }catch(e){return {available:false,error:clean(e?.message||'SUPABASE_DB_SNAPSHOT_FAILED',500)};}
  }
  if(!SUPABASE_SERVICE_ROLE_KEY)return {available:false,reason:'SUPABASE_MANAGEMENT_API_TOKEN_NOT_CONFIGURED'};
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/',{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,accept:'application/openapi+json'}});
    const d=await r.json().catch(()=>null);
    if(!r.ok)return {available:false,error:'SUPABASE_HTTP_'+r.status};
    const defs=d?.definitions||{};const tables=Object.keys(defs).slice(0,500);
    return {available:true,source:'postgrest_openapi',tables};
  }catch(e){return {available:false,error:clean(e?.message||'SUPABASE_UNAVAILABLE',300)};}
}
function extractDbResult(d){
  if(Array.isArray(d))return d;
  if(Array.isArray(d?.result))return d.result.length===1&&d.result[0]?.snapshot!==undefined?d.result[0].snapshot:d.result;
  if(Array.isArray(d?.data))return d.data;
  if(d?.snapshot!==undefined)return d.snapshot;
  return d;
}
async function supabaseManagementQuery(query,readOnly){
  if(!SUPABASE_MANAGEMENT_API_TOKEN)throw Object.assign(new Error('SUPABASE_MANAGEMENT_API_TOKEN_NOT_CONFIGURED'),{status:503});
  const endpoint=readOnly?'/database/query/read-only':'/database/query';
  const r=await fetch('https://api.supabase.com/v1/projects/'+encodeURIComponent(SUPABASE_PROJECT_REF)+endpoint,{method:'POST',headers:{Authorization:'Bearer '+SUPABASE_MANAGEMENT_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:String(query||''),read_only:!!readOnly})});
  const d=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(d?.message||d?.error||'SUPABASE_MANAGEMENT_HTTP_'+r.status),{status:r.status});return d;
}
function validateDatabaseChanges(changes){
  if(!Array.isArray(changes)||changes.length>MAX_DB_CHANGES)throw Object.assign(new Error('INVALID_DATABASE_CHANGE_SET'),{status:400});
  return changes.map(c=>{
    const sql=String(c?.sql||'').trim();if(!sql||sql.length>MAX_DB_SQL_CHARS)throw Object.assign(new Error('INVALID_DATABASE_SQL'),{status:400});
    const normalized=sql.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--[^\n]*/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    if(/\b(drop\s+database|drop\s+role|alter\s+role|create\s+role|grant\s+all\s+privileges)\b/.test(normalized))throw Object.assign(new Error('DATABASE_PRIVILEGE_CHANGE_BLOCKED'),{status:403});
    if(/\b(copy\s+[^;]*\bprogram|pg_read_file|pg_read_binary_file|lo_import|dblink_connect)\b/.test(normalized))throw Object.assign(new Error('DATABASE_DANGEROUS_OPERATION_BLOCKED'),{status:403});
    if(/\b(create|alter|drop)\s+extension\b/.test(normalized))throw Object.assign(new Error('DATABASE_EXTENSION_CHANGE_BLOCKED'),{status:403});
    return {sql,reason:clean(c?.reason||'',600),risk:clean(c?.risk||'unknown',80)};
  });
}
async function applyDatabaseChanges(changes,admin){
  const safe=validateDatabaseChanges(changes);const results=[];
  for(const c of safe){
    const d=await supabaseManagementQuery(c.sql,false);
    results.push({sql:c.sql,reason:c.reason,risk:c.risk,result:extractDbResult(d)});
  }
  return {applied:true,admin:admin.email,changes:results};
}
async function callGemini(promptText){
  if(!GEMINI_API_KEY)throw Object.assign(new Error('GEMINI_API_KEY_NOT_CONFIGURED'),{status:503});
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),55000);
  try{
    const payload={contents:[{role:'user',parts:[{text:promptText}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:30000,thinkingConfig:{thinkingLevel:'low'}}};
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent',{method:'POST',signal:controller.signal,headers:{'x-goog-api-key':GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(d?.error?.message||'GEMINI_HTTP_'+r.status),{status:r.status});
    const text=(d?.candidates?.[0]?.content?.parts||[]).map(x=>x?.text||'').join('');if(!text)throw Object.assign(new Error('AI_EMPTY_RESPONSE'),{status:502});
    try{return JSON.parse(text);}catch(_){return {answer:text};}
  }catch(e){if(e?.name==='AbortError')throw Object.assign(new Error('GEMINI_TIMEOUT'),{status:504});throw e;}finally{clearTimeout(timer);}
}
function prompt(context,git,vercel,runtime,supabase,message,mode,history){return [
  'Ты — внутренний инженерный AI-ассистент платформы QR Menu.',
  'Ты работаешь только после авторизации администратора.',
  'Тебе разрешено анализировать реальный код проекта, GitHub, Vercel и доступную схему Supabase.',
  'Для GitHub разрешено готовить и применять изменения существующих файлов через подтверждённый механизм applyChanges.',
  'Для Supabase разрешено анализировать схему и готовить SQL-изменения. SQL выполняется только через отдельное явное подтверждение администратора.',
  'Не создавай новые файлы. Не удаляй файлы без явного указания администратора.',
  'Никогда не раскрывай токены, API keys, service-role keys, пароли или другие секреты.',
  'Не отключай авторизацию, RLS, CSP, rate limits или другие защитные механизмы ради исправления.',
  'Проверяй конфликты старой/новой реализации, дубли скриптов, JS SyntaxError, API-контракты, RLS/RPC, импорт PDF/фото/сайта и Vercel runtime.',
  'При работе с БД опирайся только на переданную схему и реальные результаты SQL. Не выдумывай таблицы, колонки, функции или policies.',
  'Работай с фактами из переданного проекта. Не выдумывай строки, файлы и результаты тестов.',
  'Режим: '+clean(mode||'full',30),
  'История:\n'+(Array.isArray(history)?history.slice(-16):[]).map(m=>String(m?.role||'user').toUpperCase()+': '+String(m?.content||'').slice(0,5000)).join('\n'),
  'Запрос администратора:\n'+String(message||'').slice(0,12000),
  'Верни JSON: {summary,answer,severity,root_cause,findings,actions,files,confidence,safe_to_change,proposed_changes,database_changes}.',
  'finding={severity,title,file,line_start,line_end,evidence,explanation,fix}.',
  'proposed_changes=[{operation:"update"|"delete",file,expected_sha,reason,new_content}]. expected_sha обязателен и должен соответствовать текущему GitHub blob. Для удаления new_content="".',
  'database_changes=[{sql,reason,risk}]. Предлагай SQL только когда изменение действительно нужно. Не используй destructive privilege operations, extension changes или доступ к секретам.',
  'Не добавляй изменения, которые не нужны для исправления. Не меняй секреты.',
  'GITHUB SNAPSHOT:\n'+JSON.stringify(git),
  'VERCEL DEPLOYMENTS:\n'+JSON.stringify(vercel),
  'VERCEL RUNTIME:\n'+JSON.stringify(runtime),
  'SUPABASE DATABASE SNAPSHOT:\n'+JSON.stringify(supabase),
  'КОД ПРОЕКТА:\n'+context
].join('\n\n');}
function validateChanges(changes){
  if(!Array.isArray(changes)||changes.length>MAX_CHANGES)throw Object.assign(new Error('INVALID_CHANGE_SET'),{status:400});
  return changes.map(c=>{
    const operation=c?.operation,file=String(c?.file||'');
    if(!['update','delete'].includes(operation))throw Object.assign(new Error('INVALID_CHANGE_OPERATION'),{status:400});
    if(!/^[A-Za-z0-9._\-/]+$/.test(file)||file.includes('..')||file.startsWith('/'))throw Object.assign(new Error('INVALID_CHANGE_PATH'),{status:400});
    if(!c.expected_sha||typeof c.expected_sha!=='string')throw Object.assign(new Error('EXPECTED_SHA_REQUIRED'),{status:400});
    if(operation==='update'&&(typeof c.new_content!=='string'||c.new_content.length>160000))throw Object.assign(new Error('NEW_CONTENT_REQUIRED'),{status:400});
    return {operation,file,expected_sha:c.expected_sha,new_content:operation==='update'?c.new_content:''};
  });
}
async function applyChanges(changes,admin){
  if(!process.env.GITHUB_TOKEN)throw Object.assign(new Error('GITHUB_TOKEN_NOT_CONFIGURED'),{status:503});
  const safe=validateChanges(changes),results=[];
  for(const c of safe){
    const current=await gh('/contents/'+encodeURIComponent(c.file)+'?ref='+encodeURIComponent(GITHUB_BRANCH));
    if(String(current?.sha||'')!==c.expected_sha)throw Object.assign(new Error('STALE_FILE:'+c.file),{status:409});
    if(c.operation==='update'){
      const r=await gh('/contents/'+encodeURIComponent(c.file),{method:'PUT',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Gemini confirmed fix: '+c.file,content:Buffer.from(c.new_content,'utf8').toString('base64'),sha:c.expected_sha,branch:GITHUB_BRANCH})});
      results.push({operation:'update',file:c.file,commit:r.commit?.sha||null});
    }else{
      const r=await gh('/contents/'+encodeURIComponent(c.file),{method:'DELETE',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Gemini confirmed delete: '+c.file,sha:c.expected_sha,branch:GITHUB_BRANCH})});
      results.push({operation:'delete',file:c.file,commit:r.commit?.sha||null});
    }
  }
  return {applied:true,admin:admin.email,changes:results};
}
async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const admin=await adminAuth(req);const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const action=clean(body.action||'audit',30);
    if(action==='apply'){
      const result=await applyChanges(body.changes,admin);
      return res.status(200).json(result);
    }
    if(action==='apply_db'){
      const result=await applyDatabaseChanges(body.database_changes,admin);
      return res.status(200).json(result);
    }
    if(action==='db_probe'){
      const snap=await supabaseSnapshot();
      return res.status(200).json({ok:true,admin:admin.email,database:snap,capabilities:{supabase_database_read:!!SUPABASE_MANAGEMENT_API_TOKEN,supabase_database_write:!!SUPABASE_MANAGEMENT_API_TOKEN}});
    }
    if(action!=='audit')return res.status(400).json({error:'UNKNOWN_ACTION'});
    const snap=await repoSnapshot();
    const vercel=await vercelSnapshot();
    const runtime=await vercelRuntimeSnapshot();
    const supabase=await supabaseSnapshot();
    const result=await callGemini(prompt(snap.context,snap.files,vercel,runtime,supabase,body.message||'',body.mode||'full',body.history||[]));
    return res.status(200).json({ok:true,admin:admin.email,model:GEMINI_MODEL,result,files_scanned:snap.files.length,scanned_files:snap.files,capabilities:{github_read:true,github_write:!!process.env.GITHUB_TOKEN,vercel_read:!!process.env.VERCEL_TOKEN,supabase_schema_read:!!SUPABASE_SERVICE_ROLE_KEY||!!SUPABASE_MANAGEMENT_API_TOKEN,supabase_database_read:!!SUPABASE_MANAGEMENT_API_TOKEN,supabase_database_write:!!SUPABASE_MANAGEMENT_API_TOKEN}});
  }catch(e){
    const status=Number(e?.status)||500;console.error('[admin-ai-audit]',e);return res.status(status).json({error:clean(e?.message||'AI_AUDIT_FAILED',300)});
  }
}
module.exports=handler;
