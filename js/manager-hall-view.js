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
  return window.db.rpc(n, a).catch(function(err){
    console.error('RPC error:', n, err);
    throw err;
  });
}

function addStyles(){ /* ... (без изменений) */ }

function tableSize(t){ /* ... */ }

function tableUrl(t){ /* ... */ }

function qrImg(t){ /* ... */ }

function statClass(t){ /* ... */ }

function statLabel(t){ /* ... */ }

function statBadgeHtml(t){ /* ... */ }

async function load(){
  if(!venue) return;
  try {
    var r = await rpc('manager_table_board', {p_venue_id: venue.id});
    if(r.error) throw r.error;
    var d = r.data;
    tables = Array.isArray(d) ? d : (d && Array.isArray(d.tables) ? d.tables : []);
    render();
  } catch(e) {
    console.error('Load tables error:', e);
    alert('Не удалось загрузить столы: ' + (e.message||e));
  }
}

function render(){ /* ... (без изменений) */ }

function startDrag(e, t, el, touchEv){ /* ... (без изменений) */ }

function openEditor(t){ /* ... (без изменений) */ }

function closeEditor(){ /* ... */ }

function saveTable(t, shape){ /* ... (без изменений) */ }

function freeTable(t){ /* ... */ }

function reserveTable(t){ /* ... */ }

function seatGuest(t){ /* ... */ }

function setStatus(t, status){ /* ... */ }

function removeTable(t){ /* ... */ }

// ===== ИСПРАВЛЕННАЯ ФУНКЦИЯ addTable =====
function addTable(){
  var count = prompt('Сколько столов добавить?', '1');
  if(count===null) return;
  var n = Math.max(1, Math.min(20, Number(count)||1));
  var maxNum = tables.reduce(function(m,t){ return Math.max(m, Number(t.table_number)||0); }, 0);
  var promises = [];
  for(var i=0; i<n; i++){
    promises.push(rpc('manager_upsert_table', {
      p_venue_id: venue.id,
      p_table_id: null,
      p_table_number: maxNum + i + 1,
      p_name: 'Стол ' + (maxNum + i + 1),
      p_seats: 4,
      p_shape: 'round',
      p_pos_x: 60 + (i % 4) * 140,
      p_pos_y: 60 + Math.floor(i / 4) * 140
    }));
  }
  Promise.all(promises)
    .then(function(){
      load();
    })
    .catch(function(e){
      alert('Ошибка при добавлении столов: ' + (e.message || String(e)));
    });
}

function showQr(t){ /* ... */ }

function printAll(){ /* ... */ }

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
  h.push('<div><h2 style="margin:0">🪑 Зал / Столы</h2><div style="color:#94a3b8;font-size:12px">' + esc(venue.name) + ' · клик по столу — управление, перетаскивайте для перемещения</div></div>');
  h.push('<div style="display:flex;gap:8px;flex-wrap:wrap">');
  h.push('<button class="mhv-btn mhv-primary" id="mhv-add">+ Стол</button>');
  h.push('<button class="mhv-btn mhv-ghost" id="mhv-print">🖨 Печать всех QR</button>');
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
  panel.querySelector('#mhv-print').onclick = printAll;
  panel.onclick = function(e){ if(e.target===panel) closePanel(); };
  load();
}

function closePanel(){ /* ... */ }

function addButton(){ /* ... */ }

function start(){
  addStyles();
  addButton();
  new MutationObserver(function(){ addButton(); }).observe(document.body, {childList:true, subtree:true});
  [300, 800, 1500, 3000].forEach(function(ms){ setTimeout(addButton, ms); });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
