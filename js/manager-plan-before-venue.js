/* QR Menu — synchronous manager plan gate. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_PLAN_GATE_V3__) return;
  window.__QR_MANAGER_PLAN_GATE_V3__=true;

  function getVue(){
    try{
      var root=document.getElementById('app');
      var app=root&&root.__vue_app__;
      return app&&app._instance&&app._instance.proxy||null;
    }catch(e){ return null; }
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function close(m){if(m&&m.parentNode)m.parentNode.removeChild(m);}
  function setBusyModal(text){
    var m=document.createElement('div');
    m.id='qr-manager-plan-loading';
    m.style.cssText='position:fixed;inset:0;z-index:10060;background:rgba(3,8,20,.86);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    m.innerHTML='<div style="width:min(420px,100%);background:#111827;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:28px;text-align:center"><div style="font-size:30px;margin-bottom:10px">⏳</div><b>'+esc(text)+'</b></div>';
    document.body.appendChild(m); return m;
  }
  function showPlans(p,plans){
    var m=document.createElement('div');
    m.id='qr-manager-plan-gate';
    m.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.88);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    m.innerHTML='<div style="width:min(900px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px;box-sizing:border-box"><h2 style="margin:0 0 8px">Сначала выберите тариф</h2><div style="color:#9ca3af;font-size:14px">Тариф закрепляется за управляющим. Пробный период — 5 дней.</div><div id="qr-plan-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:20px"></div><button id="qr-plan-cancel" class="btn btn-ghost" style="margin-top:16px;width:100%">Отмена</button></div>';
    document.body.appendChild(m);
    m.querySelector('#qr-plan-cancel').onclick=function(){close(m);};
    var grid=m.querySelector('#qr-plan-grid');
    plans.forEach(function(pl){
      var card=document.createElement('button');
      card.type='button';
      card.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px;cursor:pointer';
      card.innerHTML='<div style="font-size:20px;font-weight:800">'+esc(pl.name||pl.id)+'</div><div style="font-size:24px;font-weight:800;margin-top:8px">'+esc(pl.price||0)+' ₽ <span style="font-size:12px;color:#9ca3af">/ месяц</span></div><div style="font-size:12px;color:#9ca3af;margin-top:8px">Заведений: '+esc(pl.max_venues||1)+' · Позиций: '+esc(pl.max_products||0)+'</div><div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';
      card.onclick=async function(){
        card.disabled=true;
        try{
          var u=await db.auth.getUser();
          if(!u.data.user) throw new Error('Не удалось определить управляющего');
          var end=new Date(Date.now()+5*24*60*60*1000);
          var r=await db.from('subscriptions').upsert({manager_id:u.data.user.id,venue_id:null,plan_id:pl.id,status:'trialing',current_period_end:end.toISOString()},{onConflict:'manager_id'}).select().single();
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
  }

  function hasValidSubscription(p,callback){
    var userId=p&&p.profile&&p.profile.id;
    var q=userId?Promise.resolve(userId):db.auth.getUser().then(function(r){return r.data.user&&r.data.user.id;});
    q.then(function(id){
      if(!id){callback(false);return;}
      db.from('subscriptions').select('id,manager_id,plan_id,status,current_period_end').eq('manager_id',id).maybeSingle().then(function(r){
        if(r.error) throw r.error;
        var ok=!!(r.data&&['trialing','active'].indexOf(r.data.status)!==-1&&r.data.current_period_end&&new Date(r.data.current_period_end)>=new Date());
        if(ok){p.managerSubscription=r.data;p.subscriptionEnd=r.data.current_period_end;}
        callback(ok);
      }).catch(function(e){console.warn('[QR Plan Gate]',e);callback(false);});
    });
  }

  function handleCreateClick(ev){
    var btn=ev.target&&ev.target.closest ? ev.target.closest('#app button') : null;
    if(!btn) return;
    if((btn.textContent||'').trim()!=='+ Создать') return;
    var p=getVue();
    if(!p||!window.db) return;

    /* IMPORTANT: block Vue synchronously before its v-on:click runs. */
    ev.preventDefault();
    ev.stopImmediatePropagation();

    var loading=setBusyModal('Проверяем подписку управляющего…');
    hasValidSubscription(p,function(ok){
      close(loading);
      if(ok){
        p.showCreateVenue=true;
        return;
      }
      db.from('plans').select('id,name,price,max_venues,max_products,is_active,sort_order').eq('is_active',true).order('sort_order').then(function(r){
        if(r.error) throw r.error;
        var plans=r.data||[];
        if(!plans.length){alert('Нет доступных тарифов.');return;}
        showPlans(p,plans);
      }).catch(function(e){alert('Не удалось загрузить тарифы: '+(e.message||e));});
    });
  }

  /* Capture phase runs before Vue's click handler, so templates cannot open first. */
  document.addEventListener('click',handleCreateClick,true);

  /* Replace stale copy once, without a DOM observer. */
  function fixTrialCopy(){
    var nodes=document.querySelectorAll('#app *');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(el.children.length===0 && (el.textContent||'').indexOf('3 дня бесплатно')!==-1){
        el.textContent=el.textContent.replace(/3 дня бесплатно/g,'5 дней бесплатно');
      }
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(fixTrialCopy,600);});
  else setTimeout(fixTrialCopy,600);
})();