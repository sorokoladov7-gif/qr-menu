(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallView) return;
window.__managerHallView = true;

var panel = null;
var tables = [];
var venue = null;

function getVM(){
  var el = document.getElementById('app');
  if(!el) return null;
  try{
    if(el.__vueParentComponent && el.__vueParentComponent.proxy) return el.__vueParentComponent.proxy;
    if(el.__vue_app__ && el.__vue_app__._instance && el.__vue_app__._instance.proxy) return el.__vue_app__._instance.proxy;
  }catch(e){}
  return null;
}

async function getVenue(){
  var vm = getVM();
  if(vm && vm.venue && vm.venue.id) return vm.venue;
  if(vm){
    var list = vm.myVenues || vm.venues || null;
    if(Array.isArray(list) && list.length===1 && list[0].id) return list[0];
  }
  try{
    var q = await db.from('manager_venues').select('venue_id, venues(*)');
    if(!q.error && q.data && q.data.length){
      var rows = q.data.map(function(x){ return x.venues; }).filter(Boolean);
      if(rows.length===1) return rows[0];
      var brand = document.querySelector('.brand span');
      var name = brand ? String(brand.textContent||'').trim() : '';
      return rows.find(function(v){ return v.name===name; }) || null;
    }
  }catch(e){ console.warn('[hall] getVenue error', e); }
  return null;
}

function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function rpc(n, a){
  if(!window.db || !window.db.rpc) return Promise.reject(new Error('Supabase не подключён'));
  return window.db.rpc(n, a);
}

function addStyles(){
  if(document.getElementById('mhv-style')) return;
  var s = document.createElement('style');
  s.id = 'mhv-style';
  var css = [];
  css.push('.mhv-modal{position:fixed;inset:0;background:rgba(5,10,20,.82);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}');
  css.push('.mhv-box{width:min(1100px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px;color:#fff}');
  css.push('.mhv-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px}');
  css.push('.mhv-plan{position:relative;width:100%;height:420px;background:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:24px 24px;border:1px dashed rgba(255,255,255,.15);border-radius:14px;overflow:auto;margin-bottom:14px}');
  css.push('.mhv-table{position:absolute;width:84px;height:84px;border-radius:14px;background:rgba(52,211,153,.16);border:2px solid rgba(52,211,153,.5);color:#6ee7b7;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;font-size:12px;text-align:center}');
  css.push('.mhv-table.busy{background:rgba(251,191,36,.16);border-color:rgba(251,191,36,.55);color:#fcd34d}');
  css.push('.mhv-table.reserved{background:rgba(99,102,241,.18);border-color:rgba(99,102,241,.55);color:#c7d2fe}');
  css.push('.mhv-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}');
  css.push('.mhv-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 14px;font-size:13px}');
  css.push('.mhv-stat b{display:block;font-size:20px}');
  css.push('.mhv-btn{border:0;border-radius:10px;padding:9px 14px;cursor:pointer;font-weight:700;font-size:13px}');
  css.push('.mhv-primary{background:#6366f1;color:#fff}');
  css.push('.mhv-ghost{background:rgba(255,255,255,.08);color:#fff}');
  css.push('.mhv-danger{background:#7f1d1d;color:#fff}');
  css.push('.mhv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}');
  css.push('.mhv-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px}');
  css.push('.mhv-qr{background:#fff;border-radius:12px;padding:8px;width:140px;height:140px;margin:10px auto;display:flex;align-items:center;justify-content:center}');
  css.push('.mhv-qr img{max-width:100%;max-height:100%}');
  css.push('.mhv-muted{color:#94a3b8;font-size:12px}');
  css.push('.mhv-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}');
  s.textContent = css.join('\n');
  document.head.appendChild(s);
}

function tableUrl(t){
  return location.origin + location.pathname.replace(/manager\.html$/i,'menu.html') + '?table=' + encodeURIComponent(t.qr_token||t.id);
}

function qrImg(t){
  return 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=8&data=' + encodeURIComponent(tableUrl(t));
}

function statClass(t){
  if(t.occupancy_status==='occupied') return 'busy';
  if(t.occupancy_status==='reserved') return 'reserved';
  return 'free';
}

function statLabel(t){
  if(t.occupancy_status==='occupied') return '🟡 Занят';
  if(t.occupancy_status==='reserved') return '🕐 Резерв';
  return '🟢 Свободен';
}

async function load(){
  if(!venue) return;
  var r = await rpc('manager_table_board', {p_venue_id: venue.id});
  if(r.error){ alert(r.error.message || 'Не удалось загрузить столы'); return; }
  var d = r.data;
  tables = Array.isArray(d) ? d : (d && Array.isArray(d.tables) ? d.tables : []);
  render();
}

function render(){
  if(!panel) return;
  var plan = panel.querySelector('#mhv-plan');
  var list = panel.querySelector('#mhv-list');
  var stats = panel.querySelector('#mhv-stats');

  var busyCount = tables.filter(function(t){ return t.occupancy_status==='occupied'; }).length;
  var reservedCount = tables.filter(function(t){ return t.occupancy_status==='reserved'; }).length;
  var freeCount = tables.length - busyCount - reservedCount;

  var statsHtml = [];
  statsHtml.push('<div class="mhv-stat"><b>' + tables.length + '</b>Столов</div>');
  statsHtml.push('<div class="mhv-stat"><b style="color:#fcd34d">' + busyCount + '</b>Занято</div>');
  statsHtml.push('<div class="mhv-stat"><b style="color:#c7d2fe">' + reservedCount + '</b>Резерв</div>');
  statsHtml.push('<div class="mhv-stat"><b style="color:#6ee7b7">' + freeCount + '</b>Свободно</div>');
  stats.innerHTML = statsHtml.join('');

  plan.innerHTML = '';
  tables.forEach(function(t){
    var el = document.createElement('div');
    el.className = 'mhv-table ' + statClass(t);
    el.style.left = (Number(t.pos_x)||80) + 'px';
    el.style.top = (Number(t.pos_y)||80) + 'px';
    el.innerHTML = '<b>' + esc(t.name||('Стол '+t.table_number)) + '</b><span>' + statLabel(t) + '</span>';
    el.onclick = function(){ openCard(t); };
    plan.appendChild(el);
  });

  list.innerHTML = '';
  tables.forEach(function(t){
    var card = document.createElement('div');
    card.className = 'mhv-card';
    var h = [];
    h.push('<b style="font-size:16px">' + esc(t.name||('Стол '+t.table_number)) + '</b>');
    h.push('<div class="mhv-muted">№' + t.table_number + ' · ' + statLabel(t) + '</div>');
    h.push('<div class="mhv-qr"></div>');
    h.push('<div class="mhv-row">');
    h.push('<button class="mhv-btn mhv-primary" data-act="edit">✏️ Изменить</button>');
    h.push('<button class="mhv-btn mhv-ghost" data-act="reserve">' + (t.occupancy_status==='reserved'?'✖ Снять':'🕐 Резерв') + '</button>');
    h.push('<button class="mhv-btn mhv-ghost" data-act="qr">🔄 QR</button>');
    h.push('<button class="mhv-btn mhv-danger" data-act="del">🗑</button>');
    h.push('</div>');
    card.innerHTML = h.join('');

    var qrBox = card.querySelector('.mhv-qr');
    var img = document.createElement('img');
    img.src = qrImg(t);
    img.alt = 'QR';
    qrBox.appendChild(img);

    card.querySelector('[data-act="edit"]').onclick = function(){ editTable(t); };
    card.querySelector('[data-act="reserve"]').onclick = function(){ reserveTable(t); };
    card.querySelector('[data-act="qr"]').onclick = function(){ regenQr(t); };
    card.querySelector('[data-act="del"]').onclick = function(){ removeTable(t); };
    list.appendChild(card);
  });
}

function openCard(t){
  alert((t.name||('Стол '+t.table_number)) + '\n' + statLabel(t));
}

function editTable(t){
  var name = prompt('Название стола:', t.name||('Стол '+t.table_number));
  if(name===null) return;
  rpc('manager_upsert_table', {p_venue_id:venue.id, p_table_id:t.id, p_table_number:t.table_number, p_name:name.trim(), p_seats:t.seats||4, p_shape:t.shape||'round', p_pos_x:t.pos_x||80, p_pos_y:t.pos_y||80})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function addTable(){
  var name = prompt('Название нового стола:', 'Стол '+(tables.length+1));
  if(name===null) return;
  rpc('manager_upsert_table', {p_venue_id:venue.id, p_table_id:null, p_table_number:null, p_name:name.trim(), p_seats:4, p_shape:'round', p_pos_x:80, p_pos_y:80+(tables.length*40)})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function reserveTable(t){
  if(t.occupancy_status==='reserved'){
    rpc('manager_set_table_status', {p_venue_id:venue.id, p_table_id:t.id, p_status:'free', p_reserved_until:null, p_note:null})
      .then(function(r){ if(r.error) throw r.error; return load(); })
      .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
    return;
  }
  var mins = prompt('Зарезервировать на сколько минут?', '60');
  if(mins===null) return;
  var until = new Date(Date.now() + Number(mins)*60000).toISOString();
  rpc('manager_set_table_status', {p_venue_id:venue.id, p_table_id:t.id, p_status:'reserved', p_reserved_until:until, p_note:null})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function regenQr(t){
  if(!confirm('Старый QR перестанет работать. Создать новый?')) return;
  rpc('manager_regenerate_table_qr', {p_venue_id:venue.id, p_table_id:t.id})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function removeTable(t){
  if(!confirm('Удалить '+(t.name||('Стол '+t.table_number))+'?')) return;
  rpc('manager_delete_table', {p_venue_id:venue.id, p_table_id:t.id})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

async function openPanel(){
  addStyles();
  venue = null;
  for(var i=0; i<5; i++){
    venue = await getVenue();
    if(venue) break;
    await new Promise(function(r){ setTimeout(r, 400); });
  }
  if(!venue){
    alert('Не удалось определить заведение. Выберите его в кабинете управляющего.');
    return;
  }
  if(panel) panel.remove();
  panel = document.createElement('div');
  panel.className = 'mhv-modal';
  var h = [];
  h.push('<div class="mhv-box">');
  h.push('<div class="mhv-head">');
  h.push('<div><h2 style="margin:0">🪑 Зал / Столы</h2><div class="mhv-muted">' + esc(venue.name) + '</div></div>');
  h.push('<div style="display:flex;gap:8px;flex-wrap:wrap">');
  h.push('<button class="mhv-btn mhv-primary" id="mhv-add">+ Стол</button>');
  h.push('<button class="mhv-btn mhv-ghost" id="mhv-close">✕ Закрыть</button>');
  h.push('</div></div>');
  h.push('<div class="mhv-stats" id="mhv-stats"></div>');
  h.push('<div class="mhv-plan" id="mhv-plan"></div>');
  h.push('<div class="mhv-list" id="mhv-list"></div>');
  h.push('</div>');
  panel.innerHTML = h.join('');
  document.body.appendChild(panel);
  panel.querySelector('#mhv-close').onclick = closePanel;
  panel.querySelector('#mhv-add').onclick = addTable;
  panel.onclick = function(e){ if(e.target===panel) closePanel(); };
  load();
}

function closePanel(){
  if(panel) panel.remove();
  panel = null;
}

function addButton(){
  var tabs = [].slice.call(document.querySelectorAll('button, .tab'));
  var hallTab = tabs.find(function(b){
    var txt = b.textContent || '';
    return txt.indexOf('Зал')!==-1 && txt.indexOf('Столы')!==-1;
  });
  if(hallTab && !hallTab.__mhvBound){
    hallTab.__mhvBound = true;
    hallTab.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    }, true);
    return true;
  }
  return false;
}

function start(){
  addStyles();
  addButton();
  new MutationObserver(function(){ addButton(); }).observe(document.body, {childList:true, subtree:true});
  [300, 800, 1500, 3000].forEach(function(ms){ setTimeout(addButton, ms); });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
