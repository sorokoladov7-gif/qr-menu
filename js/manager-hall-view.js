(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallView) return;
window.__managerHallView = true;

var panel = null;
var editor = null;
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
    }
  }catch(e){}
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
  css.push('.mhv-modal{position:fixed;inset:0;background:rgba(5,10,20,.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px}');
  css.push('.mhv-box{width:min(1200px,100%);max-height:94vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px;color:#fff}');
  css.push('.mhv-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px}');
  css.push('.mhv-plan{position:relative;width:100%;height:480px;background:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;border:1px dashed rgba(255,255,255,.18);border-radius:14px;overflow:auto;touch-action:none;margin-bottom:14px}');
  css.push('.mhv-table{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;font-size:11px;text-align:center;color:#fff;border:2px solid;transition:box-shadow .15s;box-shadow:0 4px 12px rgba(0,0,0,.3)}');
  css.push('.mhv-table:active{cursor:grabbing}');
  css.push('.mhv-table.dragging{box-shadow:0 12px 30px rgba(0,0,0,.5);z-index:100;opacity:.9}');
  css.push('.mhv-table.round{border-radius:50%}');
  css.push('.mhv-table.square{border-radius:10px}');
  css.push('.mhv-table.rectangle{border-radius:10px}');
  css.push('.mhv-table.free{background:rgba(52,211,153,.2);border-color:rgba(52,211,153,.6);color:#6ee7b7}');
  css.push('.mhv-table.busy{background:rgba(251,191,36,.2);border-color:rgba(251,191,36,.65);color:#fcd34d}');
  css.push('.mhv-table.reserved{background:rgba(99,102,241,.22);border-color:rgba(99,102,241,.65);color:#c7d2fe}');
  css.push('.mhv-table b{font-size:12px;pointer-events:none}');
  css.push('.mhv-table span{pointer-events:none;font-size:10px}');
  css.push('.mhv-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}');
  css.push('.mhv-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 14px;font-size:13px}');
  css.push('.mhv-stat b{display:block;font-size:19px}');
  css.push('.mhv-btn{border:0;border-radius:10px;padding:9px 14px;cursor:pointer;font-weight:700;font-size:13px}');
  css.push('.mhv-primary{background:#6366f1;color:#fff}');
  css.push('.mhv-ghost{background:rgba(255,255,255,.08);color:#fff}');
  css.push('.mhv-danger{background:#7f1d1d;color:#fff}');
  css.push('.mhv-green{background:#047857;color:#fff}');
  css.push('.mhv-warn{background:#b45309;color:#fff}');
  css.push('.mhv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}');
  css.push('.mhv-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px}');
  css.push('.mhv-muted{color:#94a3b8;font-size:12px}');
  css.push('.mhv-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}');
  css.push('.mhv-editor{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}');
  css.push('.mhv-editor-box{width:min(440px,100%);background:#1e293b;border:1px solid rgba(255,255,255,.15);border-radius:18px;padding:20px;color:#fff;max-height:92vh;overflow:auto}');
  css.push('.mhv-field{margin-bottom:14px}');
  css.push('.mhv-field label{display:block;font-size:12px;color:#94a3b8;margin-bottom:5px}');
  css.push('.mhv-field input,.mhv-field select{width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:10px;padding:10px;font-size:14px}');
  css.push('.mhv-shapes{display:flex;gap:8px}');
  css.push('.mhv-shape{flex:1;padding:12px 8px;border-radius:10px;background:rgba(255,255,255,.06);border:2px solid transparent;cursor:pointer;text-align:center;font-size:12px}');
  css.push('.mhv-shape.active{border-color:#6366f1;background:rgba(99,102,241,.2)}');
  css.push('.mhv-shape-icon{font-size:22px;display:block;margin-bottom:4px}');
  css.push('.mhv-status-badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:12px}');
  s.textContent = css.join('\n');
  document.head.appendChild(s);
}

function tableSize(t){
  var seats = Number(t.seats)||4;
  var base = seats<=2 ? 70 : seats<=4 ? 90 : seats<=6 ? 105 : 120;
  if(t.shape==='rectangle') return {w: base+40, h: base-20};
  return {w: base, h: base};
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

function statBadgeHtml(t){
  if(t.occupancy_status==='occupied') return '<span class="mhv-status-badge" style="background:rgba(251,191,36,.2);color:#fcd34d">🟡 Занят</span>';
  if(t.occupancy_status==='reserved') return '<span class="mhv-status-badge" style="background:rgba(99,102,241,.25);color:#c7d2fe">🕐 Зарезервирован</span>';
  return '<span class="mhv-status-badge" style="background:rgba(52,211,153,.2);color:#6ee7b7">🟢 Свободен</span>';
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
  var stats = panel.querySelector('#mhv-stats');

  var busyCount = tables.filter(function(t){ return t.occupancy_status==='occupied'; }).length;
  var reservedCount = tables.filter(function(t){ return t.occupancy_status==='reserved'; }).length;

  var statsHtml = [];
  statsHtml.push('<div class="mhv-stat"><b>' + tables.length + '</b>Столов</div>');
  statsHtml.push('<div class="mhv-stat"><b style="color:#fcd34d">' + busyCount + '</b>Занято</div>');
  statsHtml.push('<div class="mhv-stat"><b style="color:#c7d2fe">' + reservedCount + '</b>Резерв</div>');
  statsHtml.push('<div class="mhv-stat"><b style="color:#6ee7b7">' + (tables.length-busyCount-reservedCount) + '</b>Свободно</div>');
  stats.innerHTML = statsHtml.join('');

  plan.innerHTML = '';
  tables.forEach(function(t){
    var size = tableSize(t);
    var el = document.createElement('div');
    el.className = 'mhv-table ' + (t.shape||'round') + ' ' + statClass(t);
    el.style.width = size.w + 'px';
    el.style.height = size.h + 'px';
    el.style.left = (Number(t.pos_x)||80) + 'px';
    el.style.top = (Number(t.pos_y)||80) + 'px';
    el.innerHTML = '<b>' + esc(t.name||('Стол '+t.table_number)) + '</b><span>' + statLabel(t) + '</span><span>' + (t.seats||4) + ' мест</span>';

    el.addEventListener('mousedown', function(e){ startDrag(e, t, el); });
    el.addEventListener('touchstart', function(e){ startDrag(e.touches[0], t, el, e); }, {passive:false});
    plan.appendChild(el);
  });
}

function startDrag(e, t, el, touchEv){
  if(e.button !== undefined && e.button !== 0) return;
  var startX = e.clientX, startY = e.clientY;
  var origX = Number(t.pos_x)||80, origY = Number(t.pos_y)||80;
  var moved = false;
  el.classList.add('dragging');

  function onMove(ev){
    var point = ev.touches ? ev.touches[0] : ev;
    var dx = point.clientX - startX;
    var dy = point.clientY - startY;
    if(Math.abs(dx)>4 || Math.abs(dy)>4) moved = true;
    var nx = Math.max(5, origX + dx);
    var ny = Math.max(5, origY + dy);
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
    if(ev.touches) ev.preventDefault();
  }

  function onUp(){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    el.classList.remove('dragging');

    if(!moved){ openEditor(t); return; }

    var nx = parseInt(el.style.left)||origX;
    var ny = parseInt(el.style.top)||origY;
    t.pos_x = nx; t.pos_y = ny;
    rpc('manager_upsert_table', {
      p_venue_id: venue.id, p_table_id: t.id, p_table_number: t.table_number,
      p_name: t.name, p_seats: t.seats||4, p_shape: t.shape||'round',
      p_pos_x: nx, p_pos_y: ny
    }).catch(function(err){
      alert('Не удалось сохранить позицию: '+(err.message||err));
      load();
    });
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('touchend', onUp);
  if(touchEv) touchEv.preventDefault();
}

function openEditor(t){
  if(editor) editor.remove();
  editor = document.createElement('div');
  editor.className = 'mhv-editor';

  var h = [];
  h.push('<div class="mhv-editor-box">');
  h.push('<h3 style="margin:0 0 10px">✏️ ' + esc(t.name||('Стол '+t.table_number)) + '</h3>');
  h.push(statBadgeHtml(t));

  // Блок управления статусом
  h.push('<div class="mhv-field"><label>Управление столом</label><div class="mhv-row" style="margin-top:0">');
  if(t.occupancy_status==='occupied'){
    h.push('<button class="mhv-btn mhv-warn" id="mhv-e-free">🟢 Освободить стол</button>');
  } else if(t.occupancy_status==='reserved'){
    h.push('<button class="mhv-btn mhv-ghost" id="mhv-e-unreserve">✖ Снять резерв</button>');
    h.push('<button class="mhv-btn mhv-green" id="mhv-e-seat">✋ Посадить гостя</button>');
  } else {
    h.push('<button class="mhv-btn mhv-primary" id="mhv-e-reserve">🕐 Зарезервировать</button>');
    h.push('<button class="mhv-btn mhv-green" id="mhv-e-seat">✋ Посадить гостя</button>');
  }
  h.push('</div></div>');

  // Блок редактирования
  h.push('<div class="mhv-field"><label>Название</label><input id="mhv-e-name" value="' + esc(t.name||('Стол '+t.table_number)) + '"></div>');
  h.push('<div class="mhv-field"><label>Количество мест</label><input id="mhv-e-seats" type="number" min="1" max="20" value="' + (t.seats||4) + '"></div>');
  h.push('<div class="mhv-field"><label>Форма стола</label><div class="mhv-shapes">');
  h.push('<div class="mhv-shape ' + (t.shape==='round'?'active':'') + '" data-shape="round"><span class="mhv-shape-icon">⬤</span>Круг</div>');
  h.push('<div class="mhv-shape ' + (t.shape==='square'?'active':'') + '" data-shape="square"><span class="mhv-shape-icon">■</span>Квадрат</div>');
  h.push('<div class="mhv-shape ' + (t.shape==='rectangle'?'active':'') + '" data-shape="rectangle"><span class="mhv-shape-icon">▬</span>Прямоуг.</div>');
  h.push('</div></div>');

  h.push('<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">');
  h.push('<button class="mhv-btn mhv-primary" id="mhv-e-save">💾 Сохранить</button>');
  h.push('<button class="mhv-btn mhv-danger" id="mhv-e-del">🗑</button>');
  h.push('<button class="mhv-btn mhv-ghost" id="mhv-e-close" style="margin-left:auto">✕</button>');
  h.push('</div></div>');
  editor.innerHTML = h.join('');
  document.body.appendChild(editor);

  var selectedShape = t.shape || 'round';
  editor.querySelectorAll('.mhv-shape').forEach(function(sh){
    sh.onclick = function(){
      editor.querySelectorAll('.mhv-shape').forEach(function(x){ x.classList.remove('active'); });
      sh.classList.add('active');
      selectedShape = sh.dataset.shape;
    };
  });

  editor.onclick = function(e){ if(e.target===editor) closeEditor(); };
  editor.querySelector('#mhv-e-close').onclick = closeEditor;
  editor.querySelector('#mhv-e-del').onclick = function(){ removeTable(t); };
  editor.querySelector('#mhv-e-save').onclick = function(){ saveTable(t, selectedShape); };

  // Кнопки статусов
  var btnFree = editor.querySelector('#mhv-e-free');
  var btnUnreserve = editor.querySelector('#mhv-e-unreserve');
  var btnReserve = editor.querySelector('#mhv-e-reserve');
  var btnSeat = editor.querySelector('#mhv-e-seat');

  if(btnFree) btnFree.onclick = function(){ freeTable(t); };
  if(btnUnreserve) btnUnreserve.onclick = function(){ setStatus(t, 'free'); };
  if(btnReserve) btnReserve.onclick = function(){ reserveTable(t); };
  if(btnSeat) btnSeat.onclick = function(){ seatGuest(t); };
}

function closeEditor(){
  if(editor) editor.remove();
  editor = null;
}

function saveTable(t, shape){
  var name = editor.querySelector('#mhv-e-name').value.trim();
  var seats = Number(editor.querySelector('#mhv-e-seats').value)||4;
  rpc('manager_upsert_table', {
    p_venue_id: venue.id, p_table_id: t.id, p_table_number: t.table_number,
    p_name: name, p_seats: seats, p_shape: shape,
    p_pos_x: Number(t.pos_x)||80, p_pos_y: Number(t.pos_y)||80
  }).then(function(r){
    if(r.error) throw r.error;
    closeEditor();
    load();
  }).catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

// ОСВОБОДИТЬ СТОЛ (закрывает сессию, проверяет открытые заказы)
function freeTable(t){
  if(!confirm('Освободить ' + (t.name||('Стол '+t.table_number)) + '?\nСессия стола будет закрыта.')) return;
  rpc('manager_set_table_status', {
    p_venue_id: venue.id, p_table_id: t.id, p_status: 'free',
    p_reserved_until: null, p_note: null
  }).then(function(r){
    if(r.error) throw r.error;
    closeEditor();
    load();
  }).catch(function(e){
    var msg = e.message || String(e);
    if(msg.indexOf('table_has_open_orders')!==-1){
      alert('Нельзя освободить стол: по нему есть открытые заказы.\nСначала завершите или отмените их.');
    } else {
      alert('Ошибка: ' + msg);
    }
  });
}

// ЗАРЕЗЕРВИРОВАТЬ СТОЛ
function reserveTable(t){
  var mins = prompt('Зарезервировать на сколько минут?', '60');
  if(mins===null) return;
  var note = prompt('Комментарий (имя гостя, телефон):', '')||null;
  var until = new Date(Date.now() + Number(mins)*60000).toISOString();
  rpc('manager_set_table_status', {
    p_venue_id: venue.id, p_table_id: t.id, p_status: 'reserved',
    p_reserved_until: until, p_note: note
  }).then(function(r){
    if(r.error) throw r.error;
    closeEditor();
    load();
  }).catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

// ПОСАДИТЬ ГОСТЯ (открывает сессию)
function seatGuest(t){
  rpc('manager_set_table_status', {
    p_venue_id: venue.id, p_table_id: t.id, p_status: 'occupied',
    p_reserved_until: null, p_note: null
  }).then(function(r){
    if(r.error) throw r.error;
    closeEditor();
    load();
  }).catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

// Универсальная смена статуса
function setStatus(t, status){
  rpc('manager_set_table_status', {
    p_venue_id: venue.id, p_table_id: t.id, p_status: status,
    p_reserved_until: null, p_note: null
  }).then(function(r){
    if(r.error) throw r.error;
    closeEditor();
    load();
  }).catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function removeTable(t){
  if(!confirm('Удалить ' + (t.name||('Стол '+t.table_number)) + '?')) return;
  rpc('manager_delete_table', {p_venue_id: venue.id, p_table_id: t.id})
    .then(function(r){ if(r.error) throw r.error; closeEditor(); load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function addTable(){
  var count = prompt('Сколько столов добавить?', '1');
  if(count===null) return;
  var n = Math.max(1, Math.min(20, Number(count)||1));
  var maxNum = tables.reduce(function(m,t){ return Math.max(m, Number(t.table_number)||0); }, 0);
  var promises = [];
  for(var i=0; i<n; i++){
    promises.push(rpc('manager_upsert_table', {
      p_venue_id: venue.id, p_table_id: null, p_table_number: maxNum+i+1,
      p_name: 'Стол ' + (maxNum+i+1), p_seats: 4, p_shape: 'round',
      p_pos_x: 60 + (i%4)*140, p_pos_y: 60 + Math.floor(i/4)*140
    }));
  }
  Promise.all(promises).then(function(){ load(); }).catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

async function openPanel(){
  addStyles();
  venue = null;
  for(var i=0; i<5; i++){
    venue = await getVenue();
    if(venue) break;
    await new Promise(function(r){ setTimeout(r, 400); });
  }
  if(!venue){ alert('Не удалось определить заведение. Выберите его в кабинете.'); return; }
  if(panel) panel.remove();
  panel = document.createElement('div');
  panel.className = 'mhv-modal';
  var h = [];
  h.push('<div class="mhv-box">');
  h.push('<div class="mhv-head">');
  h.push('<div><h2 style="margin:0">🪑 Зал / Столы</h2><div style="color:#94a3b8;font-size:12px">' + esc(venue.name) + ' · клик по столу — управление</div></div>');
  h.push('<div style="display:flex;gap:8px;flex-wrap:wrap">');
  h.push('<button class="mhv-btn mhv-primary" id="mhv-add">+ Стол</button>');
  h.push('<button class="mhv-btn mhv-ghost" id="mhv-close">✕ Закрыть</button>');
  h.push('</div></div>');
  h.push('<div class="mhv-stats" id="mhv-stats"></div>');
  h.push('<div class="mhv-plan" id="mhv-plan"></div>');
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
