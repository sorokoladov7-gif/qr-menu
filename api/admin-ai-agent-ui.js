'use strict';

/* Thin response adapter for Qrchick. The agent itself stays in api/admin-ai-agent.js. */
const agent=require('./admin-ai-agent');

function capture(){const state={status:200,headers:{},body:null};return{setHeader(k,v){state.headers[k]=v},status(c){state.status=c;return this},json(b){state.body=b;return this},end(b){if(b!==undefined){try{state.body=JSON.parse(b)}catch(_){state.body=b}}return this},_state:state}}

function timeline(toolCalls){
  const calls=Array.isArray(toolCalls)?toolCalls:[];
  const labels={
    github_tree:'Сканирование проекта',
    github_search:'Поиск по коду',
    github_read_file:'Чтение файла',
    supabase_schema:'Проверка схемы Supabase',
    supabase_query:'Проверка данных Supabase',
    vercel_deployments:'Проверка Vercel',
    vercel_runtime:'Анализ runtime Vercel'
  };
  const icons={github_tree:'⌘',github_search:'⌕',github_read_file:'▤',supabase_schema:'◈',supabase_query:'◇',vercel_deployments:'▲',vercel_runtime:'◉'};
  if(!calls.length)return '### Qrchick · выполнение\n\n`✦` Анализ и рассуждение завершены.\n\nИзменения не применяются автоматически.';
  const rows=calls.map((c,i)=>{
    const name=String(c&&c.name||'agent_step');
    const args=c&&c.arguments||{};
    let detail='инструмент выполнен';
    if(name==='github_read_file'&&args.path)detail='`'+String(args.path).slice(0,100)+'`';
    else if(name==='github_search'&&args.query)detail='запрос: `'+String(args.query).slice(0,100)+'`';
    else if(name==='supabase_query')detail='read-only SQL';
    else if(name==='vercel_runtime'&&args.deployment_id)detail='deployment `'+String(args.deployment_id).slice(0,18)+'`';
    const sec=Number(c&&c.duration_ms||0);
    return (i+1)+'. **'+(icons[name]||'✓')+' '+(labels[name]||name)+'** — '+detail+(sec?' · '+(sec/1000).toFixed(1)+' с':'');
  });
  return '### Qrchick · выполнение задачи\n\n'+rows.join('\n')+'\n\n**✓ Исследование завершено.** Изменения кода и Production SQL остаются на подтверждении администратора.';
}

module.exports=async function(req,res){
  if(req.method!=='POST')return agent(req,res);
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const out=capture();
  await agent(req,Object.assign({},res,{setHeader:out.setHeader,status:out.status,json:out.json,end:out.end}));
  const payload=out._state.body;
  if(body.action==='audit'&&payload&&payload.result&&Array.isArray(payload.tool_calls)){
    const answer=String(payload.result.answer||'');
    payload.result.answer=timeline(payload.tool_calls)+'\n\n'+answer;
    payload.agent_timeline=payload.tool_calls.map((x,i)=>({index:i+1,name:x.name,duration_ms:x.duration_ms||0}));
  }
  Object.keys(out._state.headers).forEach(k=>res.setHeader(k,out._state.headers[k]));
  return res.status(out._state.status).json(payload||{error:'AI_AGENT_FAILED'});
};
