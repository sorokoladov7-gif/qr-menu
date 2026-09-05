/* QR-Menu — сборка приложения управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_APP__) return;

  var mixins=[
    window.__QR_MANAGER_CORE_MIXIN__,
    window.__QR_MANAGER_VENUES_MIXIN__,
    window.__QR_MANAGER_MENU_MIXIN__,
    window.__QR_MANAGER_ORDERS_MIXIN__,
    window.__QR_MANAGER_STAFF_MIXIN__,
    window.__QR_MANAGER_BILLING_MIXIN__,
    window.__QR_MANAGER_ANALYTICS_MIXIN__,
    window.__QR_MANAGER_SETTINGS_MIXIN__
  ];

  var appData=function(){
    var state={};
    mixins.forEach(function(m){if(m&&m.data)Object.assign(state,m.data());});
    state.managerSubscription=state.managerSubscription||null;
    state.aiFeatures=state.aiFeatures||{};
    state.aiEntitlementReady=false;
    if(!state.tab)state.tab='menu';
    return state;
  };

  var appComputed={};
  var appMethods={};
  mixins.forEach(function(m){
    if(!m)return;
    if(m.computed)Object.assign(appComputed,m.computed);
    if(m.methods)Object.assign(appMethods,m.methods);
  });

  appComputed.canCreateVenue=function(){
    if(!this.profile||this.profile.role==='admin')return true;
    var sub=this.managerSubscription;
    if(!sub||!['trialing','active'].includes(sub.status)||!sub.current_period_end||new Date(sub.current_period_end)<new Date())return false;
    var plan=(this.plans||[]).find(function(p){return p.id===sub.plan_id;});
    var limit=plan?Number(plan.max_venues||0):0;
    var used=Array.isArray(this.myVenues)?this.myVenues.length:0;
    return limit>0&&used<limit;
  };

  /* Единая точка доступа к AI-разрешениям тарифа. UI только отражает состояние;
     окончательная проверка выполняется серверными API. Активный trial получает
     полный доступ ко всем AI-функциям до окончания trial. */
  appComputed.aiFeatureList=function(){
    var s=this.managerSubscription;
    if(s&&s.status==='trialing'&&s.current_period_end&&new Date(s.current_period_end)>=new Date()){
      return ['assistant','menu_analysis','menu_import','analytics','recipes','chef','staff','marketing','settings','engineer'].reduce(function(a,k){a[k]=true;return a;},{});
    }
    return this.currentPlan&&this.currentPlan.ai_features&&typeof this.currentPlan.ai_features==='object'?this.currentPlan.ai_features:{};
  };
  appComputed.aiEnabled=function(){
    var s=this.managerSubscription;
    if(s&&s.status==='trialing'&&s.current_period_end&&new Date(s.current_period_end)>=new Date())return true;
    return !!(this.profile&&this.profile.role==='admin')||!!(this.currentPlan&&this.currentPlan.ai_enabled===true);
  };

  appMethods.hasAIFeature=function(feature){
    if(!feature)return false;
    if(this.profile&&this.profile.role==='admin')return true;
    var s=this.managerSubscription;
    if(s&&s.status==='trialing'&&s.current_period_end&&new Date(s.current_period_end)>=new Date())return true;
    var plan=this.currentPlan;
    if(!plan||plan.ai_enabled!==true)return false;
    var features=plan.ai_features&&typeof plan.ai_features==='object'?plan.ai_features:{};
    if(features[feature]===true)return true;
    /* Старые записи планов могли иметь только ai_enabled: сохраняем assistant,
       но не открываем этим флагом новые специализированные возможности. */
    return feature==='assistant'&&Object.keys(features).length===0;
  };

  appMethods.aiFeatureLabel=function(feature){
    var labels={assistant:'ИИ-помощник',menu_analysis:'Анализ меню',menu_import:'ИИ-импорт меню',analytics:'ИИ-аналитика',recipes:'ИИ-рецептуры',chef:'ИИ-помощник повара',staff:'ИИ-помощник по персоналу',marketing:'ИИ-маркетинг',settings:'ИИ-настройки',engineer:'ИИ-инженер'};
    return labels[feature]||'ИИ-функция';
  };

  appMethods.aiFeatureError=function(feature){
    return 'Функция «'+this.aiFeatureLabel(feature)+'» не включена в ваш тариф. Обратитесь к администратору для подключения.';
  };

  function setLockedState(el,locked,message){
    if(!el)return;
    el.setAttribute('data-qr-ai-locked',locked?'1':'0');
    el.setAttribute('aria-disabled',locked?'true':'false');
    el.title=locked?(message||'Функция не включена в тариф'):(el.getAttribute('data-qr-ai-title')||'');
    if(locked){
      el.classList.add('qr-ai-locked');
      if('disabled' in el)el.disabled=true;
    }else{
      el.classList.remove('qr-ai-locked');
      if('disabled' in el)el.disabled=false;
    }
  }

  function gateManagerAI(vm){
    if(!vm||!vm.profile||vm.profile.role==='admin'){
      return;
    }
    var root=document.getElementById('app');
    if(!root)return;
    var assistant=root.querySelector('#qr-ai-center');
    if(assistant){
      var allowed=vm.hasAIFeature('assistant');
      assistant.style.display=allowed?'':'none';
      assistant.setAttribute('data-qr-ai-feature','assistant');
    }
    Array.prototype.forEach.call(root.querySelectorAll('[data-ai-feature]'),function(el){
      var feature=el.getAttribute('data-ai-feature');
      if(feature)setLockedState(el,!vm.hasAIFeature(feature),vm.aiFeatureError(feature));
    });
    var importBlock=root.querySelector('#qr-menu-import-block-v2');
    if(importBlock){
      var importAllowed=vm.hasAIFeature('menu_import');
      importBlock.setAttribute('data-qr-ai-feature','menu_import');
      var notice=importBlock.querySelector('[data-qr-ai-lock-notice]');
      if(!importAllowed){
        Array.prototype.forEach.call(importBlock.querySelectorAll('button,input'),function(el){
          if(!el.hasAttribute('data-qr-ai-original-disabled'))el.setAttribute('data-qr-ai-original-disabled',el.disabled?'1':'0');
          setLockedState(el,true,vm.aiFeatureError('menu_import'));
        });
        if(!notice){
          notice=document.createElement('div');
          notice.setAttribute('data-qr-ai-lock-notice','1');
          notice.style.cssText='margin:0 0 12px;padding:10px 12px;border:1px solid rgba(251,191,36,.28);border-radius:10px;background:rgba(251,191,36,.08);color:#fcd34d;font-size:12px;line-height:1.45;';
          notice.textContent='🔒 ИИ-импорт меню не включён в текущий тариф.';
          importBlock.insertBefore(notice,importBlock.firstChild);
        }
      }else{
        if(notice)notice.remove();
        Array.prototype.forEach.call(importBlock.querySelectorAll('button,input'),function(el){
          var original=el.getAttribute('data-qr-ai-original-disabled');
          if(original!==null)el.disabled=original==='1';
          el.removeAttribute('data-qr-ai-original-disabled');
          setLockedState(el,false);
        });
      }
    }
  }

  function boot(){
    if(window.__QR_MANAGER_AI_GATE_INSTALLED__)return;
    window.__QR_MANAGER_AI_GATE_INSTALLED__=true;
    var attempts=0;
    var timer=setInterval(function(){
      var vm=window.__managerVue;
      if(vm){gateManagerAI(vm);attempts++;if(attempts>120)clearInterval(timer);}
      else if(attempts>180)clearInterval(timer);
    },250);
    window.addEventListener('qr-manager-vue-ready',function(){gateManagerAI(window.__managerVue);},{once:false});
  }

  var app={data:appData,computed:appComputed,methods:appMethods};
  window.__QR_MANAGER_APP_OPTIONS__=app;
  boot();
})();