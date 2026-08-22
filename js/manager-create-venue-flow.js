/* QR Menu — deterministic first-create flow: manager plan -> venue template. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_FLOW_V3__) return;
  window.__QR_MANAGER_CREATE_FLOW_V3__=true;

  function getProxy(){
    try{
      var root=document.getElementById('app');
      var app=root&&root.__vue_app__;
      return app&&app._instance&&app._instance.proxy||null;
    }catch(e){ return null; }
  }
  function close(el){ if(el&&el.parentNode) el.parentNode.removeChild(el); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];}); }
  function findCreateButton(target){
    var el=target&&target.closest ? target.closest('#app button') : null;
    if(!el) return null;
    var text=(el.textContent||'').replace(/\s+/g,' ').trim();
    return (text==='+ Создать' || text==='Создать') ? el : null;
  }
  function showPlans(p,userId,plans){
    var modal=document.createElement('div');
    modal.id='qr-manager-create-plan-flow';
    modal.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.9);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    modal.innerHTML='<div style="width:min(960px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px;box-sizing:border-box"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2 style="margin:0 0 8px">Сначала выберите тариф</h2><div style="color:#9ca3af;font-size:14px">Тариф закрепляется за управляющим. Пробный период — <b style="color:#fff">5 дней</b>.</div></div><button id="qr-plan-cancel" type="button" class="btn btn-ghost btn-sm">Отмена</button></div><div id="qr-plan-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#qr-plan-cancel').onclick=function(){close(modal);};
    var grid=modal.querySelector('#qr-plan-grid');
    plans.forEach(function(plan){
      var card=document.createElement('button');
      card.type='button';
      card.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;cursor:pointer';
      card.innerHTML='<div style="font-size:20px;font-weight:800">'+esc(plan.name||plan.id)+'</div><div style="font-size:26px;font-weight:800;margin-top:8px">'+esc(plan.price||0)+' ₽ <span style="font-size:12px;color:#9ca3af;font-weight:500">/ месяц</span></div><div style="font-size:12px;color:#9ca3af;margin-top:8px">'+esc(plan.max_venues||1)+' завед. · '+esc(plan.max_products||0)+' позиций</div><div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';
      card.onclick=async function(){
        card.disabled=true;
        try{
          var end=new Date(Date.now()+5*24*60*60*1000);
          var result=await db.from('subscriptions').upsert({manager_id:userId,venue_id:null,plan_id:plan.id,status:'trialing',current_period_end:end.toISOString()},{onConflict:'manager_id'}).select('id,manager_id,venue_id,plan_id,status,current_period_end').single();
          if(result.error) throw result.error;
          p.managerSubscription=result.data;
          p.subscriptionEnd=result.data.current_period_end;
          close(modal);
          p.showCreateVenue=true;
        }catch(e){
          card.disabled=false;
          alert('Не удалось подключить тариф: '+(e.message||e));
        }
      };
      grid.appendChild(card);
    });
  }
  function retryProxy(done){
    var tries=0;
    function check(){
      var p=getProxy();
      if(p){ done(p); return; }
      tries++;
      if(tries<20){ setTimeout(check,50); return; }
      done(null);
    }
    check();
  }
  async function handleCreate(p){
    var auth=await db.auth.getUser();
    var user=auth&&auth.data&&auth.data.user;
    if(!user) throw new Error('Не удалось определить управляющего');
    var sub=await db.from('subscriptions').select('id,manager_id,venue_id,plan_id,status,current_period_end').eq('manager_id',user.id).maybeSingle();
    if(sub.error) throw sub.error;
    var valid=!!(sub.data&&['trialing','active'].indexOf(sub.data.status)!==-1&&sub.data.current_period_end&&new Date(sub.data.current_period_end)>=new Date());
    if(valid){
      p.managerSubscription=sub.data;
      p.subscriptionEnd=sub.data.current_period_end;
      p.showCreateVenue=true;
      return;
    }
    var plansResult=await db.from('plans').select('id,name,price,max_venues,max_products,max_cooks,max_couriers,max_waiters,is_active,sort_order').eq('is_active',true).order('sort_order');
    if(plansResult.error) throw plansResult.error;
    var plans=(plansResult.data||[]).filter(function(x){return x&&x.is_active!==false;});
    if(!plans.length) throw new Error('Нет доступных тарифов');
    showPlans(p,user.id,plans);
  }
  document.addEventListener('click',function(ev){
    var button=findCreateButton(ev.target);
    if(!button) return;
    /* Always block Vue first. No proxy or network check is allowed to run before this. */
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if(button.dataset.qrCreateBusy==='1') return;
    button.dataset.qrCreateBusy='1';
    retryProxy(function(p){
      if(!p||!window.db){
        button.dataset.qrCreateBusy='0';
        alert('Кабинет ещё загружается. Нажмите «Создать» ещё раз.');
        return;
      }
      Promise.resolve(handleCreate(p)).catch(function(e){
        console.error('[QR Manager create flow]',e);
        alert('Не удалось проверить подписку: '+(e.message||e));
      }).finally(function(){button.dataset.qrCreateBusy='0';});
    });
  },true);
  function fixTrialCopy(){
    var nodes=document.querySelectorAll('#app *');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(el.children.length===0 && /3\s*дня\s*бесплатно/i.test(el.textContent||'')) el.textContent=(el.textContent||'').replace(/3\s*дня\s*бесплатно/ig,'5 дней бесплатно');
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(fixTrialCopy,300);});
  else setTimeout(fixTrialCopy,300);
  window.addEventListener('load',function(){setTimeout(fixTrialCopy,300);});
})();
