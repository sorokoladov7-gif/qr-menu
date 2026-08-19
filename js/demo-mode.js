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

// ─── 0. ПЕРЕХВАТ ЛЮБЫХ РЕДИРЕКТОВ ───
// Подменяем location.assign/replace/href setter
(function(){
  var origAssign = window.location.assign;
  var origReplace = window.location.replace;
  window.location.assign = function(url){
    if(String(url||'').indexOf('index.html')!==-1){
      console.warn('[demo] location.assign заблокирован:', url);
      return;
    }
    return origAssign.apply(this, arguments);
  };
  window.location.replace = function(url){
    if(String(url||'').indexOf('index.html')!==-1){
      console.warn('[demo] location.replace заблокирован:', url);
      return;
    }
    return origReplace.apply(this, arguments);
  };
  // Intercept через defineProperty на href
  try{
    var origHrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if(origHrefDesc && origHrefDesc.set){
      Object.defineProperty(window.location, 'href', {
        set: function(url){
          if(String(url||'').indexOf('index.html')!==-1){
            console.warn('[demo] location.href= заблокирован:', url);
            return;
          }
          return origHrefDesc.set.call(this, url);
        },
        get: function(){ return origHrefDesc.get.call(this); }
      });
    }
  }catch(e){}
})();

// ─── 1. Staff-сессии ───
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
    localStorage.setItem('qr_demo_mode', '1');
  }catch(e){}
}
seedStaffSessions();

// ─── 2. Полная подмена Supabase ───
function patchDb(){
  if(!window.db || window.__demoDbPatched) return;
  window.__demoDbPatched = true;

  window.db.auth = {
    getSession: function(){ return Promise.resolve({ data: { session: { user: D.user, access_token: 'demo' } }, error: null }); },
    getUser: function(){ return Promise.resolve({ data: { user: D.user }, error: null }); },
    signInWithPassword: function(){ return Promise.resolve({ data: { user: D.user, session: { user: D.user } }, error: null }); },
    signUp: function(){ return Promise.resolve({ data: { user: D.user }, error: null }); },
    signOut: function(){ localStorage.removeItem('qr_demo_mode'); location.href='index.html'; return Promise.resolve(); },
    onAuthStateChange: function(cb){ return { data: { subscription: { unsubscribe: function(){} } } }; }
  };

  var realRpc = null;
  if(window.db.rpc && !window.__demoRpcPatched){
    realRpc = window.db.rpc.bind(window.db);
    window.__demoRpcPatched = true;
  }
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
    return Promise.resolve({ data:null, error:null });
  };

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
      if(table==='plans') return { data:[{ id:'demo-plan', name:'Демо Тариф', price:1990, max_venues:3, max_cooks:10, max_couriers:10, max_waiters:10, max_products:100 }], error:null };
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

// ─── 3. Блокировка requireAuth / safeRedirect / logout ───
function blockAppFunctions(){
  if(typeof window.requireAuth === 'function' && !window.__demoAuthPatched){
    window.__demoAuthPatched = true;
    window.requireAuth = function(){ return Promise.resolve(D.profile); };
  }
  if(typeof window.safeRedirect === 'function' && !window.__demoSafePatched){
    window.__demoSafePatched = true;
    window.safeRedirect = function(){};
  }
  if(typeof window.logout === 'function' && !window.__demoLogoutPatched){
    window.__demoLogoutPatched = true;
    window.logout = function(){ localStorage.removeItem('qr_demo_mode'); window.location.assign = Location.prototype.assign; location.href='index.html'; };
  }
}

// ─── 4. Баннер ───
function showBanner(){
  if(document.getElementById('demo-banner')) return;
  var b = document.createElement('div');
  b.id = 'demo-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100001;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.2)';
  b.innerHTML = '🎮 ДЕМО-РЕЖИМ · <a href="index.html" style="color:#fff;text-decoration:underline" onclick="localStorage.removeItem(\'qr_demo_mode\')">Зарегистрироваться</a> · <a href="#" style="color:#fff;opacity:.8" onclick="localStorage.removeItem(\'qr_demo_mode\');location.reload();return false">✕ выйти</a>';
  document.body.appendChild(b);
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

// ─── 5. ПРИНУДИТЕЛЬНОЕ заполнение Vue-инстанса ───
function forceFillVue(){
  var vm = getVM();
  if(!vm) return false;

  // Базовые поля
  vm.profile = D.profile;
  vm.profileName = D.profile.display_name;
  vm.venue = D.venue;
  vm.venueName = D.venue.name;
  vm.myVenues = [D.venue];
  vm.venues = [D.venue];

  // Данные для manager.html
  if(isManager){
    vm.products = D.products;
    vm.orders = D.orders;
    vm.cooks = D.cooks;
    vm.couriers = D.couriers;
    vm.waiters = D.waiters;
    vm.tables = D.tables;
    vm.analytics = D.analytics;
    vm.revenue = D.analytics.revenue;
    vm.activeCount = D.orders.filter(function(o){return ['new','cooking','ready','delivery'].indexOf(o.status)!==-1}).length;
    vm.maxProducts = 100;
    vm.maxCooks = 10;
    vm.maxCouriers = 10;
    vm.maxWaiters = 10;
    vm.currentPlanName = 'Демо Тариф';
    vm.subscriptionEnd = D.venue.subscription_end;
    vm.daysLeft = 30;
    vm.busy = false;
    vm.loading = false;
    vm.loadError = null;

    // Подменяем методы загрузки чтобы не делали запросов
    if(typeof vm.loadAll === 'function'){
      vm.loadAll = function(){ return Promise.resolve(); };
    }
    if(typeof vm.loadOrders === 'function'){
      vm.loadOrders = function(){ return Promise.resolve(); };
    }
    if(typeof vm.loadProducts === 'function'){
      vm.loadProducts = function(){ return Promise.resolve(); };
    }
    if(typeof vm.loadCooks === 'function'){
      vm.loadCooks = function(){ return Promise.resolve(); };
    }
    if(typeof vm.loadCouriers === 'function'){
      vm.loadCouriers = function(){ return Promise.resolve(); };
    }
    if(typeof vm.loadWaiters === 'function'){
      vm.loadWaiters = function(){ return Promise.resolve(); };
    }
  }

  // Данные для staff
  if(isStaff){
    vm.session = { venueId: D.venue.id, venueName: D.venue.name, venueSlug: D.venue.slug };
    if(path.indexOf('cook')!==-1){ vm.session.cookName = D.session.cookName; vm.cookStats = D.cookStats || {total:34,done:28,avgTime:11,revenue:18400}; }
    if(path.indexOf('courier')!==-1){ vm.session.courierName = D.session.courierName; vm.courierStats = D.courierStats || {done:12,inProgress:1,total:13,revenue:9800}; }
    if(path.indexOf('waiter')!==-1){ vm.session.waiterName = D.session.waiterName; vm.waiterStats = D.waiterStats || {served:19,toCourier:6,total:25,revenue:14200}; }
    vm.orders = D.orders;
    vm.busy = false;
    vm.err = '';
  }

  // Данные для admin
  if(isAdmin){
    vm.venues = [D.venue];
    vm.mrr = 48750;
    vm.managers = [{ display_name: D.profile.display_name, email: D.profile.email, role: 'admin' }];
    vm.cooksAll = D.cooks;
    vm.couriersAll = D.couriers;
    vm.waitersAll = D.waiters;
    vm.busy = false;
  }

  return true;
}

// ─── 6. Авто-вход staff ───
function autoStaffLogin(){
  if(!isStaff) return;
  var tries = 0;
  var timer = setInterval(function(){
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
      if(t.indexOf('войти')!==-1 && t.indexOf('проверяем')===-1) loginBtn = btn;
    });
    if(slugInput && pinInput && !slugInput.value){
      slugInput.value = 'demo-cafe';
      pinInput.value = '1234';
      try{
        var e1 = new Event('input', {bubbles:true}); slugInput.dispatchEvent(e1);
        var e2 = new Event('input', {bubbles:true}); pinInput.dispatchEvent(e2);
      }catch(e){}
      if(loginBtn) setTimeout(function(){ loginBtn.click(); }, 100);
    }
    if(++tries > 30) clearInterval(timer);
  }, 300);
}

// ─── 7. Старт ───
function start(){
  patchDb();
  blockAppFunctions();
  showBanner();

  // Постоянно пытаемся подменить и заполнить Vue
  var tries = 0;
  var mainTimer = setInterval(function(){
    patchDb();
    blockAppFunctions();
    if(forceFillVue()){
      console.info('[demo] Vue заполнен успешно');
    }
    if(++tries > 100) clearInterval(mainTimer);
  }, 200);

  autoStaffLogin();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
