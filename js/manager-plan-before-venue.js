/* Manager plan gate: choose the manager subscription before creating the first venue. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_PLAN_GATE__) return;
  window.__QR_MANAGER_PLAN_GATE__ = true;

  function vue(){
    try{
      var root=document.getElementById('app');
      var app=root&&root.__vue_app__;
      return app&&app._instance&&app._instance.proxy||null;
    }catch(e){return null;}
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function close(m){if(m&&m.parentNode)m.parentNode.removeChild(m);}
  function showPlanModal(p,plans){
    var m=document.createElement('div');
    m.id='qr-manager-plan-gate';
    m.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.86);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    m.innerHTML='<div style="width:min(900px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px;box-sizing:border-box"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2 style="margin:0 0 8px">Выберите тариф</h2><div style="color:#9ca3af;font-size:14px">Тариф закрепляется за управляющим. Пробный период — 5 дней.</div></div><button id="qr-plan-close" class="btn btn-ghost btn-sm">Отмена</button></div><div id="qr-plan-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:20px"></div></div>';
    document.body.appendChild(m);
    m.querySelector('#qr-plan-close').onclick=function(){close(m);};
    var grid=m.querySelector('#qr-plan-grid');
    plans.forEach(function(pl){
      var card=document.createElement('button');
      card.type='button';
      card.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px;cursor:pointer';
      card.innerHTML='<div style="font-size:20px;font-weight:800">'+esc(pl.name||pl.id)+'</div><div style="font-size:24px;font-weight:800;margin-top:8px">'+esc(pl.price)+' ₽ <span style="font-size:12px;color:#9ca3af;font-weight:500">/ месяц</span></div><div style="font-size:12px;color:#9ca3af;margin-top:8px">'+esc(pl.max_venues||1)+' завед. · '+esc(pl.max_products||0)+' позиций</div><div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';
      card.onclick=async function(){
        card.disabled=true;
        try{
          var user=(await db.auth.getUser()).data.user;
          if(!user) throw new Error('Не удалось определить управляющего');
          var end=new Date(Date.now()+5*24*60*60*1000);
          var r=await db.from('subscriptions').upsert({manager_id:user.id,venue_id:null,plan_id:pl.id,status:'trialing',current_period_end:end.toISOString()},{onConflict:'manager_id'}).select().single();
          if(r.error) throw r.error;
          close(m);
          p.managerSubscription=r.data;
          p.subscriptionEnd=r.data.current_period_end;
          p.showCreateVenue=true;
        }catch(e){
          card.disabled=false;
          alert('Не удалось подключить тариф: '+(e.message||e));
        }
      };
      grid.appendChild(card);
    });
    return m;
  }
  function init(){
    document.addEventListener('click',async function(ev){
      var target=ev.target&&ev.target.closest ? ev.target.closest('#app button') : null;
      if(!target) return;
      var txt=(target.textContent||'').trim();
      if(txt!=='+'+' Создать') return;
      var p=vue();
      if(!p||!window.db) return;
      try{
        var user=(await db.auth.getUser()).data.user;
        if(!user) return;
        var r=await db.from('subscriptions').select('id,manager_id,plan_id,status,current_period_end').eq('manager_id',user.id).maybeSingle();
        if(r.error) throw r.error;
        if(r.data && ['trialing','active'].indexOf(r.data.status)!==-1 && new Date(r.data.current_period_end)>=new Date()) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var plans=(await db.from('plans').select('id,name,price,max_venues,max_products,is_active,sort_order').eq('is_active',true).order('sort_order')).data||[];
        if(!plans.length){alert('Нет доступных тарифов.');return;}
        showPlanModal(p,plans);
      }catch(e){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        alert('Не удалось проверить подписку: '+(e.message||e));
      }
    },true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
