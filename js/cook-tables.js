(function(){
  'use strict';
  if(!/\/cook\.html$/i.test(location.pathname)) return;
  var panel=null,timer=null,loading=false,actionBusy=false,tableCache={},tableBusy={},documentBound=false;
  function getSession(){try{return JSON.parse(localStorage.getItem('cook_session')||'null');}catch(e){return null;}}
  function ensurePanel(){
    if(panel&&document.body.contains(panel)) return panel;
    var wrap=document.querySelector('#app .wrap');
    if(!wrap) return null;
    var stats=wrap.querySelector('.stats-grid');
    if(!stats) return null;
    panel=document.createElement('section');
    panel.id='cook-table-control';
    panel.className='glass card';
    panel.style.margin='0 0 18px';
    stats.insertAdjacentElement('afterend',panel);
    return panel;
  }
  function css(){
    if(document.getElementById('cook-table-control-css')) return;
    var s=document.createElement('style');s.id='cook-table-control-css';
    s.textContent='#cook-table-control .ct-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}#cook-table-control .ct-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}#cook-table-control .ct-table{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03)}#cook-table-control .ct-free{border-color:rgba(52,211,153,.28)}#cook-table-control .ct-occupied{border-color:rgba(248,113,113,.38)}#cook-table-control .ct-status{font-size:11px;font-weight:800;padding:4px 8px;border-radius:99px}#cook-table-control .ct-free .ct-status{background:rgba(52,211,153,.14);color:#6ee7b7}#cook-table-control .ct-occupied .ct-status{background:rgba(248,113,113,.14);color:#fca5a5}#cook-table-control .ct-meta{font-size:11px;color:#94a3b8;margin-top:7px}#cook-table-control .ct-actions{display:flex;gap:7px;margin-top:9px}#cook-table-control .ct-actions button{flex:1}#cook-table-control button[disabled]{opacity:.55;pointer-events:none}.cook-order-table{display:block!important;box-sizing:border-box!important;margin:7px 0!important;padding:7px 10px!important;border-radius:10px!important;background:rgba(99,102,241,.16)!important;border:1px solid rgba(129,140,248,.32)!important;color:#e0e7ff!important;font-size:12px!important;font-weight:800!important}.cook-history-table{display:inline-block!important;margin-left:8px!important;padding:3px 7px!important;border-radius:7px!important;background:rgba(99,102,241,.15)!important;color:#c7d2fe!important;font-size:11px!important;font-weight:800!important}';
    document.head.appendChild(s);
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){return Number(v||0).toLocaleString('ru-RU');}
  function minutes(v){if(!v)return '';var m=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/60000));return m<60?m+' мин':Math.floor(m/60)+' ч '+(m%60)+' мин';}
  function vue(){var el=document.getElementById('app');if(!el)return null;try{return el.__vueParentComponent?.proxy||el.__vue_app__?._instance?.proxy||null;}catch(e){return null;}}
  async function tableById(id,venueId){
    if(!id)return null;
    var key=String(id);
    if(tableCache[key])return tableCache[key];
    if(tableBusy[key])return null;
    tableBusy[key]=1;
    try{
      var r=await window.db.rpc('public_table_by_id',{p_table_id:id});
      if(r&&!r.error&&r.data&&(!venueId||String(r.data.venue_id)===String(venueId))){tableCache[key]=r.data;return r.data;}
    }catch(e){console.warn('cook table lookup:',e);}
    finally{delete tableBusy[key];}
    return null;
  }
  function tableText(t){if(!t)return '📦 Без стола';return '🪑 '+(t.table_number!=null?'Стол '+t.table_number:(t.name||'Стол'));}
  async function annotateOrders(){
    var x=vue();if(!x||!window.db)return;
    var s=getSession();var venueId=s&&s.venueId;
    var orders=Array.isArray(x.orders)?x.orders:[];
    var history=Array.isArray(x.history)?x.history:[];
    document.querySelectorAll('.wcard').forEach(async function(card){
      var b=card.querySelector('.spread b');
      var m=b&&String(b.textContent||'').match(/№\s*(\d+)/);if(!m)return;
      var o=orders.find(function(v){return String(v.order_number)===String(m[1]);});
      if(!o||!o.table_id)return;
      var t=await tableById(o.table_id,venueId);if(!t)return;
      var badge=card.querySelector('.cook-order-table');
      if(!badge){badge=document.createElement('div');badge.className='cook-order-table';var head=card.querySelector('.spread');if(head)head.insertAdjacentElement('afterend',badge);}
      badge.textContent=tableText(t);
    });
    document.querySelectorAll('#app .row').forEach(function(row){
      var b=row.querySelector('b');
      var m=b&&String(b.textContent||'').match(/^№\s*(\d+)$/);if(!m)return;
      var o=history.find(function(v){return String(v.order_number)===String(m[1]);});
      if(!o||!o.table_id)return;
      tableById(o.table_id,venueId).then(function(t){
        if(!t)return;
        var badge=row.querySelector('.cook-history-table');
        if(!badge){badge=document.createElement('span');badge.className='cook-history-table';b.insertAdjacentElement('afterend',badge);}
        badge.textContent=tableText(t);
      });
    });
  }
  async function refresh(){
    var s=getSession();
    if(!s||!s.token||typeof window.db==='undefined'||!window.db||typeof window.db.rpc!=='function') return;
    var p=ensurePanel();
    if(!p||loading||actionBusy) return;
    loading=true;
    try{
      var r=await window.db.rpc('cook_get_dashboard',{p_token:s.token});
      if(r.error) throw r.error;
      var d=r.data||{};
      if(Array.isArray(d)) d=d[0]||{};
      if(d.dashboard) d=d.dashboard;
      var waiterCount=Number(d.waiter_count||0);
      if(waiterCount>0){p.style.display='none';return;}
      p.style.display='block';
      var tables=Array.isArray(d.tables)?d.tables:[];
      var html='<div class="ct-head"><div><h4 style="margin:0">🪑 Столы</h4><div class="muted" style="font-size:12px;margin-top:3px">Официант не назначен — занятость столов контролирует кухня.</div></div><button class="btn btn-ghost btn-sm" id="ct-refresh" type="button">↻</button></div>';
      if(!tables.length){html+='<div class="muted">Столы ещё не настроены.</div>';}else{
        html+='<div class="ct-grid">';
        tables.forEach(function(t){
          var occ=t.occupancy_status==='occupied',sess=t.session;
          html+='<div class="ct-table '+(occ?'ct-occupied':'ct-free')+'"><div class="spread"><b>Стол '+esc(t.table_number)+'</b><span class="ct-status">'+(occ?'ЗАНЯТ':'СВОБОДЕН')+'</span></div>'+(t.name?'<div class="muted" style="font-size:12px;margin-top:4px">'+esc(t.name)+'</div>':'')+(occ?'<div class="ct-meta">Посадка: '+minutes(t.occupied_since)+' · Заказов: '+(sess?sess.order_count:0)+' · '+fmt(sess?sess.total_price:0)+' ₽</div>':'<div class="ct-meta">Гости ещё не сидят</div>')+'<div class="ct-actions">'+(occ?'<button type="button" class="btn btn-green btn-sm" data-ct-release="'+esc(t.id)+'">✓ Освободить</button>':'<button type="button" class="btn btn-primary btn-sm" data-ct-start="'+esc(t.id)+'">🪑 Посадить гостей</button>')+'</div></div>';
        });
        html+='</div>';
      }
      p.innerHTML=html;
    }catch(e){console.error('cook table control:',e);p.style.display='none';}
    finally{loading=false;}
    annotateOrders();
  }
  async function action(fn,id,button){
    var s=getSession();if(!s||!s.token||!window.db||actionBusy)return;
    if(fn==='cook_release_table'&&!window.confirm('Гости действительно ушли со стола?'))return;
    actionBusy=true;
    if(button){button.disabled=true;button.textContent='⏳ Обновление...';}
    try{
      var r=await window.db.rpc(fn,{p_token:s.token,p_table_id:id});
      if(r&&r.error)throw r.error;
      if(r&&r.data===false)throw new Error('Операция не выполнена');
      tableCache={};
      await refresh();
    }catch(e){console.error('cook table action:',e);alert(e&&e.message?e.message:'Не удалось изменить состояние стола');await refresh();}
    finally{actionBusy=false;}
  }
  function bindDocument(){
    if(documentBound)return;
    documentBound=true;
    document.addEventListener('click',function(e){
      var target=e.target&&e.target.closest?e.target.closest('button[data-ct-release],button[data-ct-start],#ct-refresh'):null;
      if(!target||!document.getElementById('cook-table-control')?.contains(target))return;
      if(target.id==='ct-refresh'){e.preventDefault();e.stopPropagation();refresh();return;}
      var release=target.getAttribute('data-ct-release');
      var start=target.getAttribute('data-ct-start');
      if(release){e.preventDefault();e.stopPropagation();action('cook_release_table',release,target);return;}
      if(start){e.preventDefault();e.stopPropagation();action('cook_start_table_session',start,target);return;}
    },true);
  }
  function start(){
    css();
    bindDocument();
    ensurePanel();
    refresh();
    if(timer)clearInterval(timer);
    timer=setInterval(function(){refresh();annotateOrders();},2000);
    new MutationObserver(function(){ensurePanel();annotateOrders();}).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('beforeunload',function(){if(timer)clearInterval(timer);});
})();