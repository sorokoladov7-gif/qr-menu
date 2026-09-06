'use strict';

/*
 * QR Menu — compatibility bridge for the manager's existing Qrchick UI.
 * The UI historically called this endpoint for the assistant. Keep the URL
 * stable, but use the unified proposal/action engines so the assistant can
 * create and update real manager data after explicit confirmation.
 */

const fail=(message,status)=>Object.assign(new Error(message),{status});

function bearer(req){
  const h=String(req.headers?.authorization||req.headers?.Authorization||'');
  const m=h.match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():'';
}

async function forward(req,path,body){
  const token=bearer(req);
  if(!token)throw fail('AUTH_REQUIRED',401);
  const host=String(req.headers?.host||'').trim();
  if(!host)throw fail('REQUEST_HOST_REQUIRED',500);
  const protocol=String(req.headers?.['x-forwarded-proto']||'https').split(',')[0].trim()||'https';
  const r=await fetch(protocol+'://'+host+path,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token
    },
    body:JSON.stringify(body||{})
  });
  const data=await r.json().catch(()=>({ok:false,error:'INVALID_UPSTREAM_RESPONSE'}));
  if(!r.ok||data?.ok===false)throw fail(data?.error||('UPSTREAM_HTTP_'+r.status),r.status||502);
  return data;
}

module.exports=async function(req,res){
  if(req.method!=='POST'){
    res.statusCode=405;
    res.setHeader('Allow','POST');
    return res.end(JSON.stringify({ok:false,error:'METHOD_NOT_ALLOWED'}));
  }
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const confirm=body.confirm===true;

    if(confirm){
      const action=body.action&&typeof body.action==='object'?body.action:{};
      const feature=String(body.feature||'assistant').trim().toLowerCase();
      const result=await forward(req,'/api/manager-ai-action',{
        feature,
        action
      });
      res.statusCode=200;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.end(JSON.stringify(result));
    }

    const message=String(body.message||'').trim();
    if(!message)throw fail('MESSAGE_REQUIRED',400);

    const result=await forward(req,'/api/manager-ai-propose',{
      feature:'assistant',
      message,
      context:String(body.context||'').slice(0,14000),
      venue_id:body.venue_id||null
    });

    res.statusCode=200;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok:true,
      feature:'assistant',
      plan:result.plan||null,
      answer:result.answer||'Действие подготовлено для подтверждения.',
      actions:Array.isArray(result.actions)?result.actions:[]
    }));
  }catch(e){
    const status=Number(e?.status)||500;
    res.statusCode=status;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    return res.end(JSON.stringify({ok:false,error:e?.message||'MANAGER_AI_ASSISTANT_ACTION_FAILED'}));
  }
};
