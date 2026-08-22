/* QR Menu — stable first-create flow: manager plan -> venue template. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_FLOW__) return;
  window.__QR_MANAGER_CREATE_FLOW__=true;

  function proxy(){
    try{
      var root=document.getElementById('app');
      var app=root&&root.__vue_app__;
      return app&&app._instance&&app._instance.proxy||null;
    }catch(e){return null;}
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function remove(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}

  async function openPlanFlow(p){
    if(!p || !window.db) return;
    var userRes=await db.auth.getUser();
    var user=userRes&&userRes.data&&userRes.data.user;
    if(!user) return;
    var sub=await db.from('subscriptions').select('id,plan_id,status,current_period_end').eq('manager_id',user.id).maybeSingle();
    if(sub.error) throw sub.error;
    if(sub.data && ['active','trialing'].indexOf(sub.data.status)!==-1 && new Date(sub.data.current_period_end)>=new Date()){
      p.managerSubscription=sub.data;
      p.subscriptionEnd=sub.data.current_period_end;
      p.showCreateVenue=true;
      return;
    }
    var plansRes=await db.from('plans').select('id,name,price,max_venues,max_products,max_cooks,max_couriers,max_waiters,is_active,sort_order').eq('is_active',true).order('sort_order');
    if(plansRes.error) throw plansRes.error;
    var plans=plansRes.data||[];
    if(!plans.length){alert('Нет доступных тарифов.');return;}

    var m=document.createElement('div');
    m.id='qr-manager-create-plan-flow';
    m.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.88);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    m.innerHTML='<div style="width:min(960px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px;box-sizing:border-box"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><h2 style="margin:0 0 8px">Сначала выберите тариф</h2><div style="color:#9ca3af;font-size:14px">Тариф закрепляется за управляющим. Пробный период — <b style="color:#fff">5 дней</b>.</div></div><button id="qr-plan-cancel" class="btn btn-ghost btn-sm">Отмена</button></div><div id="qr-plan-flow-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px"></div></div>';
    document.body.appendChild(m);
    m.querySelector('#qr-plan-cancel').onclick=function(){remove(m);};
    var grid=m.querySelector('#qr-plan-flow-grid');
    plans.forEach(function(pl){
      var card=document.createElement('button');
      card.type='button';
      card.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;cursor:pointer';
      card.innerHTML='<div style="font-size:20px;font-weight:800">'+esc(pl.name||pl.id)+'</div><div style="font-size:26px;font-weight:800;margin-top:8px">'+esc(pl.price)+' ₽ <span style="font-size:12px;color:#9ca3af;font-weight:500">/ месяц</span></div><div style="font-size:12px;color:#9ca3af;margin-top:8px">'+esc(pl.max_venues||1)+' завед. · '+esc(pl.max_products||0)+' позиций</div><div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';
      card.onclick=async function(){
        card.disabled=true;
        try{
          var end=new Date(Date.now()+5*24*60*60*1000);
          var up=await db.from('subscriptions').upsert({manager_id:user.id,venue_id:null,plan_id:pl.id,status:'trialing',current_period_end:end.toISOString()},{onConflict:'manager_id'}).select('id,manager_id,venue_id,plan_id,status,current_period_end').single();
          if(up.error) throw up.error;
          p.managerSubscription=up.data;
          p.subscriptionEnd=up.data.current_period_end;
          remove(m);
          p.showCreateVenue=true;
        }catch(e){
          card.disabled=false;
          alert('Не удалось подключить тариф: '+(e.message||e));
        }
      };
      grid.appendChild(card);
    });
  }

  function findCreateButton(){
    var root=document.getElementById('app');
    if(!root) return null;
    var buttons=root.querySelectorAll('button');
    for(var i=0;i<buttons.length;i++){
      var txt=(buttons[i].textContent||'').replace(/\s+/g,' ').trim();
      if(txt==='+ Создать' || txt==='Создать') return buttons[i];
    }
    return null;
  }

  function init(){
    var b=findCreateButton();
    if(!b || b.__qrCreateFlowBound) return;
    b.__qrCreateFlowBound=true;
    b.addEventListener('click',function(ev){
      var p=proxy();
      if(!p || !window.db) return;
      db.auth.getUser().then(function(ur){
        var user=ur&&ur.data&&ur.data.user;
        if(!user) return;
        return db.from('subscriptions').select('id,plan_id,status,current_period_end').eq('manager_id',user.id).maybeSingle().then(function(sr){
          if(sr.error) throw sr.error;
          var valid=sr.data && ['active','trialing'].indexOf(sr.data.status)!==-1 && new Date(sr.data.current_period_end)>=new Date();
          if(valid){
            p.managerSubscription=sr.data;
            p.subscriptionEnd=sr.data.current_period_end;
            return;
          }
          ev.preventDefault();
          ev.stopImmediatePropagation();
          return openPlanFlow(p);
        });
      }).catch(function(e){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        console.error('[QR Manager create flow]',e);
        alert('Не удалось проверить подписку: '+(e.message||e));
      });
    },true);

    var empty=document.querySelector('.glass.card');
    if(empty && (empty.textContent||'').indexOf('3 дня бесплатно')!==-1){
      empty.textContent=empty.textContent.replace(/3 дня бесплатно/g,'5 дней бесплатно');
    }
  }

  function start(){ setTimeout(init,700); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  window.addEventListener('load',function(){setTimeout(init,500);});
})();
