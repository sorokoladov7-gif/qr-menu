'use strict';

/* Qrchick lifecycle adapter.
   Agent intelligence stays in api/admin-ai-agent.js.
   Mutations stay behind api/admin-ai-audit.js approval checks. */
const agent=require('./admin-ai-agent');

function capture(){const state={status:200,headers:{},body:null};return{setHeader(k,v){state.headers[k]=v},status(c){state.status=c;return this},json(b){state.body=b;return this},end(b){if(b!==undefined){try{state.body=JSON.parse(b)}catch(_){state.body=b}}return this},_state:state}}

function timeline(toolCalls){
  const calls=Array.isArray(toolCalls)?toolCalls:[];
  const labels={github_tree:'Сканирование проекта',github_search:'Поиск по коду',github_read_file:'Чтение файла',supabase_schema:'Проверка схемы Supabase',supabase_query:'Проверка данных Supabase',vercel_deployments:'Проверка Vercel',vercel_runtime:'Анализ runtime Vercel'};
  const icons={github_tree:'⌘',github_search:'⌕',github_read_file:'▤',supabase_schema:'◈',supabase_query:'◇',vercel_deployments:'▲',vercel_runtime:'◉'};
  if(!calls.length)return '### Qrchick · выполнение\n\n`✦` Анализ и рассуждение завершены.\n\nИзменения не применяются автоматически.';
  const rows=calls.map((c,i)=>{const name=String(c&&c.name||'agent_step'),args=c&&c.arguments||{};let detail='инструмент выполнен';if(name==='github_read_file'&&args.path)detail='`'+String(args.path).slice(0,100)+'`';else if(name==='github_search'&&args.query)detail='запрос: `'+String(args.query).slice(0,100)+'`';else if(name==='supabase_query')detail='read-only SQL';else if(name==='vercel_runtime'&&args.deployment_id)detail='deployment `'+String(args.deployment_id).slice(0,18)+'`';const sec=Number(c&&c.duration_ms||0);return(i+1)+'. **'+(icons[name]||'✓')+' '+(labels[name]||name)+'** — '+detail+(sec?' · '+(sec/1000).toFixed(1)+' с':'')});
  return '### Qrchick · выполнение задачи\n\n'+rows.join('\n')+'\n\n**✓ Исследование завершено.** Изменения кода и Production SQL остаются на подтверждении администратора.';
}

function normalizePlan(result){
  const r=result||{};
  return{diagnosis:{summary:r.summary||'',root_cause:r.root_cause||'',severity:r.severity||'info',confidence:r.confidence||0,findings:Array.isArray(r.findings)?r.findings:[]},plan:{actions:Array.isArray(r.actions)?r.actions:[],files:Array.isArray(r.files)?r.files:[],proposed_changes:Array.isArray(r.proposed_changes)?r.proposed_changes:[],database_changes:Array.isArray(r.database_changes)?r.database_changes:[],safe_to_change:!!r.safe_to_change},approval:{required:true,code_changes:Array.isArray(r.proposed_changes)&&r.proposed_changes.length>0,database_changes:Array.isArray(r.database_changes)&&r.database_changes.length>0},verification:{required:true,checks:['повторно прочитать изменённые файлы и проверить ожидаемый SHA','проверить связанный runtime/deployment Vercel','повторно проверить затронутую схему/данные Supabase','убедиться, что исходная проблема устранена'}};
}

async function callAgent(req,body){
  const out=capture();
  await agent(req,Object.assign({},req,{body},{setHeader:out.setHeader,status:out.status,json:out.json,end:out.end}));
  return out._state;
}

module.exports=async function(req,res){
  if(req.method!=='POST')return agent(req,res);
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{})}catch(_){return res.status(400).json({error:'INVALID_JSON'})}
  const action=String(body.action||'audit');

  /* APPLY: existing approval-gated executor remains the sole mutation authority. */
  if(action==='apply'||action==='apply_db')return agent(req,res);

  /* PLAN: diagnose first, then expose a normalized approval package. */
  if(action==='plan'){
    const auditBody=Object.assign({},body,{action:'audit',mode:'plan',message:String(body.message||'').trim()||'Проведи диагностику задачи и подготовь план изменений. Ничего не применяй.'});
    const out=await callAgent(req,auditBody);
    const payload=out.body;
    if(payload&&payload.result){payload.lifecycle_phase='PLAN';payload.plan=normalizePlan(payload.result);payload.result.answer='### Qrchick · план изменений\n\n'+String(payload.result.answer||'')+'\n\n**Подтверждение администратора обязательно перед применением.**'}
    return res.status(out.status).json(payload||{error:'AI_AGENT_FAILED'});
  }

  /* VERIFY: fresh read-only agent pass after an apply/deployment. */
  if(action==='verify'){
    const target=body.target||body.applied_changes||body.changes||{};
    const verifyMessage='Проведи финальную верификацию уже применённых изменений. Используй только read-only инструменты. Проверь фактическое состояние GitHub, Supabase и Vercel там, где это относится к изменению. Сравни с ожидаемым результатом и укажи PASS/FAIL по каждому пункту. Данные о применении: '+JSON.stringify(target).slice(0,18000);
    const auditBody=Object.assign({},body,{action:'audit',mode:'verify',message:verifyMessage});
    const out=await callAgent(req,auditBody);
    const payload=out.body;
    if(payload&&payload.result){payload.lifecycle_phase='VERIFY';payload.verification={status:/\bFAIL\b/i.test(String(payload.result.answer||''))?'FAIL':'PASS_OR_REVIEW',fresh_read_only_check:true};payload.result.answer='### Qrchick · верификация\n\n'+String(payload.result.answer||'')}
    return res.status(out.status).json(payload||{error:'AI_AGENT_FAILED'});
  }

  const out=await callAgent(req,body);
  const payload=out.body;
  if(action==='audit'&&payload&&payload.result&&Array.isArray(payload.tool_calls)){
    payload.lifecycle_phase='DIAGNOSE';
    const answer=String(payload.result.answer||'');
    payload.result.answer=timeline(payload.tool_calls)+'\n\n'+answer;
    payload.agent_timeline=payload.tool_calls.map((x,i)=>({index:i+1,name:x.name,duration_ms:x.duration_ms||0}));
    payload.plan=normalizePlan(payload.result);
    payload.lifecycle={current:'DIAGNOSE',next:payload.plan.approval.required?'APPROVE':'VERIFY',sequence:['DIAGNOSE','PLAN','APPROVE','APPLY','VERIFY']};
  }
  Object.keys(out.headers).forEach(k=>res.setHeader(k,out.headers[k]));
  return res.status(out.status).json(payload||{error:'AI_AGENT_FAILED'});
};
