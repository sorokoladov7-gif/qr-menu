/* QR Menu — manager compatibility bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V22__)return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V22__=true;

  function managerId(ctx){
    if(ctx&&ctx.profile&&ctx.profile.id)return Promise.resolve(ctx.profile.id);
    if(window.db&&db.auth)return db.auth.getUser().then(function(r){return r&&r.data&&r.data.user?r.data.user.id:null;});
    return Promise.resolve(null);
  }
  async function loadManagerSubscription(ctx){
    var uid=await managerId(ctx);if(!uid||!window.db)return null;
    var r=await db.from('subscriptions').select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at').eq('manager_id',uid).is('venue_id',null).in('status',['trialing','active']).gte('current_period_end',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(r.error)throw r.error;return r.data||null;
  }
  function publish(app){try{window.__QR_MANAGER_VUE_APP__=app;window.__managerVue=(app&&app._instance&&app._instance.proxy)||null;window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));}catch(e){}}

  function patchDb(){
    if(!window.db||typeof window.db.rpc!=='function'||window.db.__QR_CANONICAL_CREATE_VENUE__)return;
    try{
      var originalRpc=window.db.rpc.bind(window.db);window.db.__QR_CANONICAL_CREATE_VENUE__=true;
      function normProducts(items){return(Array.isArray(items)?items:[]).map(function(i){return{name:String(i.name||'').trim(),description:i.description==null?null:String(i.description),price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,applies_to:i.applies_to||'all',is_available:i.is_available!==false};});}
      function signature(items){return normProducts(items).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\n');}
      async function resolveTemplateId(products){var r=await window.db.from('menu_templates').select('id,products').eq('is_active',true);if(r.error)throw r.error;var incoming=signature(products),list=r.data||[],found=list.find(function(t){return signature(t.products)===incoming;});if(found)return found.id;throw new Error('Не удалось определить шаблон каталога. Обновите шаблоны меню.');}
      window.db.rpc=function(fn,args,options){if(fn!=='create_venue_for_manager'||!args||!Array.isArray(args.p_products))return originalRpc(fn,args,options);return resolveTemplateId(args.p_products).then(function(templateId){return originalRpc('create_venue_from_template',{p_template_id:templateId,p_name:args.p_name,p_slug:args.p_slug,p_plan:args.p_plan||'start',p_subscription_end:args.p_subscription_end},options);});};
    }catch(e){console.warn('[QR Manager] canonical venue RPC patch:',e);}
  }

  function patchVue(Vue){
    if(!Vue||typeof Vue.createApp!=='function'||Vue.__QR_MANAGER_PATCH_V22__)return;
    Vue.__QR_MANAGER_PATCH_V22__=true;var original=Vue.createApp;
    Vue.createApp=function(options){
      if(options&&typeof options==='object'){
        options.computed=options.computed||{};
        options.data=(function(oldData){return function(){var state=typeof oldData==='function'?oldData.apply(this,arguments):(oldData||{});state.managerSubscription=state.managerSubscription||null;return state;};})(options.data);
        options.methods=options.methods||{};
        options.methods.loadManagerSubscription=async function(){try{var s=await loadManagerSubscription(this);this.managerSubscription=s;if(s&&s.current_period_end)this.subscriptionEnd=s.current_period_end;return s;}catch(e){console.error('[QR Manager] manager subscription:',e);this.managerSubscription=null;return null;}};
        options.computed.managerPlan=function(){var s=this.managerSubscription,p=this.plans&&this.plans.find(function(x){return s&&x.id===s.plan_id;});return p||null;};
        options.computed.venueLimit=function(){var p=this.managerPlan,n=p&&Number(p.max_venues);return Number.isFinite(n)&&n>0?n:0;};
        options.computed.venueLimitUsed=function(){return Array.isArray(this.myVenues)?this.myVenues.length:0;};
        options.computed.venueLimitRemaining=function(){return Math.max(0,this.venueLimit-this.venueLimitUsed);};
        options.computed.canCreateVenue=function(){var s=this.managerSubscription;if(!s||['trialing','active'].indexOf(s.status)===-1||!s.current_period_end||new Date(s.current_period_end)<new Date())return false;return this.venueLimitUsed<this.venueLimit;};
        var oldMounted=options.mounted;options.mounted=async function(){var result=oldMounted?oldMounted.apply(this,arguments):undefined;try{await this.loadManagerSubscription();if(typeof this.loadMyVenues==='function')await this.loadMyVenues();}catch(e){console.error('[QR Manager] subscription init:',e);}return result;};
      }
      var app=original.apply(this,arguments),originalMount=app.mount;app.mount=function(){var result=originalMount.apply(this,arguments);publish(this);return result;};return app;
    };
  }

  function boot(){patchDb();if(window.Vue)patchVue(window.Vue);var tries=0,timer=setInterval(function(){if(window.Vue)patchVue(window.Vue);if(window.db)patchDb();if(++tries>=120)clearInterval(timer);},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
