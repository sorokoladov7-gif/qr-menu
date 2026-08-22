/* QR Menu — deterministic first-create flow: plan -> venue template. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_FLOW_STABLE__) return;
  window.__QR_MANAGER_CREATE_FLOW_STABLE__=true;

  function close(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}

  function findCreateButton(target){
    var el=target&&target.closest?target.closest('#app button'):null;
    if(!el)return null;
    var t=(el.textContent||'').replace(/\s+/g,' ').trim();
    return (t==='+ Создать'||t==='Создать')?el:null;
  }

  function showPlans(userId,plans){
    var old=document.getElementById('qr-manager-create-plan-flow');
    if(old)close(old);
    var m=document.createElement('div');
    m.id='qr-manager-create-plan-flow';
    m.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.94);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    m.innerHTML='<div style="width:min(960px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px;box-sizing:border-box"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2 style="margin:0 0 8px">Сначала выберите тариф</h2><div style="color:#9ca3af;font-size:14px">Тариф закрепляется за управляющим. Пробный период — <b style="color:#fff">5 дней</b>.</div></div><button id="qr-plan-cancel" type="button" class="btn btn-ghost btn-sm">Отмена</button></div><div id="qr-plan-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px"></div></div>';
    document.body.appendChild(m);
    m.querySelector('#qr-plan-cancel').onclick=function(){close(m);};
    var grid=m.querySelector('#qr-plan-grid');
    plans.forEach(function(plan){
      var card=document.createElement('button');
      card.type='button';
      card.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;cursor:pointer';
      card.innerHTML='<div style="font-size:20px;font-weight:800">'+esc(plan.name||plan.id)+'</div><div style="font-size:26px;font-weight:800;margin-top:8px">'+esc(plan.price||0)+' ₽ <span style="font-size:12px;color:#9ca3af;font-weight:500">/ месяц</span></div><div style="font-size:12px;color:#9ca3af;margin-top:8px">'+esc(plan.max_venues||1)+' завед. · '+esc(plan.max_products||0)+' позиций</div><div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';
      card.onclick=async function(){
        card.disabled=true;
        try{
          var u=await db.auth.getUser();
          var uid=u&&u.data&&u.data.user&&u.data.user.id;
          if(!uid)throw new Error('Не удалось определить управляющего');
          var end=new Date(Date.now()+5*24*60*60*1000);
          var r=await db.from('subscriptions').upsert({manager_id:uid,venue_id:null,plan_id:plan.id,status:'trialing',current_period_end:end.toISOString()},{onConflict:'manager_id'}).select('id,manager_id,venue_id,plan_id,status,current_period_end').single();
          if(r.error)throw r.error;
          sessionStorage.setItem('qr_plan_selected','1');
          close(m);
          location.reload();
        }catch(e){
          card.disabled=false;
          alert('Не удалось подключить тариф: '+(e.message||e));
        }
      };
      grid.appendChild(card);
    });
  }

  async function openFlow(){
    var u=await db.auth.getUser();
    var uid=u&&u.data&&u.data.user&&u.data.user.id;
    if(!uid)throw new Error('Не удалось определить управляющего');
    var s=await db.from('subscriptions').select('id,manager_id,plan_id,status,current_period_end').eq('manager_id',uid).maybeSingle();
    if(s.error)throw s.error;
    var valid=!!(s.data&&['active','trialing'].indexOf(s.data.status)!==-1&&s.data.current_period_end&&new Date(s.data.current_period_end)>=new Date());
    if(valid){
      sessionStorage.setItem('qr_plan_ready','1');
      location.reload();
      return;
    }
    var p=await db.from('plans').select('id,name,price,max_venues,max_products,is_active,sort_order').eq('is_active',true).order('sort_order');
    if(p.error)throw p.error;
    var plans=(p.data||[]).filter(function(x){return x&&x.is_active!==false;});
    if(!plans.length)throw new Error('Нет доступных тарифов');
    showPlans(uid,plans);
  }

  document.addEventListener('click',function(ev){
    var b=findCreateButton(ev.target);
    if(!b||!window.db)return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if(b.dataset.qrFlowBusy==='1')return;
    b.dataset.qrFlowBusy='1';
    openFlow().catch(function(e){console.error('[QR Manager create flow]',e);alert('Не удалось проверить подписку: '+(e.message||e));}).finally(function(){b.dataset.qrFlowBusy='0';});
  },true);

  function fixTrialText(){
    var root=document.getElementById('app');
    if(!root)return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var n;
    while(n=walker.nextNode()){
      if(/3\s*дня\s*бесплатно/i.test(n.nodeValue||''))n.nodeValue=n.nodeValue.replace(/3\s*дня\s*бесплатно/ig,'5 дней бесплатно');
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(fixTrialText,300);});
  else setTimeout(fixTrialText,300);
  window.addEventListener('load',function(){setTimeout(fixTrialText,500);});
})();