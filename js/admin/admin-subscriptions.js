/* QR-Menu — тарифы, подписки, оплаты (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_SUBSCRIPTIONS__) return;
  window.__QR_ADMIN_SUBSCRIPTIONS__ = true;

  var AI_FEATURES = [
    ['assistant','ИИ-помощник','Общий помощник управляющего'],
    ['menu_analysis','ИИ-анализ меню','Анализ состава и структуры меню'],
    ['menu_import','ИИ-импорт меню','Распознавание меню с фото, PDF и сайта'],
    ['analytics','ИИ-аналитик','AI-анализ продаж и показателей'],
    ['recipes','ИИ-рецепты','Создание и анализ рецептур'],
    ['chef','ИИ-шеф','Помощь шеф-повару и техкартам'],
    ['staff','ИИ-персонал','Помощь по персоналу и задачам'],
    ['marketing','ИИ-маркетолог','Тексты, акции и продвижение'],
    ['settings','ИИ-настройщик','Помощь с настройками платформы'],
    ['engineer','ИИ-инженер','Диагностика и техническая помощь']
  ];

  function featureObject(p){
    var src=p&&p.ai_features&&typeof p.ai_features==='object'?p.ai_features:{};
    var out={};
    AI_FEATURES.forEach(function(x){out[x[0]]=src[x[0]]===true;});
    return out;
  }
  function countFeatures(p){
    var f=featureObject(p);
    return Object.keys(f).filter(function(k){return f[k];}).length;
  }
  function syncAIState(plan){
    if(!plan)return;
    plan.ai_features=featureObject(plan);
    plan.ai_enabled=Object.keys(plan.ai_features).some(function(k){return plan.ai_features[k];});
  }

  var subsMixin = {
    data:function(){return {subscriptions:[],plans:[]};},
    computed:{
      mrr:function(){var self=this,seen={};return (this.subscriptions||[]).filter(function(s){return s&&s.manager_id&&['active','trialing'].indexOf(s.status)!==-1&&s.current_period_end&&new Date(s.current_period_end)>=new Date();}).reduce(function(sum,s){if(seen[s.manager_id])return sum;seen[s.manager_id]=true;var p=self.plans.find(function(x){return x.id===s.plan_id;});return sum+(p?Number(p.price)||0:0);},0);},
      subStats:function(){var now=new Date(),active=0,trial=0,expired=0,expiring=0;(this.subscriptions||[]).forEach(function(s){if(!s||!s.manager_id)return;var e=s.current_period_end?new Date(s.current_period_end):null;if(s.status==='trialing'&&e&&e>=now)trial++;if(e&&e>=now&&['active','trialing'].indexOf(s.status)!==-1){active++;var soon=new Date();soon.setDate(soon.getDate()+7);if(e<soon)expiring++;}else expired++;});return {total:(this.subscriptions||[]).filter(function(s){return s&&s.manager_id;}).length,active:active,trial:trial,expired:expired,expiringSoon:expiring};},
      venueSubs:function(){var self=this;return (this.subscriptions||[]).filter(function(s){return s&&s.manager_id;}).map(function(s){var m=self.managers.find(function(x){return x.id===s.manager_id;})||{},p=self.plans.find(function(x){return x.id===s.plan_id;}),ids=(self.links||[]).filter(function(l){return l.manager_id===s.manager_id;}).map(function(l){return l.venue_id;}),ords=self.ordersAll.filter(function(o){return ids.indexOf(o.venue_id)!==-1&&o.status==='done';}),rev=ords.reduce(function(sum,o){return sum+Number(o.total_price||0);},0),names=ids.map(function(id){var v=self.venues.find(function(x){return x.id===id;});return v?v.name:null;}).filter(Boolean);return {id:s.id,manager_id:s.manager_id,name:m.display_name||m.email||s.manager_id,slug:m.email||'управляющий',planName:p?p.name:'—',subscription_end:s.current_period_end,status:s.status,totalOrders:ords.length,totalRevenue:rev,plan_id:s.plan_id,venueNames:names};});},
      planStats:function(){var self=this,now=new Date();return this.plans.map(function(p){var ss=(self.subscriptions||[]).filter(function(s){return s&&s.manager_id&&s.plan_id===p.id;}),active=ss.filter(function(s){return ['active','trialing'].indexOf(s.status)!==-1&&s.current_period_end&&new Date(s.current_period_end)>now;}).length;return {id:p.id,name:p.name,price:Number(p.price)||0,count:ss.length,active:active,mrr:active*(Number(p.price)||0),is_public:p.is_public!==false,ai_enabled:p.ai_enabled===true,ai_count:countFeatures(p)};});}
    },
    methods:{
      syncPlanPrice:function(plan){if(!plan)return 0;var base=Math.max(0,Number(plan.base_price!=null?plan.base_price:plan.price)||0);plan.base_price=base;plan.price=Math.round(base);return plan.price;},
      subClass:function(v){if(!v.subscription_end)return'b-off';var e=new Date(v.subscription_end),d=(e-new Date())/864e5;return e<new Date()?'b-off':d<=3?'b-trial':'b-on';},
      subLabel:function(v){if(!v.subscription_end)return'Нет';var e=new Date(v.subscription_end),d=(e-new Date())/864e5;return e<new Date()?'Истекла':d<=3?'Осталось '+Math.ceil(d)+' дн':'Активна';},
      changeManagerPlan:async function(m,plan){var managerId=m&&m.id,planId=String(plan||'').trim();if(!managerId){this.msg='Не найден управляющий';return;}if(!planId){this.msg='Выберите тариф';return;}var selected=(this.plans||[]).find(function(p){return p.id===planId;});if(!selected){this.msg='Выбранный тариф не найден';return;}this.busy=true;try{var r=await db.rpc('admin_set_manager_plan',{p_manager_id:managerId,p_plan_id:planId,p_days:null});if(r.error)throw r.error;await this.loadBaseData();this.msg='Тариф «'+selected.name+'» назначен управляющему';}catch(e){this.msg='Ошибка сохранения тарифа: '+(e.message||e);}finally{this.busy=false;}},
      extendManagerSub:async function(m,days){var managerId=m&&m.id;days=Number(days)||30;if(!managerId){this.msg='Не найден управляющий';return;}this.busy=true;try{var r=await db.rpc('admin_extend_manager_subscription',{p_manager_id:managerId,p_days:days});if(r.error)throw r.error;await this.loadBaseData();this.msg='Подписка продлена на '+days+' дней';}catch(e){this.msg='Ошибка продления: '+(e.message||e);}finally{this.busy=false;}},
      changePlan:async function(v,plan){if(!v||!v.id)return;var r=await db.from('manager_venues').select('manager_id').eq('venue_id',v.id).limit(1).maybeSingle();if(r.error||!r.data){this.msg='Не найден управляющий для заведения';return;}return this.changeManagerPlan({id:r.data.manager_id},plan);},
      extendSub:async function(v){if(!v||!v.id)return;var r=await db.from('manager_venues').select('manager_id').eq('venue_id',v.id).limit(1).maybeSingle();if(r.error||!r.data){this.msg='Не найден управляющий для заведения';return;}return this.extendManagerSub({id:r.data.manager_id},30);},
      createPlan:function(){var stamp=Date.now().toString(36),id='custom_'+stamp,maxSort=(this.plans||[]).reduce(function(max,p){return Math.max(max,Number(p.sort_order)||0);},0);this.plans.push({id:id,name:'Новый индивидуальный тариф',price:0,base_price:0,ai_enabled:false,ai_addon_price:0,ai_features:featureObject(null),period:'month',features:[],max_products:10,max_cooks:1,max_venues:1,max_managers:1,max_couriers:1,max_waiters:1,is_active:true,is_public:false,sort_order:maxSort+1,__draft:true});},
      savePlan:async function(plan){if(!plan)return;var name=String(plan.name||'').trim();if(!name){this.msg='Укажите название тарифа';return;}var id=String(plan.id||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'_');if(!id){this.msg='Некорректный идентификатор тарифа';return;}this.syncPlanPrice(plan);syncAIState(plan);this.busy=true;try{var features=Array.isArray(plan.features)?plan.features.slice():[];features=features.filter(function(f){return String(f).toLowerCase().indexOf('ии-')!==0;});AI_FEATURES.forEach(function(x){if(plan.ai_features[x[0]])features.push(x[1]);});var payload={id:id,name:name,price:Number(plan.price)||0,base_price:Number(plan.base_price)||0,ai_enabled:plan.ai_enabled===true,ai_addon_price:Math.max(0,Number(plan.ai_addon_price)||0),ai_features:plan.ai_features,period:plan.period||'month',features:features,max_products:Math.max(1,Number(plan.max_products)||1),max_cooks:Math.max(1,Number(plan.max_cooks)||1),max_venues:Math.max(1,Number(plan.max_venues)||1),max_managers:Math.max(1,Number(plan.max_managers)||1),max_couriers:Math.max(1,Number(plan.max_couriers)||1),max_waiters:Math.max(1,Number(plan.max_waiters)||1),is_active:plan.is_active!==false,is_public:plan.is_public!==false,sort_order:Number(plan.sort_order)||0};var exists=(this.plans||[]).some(function(p){return p!==plan&&p.id===id&&!p.__draft;});if(exists)throw new Error('Тариф с таким ID уже существует');var r=plan.__draft?await db.from('plans').insert(payload):await db.from('plans').update(payload).eq('id',plan.id);if(r.error)throw r.error;delete plan.__draft;plan.id=id;this.msg='Тариф «'+name+'» сохранён';await this.loadBaseData();}catch(e){this.msg='Ошибка сохранения тарифа: '+(e.message||e);}finally{this.busy=false;}},
      togglePlanVisibility:async function(plan){if(!plan||!plan.id)return;var next=plan.is_public===false;this.busy=true;try{var r=await db.from('plans').update({is_public:next}).eq('id',plan.id);if(r.error)throw r.error;plan.is_public=next;this.msg=next?'Тариф «'+plan.name+'» теперь видим управляющим':'Тариф «'+plan.name+'» скрыт от управляющих';}catch(e){this.msg='Ошибка изменения видимости: '+(e.message||e);}finally{this.busy=false;}},
      delPlan:async function(plan){if(!plan||!plan.id)return;if(plan.__draft){this.plans=this.plans.filter(function(p){return p!==plan;});return;}var used=(this.subscriptions||[]).some(function(s){return s&&s.plan_id===plan.id;});if(used){this.msg='Тариф нельзя удалить: он назначен управляющему. Сначала назначьте ему другой тариф.';return;}if(!confirm('Удалить тариф «'+plan.name+'»?'))return;this.busy=true;try{var r=await db.from('plans').delete().eq('id',plan.id);if(r.error)throw r.error;this.plans=this.plans.filter(function(p){return p.id!==plan.id;});this.msg='Тариф удалён';}catch(e){this.msg='Ошибка удаления тарифа: '+(e.message||e);}finally{this.busy=false;}}
    }
  };
  window.__QR_ADMIN_SUBSCRIPTIONS_MIXIN__=subsMixin;

  function injectStyles(){
    if(document.getElementById('qr-plan-ai-style'))return;
    var s=document.createElement('style');s.id='qr-plan-ai-style';
    s.textContent=''+
      '.plan-ai-controls{margin:14px 0;padding:14px;border:1px solid rgba(99,102,241,.32);border-radius:14px;background:linear-gradient(180deg,rgba(15,23,42,.72),rgba(15,23,42,.45));}'+
      '.plan-ai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}'+
      '.plan-ai-head b{font-size:14px}.plan-ai-count{font-size:11px;opacity:.65}'+
      '.plan-ai-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}'+
      '.plan-ai-toggle{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.025);color:inherit;cursor:pointer;transition:.18s ease;min-height:48px}'+
      '.plan-ai-toggle:hover{border-color:rgba(129,140,248,.5);transform:translateY(-1px)}'+
      '.plan-ai-toggle.on{border-color:rgba(99,102,241,.75);background:rgba(99,102,241,.16);box-shadow:0 5px 18px rgba(99,102,241,.12)}'+
      '.plan-ai-toggle .dot{width:8px;height:8px;border-radius:50%;background:#475569;flex:0 0 8px}.plan-ai-toggle.on .dot{background:#a78bfa;box-shadow:0 0 10px rgba(167,139,250,.7)}'+
      '.plan-ai-toggle .txt{min-width:0}.plan-ai-toggle strong{display:block;font-size:12px}.plan-ai-toggle small{display:block;font-size:10px;opacity:.58;margin-top:2px;line-height:1.25}'+
      '.plan-ai-price{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)}'+
      '@media(max-width:720px){.plan-ai-grid{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }

  function enhance(){
    var root=document.querySelector('.plans-grid'),app=window.__QR_ADMIN_VUE_APP__,vm=app&&app._instance?app._instance.proxy:null;
    if(!root||!vm||!Array.isArray(vm.plans))return;
    injectStyles();
    Array.prototype.slice.call(root.querySelectorAll(':scope > .card')).forEach(function(card,index){
      var p=vm.plans[index];if(!p)return;
      syncAIState(p);
      var box=card.querySelector('.plan-ai-controls');
      if(!box){
        box=document.createElement('div');box.className='plan-ai-controls';
        var html='<div class="plan-ai-head"><b>✦ ИИ-функции тарифа</b><span class="plan-ai-count"></span></div><div class="plan-ai-grid">';
        AI_FEATURES.forEach(function(x){html+='<button type="button" class="plan-ai-toggle" data-ai-key="'+x[0]+'"><span class="dot"></span><span class="txt"><strong>'+x[1]+'</strong><small>'+x[2]+'</small></span></button>';});
        html+='</div><div class="plan-ai-price"><div class="field"><label>Доплата за ИИ ₽/мес (если используется отдельно)</label><input class="plan-ai-addon-input" type="number" min="0"></div></div>';
        box.innerHTML=html;
        var btn=Array.prototype.find.call(card.querySelectorAll('button'),function(b){return (b.textContent||'').indexOf('Сохранить тариф')!==-1;});
        if(btn&&btn.parentNode)btn.parentNode.insertBefore(box,btn);else card.appendChild(box);
        box.querySelectorAll('[data-ai-key]').forEach(function(toggle){
          toggle.addEventListener('click',function(){
            var key=toggle.getAttribute('data-ai-key');
            syncAIState(p);p.ai_features[key]=!p.ai_features[key];p.ai_enabled=Object.keys(p.ai_features).some(function(k){return p.ai_features[k];});
            renderPlanAI(box,p);
          });
        });
        var addon=box.querySelector('.plan-ai-addon-input');
        if(addon)addon.addEventListener('input',function(){p.ai_addon_price=Math.max(0,Number(addon.value)||0);});
      }
      renderPlanAI(box,p);
    });
  }

  function renderPlanAI(box,p){
    if(!box||!p)return;
    syncAIState(p);
    var count=Object.keys(p.ai_features).filter(function(k){return p.ai_features[k];}).length;
    var countEl=box.querySelector('.plan-ai-count');if(countEl)countEl.textContent=count+' из '+AI_FEATURES.length+' подключено';
    box.querySelectorAll('[data-ai-key]').forEach(function(toggle){
      var on=p.ai_features[toggle.getAttribute('data-ai-key')]===true;
      toggle.classList.toggle('on',on);toggle.setAttribute('aria-pressed',on?'true':'false');
    });
    var addon=box.querySelector('.plan-ai-addon-input');if(addon&&document.activeElement!==addon)addon.value=Number(p.ai_addon_price)||0;
  }

  function boot(){
    var n=0;
    var run=function(){enhance();if(n++<80)setTimeout(run,250);};
    run();
    if(window.MutationObserver&&!window.__QR_ADMIN_PLAN_AI_OBSERVER__){
      window.__QR_ADMIN_PLAN_AI_OBSERVER__=true;
      var obs=new MutationObserver(function(){enhance();});
      obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();