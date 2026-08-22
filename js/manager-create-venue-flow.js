/* QR Menu — stable manager venue creation flow. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_FLOW_V6__) return;
  window.__QR_MANAGER_CREATE_FLOW_V6__=true;

  function close(el){ if(el && el.parentNode) el.parentNode.removeChild(el); }
  function esc(v){
    return String(v==null?'':v).replace(/[&<>\"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function vue(){
    try{
      var root=document.getElementById('app');
      var inst=root && root.__vue_app__ && root.__vue_app__._instance;
      if(inst && inst.proxy) return inst.proxy;
    }catch(e){}
    try{ if(window.__managerVue) return window.__managerVue; }catch(e){}
    return null;
  }

  async function managerId(){
    var p=vue();
    if(p && p.profile && p.profile.id) return p.profile.id;
    try{
      var u=await db.auth.getUser();
      var id=u&&u.data&&u.data.user&&u.data.user.id;
      if(id) return id;
    }catch(e){
      console.warn('[QR Manager create flow] auth.getUser failed:',e);
    }
    try{
      var s=await db.auth.getSession();
      var sid=s&&s.data&&s.data.session&&s.data.session.user&&s.data.session.user.id;
      if(sid) return sid;
    }catch(e){
      console.warn('[QR Manager create flow] auth.getSession failed:',e);
    }
    return null;
  }

  function findCreateButton(target){
    var el=target && target.closest ? target.closest('#app button') : null;
    if(!el) return null;
    var t=(el.textContent||'').replace(/\s+/g,' ').trim();
    return (t==='+ Создать' || t==='Создать') ? el : null;
  }

  function ensureCreateButtonEnabled(){
    var b=findCreateButton(document.body);
    if(!b) return;
    b.disabled=false;
    b.removeAttribute('aria-disabled');
  }

  function showPlans(plans){
    var old=document.getElementById('qr-manager-create-plan-flow');
    if(old) close(old);

    var m=document.createElement('div');
    m.id='qr-manager-create-plan-flow';
    m.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.94);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    m.innerHTML='<div style="width:min(960px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px;box-sizing:border-box">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">'+
      '<div><h2 style="margin:0 0 8px">Сначала выберите тариф</h2><div style="color:#9ca3af;font-size:14px">Тариф закрепляется за управляющим. Пробный период — <b style="color:#fff">5 дней</b>.</div></div>'+ 
      '<button id="qr-plan-cancel" type="button" class="btn btn-ghost btn-sm">Отмена</button></div>'+ 
      '<div id="qr-plan-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px"></div></div>';
    document.body.appendChild(m);

    m.querySelector('#qr-plan-cancel').onclick=function(){ close(m); };
    var grid=m.querySelector('#qr-plan-grid');

    plans.forEach(function(plan){
      var card=document.createElement('button');
      card.type='button';
      card.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;cursor:pointer';
      card.innerHTML='<div style="font-size:20px;font-weight:800">'+esc(plan.name||plan.id)+'</div>'+ 
        '<div style="font-size:26px;font-weight:800;margin-top:8px">'+esc(plan.price||0)+' ₽ <span style="font-size:12px;color:#9ca3af;font-weight:500">/ месяц</span></div>'+ 
        '<div style="font-size:12px;color:#9ca3af;margin-top:8px">'+esc(plan.max_venues||1)+' завед. · '+esc(plan.max_products||0)+' позиций</div>'+ 
        '<div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';

      card.onclick=async function(){
        card.disabled=true;
        try{
          var uid=await managerId();
          if(!uid) throw new Error('Не удалось определить управляющего');

          var end=new Date(Date.now()+5*24*60*60*1000);
          var r=await db.from('subscriptions').upsert({
            manager_id:uid,
            venue_id:null,
            plan_id:plan.id,
            status:'trialing',
            current_period_end:end.toISOString()
          },{onConflict:'manager_id'}).select('id,manager_id,venue_id,plan_id,status,current_period_end').single();

          if(r.error) throw r.error;
          sessionStorage.setItem('qr_plan_selected','1');
          close(m);
          ensureCreateButtonEnabled();
        }catch(e){
          card.disabled=false;
          alert('Не удалось подключить тариф: '+(e.message||e));
        }
      };
      grid.appendChild(card);
    });
  }

  async function openFlow(){
    var uid=await managerId();
    if(!uid) throw new Error('Не удалось определить управляющего');

    var s=await db.from('subscriptions')
      .select('id,manager_id,plan_id,status,current_period_end')
      .eq('manager_id',uid)
      .maybeSingle();
    if(s.error) throw s.error;

    var valid=!!(s.data && ['active','trialing'].indexOf(s.data.status)!==-1 && s.data.current_period_end && new Date(s.data.current_period_end)>=new Date());
    if(valid) return {allowDefault:true,subscription:s.data};

    var p=await db.from('plans').select('id,name,price,max_venues,max_products,is_active,sort_order').eq('is_active',true).order('sort_order');
    if(p.error) throw p.error;
    var plans=(p.data||[]).filter(function(x){ return x && x.is_active!==false; });
    if(!plans.length) throw new Error('Нет доступных тарифов');

    showPlans(plans);
    return {allowDefault:false};
  }

  function openVenueForm(){
    var p=vue();
    if(!p) return false;
    p.showCreateVenue=true;
    if(p.managerSubscription==null){
      /* Keep the live subscription available to the creation form. */
      managerId().then(function(uid){
        if(!uid) return;
        db.from('subscriptions').select('id,manager_id,plan_id,status,current_period_end').eq('manager_id',uid).maybeSingle().then(function(r){
          if(!r.error && r.data){
            p.managerSubscription=r.data;
            p.subscriptionEnd=r.data.current_period_end;
          }
        });
      });
    }
    return true;
  }

  /* Keep createVenue authoritative in one place; this replaces the stale 3-day/plan-start implementation. */
  function patchCreateVenue(p){
    if(!p || p.__qrCreateVenueFlowV6) return;
    p.__qrCreateVenueFlowV6=true;
    p.createVenue=async function(){
      var self=this;
      self.formError='';
      var template=self.selectedVenueTemplate;
      if(!template){ self.formError='Выберите шаблон ниши'; return; }
      if(!self.newVenueForm.name || !self.newVenueForm.slug){ self.formError='Заполните название и код заведения'; return; }

      var uid=await managerId();
      if(!uid){ self.formError='Не удалось определить управляющего'; return; }

      var sub=await db.from('subscriptions').select('id,manager_id,plan_id,status,current_period_end').eq('manager_id',uid).maybeSingle();
      if(sub.error){ self.formError='Не удалось проверить подписку: '+sub.error.message; return; }
      if(!sub.data || ['active','trialing'].indexOf(sub.data.status)===-1 || !sub.data.current_period_end || new Date(sub.data.current_period_end)<new Date()){
        self.formError='Сначала выберите тариф'; return;
      }

      var planId=sub.data.plan_id;
      var end=sub.data.current_period_end;
      var plans=Array.isArray(self.plans)?self.plans:[];
      var plan=plans.find(function(x){return x.id===planId;})||null;
      if(plan && plan.max_products && template.products.length>plan.max_products){
        self.formError='В выбранном тарифе недостаточно места для шаблона ('+template.products.length+' позиций).'; return;
      }

      self.busy=true;
      try{
        var slug=self.newVenueForm.slug.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9а-яё_-]/gi,'').replace(/[а-яё]/gi,function(c){
          var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
          return m[c.toLowerCase()]||'';
        });
        if(!slug) throw new Error('Некорректный slug');

        var products=template.products.map(function(item){
          return {name:item.name,description:item.description||null,price:Number(item.price)||0,category:item.category||'main',image_url:item.image_url||null,applies_to:item.applies_to||'all',is_available:true};
        });

        var r=await db.rpc('create_venue_for_manager',{
          p_name:self.newVenueForm.name.trim(),
          p_slug:slug,
          p_plan:planId,
          p_subscription_end:end,
          p_products:products
        });
        if(r.error) throw r.error;

        self.showCreateVenue=false;
        self.newVenueForm={name:'',slug:'',template:null};
        await self.loadMyVenues();
        if(r.data) self.selectVenue(r.data);
        self.showToast('Заведение создано: '+template.name+' · '+template.products.length+' позиций добавлено');
      }catch(err){
        console.error('createVenue error:',err);
        self.formError='Ошибка: '+(err.message||String(err));
      }finally{ self.busy=false; }
    };
  }

  function waitForVue(){
    var tries=0;
    function tick(){
      var p=vue();
      if(p) patchCreateVenue(p);
      if(++tries<40) setTimeout(tick,250);
    }
    tick();
  }

  document.addEventListener('click',function(ev){
    var b=findCreateButton(ev.target);
    if(!b || !window.db) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    if(b.dataset.qrFlowBusy==='1') return;
    b.dataset.qrFlowBusy='1';

    openFlow().then(function(result){
      b.dataset.qrFlowBusy='0';
      if(result && result.allowDefault){
        openVenueForm();
      }
    }).catch(function(e){
      console.error('[QR Manager create flow]',e);
      b.dataset.qrFlowBusy='0';
      alert('Не удалось проверить подписку: '+(e.message||e));
    });
  },true);

  function fixTrialText(){
    var root=document.getElementById('app');
    if(!root) return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var n;
    while(n=walker.nextNode()){
      if(/3\s*дня\s*бесплатно/i.test(n.nodeValue||'')){
        n.nodeValue=n.nodeValue.replace(/3\s*дня\s*бесплатно/ig,'5 дней бесплатно');
      }
    }
  }

  function start(){
    fixTrialText();
    setTimeout(fixTrialText,600);
    setTimeout(fixTrialText,1400);
    waitForVue();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
  window.addEventListener('load',start);
})();
