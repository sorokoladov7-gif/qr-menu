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
function err(message,status){return Object.assign(new Error(message),{status});}

async function adminAuth(req){
  const token=bearer(req);if(!token)throw err('AUTH_REQUIRED',401);
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});
  const u=await r.json().catch(()=>null);if(!r.ok||!u?.id)throw err('AUTH_INVALID',401);
  const p=await fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(u.id)+'&select=role&limit=1',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token,accept:'application/json'}});
  const rows=await p.json().catch(()=>[]);if(!p.ok||String(rows?.[0]?.role||'').toLowerCase()!=='admin')throw err('ADMIN_ONLY',403);
  return {id:u.id,email:u.email||''};
}

function githubHeaders(){const h={'User-Agent':'QR-Menu-Admin-Gemini','Accept':'application/vnd.github+json'};if(process.env.GITHUB_TOKEN)h.Authorization='Bearer '+process.env.GITHUB_TOKEN;return h;}
async function gh(path,opts){const r=await fetch('https://api.github.com/repos/'+GITHUB_REPO+path,Object.assign({headers:githubHeaders()},opts||{}));const b=await r.json().catch(()=>null);if(!r.ok)throw err(b?.message||'GITHUB_HTTP_'+r.status,r.status);return b;}
function shouldSkip(path){return /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|\.vercel)(\/|$)/.test(path)||/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|zip)$/i.test(path);}

async function repoSnapshot(){
  const tree=await gh('/git/trees/'+encodeURIComponent(GITHUB_BRANCH)+'?recursive=1');
  const files=(tree.tree||[]).filter(x=>x.type==='blob'&&!shouldSkip(x.path)&&/\.(js|mjs|cjs|ts|tsx|html|css|json|sql|md)$/i.test(x.path)).slice(0,MAX_FILES);
  const chunks=[];let total=0;
  for(const f of files){
    try{
      const raw='https://raw.githubusercontent.com/'+GITHUB_REPO+'/'+GITHUB_BRANCH+'/'+f.path.split('/').map(encodeURIComponent).join('/');
      const r=await fetch(raw,{headers:{'User-Agent':'QR-Menu-Admin-Gemini'}});if(!r.ok)throw new Error('RAW_HTTP_'+r.status);
      const text=await r.text();const part='===== FILE: '+f.path+' =====\n'+text.slice(0,MAX_FILE_CHARS);if(total+part.length>MAX_CONTEXT_CHARS)break;chunks.push(part);total+=part.length;
    }catch(e){chunks.push('===== FILE: '+f.path+' =====\n[UNREADABLE]');}
  }
  return {files:files.map(x=>x.path),context:chunks.join('\n\n')};
}

async function vercelSnapshot(){
  const token=process.env.VERCEL_TOKEN;if(!token)return {available:false,reason:'VERCEL_TOKEN_NOT_CONFIGURED'};
  try{
    const u='https://api.vercel.com/v6/deployments?projectId='+encodeURIComponent(VERCEL_PROJECT)+'&teamId='+encodeURIComponent(VERCEL_TEAM)+'&limit=8';
    const r=await fetch(u,{headers:{Authorization:'Bearer '+token}});const d=await r.json().catch(()=>({}));
    return {available:r.ok,deployments:d?.deployments||[],error:r.ok?'':clean(d?.error?.message||'VERCEL_HTTP_'+r.status,300)};
  }catch(e){return {available:false,error:clean(e?.message||'VERCEL_UNAVAILABLE',300)};}
}

function parseNdjson(text){return String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>{try{return JSON.parse(s);}catch(_){return null;}}).filter(Boolean);}
async function vercelRuntimeSnapshot(vercel){
  const token=process.env.VERCEL_TOKEN;if(!token)return {available:false,reason:'VERCEL_TOKEN_NOT_CONFIGURED'};
  const deployment=vercel?.deployments?.find(d=>d?.target==='production')||vercel?.deployments?.[0];
  if(!deployment?.id)return {available:false,reason:'NO_DEPLOYMENT_FOUND'};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const u='https://api.vercel.com/v3/deployments/'+encodeURIComponent(deployment.id)+'/events?teamId='+encodeURIComponent(VERCEL_TEAM)+'&limit=80';
    const r=await fetch(u,{headers:{Authorization:'Bearer '+token,Accept:'application/stream+json'},signal:controller.signal});
    const text=await r.text();if(!r.ok)return {available:false,deployment_id:deployment.id,error:clean(text||'VERCEL_EVENTS_HTTP_'+r.status,500)};
    return {available:true,deployment_id:deployment.id,deployment_url:deployment.url||'',events:parseNdjson(text).slice(-80)};
  }catch(e){return {available:false,deployment_id:deployment.id,error:clean(e?.name==='AbortError'?'VERCEL_EVENTS_TIMEOUT':e?.message||'VERCEL_EVENTS_UNAVAILABLE',300)};}
  finally{clearTimeout(timer);}
}

function extractDbResult(d){if(Array.isArray(d))return d;if(Array.isArray(d?.result))return d.result.length===1&&d.result[0]?.snapshot!==undefined?d.result[0].snapshot:d.result;if(Array.isArray(d?.data))return d.data;if(d?.snapshot!==undefined)return d.snapshot;return d;}
async function supabaseManagementQuery(query,readOnly){
  if(!SUPABASE_MANAGEMENT_API_TOKEN)throw err('SUPABASE_MANAGEMENT_API_TOKEN_NOT_CONFIGURED',503);
  const endpoint=readOnly?'/database/query/read-only':'/database/query';
  const r=await fetch('https://api.supabase.com/v1/projects/'+encodeURIComponent(SUPABASE_PROJECT_REF)+endpoint,{method:'POST',headers:{Authorization:'Bearer '+SUPABASE_MANAGEMENT_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:String(query||''),read_only:!!readOnly})});
  const d=await r.json().catch(()=>null);if(!r.ok)throw err(d?.message||d?.error||'SUPABASE_MANAGEMENT_HTTP_'+r.status,r.status);return d;
}
async function supabaseSnapshot(){
  if(SUPABASE_MANAGEMENT_API_TOKEN){
    try{
      const q="select jsonb_build_object('schemas',(select coalesce(jsonb_agg(jsonb_build_object('schema',nspname) order by nspname),'[]'::jsonb) from pg_namespace where nspname not in ('pg_catalog','information_schema') and nspname !~ '^pg_temp'),'tables',(select coalesce(jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name) order by table_schema,table_name),'[]'::jsonb) from information_schema.tables where table_schema not in ('pg_catalog','information_schema') and table_type='BASE TABLE'),'columns',(select coalesce(jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable) order by table_schema,table_name,ordinal_position),'[]'::jsonb) from information_schema.columns where table_schema not in ('pg_catalog','information_schema')),'policies',(select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'policy',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check) order by schemaname,tablename,policyname),'[]'::jsonb) from pg_policies where schemaname not in ('pg_catalog','information_schema')),'functions',(select coalesce(jsonb_agg(jsonb_build_object('schema',routine_schema,'name',routine_name,'type',routine_type,'return',data_type) order by routine_schema,routine_name),'[]'::jsonb) from information_schema.routines where routine_schema not in ('pg_catalog','information_schema'))) as snapshot;";
      const d=await supabaseManagementQuery(q,true);return {available:true,source:'management_api',snapshot:extractDbResult(d)};
    }catch(e){return {available:false,error:clean(e?.message||'SUPABASE_DB_SNAPSHOT_FAILED',500)};}
  }
  if(!SUPABASE_SERVICE_ROLE_KEY)return {available:false,reason:'SUPABASE_MANAGEMENT_API_TOKEN_NOT_CONFIGURED'};
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/',{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,accept:'application/openapi+json'}});const d=await r.json().catch(()=>null);if(!r.ok)return {available:false,error:'SUPABASE_HTTP_'+r.status};
    return {available:true,source:'postgrest_openapi',tables:Object.keys(d?.definitions||{}).slice(0,500)};
  }catch(e){return {available:false,error:clean(e?.message||'SUPABASE_UNAVAILABLE',300)};}
}

function validateDatabaseChanges(changes){
  if(!Array.isArray(changes)||changes.length>MAX_DB_CHANGES)throw err('INVALID_DATABASE_CHANGE_SET',400);
  return changes.map(c=>{
    const sql=String(c?.sql||'').trim();if(!sql||sql.length>MAX_DB_SQL_CHARS)throw err('INVALID_DATABASE_SQL',400);
    const n=sql.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--[^\n]*/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    if(/\b(drop\s+database|drop\s+role|alter\s+role|create\s+role|grant\s+all\s+privileges)\b/.test(n))throw err('DATABASE_PRIVILEGE_CHANGE_BLOCKED',403);
    if(/\b(copy\s+[^;]*\bprogram|pg_read_file|pg_read_binary_file|lo_import|dblink_connect)\b/.test(n))throw err('DATABASE_DANGEROUS_OPERATION_BLOCKED',403);
    if(/\b(create|alter|drop)\s+extension\b/.test(n))throw err('DATABASE_EXTENSION_CHANGE_BLOCKED',403);
    return {sql,reason:clean(c?.reason||'',600),risk:clean(c?.risk||'unknown',80)};
  });
}
async function applyDatabaseChanges(changes,admin){const safe=validateDatabaseChanges(changes),results=[];for(const c of safe){const d=await supabaseManagementQuery(c.sql,false);results.push({sql:c.sql,reason:c.reason,risk:c.risk,result:extractDbResult(d)});}return {applied:true,admin:admin.email,changes:results};}

function validateChanges(changes){
  if(!Array.isArray(changes)||changes.length>MAX_CHANGES)throw err('INVALID_CHANGE_SET',400);
  return changes.map(c=>{
    const operation=c?.operation,file=String(c?.file||'');if(!['update','delete'].includes(operation))throw err('INVALID_CHANGE_OPERATION',400);
    if(!/^[A-Za-z0-9._\-/]+$/.test(file)||file.includes('..')||file.startsWith('/'))throw err('INVALID_CHANGE_PATH',400);
    if(!c.expected_sha||typeof c.expected_sha!=='string')throw err('EXPECTED_SHA_REQUIRED',400);
    if(operation==='update'&&(typeof c.new_content!=='string'||c.new_content.length>160000))throw err('NEW_CONTENT_REQUIRED',400);
    return {operation,file,expected_sha:c.expected_sha,new_content:operation==='update'?c.new_content:''};
  });
}
async function applyChanges(changes,admin){
  if(!process.env.GITHUB_TOKEN)throw err('GITHUB_TOKEN_NOT_CONFIGURED',503);const safe=validateChanges(changes),results=[];
  for(const c of safe){const current=await gh('/contents/'+encodeURIComponent(c.file)+'?ref='+encodeURIComponent(GITHUB_BRANCH));if(String(current?.sha||'')!==c.expected_sha)throw err('STALE_FILE:'+c.file,409);
    if(c.operation==='update'){
      const r=await gh('/contents/'+encodeURIComponent(c.file),{method:'PUT',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Gemini confirmed fix: '+c.file,content:Buffer.from(c.new_content,'utf8').toString('base64'),sha:c.expected_sha,branch:GITHUB_BRANCH})});results.push({operation:'update',file:c.file,commit:r.commit?.sha||null});
    }else{
      const r=await gh('/contents/'+encodeURIComponent(c.file),{method:'DELETE',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Gemini confirmed delete: '+c.file,sha:c.expected_sha,branch:GITHUB_BRANCH})});results.push({operation:'delete',file:c.file,commit:r.commit?.sha||null});
    }
  }
  return {applied:true,admin:admin.email,changes:results};
}

async function callGemini(promptText){
  if(!GEMINI_API_KEY)throw err('GEMINI_API_KEY_NOT_CONFIGURED',503);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
  try{
    const payload={contents:[{role:'user',parts:[{text:promptText}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:30000,thinkingConfig:{thinkingLevel:'low'}}};
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent',{method:'POST',signal:controller.signal,headers:{'x-goog-api-key':GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>null);if(!r.ok)throw err(d?.error?.message||'GEMINI_HTTP_'+r.status,r.status);
    const text=(d?.candidates?.[0]?.content?.parts||[]).map(x=>x?.text||'').join('');if(!text)throw err('AI_EMPTY_RESPONSE',502);try{return JSON.parse(text);}catch(_){return {answer:text};}
  }catch(e){if(e?.name==='AbortError')throw err('GEMINI_TIMEOUT',504);throw e;}finally{clearTimeout(timer);}
}

function buildPrompt(s,message,mode,history){return [
  'Ты — внутренний инженерный AI-ассистент платформы QR Menu.',
  'Работай только после авторизации администратора.',
  'Анализируй переданные факты из GitHub, Vercel и Supabase.',
  'Для GitHub разрешены только изменения существующих файлов через подтверждение администратора.',
  'Для Supabase разрешено готовить SQL, но выполнение происходит только отдельным подтверждением администратора.',
  'Не создавай новые файлы. Не удаляй файлы без явного указания администратора.',
  'Никогда не раскрывай токены, ключи, пароли и service-role секреты.',
  'Не отключай auth, RLS, CSP или rate limits ради исправления.',
  'Проверяй дубли реализаций, JS SyntaxError, API/RPC контракты, RLS, импорт PDF/фото/сайта и Vercel runtime.',
  'Не выдумывай файлы, строки, таблицы, колонки, функции или результаты тестов.',
  'Режим: '+clean(mode||'full',30),
  'История:\n'+(Array.isArray(history)?history.slice(-16):[]).map(m=>String(m?.role||'user').toUpperCase()+': '+String(m?.content||'').slice(0,5000)).join('\n'),
  'Запрос администратора:\n'+String(message||'').slice(0,12000),
  'Верни JSON: {summary,answer,severity,root_cause,findings,actions,files,confidence,safe_to_change,proposed_changes,database_changes}.',
  'finding={severity,title,file,line_start,line_end,evidence,explanation,fix}.',
  'proposed_changes=[{operation:"update"|"delete",file,expected_sha,reason,new_content}].',
  'database_changes=[{sql,reason,risk}].',
  'GITHUB SNAPSHOT:\n'+JSON.stringify(s.git),
  'VERCEL DEPLOYMENTS:\n'+JSON.stringify(s.vercel),
  'VERCEL RUNTIME:\n'+JSON.stringify(s.runtime),
  'SUPABASE:\n'+JSON.stringify(s.supabase),
  'КОД:\n'+s.context
].join('\n\n');
}

async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const admin=await adminAuth(req),body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}),action=clean(body.action||'audit',30);
    if(action==='apply')return res.status(200).json(await applyChanges(body.changes,admin));
    if(action==='apply_db')return res.status(200).json(await applyDatabaseChanges(body.database_changes,admin));
    if(action!=='audit')return res.status(400).json({error:'UNKNOWN_ACTION'});
    const git=await repoSnapshot(),vercel=await vercelSnapshot(),runtime=await vercelRuntimeSnapshot(vercel),supabase=await supabaseSnapshot();
    const result=await callGemini(buildPrompt({git,vercel,runtime,supabase,context:git.context},body.message||'',body.mode||'full',body.history||[]));
    return res.status(200).json({ok:true,admin:admin.email,model:GEMINI_MODEL,result,files_scanned:git.files.length,scanned_files:git.files,capabilities:{github_read:true,github_write:!!process.env.GITHUB_TOKEN,vercel_read:!!process.env.VERCEL_TOKEN,vercel_runtime_read:runtime.available===true,supabase_schema_read:!!(SUPABASE_MANAGEMENT_API_TOKEN||SUPABASE_SERVICE_ROLE_KEY),supabase_database_read:!!SUPABASE_MANAGEMENT_API_TOKEN,supabase_database_write:!!SUPABASE_MANAGEMENT_API_TOKEN}});
  }catch(e){const status=Number(e?.status)||500;console.error('[admin-ai-audit]',e);return res.status(status).json({error:clean(e?.message||'AI_AUDIT_FAILED',500)});}
}

module.exports=handler;
