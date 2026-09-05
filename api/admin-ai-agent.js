'use strict';

/* Qrchick agent orchestrator. It composes the existing admin AI handler into a
   server-side plan -> independent verification -> safe proposal pipeline. */
const auditHandler=require('./admin-ai-audit');

function capture(){
  const state={status:200,headers:{},body:null};
  return {
    setHeader(k,v){state.headers[k]=v},
    status(code){state.status=code;return this},
    json(body){state.body=body;return this},
    end(body){if(body!==undefined){try{state.body=JSON.parse(body)}catch(_){state.body=body}}return this},
    _state:state
  };
}

async function invoke(req,body){
  const res=capture();
  const next=Object.assign({},req,{body});
  await auditHandler(next,res);
  return res._state;
}

function key(x){return String(x?.file||'')+'|'+String(x?.expected_sha||'')}
function clean(v,n=500){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n)}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const action=String(body.action||'audit');

    /* Mutations stay in the original hardened handler. */
    if(action!=='audit'){
      const out=await invoke(req,body);
      return res.status(out.status).json(out.body||{error:'AI_AUDIT_FAILED'});
    }

    const userMessage=String(body.message||'').trim();
    const firstBody=Object.assign({},body,{mode:body.mode||'agent'});
    const first=await invoke(req,firstBody);
    if(first.status>=400)return res.status(first.status).json(first.body||{error:'AI_AGENT_PRIMARY_FAILED'});

    const primary=first.body||{};
    const primaryResult=primary.result||{};
    const originalChanges=Array.isArray(primaryResult.proposed_changes)?primaryResult.proposed_changes:[];
    const originalDb=Array.isArray(primaryResult.database_changes)?primaryResult.database_changes:[];

    const verificationMessage=[
      'Выполни независимую вторичную проверку предыдущего результата Qrchick.',
      'Не принимай предыдущий вывод на веру. Повторно проверь факты по текущему репозиторию и текущей схеме.',
      'Найди ложные срабатывания, неправильные первопричины, устаревшие expected_sha, несовместимые изменения, опасный SQL и риск регрессии.',
      'В ответе proposed_changes оставь ТОЛЬКО те изменения кода из предыдущего результата, которые после повторной проверки действительно безопасны и обоснованы.',
      'В database_changes оставь ТОЛЬКО действительно необходимые и безопасные SQL-изменения.',
      'Если изменение не прошло проверку — не включай его.',
      'ПРЕДЫДУЩИЙ РЕЗУЛЬТАТ:\n'+JSON.stringify(primaryResult).slice(0,180000),
      'ИСХОДНЫЙ ЗАПРОС АДМИНИСТРАТОРА:\n'+userMessage
    ].join('\n\n');

    const secondBody={
      action:'audit',
      mode:'verification',
      message:verificationMessage,
      history:Array.isArray(body.history)?body.history.slice(-8):[],
      attachments:[],
      thinking:body.thinking||'high'
    };
    const second=await invoke(req,secondBody);
    const verification=second.body?.result||{};
    const verifiedChanges=Array.isArray(verification.proposed_changes)?verification.proposed_changes:[];
    const verifiedDb=Array.isArray(verification.database_changes)?verification.database_changes:[];
    const verifiedKeys=new Set(verifiedChanges.map(key));
    const verifiedDbSql=new Set(verifiedDb.map(x=>String(x?.sql||'').replace(/\s+/g,' ').trim()));

    primaryResult.proposed_changes=originalChanges.filter(x=>verifiedKeys.has(key(x)));
    primaryResult.database_changes=originalDb.filter(x=>verifiedDbSql.has(String(x?.sql||'').replace(/\s+/g,' ').trim()));
    primaryResult.agent_mode=true;
    primaryResult.agent_pipeline=['context_scan','primary_reasoning','independent_verification','safe_change_filter'];
    primaryResult.verification={
      status:second.status>=400?'warning':'completed',
      model:second.body?.model||null,
      verified_findings:verification.findings||[],
      verification_summary:verification.summary||verification.answer||'',
      retained_code_changes:primaryResult.proposed_changes.length,
      retained_database_changes:primaryResult.database_changes.length
    };

    return res.status(200).json(Object.assign({},primary,{
      result:primaryResult,
      verification:primaryResult.verification,
      steps:[
        {name:'Сканирование проекта',status:'completed'},
        {name:'Основной анализ',status:'completed'},
        {name:'Независимая проверка',status:second.status>=400?'warning':'completed'},
        {name:'Фильтр безопасных изменений',status:'completed'}
      ],
      capabilities:Object.assign({},primary.capabilities||{}, {agentic_mode:true,independent_verification:true,safe_change_filter:true})
    }));
  }catch(e){
    console.error('[admin-ai-agent]',e);
    return res.status(Number(e?.status)||500).json({error:clean(e?.message||'AI_AGENT_FAILED',1400)});
  }
};
