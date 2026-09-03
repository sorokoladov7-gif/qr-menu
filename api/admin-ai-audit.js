'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_AUDIT_MODEL || 'gemini-3.7-flash';
const GITHUB_REPO = 'sorokoladov7-gif/qr-menu';
const GITHUB_BRANCH = 'main';
const MAX_FILES = 160;
const MAX_FILE_CHARS = 30000;
const MAX_CONTEXT_CHARS = 1000000;
const MAX_HISTORY = 16;

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
  for(const f of files){try{const d=await gh('/contents/'+f.path+'?ref='+encodeURIComponent(GITHUB_BRANCH));const text=d?.encoding==='base64'?Buffer.from(d.content||'','base64').toString('utf8'):String(d?.content||'');const part='===== FILE: '+f.path+' =====\n'+text.slice(0,MAX_FILE_CHARS);if(total+part.length>MAX_CONTEXT_CHARS)break;chunks.push(part);total+=part.length;}catch(e){chunks.push('===== FILE: '+f.path+' =====\n[UNREADABLE]');}}
  return {files:files.map(x=>x.path),context:chunks.join('\n\n')};
}
async function vercelSnapshot(){
  const token=process.env.VERCEL_TOKEN;if(!token)return '[Vercel data unavailable: VERCEL_TOKEN is not configured]';
  const project=process.env.VERCEL_PROJECT_ID||'prj_LGw7oYwZum4EsfmY3J0QiLDU4mzq';const team=process.env.VERCEL_TEAM_ID||'team_8QI087XOgioMrRulnW2TdDDF';
  try{const r=await fetch('https://api.vercel.com/v3/now/deployments?projectId='+encodeURIComponent(project)+'&teamId='+encodeURIComponent(team)+'&limit=8',{headers:{Authorization:'Bearer '+token}});return JSON.stringify(await r.json().catch(()=>({}))).slice(0,70000);}catch(e){return '[Vercel unavailable]';}
}
function historyText(history){return (Array.isArray(history)?history:[]).slice(-MAX_HISTORY).map(m=>{const role=m?.role==='assistant'?'assistant':'user';return role.toUpperCase()+': '+String(m?.content||'').slice(0,5000);}).join('\n');}
function prompt(context,logs,message,mode,history){return ['Ты — внутренний AI-инженер и полноценный технический помощник платформы QR Menu. Работаешь только для авторизованного администратора.','Отвечай как инженер-партнёр: веди диалог, помни последние сообщения в рамках переданной истории, связывай симптомы с реальным кодом и не ограничивайся общими советами.','Анализируй только факты из переданного проекта и диагностических данных. Не выдумывай файлы, функции, строки, логи или результаты тестов.','Если данных недостаточно — прямо укажи, чего не хватает и какой проверкой это установить.','Никогда не утверждай, что изменение выполнено, пока сервер действительно его не выполнил.','Никогда не раскрывай секреты, токены, пароли, service-role keys, API keys или персональные данные.','Не предлагай отключать авторизацию, RLS, CSP, rate limits или другие защитные механизмы ради исправления.','Для исправлений сначала сформируй предложение: конкретные файлы, операции, старое состояние и новое состояние. Удаление допускается только по явной команде администратора и с указанием зависимостей/риска.','Режим: '+clean(mode||'full',40),'История диалога:\n'+historyText(history),'Новый запрос администратора:\n'+String(message||'').slice(0,12000),'Верни JSON: {summary,answer,severity,root_cause,findings,actions,proposed_changes,confidence,safe_to_change}.','finding={severity,title,file,line_start,line_end,evidence,explanation,fix}.','proposed_changes=[{operation:"update"|"delete",file,expected_sha,reason,new_content}]. Если изменения не нужны — []. Для удаления new_content должен быть пустым. Никогда не включай секреты в new_content.','Код проекта:\n'+context,'Vercel:\n'+logs].join('\n\n');}
function validateChanges(changes){
  if(!Array.isArray(changes)||changes.length>20)throw new Error('INVALID_CHANGE_SET');
  return changes.map(c=>{const operation=c?.operation;const file=String(c?.file||'');if(!['update','delete'].includes(operation))throw new Error('INVALID_CHANGE_OPERATION');if(!/^[A-Za-z0-9._\-/]+$/.test(file)||file.includes('..'))throw new Error('INVALID_CHANGE_PATH');if(!c.expected_sha||typeof c.expected_sha!=='string')throw new Error('EXPECTED_SHA_REQUIRED');if(operation==='update'&&typeof c.new_content!=='string')throw new Error('NEW_CONTENT_REQUIRED');if(operation==='delete'&&file==='api/admin-ai-audit.js')throw new Error('SELF_DELETE_BLOCKED');return {operation,file,expected_sha:c.expected_sha,new_content:operation==='update'?c.new_content:''};});}
async function applyChanges(changes,admin){
  if(!process.env.GITHUB_TOKEN)throw Object.assign(new Error('GITHUB_TOKEN_NOT_CONFIGURED'),{status:503});
  const safe=validateChanges(changes);const results=[];
  for(const c of safe){
    if(c.operation==='update'){
      if(c.new_content.length>150000)throw new Error('FILE_TOO_LARGE');
      const r=await gh('/contents/'+c.file,{method:'PUT',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Admin Gemini fix: '+c.file,content:Buffer.from(c.new_content,'utf8').toString('base64'),sha:c.expected_sha,branch:GITHUB_BRANCH})});
      results.push({operation:'update',file:c.file,commit:r.commit?.sha||null});
    }else{
      const r=await gh('/contents/'+c.file,{method:'DELETE',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Admin Gemini delete: '+c.file,sha:c.expected_sha,branch:GITHUB_BRANCH})});
      results.push({operation:'delete',file:c.file,commit:r.commit?.sha||null});
    }
  }
  return {applied:true,admin:admin.email,changes:results};
}
async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const admin=await adminAuth(req);const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const action=clean(body.action||'audit',30);
    if(action==='apply'){const result=await applyChanges(body.changes,admin);return res.status(200).json({ok:true,...result});}
    const snap=await repoSnapshot();const logs=await vercelSnapshot();const result=await callGemini(prompt(snap.context,logs,body.message||'',body.mode||action,body.history||[]));
    return res.status(200).json({ok:true,admin:admin.email,model:GEMINI_MODEL,result,files_scanned:snap.files.length,scanned_files:snap.files});
  }catch(e){const status=Number(e?.status)||500;console.error('[admin-ai-audit]',e);return res.status(status).json({error:clean(e?.message||'AI_AUDIT_FAILED',300)});}
}
async function callGemini(promptText){
  if(!GEMINI_API_KEY)throw Object.assign(new Error('GEMINI_API_KEY_NOT_CONFIGURED'),{status:503});
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent',{method:'POST',headers:{'x-goog-api-key':GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:promptText}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:30000,thinkingConfig:{thinkingLevel:'low'}}})});
  const d=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(d?.error?.message||'GEMINI_HTTP_'+r.status),{status:r.status});
  const text=(d?.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');if(!text)throw Object.assign(new Error('AI_EMPTY_RESPONSE'),{status:502});
  try{return JSON.parse(text);}catch(_){return {answer:text};}
}
module.exports=handler;
