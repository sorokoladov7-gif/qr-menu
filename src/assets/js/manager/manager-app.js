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
    if(feature==='assistant')return !!(this.profile&&this.profile.role==='manager');
    var s=this.managerSubscription;
    if(s&&s.status==='trialing'&&s.current_period_end&&new Date(s.current_period_end)>=new Date())return true;
    var plan=this.currentPlan;
    if(!plan||plan.ai_enabled!==true)return false;
    var features=plan.ai_features&&typeof plan.ai_features==='object'?plan.ai_features:{};
    return features[feature]===true;
  };

  appMethods.aiFeatureLabel=function(feature){
    var labels={assistant:'ИИ-помощник',menu_analysis:'Анализ меню',menu_import:'ИИ-импорт меню',analytics:'ИИ-аналитика',recipes:'ИИ-рецептуры',chef:'ИИ-помощник повара',staff:'ИИ-помощник по персоналу',marketing:'ИИ-маркетинг',settings:'ИИ-настройки',engineer:'ИИ-инженер'};
    return labels[feature]||'ИИ-функция';
  };

  appMethods.aiFeatureError=function(feature){
    return 'Функция «'+this.aiFeatureLabel(feature)+'» не включена в ваш тариф. Обратитесь к администратору для подключения.';
  };

  if(!appMethods.openStaffGuide){
    appMethods.openStaffGuide=function(){window.location.href='/src/pages/manager/staff-guide.html';};
  }

  if(!appMethods.renderHall){
    appMethods.renderHall=function(){
      var container=document.getElementById('hall-container');
      if(!container||!this.venue||!this.venue.id)return;
      var hall=window.QRManagerHall;
      if(!hall||typeof hall.renderIn!=='function'){
        console.warn('[QR Manager] Hall API is not ready');
        return;
      }
      if(!this.hallRendered){
        hall.renderIn(container,this.venue);
        this.hallRendered=true;
      }
    };
  }

  function setLockedState(el,locked,message){
    if(!el)return;
    el.setAttribute('data-qr-ai-locked',locked?'1':'0');
    el.setAttribute('aria-disabled',locked?'true':'false');
    el.title=locked?(message||'Функция не включена в тариф'):(el.getAttribute('data-qr-ai-title')||'');
    if(locked){el.classList.add('qr-ai-locked');if('disabled' in el)el.disabled=true;}
    else{el.classList.remove('qr-ai-locked');if('disabled' in el)el.disabled=false;}
  }

  function gateManagerAI(vm){
    if(!vm||!vm.profile||vm.profile.role==='admin')return;
    var root=document.getElementById('app');if(!root)return;
    var assistant=root.querySelector('#qr-ai-center');
    if(assistant){var allowed=vm.hasAIFeature('assistant');assistant.style.display=allowed?'':'none';assistant.setAttribute('data-qr-ai-feature','assistant');}
    Array.prototype.forEach.call(root.querySelectorAll('[data-ai-feature]'),function(el){var feature=el.getAttribute('data-ai-feature');if(feature)setLockedState(el,!vm.hasAIFeature(feature),vm.aiFeatureError(feature));});
    var importBlock=root.querySelector('#qr-menu-import-block-v2');
    if(importBlock){
      var importAllowed=vm.hasAIFeature('menu_import');
      importBlock.setAttribute('data-qr-ai-feature','menu_import');
      var notice=importBlock.querySelector('[data-qr-ai-lock-notice]');
      if(!importAllowed){
        Array.prototype.forEach.call(importBlock.querySelectorAll('button,input'),function(el){if(!el.hasAttribute('data-qr-ai-original-disabled'))el.setAttribute('data-qr-ai-original-disabled',el.disabled?'1':'0');setLockedState(el,true,vm.aiFeatureError('menu_import'));});
        if(!notice){notice=document.createElement('div');notice.setAttribute('data-qr-ai-lock-notice','1');notice.style.cssText='margin:0 0 12px;padding:10px 12px;border:1px solid rgba(251,191,36,.28);border-radius:10px;background:rgba(251,191,36,.08);color:#fcd34d;font-size:12px;line-height:1.45;';notice.textContent='🔒 ИИ-импорт меню не включён в текущий тариф.';importBlock.insertBefore(notice,importBlock.firstChild);}
      }else{
        if(notice)notice.remove();
        Array.prototype.forEach.call(importBlock.querySelectorAll('button,input'),function(el){if(el.getAttribute('data-qr-ai-locked')==='1'){el.disabled=el.getAttribute('data-qr-ai-original-disabled')==='1';el.removeAttribute('data-qr-ai-original-disabled');setLockedState(el,false,'');}});
      }
    }
    Array.prototype.forEach.call(root.querySelectorAll('button,a,[role="button"]'),function(el){
      if(el.hasAttribute('data-ai-feature'))return;
      var text=(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(text.indexOf('ии-инженер')!==-1||text.indexOf('ии инженер')!==-1||text.indexOf('ai engineer')!==-1){el.setAttribute('data-ai-feature','engineer');setLockedState(el,!vm.hasAIFeature('engineer'),vm.aiFeatureError('engineer'));}
    });
  }

  function startManagerAIGate(vm){
    if(!vm||vm.__qrManagerAIGate)return;
    vm.__qrManagerAIGate=true;
    var style=document.createElement('style');style.setAttribute('data-qr-manager-ai-gate-style','1');style.textContent='.qr-ai-locked{opacity:.55!important;cursor:not-allowed!important;filter:saturate(.65)}[data-qr-ai-locked="1"]{cursor:not-allowed!important}';document.head.appendChild(style);
    var run=function(){try{gateManagerAI(vm);}catch(e){console.warn('[QR Manager] AI entitlement UI:',e);}};
    run();
    var observer=new MutationObserver(function(){clearTimeout(vm.__qrAIGateTimer);vm.__qrAIGateTimer=setTimeout(run,60);});
    var root=document.getElementById('app');if(root)observer.observe(root,{subtree:true,childList:true});vm.__qrAIGateObserver=observer;
  }

  function loadPaymentSettings(){
    if(window.__QR_MANAGER_PAYMENT_SETTINGS_V3__)return;
    if(document.querySelector('script[data-qr-manager-payment-settings]'))return;
    var script=document.createElement('script');script.src='/js/manager-payment-settings.js';script.async=false;script.setAttribute('data-qr-manager-payment-settings','1');
    script.onerror=function(){console.error('[QR Manager] Не удалось загрузить модуль СБП:',script.src);};
    document.head.appendChild(script);
  }

  var baseInit=appMethods.init;
  if(typeof baseInit==='function'){
    appMethods.init=async function(){
      await baseInit.call(this);
      if(!this.profile||this.profile.role==='admin')return;
      var r=await db.from('subscriptions').select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at,payment_status,payment_id').eq('manager_id',this.profile.id).is('venue_id',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(r.error)throw r.error;
      var sub=r.data||null;
      if(!sub){var healed=await db.rpc('manager_ensure_subscription');if(healed.error)throw healed.error;sub=healed.data||null;}
      this.managerSubscription=sub;this.aiEntitlementReady=true;
      if(sub&&sub.current_period_end)this.subscriptionEnd=sub.current_period_end;
      try{window.dispatchEvent(new CustomEvent('qr-manager-subscription-ready',{detail:{subscription:sub,managerId:this.profile.id}}));}catch(e){}
      this.$nextTick(function(){startManagerAIGate(this);}.bind(this));
    };
  }

  function installVenueNameSuggestions(vm){
    if(!vm)return;var root=document.getElementById('app');var modal=root&&root.querySelector('.modal');if(!modal)return;
    var input=document.getElementById('qr-venue-name-v10');
    if(!input){var fields=modal.querySelectorAll('.field input');Array.prototype.some.call(fields,function(x){var p=(x.placeholder||'').toLowerCase();if(p.indexOf('название')!==-1||p.indexOf('coffee point')!==-1){input=x;return true;}return false;});}
    if(!input||input.__qrVenueSuggestBound)return;
    input.__qrVenueSuggestBound=true;
    var box=document.createElement('div');box.className='qr-venue-name-suggestions';box.style.cssText='position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:12020;background:#141821;border:1px solid rgba(148,163,184,.2);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.35);padding:5px;display:none;max-height:230px;overflow:auto;';
    var parent=input.parentElement;if(parent){if(getComputedStyle(parent).position==='static')parent.style.position='relative';parent.appendChild(box);}else return;
    var baseWords=['Кофейня','Coffee House','Coffee Point','Кафе','Ресторан','Пиццерия','Шаурма','Бургерная','Пекарня','Кондитерская','Суши','Суши-бар','Стритфуд','Фастфуд','Бар','Кафе-бар','Столовая','Лаунж','Чайхана','Бистро'];
    function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}function norm(v){return clean(v).toLocaleLowerCase('ru-RU');}
    function sourceWords(){var out=[];(Array.isArray(vm.myVenues)?vm.myVenues:[]).forEach(function(v){if(v&&v.name)out.push(v.name);});(Array.isArray(vm.venueTemplates)?vm.venueTemplates:[]).forEach(function(t){if(t&&t.name)out.push(t.name);});return out.concat(baseWords);}
    function buildSuggestions(query){var q=norm(query),words=sourceWords(),seen={},items=[];words.forEach(function(word){var text=clean(word);if(!text)return;var n=norm(text),score=0;if(!q)score=1;else if(n===q)score=100;else if(n.indexOf(q)===0)score=80;else if(n.indexOf(' '+q)!==-1)score=65;else if(n.indexOf(q)!==-1)score=45;else{var parts=q.split(/\s+/).filter(Boolean);if(parts.length>1&&parts.every(function(part){return n.indexOf(part)!==-1;}))score=30;}if(score&&!seen[n]){seen[n]=true;items.push({text:text,score:score});}});items.sort(function(a,b){return b.score-a.score||a.text.localeCompare(b.text,'ru');});return items.slice(0,8);}
    function hide(){box.style.display='none';box.innerHTML='';}
    function choose(text){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));try{vm.newVenueForm.name=text;}catch(e){}hide();input.focus();}
    function render(){var items=buildSuggestions(input.value||'');if(!items.length){hide();return;}box.innerHTML='';items.forEach(function(item){var btn=document.createElement('button');btn.type='button';btn.textContent=item.text;btn.style.cssText='display:block;width:100%;text-align:left;border:0;background:transparent;color:#e2e8f0;padding:8px 9px;border-radius:7px;cursor:pointer;font-size:12px;';btn.onmouseenter=function(){btn.style.background='rgba(99,102,241,.12)';};btn.onmouseleave=function(){btn.style.background='transparent';};btn.onclick=function(){choose(item.text);};box.appendChild(btn);});box.style.display='block';}
    input.addEventListener('input',render);input.addEventListener('focus',render);document.addEventListener('click',function(e){if(e.target!==input&&!box.contains(e.target))hide();});
  }

  function startVenueNameSuggestions(vm){var tries=0;var timer=setInterval(function(){if(!window.__managerVue){if(++tries>120)clearInterval(timer);return;}installVenueNameSuggestions(vm||window.__managerVue);if((vm||window.__managerVue).__qrVenueSuggestBound||++tries>120)clearInterval(timer);},250);}

  window.__QR_MANAGER_APP_MIXIN__={data:appData,computed:appComputed,methods:appMethods};

  function boot(){
    var el=document.getElementById('app');
    if(!el||!window.Vue)return setTimeout(boot,50);

    var app=Vue.createApp({
      data:appData,
      computed:appComputed,
      methods:appMethods,
      watch:{
        tab:function(newTab){
          if(newTab==='hall'&&this.venue){
            var self=this;
            this.$nextTick(function(){self.renderHall();});
          }
        },
        venue:function(newVenue){
          if(newVenue&&newVenue.id){
            window.__managerSelectedVenue=newVenue;
            window.__managerCurrentVenue={id:newVenue.id,name:newVenue.name||'',slug:newVenue.slug||'',logo_url:newVenue.logo_url||null};
            try{localStorage.setItem('manager_venue_id',String(newVenue.id));}catch(e){}
          }
        }
      },
      mounted:function(){this.init();},
      beforeUnmount:function(){if(this.timer)clearInterval(this.timer);}
    });

    app.mount(el);
    window.__managerVue=app._instance&&app._instance.proxy;
    window.__QR_MANAGER_VUE_APP__=app;
    window.__QR_MANAGER_APP__=true;
    try{window.dispatchEvent(new CustomEvent('qr-manager-vue-ready',{detail:{vm:window.__managerVue,app:app}}));}catch(e){}
    loadPaymentSettings();
    startVenueNameSuggestions(window.__managerVue);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
