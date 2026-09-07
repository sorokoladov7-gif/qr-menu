/* QR Menu — canonical Qrchick manager AI. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_CENTER__) return;
  window.__QR_MANAGER_AI_CENTER__=true;

  var FEATURES=[
    ['assistant','Qrchick'],['menu_analysis','Анализ меню'],['menu_import','ИИ-импорт меню'],
    ['analytics','ИИ-аналитика'],['recipes','ИИ-рецептуры'],['chef','ИИ-шеф'],
    ['staff','ИИ-персонал'],['marketing','ИИ-маркетолог'],['settings','ИИ-настройщик'],['engineer','ИИ-инженер']
  ];
  var LABELS={}; FEATURES.forEach(function(x){LABELS[x[0]]=x[1];});
  var QUICK={
    assistant:['Покажи продажи за сегодня','Добавь блюдо в меню','Измени цену блюда','Создай сотрудника'],
    menu_analysis:['Найди слабые позиции','Проверь цены и категории'],
    menu_import:['Открой импорт меню','Запусти импорт меню'],
    analytics:['Найди точки роста выручки','Разбери продажи'],
    recipes:['Найди блюда без техкарт','Проверь себестоимость'],
    chef:['Найди узкие места кухни','Предложи улучшения меню'],
    staff:['Покажи персонал','Добавь повара'],
    marketing:['Придумай акцию из текущего меню','Сделай 5 офферов'],
    settings:['Проверь настройки заведения','Проверь настройки доставки'],
    engineer:['Проверь конфигурацию кабинета','Найди технические проблемы']
  };
  var state={open:false,feature:'assistant',history:[],busy:false,entitlementsReady:false};

  function vm(){return window.__managerVue||null;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}

  function normalizeSubscription(data){
    if(Array.isArray(data)) return data[0]||null;
    return data&&typeof data==='object'?data:null;
  }

  function syncEntitlements(){
    var v=vm();
    if(!v||!window.db||typeof db.rpc!=='function')return Promise.resolve(false);
    return db.rpc('manager_ensure_subscription').then(function(r){
      if(r.error)throw r.error;
      var sub=normalizeSubscription(r.data);
      v.managerSubscription=sub;
      if(sub&&sub.current_period_end)v.subscriptionEnd=sub.current_period_end;
      return db.from('plans').select('id,name,price,ai_enabled,ai_features,max_venues,max_products,is_active').order('price');
    }).then(function(r){
      if(r&&r.error)throw r.error;
      if(r&&Array.isArray(r.data)){
        v.plans=r.data;
        var s=normalizeSubscription(v.managerSubscription);
        if(s&&s.plan_id){
          var p=r.data.find(function(x){return String(x.id)===String(s.plan_id);});
          if(p)v.currentPlan=p;
        }
      }
      state.entitlementsReady=true;
      try{window.dispatchEvent(new CustomEvent('qr-manager-ai-entitlements-updated',{detail:{managerId:v.profile&&v.profile.id||null}}));}catch(e){}
      render();
      return true;
    }).catch(function(e){
      console.warn('[Qrchick] entitlement sync:',e);
      state.entitlementsReady=false;
      render();
      return false;
    });
  }

  function allowed(feature){
    var v=vm();
    try{
      if(!v)return false;
      if(v.profile&&v.profile.role==='admin')return true;
      var s=normalizeSubscription(v.managerSubscription);
      if(!s)return false;
      var status=String(s.status||'').toLowerCase();
      var end=s.current_period_end?new Date(s.current_period_end):null;
      if(['active','trialing'].indexOf(status)===-1||!end||isNaN(end.getTime())||end<new Date())return false;
      if(status==='trialing')return true;
      var plans=Array.isArray(v.plans)?v.plans:[];
      var p=plans.find(function(x){return String(x.id)===String(s.plan_id);})||null;
      if(!p&&v.currentPlan&&String(v.currentPlan.id)===String(s.plan_id))p=v.currentPlan;
      if(!p||p.is_active===false||p.ai_enabled!==true)return false;
      var features=p.ai_features&&typeof p.ai_features==='object'?p.ai_features:{};
      return features[feature]===true;
    }catch(e){
      console.warn('[Qrchick] entitlement check:',e);
      return false;
    }
  }

  function getToken(){
    if(!window.db||!db.auth||typeof db.auth.getSession!=='function')return Promise.reject(new Error('Supabase не подключен'));
    return db.auth.getSession().then(function(r){
      var t=r&&r.data&&r.data.session&&r.data.session.access_token;
      if(!t)throw new Error('Сессия управляющего не найдена');
      return t;
    });
  }
  function post(url,body){
    return getToken().then(function(t){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify(body)});})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){if(!r.ok||!d.ok)throw new Error(d.error||('HTTP_'+r.status));return d;});});
  }
  function context(feature){
    var v=vm()||{},venue=v.venue||{},products=Array.isArray(v.products)?v.products:[],orders=Array.isArray(v.orders)?v.orders:[],a=v.analytics||{};
    return JSON.stringify({feature:feature,current_tab:v.tab||null,venue:{id:venue.id||null,name:venue.name||null,address:venue.address||null,slug:venue.slug||null},menu:{count:products.length,items:products.slice(0,180)},orders:{count:orders.length,items:orders.slice(0,100)},analytics:{revenue:a.revenue||0,orders:a.orders||0,clients:a.clients||0,avgCheck:a.avgCheck||0,topItems:(a.topItems||[]).slice(0,30)},staff:{cooks:(v.cooks||[]).slice(0,80),couriers:(v.couriers||[]).slice(0,80),waiters:(v.waiters||[]).slice(0,80)},settings:{form:v.vform||{},delivery_primary:v.deliveryPrimaryName||null},plan:{name:v.currentPlan&&v.currentPlan.name||null},permissions:v.perms||{}}).slice(0,18000);
  }
  function format(text){return esc(text||'').replace(/```([\s\S]*?)```/g,function(_,x){return '<pre class="qrchick-code">'+esc(x.trim())+'</pre>';}).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');}

  function refresh(){
    var v=vm();if(!v)return;
    ['loadProducts','loadOrders','loadCooks','loadCouriers','loadWaiters','loadStaffAnalytics','loadDeliverySettings'].forEach(function(n){if(typeof v[n]==='function')Promise.resolve().then(function(){return v[n]();}).catch(function(){});});
  }
  function preview(a){var p=a&&a.payload||{};if(a.type==='create_product')return 'Новая позиция: <b>'+esc(p.name||'')+'</b> · '+esc(p.price==null?'—':p.price)+' ₽';if(a.type==='update_product_price')return 'Новая цена: <b>'+esc(p.price==null?'—':p.price)+' ₽</b>';if(a.type==='create_staff')return 'Сотрудник: <b>'+esc(p.name||'')+'</b> · '+esc(p.type||'');if(a.type==='update_order')return 'Статус заказа: <b>'+esc(p.status||'')+'</b>';return '';}
  function add(role,text,meta){state.history.push({id:'m_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),role:role,text:String(text||''),meta:meta||null});}

  function applyAction(btn){
    var card=btn.closest('.qrchick-action');if(!card)return;
    var ai=Number(btn.getAttribute('data-apply')),msg=null;
    for(var i=state.history.length-1;i>=0;i--){if(state.history[i].role==='assistant'&&state.history[i].meta&&Array.isArray(state.history[i].meta.actions)){msg=state.history[i];break;}}
    if(!msg||!msg.meta.actions[ai])return;
    var action=JSON.parse(JSON.stringify(msg.meta.actions[ai]));if(!confirm('Подтвердить применение этого изменения?'))return;
    var v=vm(),status=card.querySelector('.qrchick-action-status');action.payload=action.payload||{};
    if(!action.payload.venue_id&&v&&v.venue&&v.venue.id)action.payload.venue_id=v.venue.id;
    btn.disabled=true;btn.textContent='Проверяю права…';
    post('/api/manager-ai-action',{feature:action._feature||msg.meta.feature||state.feature,action:action}).then(function(r){btn.textContent='Выполнено';if(status){status.textContent=r.result&&r.result.text?'Готово: '+String(r.result.text).slice(0,300):'Изменение подтверждено и применено.';status.style.color='#86efac';}refresh();}).catch(function(e){btn.disabled=false;btn.textContent='Подтвердить и выполнить';if(status){status.textContent='Ошибка: '+(e.message||e);status.style.color='#fca5a5';}});
  }

  function render(){
    var panel=document.getElementById('qrchick-manager-panel');if(!panel)return;
    var list=document.getElementById('qrchick-manager-messages');
    if(list){list.innerHTML=state.history.map(function(m){var user=m.role==='user',actions=m.meta&&m.meta.actions||[],html='';if(!user&&actions.length){html='<div class="qrchick-action-list">'+actions.slice(0,20).map(function(a,i){return '<div class="qrchick-action"><div class="qrchick-action-title">'+esc(a.title||a.type||'Действие')+'</div><div class="qrchick-action-reason">'+esc(a.reason||'')+'</div><div class="qrchick-action-preview">'+preview(a)+'</div><div class="qrchick-action-buttons"><button data-apply="'+i+'">Подтвердить и выполнить</button><button data-reject="'+i+'" class="secondary">Отклонить</button></div><div class="qrchick-action-status"></div></div>';}).join('')+'</div>';}return '<div class="qrchick-msg '+(user?'user':'ai')+'"><div class="qrchick-msg-avatar">'+(user?'':'<img src="/assets/img/qrchick-avatar.svg?v=2" alt="Qrchick">')+'</div><div class="qrchick-msg-body">'+(user?'':'<div class="qrchick-name">Qrchick</div>')+'<div class="qrchick-bubble">'+format(m.text)+'</div>'+html+'</div></div>';}).join('');list.scrollTop=list.scrollHeight;list.querySelectorAll('[data-reject]').forEach(function(b){b.onclick=function(){var c=b.closest('.qrchick-action');if(c)c.remove();};});list.querySelectorAll('[data-apply]').forEach(function(b){b.onclick=function(){applyAction(this);};});}
    renderFeatures();panel.style.display=state.open?'flex':'none';
  }
  function send(text){
    var input=document.getElementById('qrchick-manager-input'),message=String(text!=null?text:(input?input.value:'')).trim();if(!message||state.busy)return;if(input)input.value='';
    var feature=state.feature;
    if(!allowed(feature)){syncEntitlements().then(function(){if(allowed(feature))send(message);else{add('assistant','Функция «'+LABELS[feature]+'» не включена в текущий тариф.');render();}});return;}
    add('user',message);add('assistant','Qrchick обрабатывает запрос…');render();state.busy=true;
    post('/api/manager-ai',{feature:feature,message:message.slice(0,8000),context:context(feature)}).then(function(d){var m=state.history[state.history.length-1];if(m&&m.role==='assistant'){m.text=String(d.answer||d.summary||'Готово.');m.meta={feature:feature,actions:(Array.isArray(d.actions)?d.actions:[]).map(function(a){var x=JSON.parse(JSON.stringify(a));x._feature=feature;return x;})};}render();}).catch(function(e){var m=state.history[state.history.length-1];if(m&&m.role==='assistant')m.text='Ошибка: '+(e.message||e);render();}).finally(function(){state.busy=false;});
  }
  function renderFeatures(){
    var b=document.getElementById('qrchick-manager-features'),q=document.getElementById('qrchick-manager-quick');
    if(b)b.innerHTML=FEATURES.map(function(f){var ok=allowed(f[0]),on=state.feature===f[0];return '<button type="button" class="qrchick-feature '+(on?'on ':'')+(ok?'':'locked')+'" data-feature="'+f[0]+'">'+esc(f[1])+(ok?'':' 🔒')+'</button>';}).join('');
    if(b)b.querySelectorAll('[data-feature]').forEach(function(x){x.onclick=function(){var f=x.getAttribute('data-feature');if(!allowed(f)){syncEntitlements();return;}state.feature=f;render();};});
    var items=QUICK[state.feature]||[];if(q)q.innerHTML=items.map(function(x){return '<button type="button" data-quick="'+encodeURIComponent(x)+'">'+esc(x)+'</button>';}).join('');if(q)q.querySelectorAll('[data-quick]').forEach(function(x){x.onclick=function(){send(decodeURIComponent(x.getAttribute('data-quick')));};});
    var v=vm(),meta=document.getElementById('qrchick-manager-context');if(meta)meta.textContent=v&&v.venue&&v.venue.name?'Qrchick · '+v.venue.name:'Qrchick · текущее заведение';
  }

  function install(){
    if(document.getElementById('qrchick-manager-root'))return true;
    var root=document.createElement('div');root.id='qrchick-manager-root';
    root.innerHTML='<button id="qrchick-manager-fab" type="button" aria-label="Qrchick" title="Qrchick — ИИ-помощник управляющего"><img src="/assets/img/qrchick-avatar.svg?v=2" alt="Qrchick"></button><section id="qrchick-manager-panel" aria-label="Qrchick"><header class="qrchick-manager-head"><div class="qrchick-manager-brand"><img src="/assets/img/qrchick-avatar.svg?v=2" alt="Qrchick"><div><b>Qrchick</b><span id="qrchick-manager-context">Qrchick · текущее заведение</span></div></div><button id="qrchick-manager-close" type="button">×</button></header><div class="qrchick-manager-sub">Выполняю задачи управляющего. Изменения данных — только после подтверждения.</div><div id="qrchick-manager-features"></div><div id="qrchick-manager-quick"></div><div id="qrchick-manager-messages"></div><div class="qrchick-manager-input"><textarea id="qrchick-manager-input" rows="2" placeholder="Напиши задачу для Qrchick…"></textarea><button id="qrchick-manager-send" type="button">➤</button></div><div id="qrchick-manager-status">Qrchick онлайн</div></section>';
    document.body.appendChild(root);
    var style=document.createElement('style');style.id='qrchick-manager-style';style.textContent='#qrchick-manager-root{position:fixed;right:18px;bottom:18px;z-index:15000;font-family:inherit;color:#fff}#qrchick-manager-fab{width:78px;height:78px;border-radius:50%;padding:0;border:2px solid rgba(62,196,255,.78);background:#06152e;box-shadow:0 0 28px rgba(24,157,255,.5);cursor:pointer;overflow:hidden}#qrchick-manager-fab img,#qrchick-manager-brand img{display:block;width:100%;height:100%;object-fit:cover}#qrchick-manager-panel{display:none;flex-direction:column;position:absolute;right:0;bottom:92px;width:min(500px,calc(100vw - 24px));height:min(760px,calc(100vh - 110px));background:rgba(5,23,53,.985);border:1px solid rgba(64,181,255,.46);border-radius:20px;box-shadow:0 24px 80px rgba(1,20,52,.55);backdrop-filter:blur(18px);overflow:hidden}.qrchick-manager-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;border-bottom:1px solid rgba(148,163,184,.12)}.qrchick-manager-brand{display:flex;align-items:center;gap:10px}.qrchick-manager-brand img{width:42px;height:42px;border-radius:50%;border:1px solid rgba(62,196,255,.5)}.qrchick-manager-brand b{display:block;font-size:17px}.qrchick-manager-brand span{display:block;margin-top:2px;font-size:10px;color:#9fb5d4}.qrchick-manager-head>button{border:0;background:rgba(255,255,255,.07);color:#fff;border-radius:9px;font-size:21px;width:32px;height:32px;cursor:pointer}.qrchick-manager-sub{padding:10px 16px;font-size:11px;color:#b6c9e4;line-height:1.45}#qrchick-manager-features,#qrchick-manager-quick{display:flex;gap:6px;overflow:auto;padding:0 12px 8px}.qrchick-feature,#qrchick-manager-quick button{white-space:nowrap;border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.035);color:#dbeafe;border-radius:9px;padding:7px 9px;font-size:10px;cursor:pointer}.qrchick-feature.on{border-color:rgba(55,185,255,.7);background:rgba(20,124,240,.13)}.qrchick-feature.locked{opacity:.48}.qrchick-manager-input{display:flex;gap:8px;align-items:end;padding:10px 12px;border-top:1px solid rgba(148,163,184,.12)}#qrchick-manager-input{flex:1;resize:none;min-height:40px;max-height:120px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(255,255,255,.045);color:#fff;padding:9px;font:inherit;font-size:12px;outline:none}#qrchick-manager-send{width:40px;height:40px;border:0;border-radius:12px;background:linear-gradient(135deg,#147cf0,#21b7ff);color:#fff;font-size:17px;cursor:pointer}#qrchick-manager-status{padding:0 12px 8px;font-size:9px;color:#7f98b9}#qrchick-manager-messages{flex:1;overflow:auto;padding:10px 14px}.qrchick-msg{display:flex;gap:8px;margin:10px 0}.qrchick-msg.user{justify-content:flex-end}.qrchick-msg-avatar{width:30px;flex:0 0 30px}.qrchick-msg-avatar img{width:30px;height:30px;border-radius:50%}.qrchick-msg-body{max-width:88%}.qrchick-name{font-size:10px;font-weight:700;margin:0 0 4px 2px;color:#bfeaff}.qrchick-bubble{padding:9px 11px;border-radius:13px;background:rgba(255,255,255,.055);font-size:12px;line-height:1.5;word-break:break-word}.qrchick-msg.user .qrchick-bubble{background:rgba(36,125,230,.22)}.qrchick-action{margin-top:7px;padding:9px;border:1px solid rgba(56,189,248,.25);border-radius:11px;background:rgba(14,116,144,.08)}.qrchick-action-title{font-weight:700;font-size:11px}.qrchick-action-reason{margin-top:4px;color:#9fb5d4;font-size:10px;line-height:1.4}.qrchick-action-preview{margin-top:6px;color:#dbeafe;font-size:10px}.qrchick-action-buttons{display:flex;gap:6px;margin-top:8px}.qrchick-action-buttons button{border:0;border-radius:8px;padding:7px 9px;background:#147cf0;color:#fff;cursor:pointer;font-size:10px;font-weight:700}.qrchick-action-buttons button.secondary{border:1px solid rgba(148,163,184,.2);background:transparent;color:#cbd5e1}.qrchick-action-status{margin-top:6px;font-size:10px;min-height:14px}.qrchick-code{margin:8px 0;padding:10px;background:#020817;overflow:auto;border-radius:10px}@media(max-width:900px){#qrchick-manager-root{right:12px;bottom:max(12px,env(safe-area-inset-bottom))}#qrchick-manager-fab{width:66px;height:66px}#qrchick-manager-panel{right:-6px;bottom:78px;width:calc(100vw - 18px);height:min(780px,calc(100dvh - 94px));border-radius:17px}}';document.head.appendChild(style);
    root.querySelector('#qrchick-manager-fab').onclick=function(){state.open=!state.open;if(state.open&&!state.history.length)add('assistant','Я Qrchick — ИИ-помощник управляющего. Могу выполнять доступные тебе операции с меню, заказами, персоналом, рецептами, залом, настройками и аналитикой.');render();if(state.open)syncEntitlements();};
    root.querySelector('#qrchick-manager-close').onclick=function(){state.open=false;render();};root.querySelector('#qrchick-manager-send').onclick=function(){send();};root.querySelector('#qrchick-manager-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});render();return true;
  }

  window.addEventListener('qr-manager-vue-ready',function(){setTimeout(function(){install();syncEntitlements();},100);});
  window.addEventListener('qr-manager-subscription-ready',function(){setTimeout(function(){install();syncEntitlements();},100);});
  window.addEventListener('qr-manager-ai-entitlements-updated',function(){render();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){install();syncEntitlements();},250);},{once:true});else setTimeout(function(){install();syncEntitlements();},250);
})();