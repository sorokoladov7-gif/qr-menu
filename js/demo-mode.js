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

// ─── 0. Staff-сессии в localStorage ───
(function(){
  var base = { venueId: D.venue.id, venueName: D.venue.name, token: 'demo-token-' + Date.now(), shiftOpen: true, shift_open: true };
  try{
    localStorage.setItem('cook_session', JSON.stringify(Object.assign({}, base, { cookName: D.session.cookName })));
    localStorage.setItem('courier_session', JSON.stringify(Object.assign({}, base, { courierName: D.session.courierName })));
    localStorage.setItem('waiter_session', JSON.stringify(Object.assign({}, base, { waiterName: D.session.waiterName })));
    localStorage.setItem('cook_token', base.token);
    localStorage.setItem('courier_token', base.token);
    localStorage.setItem('waiter_token', base.token);
    localStorage.setItem('staff_token', base.token);
    localStorage.setItem('cook_shift_open','1');
    localStorage.setItem('courier_shift_open','1');
    localStorage.setItem('waiter_shift_open','1');
    localStorage.setItem('staff_shift_open','1');
  }catch(e){}
})();

// ─── 1. Полная подмена Supabase ───
function patchDb(){
  if(!window.db || window.__demoDbPatched) return;
  window.__demoDbPatched = true;

  window.db.auth = {
    getSession: function(){ return Promise.resolve({ data: { session: { user: D.user, access_token: 'demo' } }, error: null }); },
    getUser: function(){ return Promise.resolve({ data: { user: D.user }, error: null }); },
    signInWithPassword: function(){ return Promise.resolve({ data: { user: D.user, session: { user: D.user } }, error: null }); },
    signInWithOtp: function(){ return Promise.resolve({ data: {}, error: null }); },
    signUp: function(){ return Promise.resolve({ data: { user: D.user }, error: null }); },
    signOut: function(){ localStorage.removeItem('qr_demo_mode'); location.href='index.html'; return Promise.resolve(); },
    onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; }
  };

  window.db.rpc = function(name, args){
    // Demo staff shifts are always open. These handlers only exist while
    // qr_demo_mode=1 and therefore cannot affect the production database.
    if(/shift/i.test(String(name))){
      var staffType = args && (args.p_type || args.p_staff_type || args.staff_type) || (isStaff ? (path.indexOf('cook')!==-1?'cook':path.indexOf('courier')!==-1?'courier':'waiter') : 'staff');
      var staffId = 'demo-' + staffType;
      if(/status|current|get|check|active|open/i.test(String(name))){
        return Promise.resolve({ data:{ ok:true, open:true, is_open:true, shift_open:true, status:'open', id:'demo-shift', shift_id:'demo-shift', staff_id:staffId, venue_id:D.venue.id, opened_at:new Date().toISOString() }, error:null });
      }
      if(/close/i.test(String(name))){
        return Promise.resolve({ data:{ ok:true, open:false, is_open:false, shift_open:false, status:'closed' }, error:null });
      }
      return Promise.resolve({ data:{ ok:true, open:true, is_open:true, shift_open:true, status:'open', id:'demo-shift', shift_id:'demo-shift', staff_id:staffId, venue_id:D.venue.id }, error:null });
    }
    if(name==='staff_login'){
      var type = args && args.p_type;
      var nm = type==='cook'?D.session.cookName : type==='courier'?D.session.courierName : D.session.waiterName;
      return Promise.resolve({ data:{ staffId:'demo-'+type, staffName:nm, venueId:D.venue.id, venueName:D.venue.name, token:'demo-token-'+Date.now(), expiresAt: Date.now()+12*60*60*1000, shiftOpen:true, shift_open:true }, error:null });
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
    if(name==='get_public_table') return Promise.resolve({ data:D.tables[0], error:null });
    return Promise.resolve({ data:null, error:null });
  };

  window.db.from = function(table){
    function pick(){
      // Any demo shift table is represented by one already-open shift.
      if(/shift/i.test(String(table))) return { data:[{ id:'demo-shift', venue_id:D.venue.id, staff_id:'demo-staff', status:'open', is_open:true, open:true, opened_at:new Date().toISOString() }], error:null };
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

// ─── 2. Безопасная блокировка редиректов ───
function blockRedirects(){
  if(typeof window.safeRedirect === 'function' && !window.__demoSafePatched){
    window.__demoSafePatched = true;
    window.safeRedirect = function(){};
  }
  if(typeof window.requireAuth === 'function' && !window.__demoAuthPatched){
    window.__demoAuthPatched = true;
    window.requireAuth = function(){ return Promise.resolve(D.profile); };
  }
  if(typeof window.logout === 'function' && !window.__demoLogoutPatched){
    window.__demoLogoutPatched = true;
    window.logout = function(){ localStorage.removeItem('qr_demo_mode'); location.href='index.html'; };
  }

  if(!window.__demoHistoryPatched){
    window.__demoHistoryPatched = true;
    try{
      var origPush = history.pushState.bind(history);
      var origReplace = history.replaceState.bind(history);
      history.pushState = function(state,title,url){
        if(url && String(url).indexOf('index.html')!==-1){ console.warn('[demo] history.pushState to index blocked'); return; }
        return origPush(state,title,url);
      };
      history.replaceState = function(state,title,url){
        if(url && String(url).indexOf('index.html')!==-1){ console.warn('[demo] history.replaceState to index blocked'); return; }
        return origReplace(state,title,url);
      };
    }catch(e){}
  }
}

function showBanner(){ /* ... без изменений */ }
function getVM(){ /* ... без изменений */ }
function forceFillVue(){ /* ... без изменений */ }
function autoStaffLogin(){ /* ... без изменений */ }

function start(){
  patchDb();
  blockRedirects();
  showBanner();
  var tries=0;
  var mainTimer=setInterval(function(){
    patchDb(); blockRedirects(); forceFillVue();
    if(++tries>100) clearInterval(mainTimer);
  },200);
  autoStaffLogin();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
