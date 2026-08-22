/* QR Menu — manager venue creation flow v7. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_FLOW_V7__) return;
  window.__QR_MANAGER_CREATE_FLOW_V7__=true;

  function vue(){
    try{
      var root=document.getElementById('app');
      var inst=root&&root.__vue_app__&&root.__vue_app__._instance;
      if(inst&&inst.proxy) return inst.proxy;
    }catch(e){}
    return window.__managerVue||null;
  }
  async function managerId(){
    var p=vue();
    if(p&&p.profile&&p.profile.id) return p.profile.id;
    var a=await db.auth.getUser();
    if(a&&a.data&&a.data.user&&a.data.user.id) return a.data.user.id;
    var s=await db.auth.getSession();
    return s&&s.data&&s.data.session&&s.data.session.user?s.data.session.user.id:null;
  }
  function btn(target){
    var b=target&&target.closest?target.closest('#app button'):null;
    if(!b) return null;
    var t=(b.textContent||'').replace(/\s+/g,' ').trim();
    return (t==='+ Создать'||t==='Создать')?b:null;
  }
  function close(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function text5(){
    var root=document.getElementById('app'); if(!root)return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n;
    while(n=w.nextNode()) if(/3\s*дня\s*бесплатно/i.test(n.nodeValue||'')) n.nodeValue=n.nodeValue.replace(/3\s*дня\s*бесплатно/ig,'5 дней бесплатно');
  }
  function plansModal(plans){
    var old=document.getElementById('qr-manager-plan-modal'); if(old)close(old);
    var m=document.createElement('div'); m.id='qr-manager-plan-modal';
    m.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(3,8,20,.94);display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML='<div style="width:min(960px,100%);max-height:90vh;overflow:auto;background:#111827;color:#fff;border-radius:20px;padding:24px"><div style="display:flex;justify-content:space-between"><div><h2 style="margin:0 0 8px">Сначала выберите тариф</h2><div style="color:#9ca3af">Пробный период — <b>5 дней</b></div></div><button id="qr-plan-close" type="button" class="btn btn-ghost btn-sm">Отмена</button></div><div id="qr-plan-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:20px"></div></div>';
    document.body.appendChild(m); m.querySelector('#qr-plan-close').onclick=function(){close(m);};
    var g=m.querySelector('#qr-plan-grid');
    plans.forEach(function(p){
      var c=document.createElement('button'); c.type='button'; c.style.cssText='text-align:left;background:#172236;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;cursor:pointer';
      c.innerHTML='<b style="font-size:20px">'+esc(p.name||p.id)+'</b><div style="font-size:25px;font-weight:800;margin-top:8px">'+esc(p.price||0)+' ₽</div><div style="font-size:12px;color:#9ca3af;margin-top:8px">'+esc(p.max_venues||1)+' завед. · '+esc(p.max_products||0)+' позиций</div><div style="font-size:12px;color:#6ee7b7;margin-top:10px">5 дней бесплатно</div>';
      c.onclick=async function(){
        c.disabled=true;
        try{
          var uid=await managerId(); if(!uid)throw new Error('Не удалось определить управляющего');
          var end=new Date(Date.now()+5*864e5);
          var r=await db.from('subscriptions').upsert({manager_id:uid,venue_id:null,plan_id:p.id,status:'trialing',current_period_end:end.toISOString()},{onConflict:'manager_id'}).select('*').single();
          if(r.error)throw r.error; close(m); text5();
          var proxy=vue(); if(proxy) proxy.showCreateVenue=true;
        }catch(e){c.disabled=false;alert('Не удалось подключить тариф: '+(e.message||e));}
      };
      g.appendChild(c);
    });
  }
  async function openCreate(){
    var uid=await managerId(); if(!uid)throw new Error('Не удалось определить управляющего');
    var s=await db.from('subscriptions').select('id,manager_id,plan_id,status,current_period_end').eq('manager_id',uid).maybeSingle();
    if(s.error)throw s.error;
    var valid=s.data&&['active','trialing'].indexOf(s.data.status)!==-1&&s.data.current_period_end&&new Date(s.data.current_period_end)>=new Date();
    if(valid){var p=vue();if(!p)throw new Error('Кабинет ещё не инициализирован');p.showCreateVenue=true;return;}
    var r=await db.from('plans').select('id,name,price,max_venues,max_products,is_active,sort_order').eq('is_active',true).order('sort_order');
    if(r.error)throw r.error; if(!r.data||!r.data.length)throw new Error('Нет доступных тарифов'); plansModal(r.data);
  }
  function patch(proxy){
    if(!proxy||proxy.__qrCreateVenueV7)return;
    proxy.__qrCreateVenueV7=true;
    proxy.createVenue=async function(){
      var p=proxy,template=p.selectedVenueTemplate;
      p.formError='';
      if(!template){p.formError='Выберите шаблон ниши';return;}
      if(!p.newVenueForm||!p.newVenueForm.name||!p.newVenueForm.slug){p.formError='Заполните название и код заведения';return;}
      var uid=await managerId(); if(!uid){p.formError='Не удалось определить управляющего';return;}
      var s=await db.from('subscriptions').select('id,plan_id,status,current_period_end').eq('manager_id',uid).maybeSingle();
      if(s.error){p.formError='Не удалось проверить подписку: '+s.error.message;return;}
      if(!s.data||['active','trialing'].indexOf(s.data.status)===-1||!s.data.current_period_end||new Date(s.data.current_period_end)<new Date()){p.formError='Сначала выберите тариф';return;}
      var plan=Array.isArray(p.plans)?p.plans.find(function(x){return x.id===s.data.plan_id;}):null;
      var count=Array.isArray(p.myVenues)?p.myVenues.length:0;
      if(plan&&plan.max_venues&&count>=plan.max_venues){p.formError='Достигнут лимит заведений по тарифу';return;}
      if(plan&&plan.max_products&&template.products.length>plan.max_products){p.formError='В выбранном тарифе недостаточно места для шаблона';return;}
      p.busy=true;
      try{
        var slug=p.newVenueForm.slug.toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9а-яё_-]/gi,'');
        if(!slug)throw new Error('Некорректный slug');
        var products=(template.products||[]).map(function(i){return {name:i.name,description:i.description||null,price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,applies_to:i.applies_to||'all',is_available:true};});
        var r=await db.rpc('create_venue_for_manager',{p_name:p.newVenueForm.name.trim(),p_slug:slug,p_plan:s.data.plan_id,p_subscription_end:s.data.current_period_end,p_products:products});
        if(r.error)throw r.error;
        p.showCreateVenue=false; p.newVenueForm={name:'',slug:'',template:null}; await p.loadMyVenues(); if(r.data)p.selectVenue(r.data); p.showToast('Заведение создано');
      }catch(e){console.error('createVenue error:',e);p.formError='Ошибка: '+(e.message||String(e));}finally{p.busy=false;}
    };
  }
  function boot(){
    text5(); var p=vue(); if(p)patch(p); setTimeout(function(){var q=vue();if(q)patch(q);},300); setTimeout(text5,800);
  }
  document.addEventListener('click',function(e){
    var b=btn(e.target); if(!b||!window.db)return; e.preventDefault(); e.stopImmediatePropagation();
    if(b.dataset.qrBusy==='1')return; b.dataset.qrBusy='1';
    openCreate().catch(function(err){console.error('[QR Manager create flow]',err);alert('Не удалось проверить подписку: '+(err.message||err));}).finally(function(){b.dataset.qrBusy='0';});
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot(); window.addEventListener('load',boot);
})();
