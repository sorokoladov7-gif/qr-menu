(function(){
'use strict';
var params = new URLSearchParams(location.search);
if(params.get('demo')==='1') localStorage.setItem('qr_demo_mode','1');
if(params.get('demo')==='0') localStorage.removeItem('qr_demo_mode');

var isDemo = localStorage.getItem('qr_demo_mode')==='1';
window.__isDemoMode = isDemo;
if(!isDemo) return;

var D = window.QR_DEMO_DATA || {};
var path = location.pathname.toLowerCase();
var isStaff = /(cook|courier|waiter)\.html$/i.test(path);
var isManager = /manager\.html$/i.test(path);
var isAdmin = /admin\.html$/i.test(path);

// ─── 1. Автоматически создаём staff-сессии в localStorage ───
function seedStaffSessions(){
  var base = { venueId: D.venue.id, venueName: D.venue.name, token: 'demo-token-' + Date.now() };
  try{
    localStorage.setItem('cook_session', JSON.stringify(Object.assign({}, base, { cookName: D.session.cookName })));
    localStorage.setItem('courier_session', JSON.stringify(Object.assign({}, base, { courierName: D.session.courierName })));
    localStorage.setItem('waiter_session', JSON.stringify(Object.assign({}, base, { waiterName: D.session.waiterName })));
    localStorage.setItem('cook_token', base.token);
    localStorage.setItem('courier_token', base.token);
    localStorage.setItem('waiter_token', base.token);
    localStorage.setItem('staff_token', base.token);
  }catch(e){}
}
seedStaffSessions();

// ─── 2. Подмена db (после config.js) ───
function patchDb(){
  if(!window.db) return;
  var realRpc = window.db.rpc ? window.db.rpc.bind(window.db) : null;
  var realAuth = window.db.auth || null;

  // Подмена auth для manager/admin
  if(realAuth){
    var realGetSession = realAuth.getSession ? realAuth.getSession.bind(realAuth) : null;
    realAuth.getSession = function(){
      return Promise.resolve({ data: { session: { user: D.user, access_token: 'demo' } }, error: null });
    };
    realAuth.signOut = function(){ localStorage.removeItem('qr_demo_mode'); location.href='index.html'; return Promise.resolve(); };
  }

  // Подмена rpc
  window.db.rpc = function(name, args){
    if(name==='staff_login'){
      var type = args && args.p_type;
      var nm = type==='cook'?D.session.cookName : type==='courier'?D.session.courierName : D.session.waiterName;
      return Promise.resolve({ data:{ staffId:'demo-'+type, staffName:nm, venueId:D.venue.id, venueName:D.venue.name, token:'demo-token-'+Date.now() }, error:null });
    }
    if(name==='staff_venue_by_slug') return Promise.resolve({ data:D.venue, error:null });
    if(name==='staff_orders_json' || name==='staff_history_json') return Promise.resolve({ data:D.orders, error:null });
    if(name==='staff_update_order') return Promise.resolve({ data:Object.assign({}, D.orders[0], {status: args&&args.p_status}), error:null });
    if(name==='manager_table_board') return Promise.resolve({ data:{ ok:true, venue_id:D.venue.id, tables:D.tables }, error:null });
    if(name==='manager_upsert_table') return Promise.resolve({ data:D.tables[0], error:null });
    if(name==='manager_delete_table') return Promise.resolve({ data:true, error:null });
    if(name==='manager_set_table_status') return Promise.resolve({ data:{ ok:true }, error:null });
    if(name==='manager_regenerate_table_qr') return Promise.resolve({ data:D.tables[0], error:null });
    if(name==='manager_reset_staff_pin') return Promise.resolve({ data:{ pin:String(Math.floor(1000+Math.random()*9000)) }, error:null });
    if(name==='customer_track_order_json') return Promise.resolve({ data:D.orders[0], error:null });
    if(name==='create_public_order') return Promise.resolve({ data:{ id:'demo-order', order_number:999, status:'new' }, error:null });
    if(realRpc) return realRpc(name, args);
    return Promise.resolve({ data:null, error:{ message:'demo: '+name } });
  };

  // Подмена from
  var realFrom = window.db.from ? window.db.from.bind(window.db) : null;
  window.db.from = function(table){
    function pick(){
      if(table==='profiles') return { data: D.profile, error:null };
      if(table==='venues') return { data:[D.venue], error:null };
      if(table==='manager_venues') return { data:[{ venue_id:D.venue.id, manager_id:'demo-user', venues:D.venue }], error:null };
      if(table==='products') return { data:D.products, error:null };
      if(table==='orders') return { data:D.orders, error:null };
      if(table==='venue_tables') return { data:D.tables, error:null };
      if(table==='cooks') return { data:D.cooks, error:null };
      if(table==='couriers') return { data:D.couriers, error:null };
      if(table==='waiters') return { data:D.waiters, error:null };
      if(table==='subscriptions') return { data:[{ venue_id:D.venue.id, status:'active', current_period_end:D.venue.subscription_end }], error:null };
      return { data:[], error:null };
    }
    function single(){
      var p = pick();
      return { data: Array.isArray(p.data)?(p.data[0]||null):p.data, error:p.error };
    }
    var chain = {
      select:function(){ return chain; },
      insert:function(v){ return Promise.resolve({ data:Array.isArray(v)?v:[v], error:null }); },
      update:function(v){ return Promise.resolve({ data:v, error:null }); },
      delete:function(){ return chain; },
      eq:function(){ return chain; },
      in:function(){ return chain; },
      order:function(){ return chain; },
      limit:function(){ return chain; },
      maybeSingle:function(){ return Promise.resolve(single()); },
      single:function(){ return Promise.resolve(single()); },
      then:function(a,b){ return Promise.resolve(pick()).then(a,b); },
      catch:function(a){ return Promise.resolve(pick()).catch(a); }
    };
    return chain;
  };
}

// ─── 3. Баннер демо ───
function showBanner(){
  if(document.getElementById('demo-banner')) return;
  var b = document.createElement('div');
  b.id = 'demo-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100001;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.2);font-family:sans-serif';
  b.innerHTML = '🎮 ДЕМО-РЕЖИМ · <a href="index.html" style="color:#fff;text-decoration:underline" onclick="localStorage.removeItem(\'qr_demo_mode\')">Зарегистрироваться</a> · <a href="#" style="color:#fff;opacity:.8" onclick="localStorage.removeItem(\'qr_demo_mode\');location.reload();return false">✕ выйти</a>';
  document.body.appendChild(b);
}

// ─── 4. Авто-вход на staff-страницах (симуляция формы) ───
function autoStaffLogin(){
  if(!isStaff) return;
  var tries = 0;
  var timer = setInterval(function(){
    var vm = getVM();
    // Если уже залогинен (session заполнен) — ничего не делаем
    if(vm && vm.session){ clearInterval(timer); return; }
    // Ищем форму входа и заполняем
    var inputs = document.querySelectorAll('input');
    var slugInput = null, pinInput = null, loginBtn = null;
    inputs.forEach(function(inp){
      var ph = (inp.placeholder||'').toLowerCase();
      if(ph.indexOf('код')!==-1 || ph.indexOf('slug')!==-1) slugInput = inp;
      if(ph.indexOf('pin')!==-1) pinInput = inp;
    });
    var btns = document.querySelectorAll('button');
    btns.forEach(function(btn){
      var t = (btn.textContent||'').toLowerCase();
      if(t.indexOf('войти')!==-1 || t.indexOf('проверяем')!==-1) loginBtn = btn;
    });
    if(slugInput && pinInput){
      slugInput.value = 'demo-cafe';
      pinInput.value = '1234';
      slugInput.dispatchEvent(new Event('input', {bubbles:true}));
      pinInput.dispatchEvent(new Event('input', {bubbles:true}));
      if(loginBtn) loginBtn.click();
      clearInterval(timer);
    }
    if(++tries > 30) clearInterval(timer);
  }, 300);
}

function getVM(){
  var el = document.getElementById('app');
  if(!el) return null;
  try{
    if(el.__vueParentComponent && el.__vueParentComponent.proxy) return el.__vueParentComponent.proxy;
    if(el.__vue_app__ && el.__vue_app__._instance && el.__vue_app__._instance.proxy) return el.__vue_app__._instance.proxy;
  }catch(e){}
  return null;
}

// ─── 5. Авто-выбор заведения в manager ───
function autoSelectVenue(){
  if(!isManager) return;
  var tries = 0;
  var timer = setInterval(function(){
    var vm = getVM();
    if(vm && vm.venue){ clearInterval(timer); return; }
    if(vm && !vm.venue){
      // Если есть список заведений и метод выбора
      if(vm.myVenues && vm.myVenues.length && typeof vm.selectVenue==='function'){
        vm.selectVenue(vm.myVenues[0]);
        clearInterval(timer);
        return;
      }
      // Прямая установка venue
      if(vm.myVenues && vm.myVenues.length){
        vm.venue = vm.myVenues[0];
        if(vm.loadAll) vm.loadAll();
        clearInterval(timer);
        return;
      }
    }
    if(++tries > 40) clearInterval(timer);
  }, 300);
}

function start(){
  patchDb();
  var tries = 0;
  var timer = setInterval(function(){
    if(window.db){ patchDb(); clearInterval(timer); }
    if(++tries > 40) clearInterval(timer);
  }, 250);
  showBanner();
  autoStaffLogin();
  autoSelectVenue();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
