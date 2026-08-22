/* QR Menu — enable/disable venue creation according to manager subscription limit. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_VENUE_LIMIT__) return;
  window.__QR_MANAGER_VENUE_LIMIT__=true;

  function findCreateButton(){
    var buttons=document.querySelectorAll('#app button');
    for(var i=0;i<buttons.length;i++){
      var text=(buttons[i].textContent||'').replace(/\s+/g,' ').trim();
      if(text==='+ Создать' || text==='Создать') return buttons[i];
    }
    return null;
  }

  async function refresh(){
    var button=findCreateButton();
    if(!button || !window.db) return;
    try{
      var auth=await db.auth.getUser();
      var uid=auth&&auth.data&&auth.data.user&&auth.data.user.id;
      if(!uid) return;

      var sub=await db.from('subscriptions')
        .select('plan_id,status,current_period_end')
        .eq('manager_id',uid)
        .maybeSingle();
      if(sub.error) return;

      var valid=!!(sub.data && ['trialing','active'].indexOf(sub.data.status)!==-1 && sub.data.current_period_end && new Date(sub.data.current_period_end)>=new Date());
      if(!valid){
        button.disabled=false;
        button.removeAttribute('title');
        return;
      }

      var plan=await db.from('plans')
        .select('id,max_venues,name')
        .eq('id',sub.data.plan_id)
        .maybeSingle();
      if(plan.error || !plan.data) return;

      var links=await db.from('manager_venues')
        .select('venue_id', {count:'exact', head:true})
        .eq('manager_id',uid);
      if(links.error) return;

      var count=links.count||0;
      var max=Number(plan.data.max_venues||0);
      var allowed=max<=0 || count<max;
      button.disabled=!allowed;
      if(!allowed){
        button.title='Лимит тарифа достигнут: '+max+' заведения(й)';
      }else{
        button.removeAttribute('title');
      }
    }catch(e){
      console.warn('[QR Menu] venue limit check:',e);
    }
  }

  function schedule(){
    refresh();
    var tries=0;
    function retry(){
      tries++;
      refresh();
      if(tries<12) setTimeout(retry,250);
    }
    setTimeout(retry,250);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',schedule);
  }else schedule();
  window.addEventListener('load',function(){setTimeout(refresh,300);});
})();
