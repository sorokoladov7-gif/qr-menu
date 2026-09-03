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

  var baseInit=appMethods.init;
  if(typeof baseInit==='function'){
    appMethods.init=async function(){
      await baseInit.call(this);
      if(!this.profile||this.profile.role==='admin')return;
      var r=await db.from('subscriptions')
        .select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at,payment_status,payment_id')
        .eq('manager_id',this.profile.id)
        .is('venue_id',null)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if(r.error)throw r.error;
      var sub=r.data||null;
      if(!sub){
        var healed=await db.rpc('manager_ensure_subscription');
        if(healed.error)throw healed.error;
        sub=healed.data||null;
      }
      this.managerSubscription=sub;
      if(sub&&sub.current_period_end)this.subscriptionEnd=sub.current_period_end;
      try{window.dispatchEvent(new CustomEvent('qr-manager-subscription-ready',{detail:{subscription:sub,managerId:this.profile.id}}));}catch(e){}
    };
  }

  /* Автоподсказки названия заведения. Использует существующие названия,
   * названия шаблонов и короткий базовый словарь. Новый файл не требуется. */
  function installVenueNameSuggestions(vm){
    if(!vm)return;
    var root=document.getElementById('app');
    var modal=root&&root.querySelector('.modal');
    if(!modal)return;
    var input=document.getElementById('qr-venue-name-v10');
    if(!input){
      var fields=modal.querySelectorAll('.field input');
      Array.prototype.some.call(fields,function(x){
        var p=(x.placeholder||'').toLowerCase();
        if(p.indexOf('название')!==-1||p.indexOf('coffee point')!==-1){input=x;return true;}
        return false;
      });
    }
    if(!input)return;
    if(input.__qrVenueSuggestBound)return;
    input.__qrVenueSuggestBound=true;

    var box=document.createElement('div');
    box.className='qr-venue-name-suggestions';
    box.style.cssText='position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:12020;background:#141821;border:1px solid rgba(148,163,184,.2);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.35);padding:5px;display:none;max-height:230px;overflow:auto;';
    var parent=input.parentElement;
    if(parent){
      if(getComputedStyle(parent).position==='static')parent.style.position='relative';
      parent.appendChild(box);
    }else return;

    var baseWords=['Кофейня','Coffee House','Coffee Point','Кафе','Ресторан','Пиццерия','Шаурма','Бургерная','Пекарня','Кондитерская','Суши','Суши-бар','Стритфуд','Фастфуд','Бар','Кафе-бар','Столовая','Лаунж','Чайхана','Бистро'];
    function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
    function norm(v){return clean(v).toLocaleLowerCase('ru-RU');}
    function sourceWords(){
      var out=[];
      (Array.isArray(vm.myVenues)?vm.myVenues:[]).forEach(function(v){if(v&&v.name)out.push(v.name);});
      (Array.isArray(vm.venueTemplates)?vm.venueTemplates:[]).forEach(function(t){if(t&&t.name)out.push(t.name);});
      return out.concat(baseWords);
    }
    function buildSuggestions(query){
      var q=norm(query),words=sourceWords(),seen={},items=[];
      words.forEach(function(word){
        var text=clean(word);if(!text)return;
        var n=norm(text),score=0;
        if(!q)score=1;
        else if(n===q)score=100;
        else if(n.indexOf(q)===0)score=80;
        else if(n.indexOf(' '+q)!==-1)score=65;
        else if(n.indexOf(q)!==-1)score=45;
        else{
          var parts=q.split(/\s+/).filter(Boolean);
          if(parts.length>1&&parts.every(function(part){return n.indexOf(part)!==-1;}))score=30;
        }
        if(score&&!seen[n]){seen[n]=true;items.push({text:text,score:score});}
      });
      items.sort(function(a,b){return b.score-a.score||a.text.localeCompare(b.text,'ru');});
      return items.slice(0,8);
    }
    function hide(){box.style.display='none';box.innerHTML='';}
    function choose(text){
      input.value=text;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      try{vm.newVenueForm.name=text;}catch(e){}
      hide();
      input.focus();
    }
    function render(){
      var items=buildSuggestions(input.value||'');
      if(!items.length){hide();return;}
      box.innerHTML='';
      items.forEach(function(item){
        var row=document.createElement('button');
        row.type='button';
        row.textContent=item.text;
        row.style.cssText='display:block;width:100%;text-align:left;border:0;background:transparent;color:#e5e7eb;padding:9px 10px;border-radius:7px;cursor:pointer;font-size:13px;';
        row.addEventListener('mouseenter',function(){row.style.background='rgba(99,102,241,.12)';});
        row.addEventListener('mouseleave',function(){row.style.background='transparent';});
        row.addEventListener('mousedown',function(e){e.preventDefault();choose(item.text);});
        box.appendChild(row);
      });
      box.style.display='block';
    }
    input.addEventListener('input',render);
    input.addEventListener('focus',render);
    input.addEventListener('blur',function(){setTimeout(hide,140);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
    vm.$nextTick(render);
  }

  var basePrepareCreateVenueModal=appMethods.prepareCreateVenueModal;
  if(typeof basePrepareCreateVenueModal==='function'){
    appMethods.prepareCreateVenueModal=function(){
      var self=this;
      return Promise.resolve(basePrepareCreateVenueModal.apply(this,arguments)).then(function(result){
        self.$nextTick(function(){installVenueNameSuggestions(self);});
        return result;
      });
    };
  }

  function loadInstruction(){
    if(window.__QR_MANAGER_INSTRUCTION_V6__||window.__QR_MANAGER_INSTRUCTION_LOADING__)return;
    window.__QR_MANAGER_INSTRUCTION_LOADING__=true;
    var script=document.createElement('script');
    script.src='/js/manager-instruction-tab-v2.js?v=6';
    script.async=false;
    script.setAttribute('data-qr-manager-instruction','v6');
    script.onload=function(){window.__QR_MANAGER_INSTRUCTION_LOADING__=false;};
    script.onerror=function(){window.__QR_MANAGER_INSTRUCTION_LOADING__=false;console.error('[QR Manager] Не удалось загрузить полную инструкцию:',script.src);};
    document.head.appendChild(script);
  }

  if(!appMethods.openStaffGuide){
    appMethods.openStaffGuide=function(){
      if(typeof window.__QR_MANAGER_INSTRUCTION_SHOW__==='function'){
        window.__QR_MANAGER_INSTRUCTION_SHOW__('start');
        return;
      }
      loadInstruction();
      setTimeout(function(){
        if(typeof window.__QR_MANAGER_INSTRUCTION_SHOW__==='function')window.__QR_MANAGER_INSTRUCTION_SHOW__('start');
      },100);
    };
  }

  if(!appMethods.renderHall){
    appMethods.renderHall=function(){
      var container=document.getElementById('hall-container');
      if(!container||!window.QRManagerHall||typeof window.QRManagerHall.renderIn!=='function')return;
      if(!this.hallRendered){
        window.QRManagerHall.renderIn(container,this.venue);
        this.hallRendered=true;
      }
    };
  }

  function loadPaymentSettings(){
    if(window.__QR_MANAGER_PAYMENT_SETTINGS_V3__)return;
    if(document.querySelector('script[data-qr-manager-payment-settings]'))return;
    var script=document.createElement('script');
    script.src='/js/manager-payment-settings.js';
    script.async=false;
    script.setAttribute('data-qr-manager-payment-settings','1');
    script.onerror=function(){console.error('[QR Manager] Не удалось загрузить модуль СБП:',script.src);};
    document.head.appendChild(script);
  }

  function mountApp(){
    if(window.__QR_MANAGER_VUE_APP__)return;
    var root=document.getElementById('app');
    if(!root){console.error('[QR Manager] #app not found');return;}
    if(typeof window.Vue==='undefined'){console.error('[QR Manager] Vue is not loaded');return;}

    loadInstruction();

    var app=Vue.createApp({
      data:appData,
      computed:appComputed,
      methods:appMethods,
      watch:{
        tab:function(newTab){
          if(newTab==='orders'&&this.venue){
            var self=this;
            if(typeof self.loadOrders==='function')self.loadOrders().catch(function(e){
              console.error('[Manager] Ошибка загрузки заказов:',e);
              self.showToast('Не удалось загрузить заказы: '+(e.message||e),'error');
            });
          }
          if(newTab==='hall'&&this.venue){
            var self=this;
            this.$nextTick(function(){self.renderHall();});
          }
          if(newTab==='staff'&&this.venue){
            var self=this;
            self.staffAnalyticsDays=self.staffAnalyticsDays||'30';
            Promise.all([
              typeof self.loadCooks==='function'?self.loadCooks():Promise.resolve(),
              typeof self.loadCouriers==='function'?self.loadCouriers():Promise.resolve(),
              typeof self.loadWaiters==='function'?self.loadWaiters():Promise.resolve(),
              typeof self.loadStaffAnalytics==='function'?self.loadStaffAnalytics():Promise.resolve()
            ]).catch(function(e){
              console.error('[Manager] Ошибка загрузки персонала:',e);
              self.showToast('Не удалось загрузить персонал: '+(e.message||e),'error');
            });
          }
        },
        showCreateVenue:function(show){
          if(!show||typeof this.prepareCreateVenueModal!=='function')return;
          this.prepareCreateVenueModal();
        }
      },
      mounted:function(){this.init();},
      beforeUnmount:function(){if(this.timer)clearInterval(this.timer);}
    });

    app.mount(root);
    window.__managerVue=app._instance&&app._instance.proxy;
    window.__QR_MANAGER_VUE_APP__=app;
    window.__QR_MANAGER_APP__=true;
    window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
    loadPaymentSettings();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountApp,{once:true});
  else mountApp();
})();