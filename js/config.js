const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const baseDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = baseDb;

(function(){
'use strict';
var path = location.pathname.toLowerCase();
var isMenu = /\/menu\.html$/i.test(path);
var staffMatch = path.match(/\/(cook|courier|waiter)\.html$/i);
var isStaff = !!staffMatch;
var staffType = isStaff ? staffMatch[1] : null;
var real = baseDb;
var oldFrom = real.from.bind(real);
var oldRpc = real.rpc.bind(real);

function staffToken(){
  if(window.StaffAuth && window.StaffAuth.token()) return window.StaffAuth.token();
  var keys = ['staff_token','cook_token','waiter_token','courier_token'];
  for(var i=0;i<keys.length;i++){
    var t = localStorage.getItem(keys[i]);
    if(t) return t;
  }
  return null;
}

function rememberStaffLogin(type, data){
  if(window.StaffAuth && data) window.StaffAuth.login(type, data);
  if(data && data.token){
    try{
      localStorage.setItem('staff_token', data.token);
      localStorage.setItem(type+'_token', data.token);
      localStorage.setItem(type+'_session', JSON.stringify({
        venueId: data.venueId, venueName: data.venueName,
        staffName: data.staffName, token: data.token
      }));
    }catch(e){}
  }
}

function resolveQrTable(venueId){
  var token = new URLSearchParams(location.search).get('table');
  if(!token) return Promise.resolve(null);
  if(window.__qrTable && window.__qrTable.qr_token === token) return Promise.resolve(window.__qrTable);
  var q = oldFrom('venue_tables')
    .select('id,venue_id,table_number,name,qr_token,is_active')
    .eq('qr_token', String(token).trim())
    .eq('is_active', true);
  if(venueId) q = q.eq('venue_id', venueId);
  return q.maybeSingle().then(function(r){
    if(!r.error && r.data) window.__qrTable = r.data;
    return r.data || null;
  });
}

function makeChain(table){
  var state = { action:'select', filters:{}, inFilters:{}, neqFilters:{}, payload:null };
  var api = {
    select: function(){ state.action='select'; return api; },
    insert: function(v){ state.action='insert'; state.payload=v; return api; },
    update: function(v){ state.action='update'; state.payload=v; return api; },
    delete: function(){ state.action='delete'; return api; },
    eq: function(k,v){ state.filters[k]=v; return api; },
    neq: function(k,v){ state.neqFilters[k]=v; return api; },
    in: function(k,v){ state.inFilters[k]=v; return api; },
    order: function(){ return api; },
    limit: function(){ return api; },
    maybeSingle: function(){ return execute(true); },
    single: function(){ return execute(true); },
    then: function(a,b){ return execute(false).then(a,b); },
    catch: function(a){ return execute(false).catch(a); }
  };

  function applyNeq(rows){
    if(!state.neqFilters || !Object.keys(state.neqFilters).length) return rows;
    return rows.filter(function(row){
      for(var k in state.neqFilters){
        if(row[k] === state.neqFilters[k]) return false;
      }
      return true;
    });
  }

  async function execute(single){
    if(isStaff && table==='venues' && state.action==='select' && state.filters.slug){
      var slug = String(state.filters.slug).trim().toLowerCase();
      localStorage.setItem(staffType+'_login_context', JSON.stringify({slug:slug}));
      var r = await oldRpc('staff_venue_by_slug', {p_slug:slug});
      return { data:r.error?null:r.data, error:r.error||null };
    }
    // 2. Перехват: вход персонала по PIN
if(isStaff && ['cooks','waiters','couriers'].indexOf(table)>=0 && state.action==='select' && state.filters.venue_id && state.filters.pin){
  var type = table==='cooks'?'cook':table==='waiters'?'waiter':'courier';
  var ctx = JSON.parse(localStorage.getItem(type+'_login_context')||'null')||{};
  var r2 = await oldRpc('staff_login', {p_type:type, p_slug:ctx.slug||'', p_pin:String(state.filters.pin)});
  // Новая функция возвращает JSON с error, а не exception
  if(r2.data && r2.data.error){
    return { data:null, error:{message: r2.data.error} };
  }
  if(r2.error) return { data:null, error:r2.error };
  rememberStaffLogin(type, r2.data);
  return {
    data: r2.data ? {id:r2.data.staffId, name:r2.data.staffName, venue_id:r2.data.venueId, token:r2.data.token} : null,
    error: null
  };
}
    if(isStaff && table==='orders' && state.action==='select'){
      var token = staffToken();
      if(!token) return { data:[], error:new Error('staff_session_missing') };
      var historyKey = state.filters.cook_name||state.filters.waiter_name||state.filters.courier_name;
      var r3 = await oldRpc(historyKey?'staff_history_json':'staff_orders_json', {p_token:token});
      if(r3.error) return { data:[], error:r3.error };
      var rows = Array.isArray(r3.data)?r3.data:[];
      rows = applyNeq(rows);
      return { data:single?(rows[0]||null):rows, error:null };
    }
    if(isStaff && table==='orders' && state.action==='update'){
      var token = staffToken();
      if(!token) return { data:null, error:new Error('staff_session_missing') };
      var r4 = await oldRpc('staff_update_order', {
        p_token:token, p_order_id:state.filters.id, p_status:state.payload&&state.payload.status
      });
      return { data:r4.data||null, error:r4.error||null };
    }
    if(table==='orders' && state.action==='select' && isMenu){
      var venueId = state.filters.venue_id;
      var phone = state.filters.customer_phone||localStorage.getItem('last_phone')||'';
      if(!venueId||!phone) return { data:null, error:new Error('tracking_context_missing') };
      var r5 = await oldRpc('customer_track_order_json', {p_venue_id:venueId, p_customer_phone:String(phone).trim()});
      return { data:single?(r5.data||null):(r5.data?[r5.data]:[]), error:r5.error||null };
    }
    if(table==='orders' && state.action==='update' && isMenu){
      return oldRpc('customer_change_order_status', {
        p_order_id:state.filters.id,
        p_customer_phone:localStorage.getItem('last_phone')||'',
        p_status:state.payload&&state.payload.status
      });
    }
    if(table==='orders' && state.action==='insert'){
      var payload = state.payload;
      var venueId = payload && payload.venue_id;
      var token = new URLSearchParams(location.search).get('table');
      if(token && venueId){
        var t = await resolveQrTable(venueId);
        if(t){
          if(Array.isArray(payload)) payload = payload.map(function(row){ return Object.assign({},row,{table_id:row.table_id||t.id}); });
          else payload = Object.assign({},payload,{table_id:payload.table_id||t.id});
        }
      }
      return oldFrom(table).insert(payload);
    }
    var q = oldFrom(table)[state.action](state.action==='select'?'*':state.payload);
    if(state.action!=='insert'){
      for(var fk in state.filters){ q = q.eq(fk, state.filters[fk]); }
      for(var ik in state.inFilters){ q = q.in(ik, state.inFilters[ik]); }
      for(var nk in state.neqFilters){ q = q.neq(nk, state.neqFilters[nk]); }
    }
    if(single) return state.action==='select'?q.maybeSingle():q;
    return q;
  }
  return api;
}

function rpc(name, args, options){
  if(name==='create_public_order' && args && typeof args==='object'){
    var token = new URLSearchParams(location.search).get('table');
    if(token) args = Object.assign({}, args, {p_table_token:String(token).trim()});
  }
  return oldRpc(name, args, options);
}

window.db = {
  from: function(table){
    if(isStaff) return makeChain(table);
    if(isMenu && table==='orders') return makeChain(table);
    return oldFrom(table);
  },
  rpc: rpc,
  auth: real.auth,
  storage: real.storage
};

async function bootQrTable(){
  if(!isMenu) return;
  var token = new URLSearchParams(location.search).get('table');
  if(!token) return;
  var t = await resolveQrTable(null);
  if(!t) return;
  localStorage.setItem('qr_table_id', t.id);
  localStorage.setItem('qr_table_number', String(t.table_number));
  localStorage.setItem('qr_table_name', t.name||('Стол '+t.table_number));
  renderCustomerTable();
}

function renderCustomerTable(){
  var t = window.__qrTable;
  if(!t) return;
  var b = document.getElementById('qr-table-fixed-badge');
  if(!b){
    b = document.createElement('div');
    b.id = 'qr-table-fixed-badge';
    b.style.cssText = 'position:fixed;top:74px;right:14px;z-index:9999;display:block;padding:10px 14px;border-radius:999px;background:#4f46e5;color:#fff;font-weight:800;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.35)';
    if(document.body) document.body.appendChild(b);
  }
  if(b) b.textContent = '🪑 ' + (t.name||('Стол '+t.table_number));
}

if(isMenu){
  bootQrTable();
  var n = 0;
  var timer = setInterval(function(){ renderCustomerTable(); if(++n>30) clearInterval(timer); }, 500);
}

async function loadStaffOrders(){
  if(!isStaff) return;
  var token = staffToken();
  if(!token) return;
  var r = await oldRpc('staff_orders_json', {p_token:token});
  if(!r.error && Array.isArray(r.data)) window.__staffTableOrders = r.data;
}

function installTableControl(){
  if(!isStaff) return;
  if(staffType==='courier') return;
  if(!document.body){ setTimeout(installTableControl, 100); return; }
  if(document.getElementById('staff-table-control-btn')) return;
  var btn = document.createElement('button');
  btn.id = 'staff-table-control-btn';
  btn.type = 'button';
  btn.textContent = '🪑 Столы';
  btn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9998;border:0;border-radius:14px;padding:12px 16px;background:#4f46e5;color:#fff;font-weight:800;box-shadow:0 8px 25px rgba(0,0,0,.35);cursor:pointer';
  document.body.appendChild(btn);
  btn.onclick = showStaffTables;
}

async function showStaffTables(){
  var token = staffToken();
  if(!token){ alert('Сессия сотрудника не найдена. Войдите заново.'); return; }
  var rpcName = staffType==='cook'?'cook_get_table_dashboard':'waiter_get_dashboard';
  var r = await oldRpc(rpcName, {p_token:token});
  if(r.error){
    var msg = (r.error.message||String(r.error)||'').toLowerCase();
    if(msg.indexOf('does not exist')!==-1 || msg.indexOf('403')!==-1 || msg.indexOf('not found')!==-1){
      alert('🪑 Управление столами пока не подключено.\n\nОбратитесь к администратору.');
    } else {
      alert('Не удалось загрузить столы: ' + (r.error.message||r.error));
    }
    return;
  }
  var payload = r.data||{};
  var tables = Array.isArray(payload.tables)?payload.tables:[];
  var canControl = staffType==='waiter'||payload.can_control_tables===true;
  var modal = document.getElementById('staff-table-modal');
  if(modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'staff-table-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,10,20,.82);backdrop-filter:blur(8px);padding:20px;overflow:auto';
  var box = document.createElement('div');
  box.style.cssText = 'max-width:900px;margin:20px auto;background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px;color:#fff';
  var head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px';
  head.innerHTML = '<h2 style="margin:0">🪑 Столы</h2><button id="staff-table-close" style="border:0;border-radius:10px;padding:9px 12px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer">✕</button>';
  box.appendChild(head);
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px';
  tables.forEach(function(t){
    var occupied = t.occupancy_status==='occupied';
    var card = document.createElement('div');
    card.style.cssText = 'border:1px solid '+(occupied?'rgba(251,191,36,.45)':'rgba(52,211,153,.35)')+';border-radius:14px;padding:14px;background:rgba(255,255,255,.03)';
    var actionText = occupied?'Освободить стол':'Посадить гостя';
    card.innerHTML = '<b style="font-size:17px">'+(t.name||('Стол '+t.table_number))+'</b>'
      + '<div style="margin:7px 0;color:'+(occupied?'#fcd34d':'#6ee7b7')+'">'+(occupied?'🟡 Занят':'🟢 Свободен')+'</div>'
      + (canControl?'<button class="staff-seat-btn" style="width:100%;margin-top:10px;border:0;border-radius:10px;padding:9px;background:'+(occupied?'#7f1d1d':'#047857')+';color:#fff;font-weight:700;cursor:pointer">'+actionText+'</button>':'<div style="margin-top:10px;color:#94a3b8;font-size:12px">Только просмотр</div>');
    var action = card.querySelector('.staff-seat-btn');
    if(action){
      action.onclick = async function(){
        action.disabled = true;
        var rr;
        if(occupied) rr = await oldRpc(staffType==='cook'?'cook_release_table':'waiter_release_table', {p_token:token, p_table_id:t.id});
        else rr = await oldRpc(staffType==='cook'?'cook_start_table_session':'waiter_start_table_session', {p_token:token, p_table_id:t.id});
        if(rr.error){ alert(rr.error.message||'Операция не выполнена'); action.disabled=false; return; }
        modal.remove();
        showStaffTables();
      };
    }
    grid.appendChild(card);
  });
  box.appendChild(grid);
  modal.appendChild(box);
  document.body.appendChild(modal);
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
  box.querySelector('#staff-table-close').onclick = function(){ modal.remove(); };
}

if(isStaff){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){
      installTableControl();
      loadStaffOrders();
      setInterval(loadStaffOrders, 3000);
    });
  } else {
    installTableControl();
    loadStaffOrders();
    setInterval(loadStaffOrders, 3000);
  }
}
})();

(function(){
'use strict';
var p = location.pathname.toLowerCase();
function load(src, key){
  if(document.querySelector('script['+key+']')) return;
  var s = document.createElement('script');
  s.src = src;
  s.async = false;
  s.setAttribute(key, '1');
  document.head.appendChild(s);
}
if(/\/admin\.html$/i.test(p)) load('/js/admin-design-access.js?v=1', 'data-admin-design-access');
if(/\/menu\.html$/i.test(p)) load('/js/design-runtime.js?v=2', 'data-design-runtime');
})();
