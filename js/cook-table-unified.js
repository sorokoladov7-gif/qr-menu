/* Kitchen tabs/modal controller. Legacy floating table button is disabled. */
(function(){
  'use strict';
  var TAB_KEY='qr_cook_tab';
  window.CookTableUnified={version:'4.0',managedBy:'cook-table-unified.js'};

  function token(){return localStorage.getItem('staff_token')||'';}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]});}
  function fmt(n){return Number(n||0).toLocaleString('ru-RU');}
  function arr(v){if(Array.isArray(v))return v;if(typeof v==='string'){try{return JSON.parse(v)||[]}catch(e){}}return[];}
  function status(s){return ({new:'Новый',changed:'Изменён',cooking:'Готовится',ready:'Готов',done:'Выдан',cancelled:'Отменён'})[s]||s||'';}

  function injectCss(){
    if(document.getElementById('qr-cook-tabs-css'))return;
    var s=document.createElement('style');s.id='qr-cook-tabs-css';s.textContent=''
      +'#staff-table-control-btn{display:none!important}'
      +'.qr-cook-tabs{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:12px 16px 8px;position:sticky;top:56px;z-index:90;background:rgba(11,17,32,.94);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.06)}'
      +'.qr-cook-tab{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#cbd5e1;border-radius:12px;padding:9px 14px;font-weight:800;cursor:pointer}'
      +'.qr-cook-tab:hover{background:rgba(255,255,255,.09)}'
      +'.qr-cook-modal{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:14px}'
      +'.qr-cook-sheet{width:min(980px,100%);max-height:90vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.5);padding:18px}'
      +'.qr-cook-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.qr-cook-head h2{margin:0;font-size:20px}'
      +'.qr-cook-close{border:0;border-radius:10px;padding:8px 11px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer}'
      +'.qr-cook-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}'
      +'.qr-cook-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px}'
      +'.qr-cook-muted{color:#94a3b8;font-size:12px}.qr-cook-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.qr-cook-btn{border:0;border-radius:10px;padding:9px 12px;color:#fff;font-weight:800;cursor:pointer}.qr-cook-primary{background:#4f46e5}.qr-cook-green{background:#047857}.qr-cook-red{background:#991b1b}.qr-cook-empty{text-align:center;color:#64748b;padding:35px 10px}'
      +'.qr-cook-loading{text-align:center;color:#94a3b8;padding:35px 10px}'
      +'.qr-cook-badge{display:inline-block;padding:3px 8px;border-radius:999px;background:rgba(99,102,241,.18);color:#c7d2fe;font-size:11px;font-weight:800;margin-left:6px}'
      +'.qr-cook-ingredients{margin-top:7px;color:#94a3b8;font-size:12px;line-height:1.45}'
      +'.qr-cook-status{font-size:11px;color:#cbd5e1;opacity:.9}'
      +'@media(max-width:700px){.qr-cook-tabs{top:52px;justify-content:flex-start;overflow-x:auto;flex-wrap:nowrap}.qr-cook-tab{white-space:nowrap}.qr-cook-sheet{max-height:94vh;padding:14px}}';
    document.head.appendChild(s);
  }

  function removeLegacyButton(){var b=document.getElementById('staff-table-control-btn');if(b)b.remove();}

  function getOrders(){return window.db.rpc('staff_orders_json',{p_token:token()}).then(function(r){if(r.error)throw r.error;return Array.isArray(r.data)?r.data:[];});}
  function getHistory(){return window.db.rpc('staff_history_json',{p_token:token()}).then(function(r){if(r.error)throw r.error;return Array.isArray(r.data)?r.data:[];});}
  function getTables(){return window.db.rpc('cook_get_table_dashboard',{p_token:token()}).then(function(r){if(r.error)throw r.error;return r.data||{};});}

  function openModal(title,loader){
    var m=document.createElement('div');m.className='qr-cook-modal';m.innerHTML='<div class="qr-cook-sheet"><div class="qr-cook-head"><h2>'+esc(title)+'</h2><button class="qr-cook-close">✕</button></div><div class="qr-cook-body"><div class="qr-cook-loading">Загрузка…</div></div></div>';
    document.body.appendChild(m);
    var body=m.querySelector('.qr-cook-body');
    var close=function(){m.remove()};
    m.querySelector('.qr-cook-close').onclick=close;
    m.addEventListener('click',function(e){if(e.target===m)close()});
    Promise.resolve().then(loader).then(function(html){body.innerHTML=html||'<div class="qr-cook-empty">Нет данных</div>';bindActions(body);}).catch(function(e){body.innerHTML='<div class="qr-cook-empty">Ошибка: '+esc(e&&e.message||e||'Не удалось загрузить данные')+'</div>';});
    return m;
  }

  function orderHtml(o){
    var items=arr(o.items);var addons=arr(o.addons);
    var h='<div class="qr-cook-card"><div><b>№'+esc(o.order_number||'—')+'</b>'+(o.table_name||o.table_number?'<span class="qr-cook-badge">🪑 '+esc(o.table_name||('Стол '+o.table_number))+'</span>':'')+'</div>';
    h+='<div class="qr-cook-status">'+esc(status(o.status))+' · '+fmt(o.total_price)+' ₽</div><div style="margin-top:8px">';
    if(items.length)items.forEach(function(i){h+='<div style="margin-bottom:7px"><b>'+esc(i.qty||i.quantity||1)+'× '+esc(i.name||i.product_name||'Товар')+'</b>';if(i.ingredients||i.description)h+='<div class="qr-cook-ingredients">Состав: '+esc(i.ingredients||i.description)+'</div>';h+='</div>';});
    if(addons.length){h+='<div class="qr-cook-ingredients"><b>Дополнения:</b> '+addons.map(function(a){return esc(a.qty||a.quantity||1)+'× '+esc(a.name||'Дополнение')}).join(', ')+'</div>';}
    if(o.comment)h+='<div class="qr-cook-ingredients">💬 '+esc(o.comment)+'</div>';
    h+='</div><div class="qr-cook-actions">';
    if(o.status==='new'||o.status==='changed')h+='<button class="qr-cook-btn qr-cook-primary" data-action="status" data-id="'+esc(o.id)+'" data-status="cooking">Взять</button>';
    if(o.status==='cooking')h+='<button class="qr-cook-btn qr-cook-green" data-action="status" data-id="'+esc(o.id)+'" data-status="ready">Готово</button>';
    if(o.status==='ready')h+='<button class="qr-cook-btn qr-cook-green" data-action="status" data-id="'+esc(o.id)+'" data-status="done">Выдан клиенту</button>';
    h+='</div></div>';return h;
  }

  function renderOrders(filter,title){
    return getOrders().then(function(list){var rows=list.filter(function(o){return filter(o)});return '<div class="qr-cook-grid">'+(rows.length?rows.map(orderHtml).join(''):'<div class="qr-cook-empty">Нет заказов</div>')+'</div>';});
  }

  function renderHistory(){
    return getHistory().then(function(list){var rows=list.slice().sort(function(a,b){return new Date(b.created_at||0)-new Date(a.created_at||0)});return '<div class="qr-cook-grid">'+(rows.length?rows.map(function(o){var h=orderHtml(o);return h.replace(/<button[^>]*data-action="status"[\s\S]*?<\/button>/g,'');}).join(''):'<div class="qr-cook-empty">История заказов пуста</div>')+'</div>';});
  }

  function renderTables(){
    return getTables().then(function(data){var rows=Array.isArray(data.tables)?data.tables:[];var can= data.can_control_tables!==false;var h='<div class="qr-cook-grid">';
      if(!rows.length)return '<div class="qr-cook-empty">Столы не настроены</div>';
      rows.forEach(function(t){var occ=t.occupancy_status==='occupied',res=t.occupancy_status==='reserved';h+='<div class="qr-cook-card"><div><b>🪑 '+esc(t.name||('Стол '+t.table_number))+'</b><span class="qr-cook-badge">'+(occ?'Занят':res?'Резерв':'Свободен')+'</span></div>';if(t.session)h+='<div class="qr-cook-muted" style="margin-top:7px">Заказов: '+fmt(t.session.order_count||0)+' · '+fmt(t.session.total_price||0)+' ₽</div>';else h+='<div class="qr-cook-muted" style="margin-top:7px">Нет активной сессии</div>';if(can){h+='<div class="qr-cook-actions">';if(occ)h+='<button class="qr-cook-btn qr-cook-red" data-action="release" data-id="'+esc(t.id)+'">Освободить</button>';else if(!res)h+='<button class="qr-cook-btn qr-cook-green" data-action="seat" data-id="'+esc(t.id)+'">Посадить</button>';else h+='<span class="qr-cook-muted">Зарезервирован</span>';h+='</div>';}h+='</div>';});h+='</div>';return h;});
  }

  function bindActions(root){
    root.querySelectorAll('[data-action="status"]').forEach(function(b){b.onclick=async function(){b.disabled=true;var r=await window.db.rpc('staff_update_order',{p_token:token(),p_order_id:b.dataset.id,p_status:b.dataset.status});if(r.error)alert(r.error.message);else{var m=root.closest('.qr-cook-modal');m&&m.remove();openTab(b.dataset.status==='cooking'?'new':b.dataset.status==='ready'?'cooking':'ready');}}});
    root.querySelectorAll('[data-action="seat"]').forEach(function(b){b.onclick=async function(){b.disabled=true;var r=await window.db.rpc('cook_start_table_session',{p_token:token(),p_table_id:b.dataset.id});if(r.error)alert(r.error.message);else{var m=root.closest('.qr-cook-modal');m&&m.remove();openTab('tables');}}});
    root.querySelectorAll('[data-action="release"]').forEach(function(b){b.onclick=async function(){b.disabled=true;var r=await window.db.rpc('cook_release_table',{p_token:token(),p_table_id:b.dataset.id});if(r.error)alert(r.error.message);else{var m=root.closest('.qr-cook-modal');m&&m.remove();openTab('tables');}}});
  }

  function openTab(key){
    localStorage.setItem(TAB_KEY,key);
    var titles={new:'🆕 Новые заказы',cooking:'🔥 Готовятся',ready:'✅ Готовы к выдаче',tables:'🪑 Столы',history:'📜 История заказов'};
    var loaders={
      new:function(){return renderOrders(function(o){return o.status==='new'||o.status==='changed'},titles.new)},
      cooking:function(){return renderOrders(function(o){return o.status==='cooking'},titles.cooking)},
      ready:function(){return renderOrders(function(o){return o.status==='ready'},titles.ready)},
      tables:renderTables,
      history:renderHistory
    };
    if(!loaders[key])return;openModal(titles[key],loaders[key]);
  }

  function install(){
    injectCss();removeLegacyButton();
    if(!document.body)return;
    if(document.getElementById('qr-cook-tabs'))return;
    var host=document.querySelector('.topbar');if(!host)return;
    var nav=document.createElement('div');nav.id='qr-cook-tabs';nav.className='qr-cook-tabs';
    [{k:'new',t:'🆕 Новые'},{k:'cooking',t:'🔥 Готовятся'},{k:'ready',t:'✅ Выдача'},{k:'tables',t:'🪑 Столы'},{k:'history',t:'📜 История'}].forEach(function(x){var b=document.createElement('button');b.className='qr-cook-tab';b.type='button';b.textContent=x.t;b.onclick=function(){openTab(x.k)};nav.appendChild(b);});
    host.parentNode.insertBefore(nav,host.nextSibling);
    removeLegacyButton();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else setTimeout(install,0);
  var mo=new MutationObserver(function(){removeLegacyButton();if(!document.getElementById('qr-cook-tabs'))install();});
  if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect()},20000);
})();
