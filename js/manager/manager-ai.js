/* QR Menu — manager AI control center. Assistant can propose and execute safe actions. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_CENTER__)return;
  window.__QR_MANAGER_AI_CENTER__=true;

  var FEATURES=[
    ['assistant','ИИ-помощник','Общие вопросы и реальные действия в кабинете.'],
    ['menu_analysis','Анализ меню','Структура меню, категории, цены и рекомендации.'],
    ['menu_import','ИИ-импорт меню','Запуск существующего AI-импорта меню.'],
    ['analytics','ИИ-аналитика','Продажи, заказы, эффективность и точки роста.'],
    ['recipes','ИИ-рецептуры','Рецептуры, техкарты, нормы и рекомендации.'],
    ['chef','ИИ-шеф','Блюда, кухня, себестоимость и процессы.'],
    ['staff','ИИ-персонал','Персонал, роли, нагрузка и процессы.'],
    ['marketing','ИИ-маркетинг','Акции, тексты, предложения и продвижение.'],
    ['settings','ИИ-настройки','Настройки платформы и заведения.'],
    ['engineer','ИИ-инженер','Диагностика и технические рекомендации.']
  ];
  var DEFAULT_TASKS={
    assistant:'Помоги с задачей. Если для ответа нужно изменить данные, предложи безопасное действие для подтверждения.',
    menu_analysis:'Проанализируй текущее меню и предложи конкретные улучшения.',
    analytics:'Проанализируй текущие показатели заведения и найди точки роста.',
    recipes:'Проанализируй рецептуры, ингредиенты и себестоимость.',
    chef:'Оцени меню и процессы кухни с позиции шефа.',
    staff:'Проанализируй состав и нагрузку персонала.',
    marketing:'Предложи маркетинговый план на основе текущего меню.',
    settings:'Проведи аудит настроек заведения.',
    engineer:'Проведи техническую диагностику текущего кабинета.'
  };
  var MODULE_TABS={menu_analysis:'menu',analytics:'analytics',recipes:'recipes',chef:'menu',staff:'staff',marketing:'menu',settings:'settings'};
  var QUICK_TASKS={
    assistant:['Покажи продажи за сегодня','Измени цену блюда','Как пользоваться кабинетом?'],
    menu_analysis:['Найди слабые позиции','Проверь цены и категории'],
    analytics:['Найди точки роста выручки','Разбери самые продаваемые блюда'],
    recipes:['Найди неполные рецептуры','Проверь себестоимость блюд'],
    chef:['Найди узкие места кухни','Предложи блюда для усиления меню'],
    staff:['Найди перегрузку персонала','Проанализируй эффективность'],
    marketing:['Придумай акцию из текущего меню','Сделай 5 офферов'],
    settings:['Проверь настройки доставки','Проверь основные настройки'],
    engineer:['Проверь конфигурацию кабинета','Найди вероятные технические проблемы']
  };
  function vm(){return window.__managerVue||null;}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c];});}
  function allowed(v,f){try{return !!v&&typeof v.hasAIFeature==='function'&&v.hasAIFeature(f);}catch(e){return false;}}
  function compact(v,n){return Array.isArray(v)?v.slice(0,n||120):[];}
  function makeContext(v,feature){
    var venue=v&&v.venue||{},products=Array.isArray(v&&v.products)?v.products:[],orders=Array.isArray(v&&v.orders)?v.orders:[],a=v&&v.analytics||{};
    var c={feature:feature,current_tab:v&&v.tab||null,venue:{id:venue.id||null,name:venue.name||null,address:venue.address||null},menu:{count:products.length,items:compact(products)},orders:{count:orders.length,items:compact(orders,80)},analytics:{period_days:v&&v.analyticsPeriod||null,revenue:a.revenue||0,orders:a.orders||0,clients:a.clients||0,avgCheck:a.avgCheck||0,avgCookTime:a.avgCookTime||0,topItems:compact(a.topItems),topHours:compact(a.topHours),typeStats:a.typeStats||{},payStats:a.payStats||{}},staff:{cooks:compact(v&&v.cooks),couriers:compact(v&&v.couriers),waiters:compact(v&&v.waiters)},settings:{form:v&&v.vform||{},delivery_primary:v&&v.deliveryPrimaryName||null,delivery_providers:compact(v&&v.deliveryProviderCards)},plan:{name:v&&v.currentPlan&&v.currentPlan.name||null}};
    var rs=window.__QR_MANAGER_RECIPES_STATE__;
    if(rs)c.recipes={venue_id:rs.venueId||null,products:compact(rs.products),ingredients:compact(rs.ingredients),selected_product:rs.selected||null,selected_rows:compact(rs.rows),tech_cards:compact(rs.techCards)};
    if(feature==='engineer')c.engineer={url:location.pathname,online:navigator.onLine,language:navigator.language,viewport:{width:innerWidth,height:innerHeight},service_worker:!!navigator.serviceWorker};
    return JSON.stringify(c).slice(0,12000);
  }
  async function token(){if(!window.db||!db.auth)throw new Error('Supabase не подключен');var r=await db.auth.getSession(),t=r&&r.data&&r.data.session&&r.data.session.access_token;if(!t)throw new Error('Сессия управляющего не найдена');return t;}
  async function post(url,body){var t=await token(),r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify(body)}),d=await r.json().catch(function(){return{};});if(!r.ok||!d.ok)throw new Error(d.error||('HTTP_'+r.status));return d;}
  async function call(feature,message,v){
    if(!allowed(v,feature))throw new Error(v&&v.aiFeatureError?v.aiFeatureError(feature):'Функция ИИ не включена в тариф');
    var body={feature:feature,message:String(message||'').trim().slice(0,8000),context:makeContext(v,feature)};
    return post(feature==='assistant'?'/api/manager-ai-assistant-action':'/api/manager-ai',body);
  }
  function openImport(){var b=document.getElementById('qr-menu-import-block-v2');if(!b)return false;var bs=b.querySelectorAll('button');for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').toLowerCase();if(t.indexOf('импорт')>=0||t.indexOf('анализ')>=0){bs[i].click();return true;}}return false;}
  function openModule(f){var v=vm(),tab=MODULE_TABS[f];if(!v||!tab||!allowed(v,f))return false;v.tab=tab;return true;}

  function renderActions(answer,actions,panel){
    if(!Array.isArray(actions)||!actions.length)return;
    var box=document.createElement('div');box.style.cssText='margin-top:12px;border-top:1px solid rgba(148,163,184,.16);padding-top:10px;';
    var h=document.createElement('div');h.textContent='Предлагаемые изменения';h.style.cssText='font-weight:700;font-size:12px;margin-bottom:7px;color:#fff;';box.appendChild(h);
    actions.slice(0,5).forEach(function(action){
      var card=document.createElement('div');card.style.cssText='margin-top:7px;padding:10px;border:1px solid rgba(56,189,248,.25);border-radius:10px;background:rgba(14,116,144,.08);';
      var p=action.payload||{};
      card.innerHTML='<div style="font-weight:700;font-size:11px;color:#fff">'+esc(action.title||action.type)+'</div><div style="font-size:10px;color:#9fb5d4;margin-top:4px;line-height:1.4">'+esc(action.reason||'')+'</div><div data-preview style="margin-top:7px;font-size:10px;color:#dbeafe"></div><div style="display:flex;gap:6px;margin-top:8px"><button type="button" data-apply style="border:0;border-radius:8px;padding:7px 10px;background:linear-gradient(135deg,#147cf0,#21b7ff);color:#fff;cursor:pointer;font-size:11px;font-weight:700">Подтвердить и выполнить</button><button type="button" data-reject style="border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:7px 10px;background:transparent;color:#cbd5e1;cursor:pointer;font-size:11px">Отклонить</button></div><div data-status style="font-size:10px;margin-top:7px"></div>';
      var pr=card.querySelector('[data-preview]');
      if(action.type==='update_product_price')pr.textContent='Новая цена: '+(Number.isFinite(Number(p.price))?Number(p.price).toFixed(2):'—')+' ₽';
      else if(action.type==='update_product')pr.textContent='Изменение позиции: '+(p.name||p.description||'параметры товара');
      else if(action.type==='update_venue_settings')pr.textContent='Изменение настроек заведения';
      card.querySelector('[data-reject]').onclick=function(){card.remove();};
      card.querySelector('[data-apply]').onclick=async function(){
        var btn=this,status=card.querySelector('[data-status]');
        if(!window.confirm('Подтвердить применение этого изменения?'))return;
        btn.disabled=true;btn.textContent='Проверяю права…';
        try{
          var v=vm(),copy=JSON.parse(JSON.stringify(action));copy.payload=copy.payload||{};
          if(!copy.payload.venue_id&&v&&v.venue&&v.venue.id)copy.payload.venue_id=v.venue.id;
          await post('/api/manager-ai-assistant-action',{feature:'assistant',confirm:true,action:copy});
          btn.textContent='Выполнено';btn.style.opacity='.55';status.style.color='#86efac';status.textContent='Изменение подтверждено сервером и применено.';
          if(v&&typeof v.loadProducts==='function')await v.loadProducts();
          if(v&&typeof v.loadDeliverySettings==='function')await v.loadDeliverySettings();
        }catch(e){btn.disabled=false;btn.textContent='Подтвердить и выполнить';status.style.color='#fca5a5';status.textContent='Ошибка: '+(e.message||String(e));}
      };
      box.appendChild(card);
    });
    answer.appendChild(box);
  }

  function install(){
    if(document.getElementById('qr-ai-feature-center'))return true;
    var v=vm();if(!v)return false;
    var root=document.createElement('div');root.id='qr-ai-feature-center';root.style.cssText='position:fixed;right:18px;bottom:18px;z-index:15000;font-family:inherit;';
    root.innerHTML='<button type="button" id="qr-ai-feature-fab" aria-label="ИИ для управляющего" title="Qrchick — ИИ-помощник" style="width:78px;height:78px;border-radius:50%;border:2px solid rgba(62,196,255,.78);background:radial-gradient(circle at 50% 42%,#123c78 0,#06152e 62%,#020817 100%);color:#fff;font-size:0;box-shadow:0 0 0 5px rgba(22,140,255,.08),0 0 28px rgba(24,157,255,.60),0 18px 44px rgba(7,48,105,.32);cursor:pointer;position:relative;overflow:visible"><span style="display:block;width:100%;height:100%;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='31' fill='%23020916' stroke='%231aaaff' stroke-width='2'/%3E%3Cpath d='M24 38C9 15 49 5 65 18C89 12 94 45 79 57C89 79 56 95 39 78C15 85 5 53 24 38Z' fill='none' stroke='%23128fff' stroke-width='4'/%3E%3Ccircle cx='40' cy='48' r='5' fill='%23c7f7ff'/%3E%3Ccircle cx='60' cy='48' r='5' fill='%23c7f7ff'/%3E%3Cpath d='M39 63Q50 72 61 63' fill='none' stroke='%23bdf6ff' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E\");background-size:cover"></span><i style="position:absolute;right:-1px;bottom:3px;width:14px;height:14px;border-radius:50%;background:#20d77a;border:3px solid #07172f"></i></button><div id="qr-ai-feature-panel" style="display:none;position:absolute;right:0;bottom:88px;width:min(430px,calc(100vw - 28px));max-height:min(700px,calc(100vh - 100px));overflow:auto;background:rgba(5,23,53,.985);border:1px solid rgba(64,181,255,.46);border-radius:18px;box-shadow:0 24px 80px rgba(1,20,52,.55);padding:14px;backdrop-filter:blur(18px)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div><b style="font-size:16px;color:#fff">ИИ для управляющего</b><div style="font-size:11px;color:#a9c2e4;margin-top:3px">ИИ может предложить изменение и выполнить его после подтверждения</div></div><button type="button" id="qr-ai-feature-close" style="border:0;background:rgba(255,255,255,.07);color:#fff;font-size:20px;cursor:pointer">×</button></div><div id="qr-ai-feature-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:7px"></div><div id="qr-ai-feature-work" style="display:none;margin-top:12px;border-top:1px solid rgba(91,190,255,.15);padding-top:12px"></div></div>';
    document.body.appendChild(root);
    var style=document.createElement('style');style.id='qr-manager-qchick-style';style.textContent='@media(max-width:900px){#qr-ai-feature-center{right:14px!important;bottom:max(14px,env(safe-area-inset-bottom))!important}#qr-ai-feature-fab{width:66px!important;height:66px!important}#qr-ai-feature-panel{right:-4px!important;bottom:76px!important;width:calc(100vw - 20px)!important;max-height:min(760px,calc(100dvh - 100px))!important}}';document.head.appendChild(style);
    var fab=root.querySelector('#qr-ai-feature-fab'),panel=root.querySelector('#qr-ai-feature-panel'),buttons=root.querySelector('#qr-ai-feature-buttons'),work=root.querySelector('#qr-ai-feature-work');
    fab.onclick=function(){panel.style.display=panel.style.display==='none'?'block':'none';refresh();};
    root.querySelector('#qr-ai-feature-close').onclick=function(){panel.style.display='none';};
    function refresh(){var cur=vm(),any=false;buttons.innerHTML='';FEATURES.forEach(function(f){var ok=allowed(cur,f[0]);if(ok)any=true;var b=document.createElement('button');b.type='button';b.style.cssText='text-align:left;border:1px solid rgba(91,190,255,.18);border-radius:10px;padding:9px;background:rgba(22,86,145,.20);color:#e8f7ff;cursor:pointer;font-size:11px;line-height:1.25;opacity:'+(ok?'1':'.48')+';';b.innerHTML='<b>'+esc(f[1])+'</b><br><span style="color:#a9c2e4">'+esc(f[2])+'</span>';b.onclick=function(){if(!allowed(vm(),f[0])){if(vm()&&vm().showToast)vm().showToast(vm().aiFeatureError?vm().aiFeatureError(f[0]):'Функция ИИ не включена в тариф.','error');return;}if(f[0]==='menu_import'){if(!openImport()&&vm()&&vm().showToast)vm().showToast('Блок ИИ-импорта меню не найден.','error');return;}openWork(f);};buttons.appendChild(b);});root.style.display=any?'block':'none';}
    function openWork(f){
      work.style.display='block';var chips=QUICK_TASKS[f[0]]||[];var nav=MODULE_TABS[f[0]]?'<button type="button" id="qr-ai-feature-open-module" style="border:1px solid rgba(91,190,255,.18);border-radius:9px;padding:8px 10px;background:rgba(22,86,145,.20);color:#dff5ff;cursor:pointer">Открыть раздел</button>':'';
      work.innerHTML='<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:7px">'+esc(f[1])+'</div><div style="font-size:11px;color:#a9c2e4;margin-bottom:9px">'+esc(f[2])+'</div><div id="qr-ai-feature-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px"></div><textarea id="qr-ai-feature-input" placeholder="Напишите задачу для ИИ..." style="width:100%;min-height:90px;resize:vertical;box-sizing:border-box;background:rgba(255,255,255,.055);border:1px solid rgba(86,180,255,.22);border-radius:10px;color:#f5fbff;padding:10px;font:inherit;font-size:12px"></textarea><div style="display:flex;gap:7px;margin-top:8px"><button type="button" id="qr-ai-feature-send" style="flex:1;border:0;border-radius:10px;padding:10px;background:linear-gradient(135deg,#147cf0,#21b7ff);color:#fff;cursor:pointer;font-weight:700">Запустить ИИ</button>'+nav+'<button type="button" id="qr-ai-feature-clear" style="border:1px solid rgba(91,190,255,.18);border-radius:9px;padding:10px;background:transparent;color:#cbd5e1;cursor:pointer">Очистить</button></div><div id="qr-ai-feature-answer" style="display:none;margin-top:10px;white-space:pre-wrap;font-size:12px;line-height:1.55;background:rgba(255,255,255,.035);border-radius:10px;padding:11px;color:#eef8ff"></div>';
      var input=work.querySelector('#qr-ai-feature-input'),send=work.querySelector('#qr-ai-feature-send'),clear=work.querySelector('#qr-ai-feature-clear'),answer=work.querySelector('#qr-ai-feature-answer'),chipBox=work.querySelector('#qr-ai-feature-chips'),openBtn=work.querySelector('#qr-ai-feature-open-module');
      input.value=DEFAULT_TASKS[f[0]]||'';
      chips.forEach(function(text){var c=document.createElement('button');c.type='button';c.textContent=text;c.style.cssText='border:1px solid rgba(91,190,255,.16);border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.03);color:#cbd5e1;cursor:pointer;font-size:10px;';c.onclick=function(){input.value=text;input.focus();};chipBox.appendChild(c);});
      if(openBtn)openBtn.onclick=function(){if(openModule(f[0])){panel.style.display='none';if(vm().showToast)vm().showToast('Открыт рабочий раздел.','success');}};
      clear.onclick=function(){input.value='';answer.style.display='none';answer.innerHTML='';};
      send.onclick=async function(){var message=input.value.trim();if(!message)return;send.disabled=true;send.textContent='ИИ работает…';answer.style.display='block';answer.textContent='Выполняю запрос…';try{var data=await call(f[0],message,vm());answer.innerHTML='';var text=document.createElement('div');text.textContent=data.answer||data.reply||'ИИ не вернул ответ.';answer.appendChild(text);if(f[0]==='assistant')renderActions(answer,data.actions,panel);}catch(e){answer.textContent='Ошибка: '+(e.message||String(e));if(vm()&&vm().showToast)vm().showToast(e.message||'Ошибка ИИ','error');}finally{send.disabled=false;send.textContent='Запустить ИИ';}};
      input.focus();
    }
    refresh();return true;
  }
  function boot(){var n=0,t=setInterval(function(){n++;if(install()||n>80)clearInterval(t);},250);window.addEventListener('qr-manager-vue-ready',function(){setTimeout(install,50);},{once:true});}
  boot();
})();
