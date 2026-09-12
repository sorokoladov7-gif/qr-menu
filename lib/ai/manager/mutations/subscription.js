'use strict';

const {fail,api,rpc,str}=require('../context');

const TYPES=new Set(['change_trial_plan']);

async function run(type,c,f,p){
  const pid=str(p.plan_id||p.p_plan_id,80);
  if(!pid)throw fail('PLAN_ID_REQUIRED',400);
  const sub=await api('subscriptions?manager_id=eq.'+encodeURIComponent(c.user.id)+'&venue_id=is.null&status=eq.trialing&select=id&limit=1',c.token);
  if(!sub?.[0])throw fail('TRIAL_SUBSCRIPTION_REQUIRED',400);
  return{type,status:'applied',result:await rpc('manager_change_trial_plan',{p_plan_id:pid},c.token)};
}

module.exports={TYPES,run};
