(function(){
'use strict';
var params = new URLSearchParams(location.search);
var path = location.pathname.toLowerCase();

// Активация демо: ?demo=1 или localStorage
if(params.get('demo')==='1'){ localStorage.setItem('qr_demo_mode','1'); }
if(params.get('demo')==='0'){ localStorage.removeItem('qr_demo_mode'); }

var isDemo = localStorage.getItem('qr_demo_mode')==='1';
window.__isDemoMode = isDemo;
if(!isDemo) return;

var D = window.QR_DEMO_DATA || {};

// Подмена db.rpc и db.from на моки
function patchDb(){
  if(!window.db) return;
  var realRpc = window.db.rpc ? window.db.rpc.bind(window.db) : null;
  var realFrom = window.db.from ? window.db.from.bind(window.db) : null;

  window.db.rpc = function(name, args){
    // Логины персонала в демо
    if(name==='staff_login'){
      var type = args && args.p_type;
      var staffName = type==='cook'?'Иван Петров':type==='courier'?'Алексей Козлов':'Ольга Новикова';
      return Promise.resolve({ data:{ staffId:'demo-'+type, staffName:staffName, venueId:D.venue.id, venueName:D.venue.name, token:'demo-token-'+Date.now() }, error:null });
    }
    if(name==='staff_venue_by_slug') return Promise.resolve({ data: D.venue, error:null });
    if(name==='staff_orders_json' || name==='staff_history_json') return Promise.resolve({ data: D.orders, error:null });
    if(name==='staff_update_order'){
      return Promise.resolve({ data: Object.assign({}, D.orders[0], {status: args&&args.p_status}), error:null });
    }
    if(name==='manager_table_board') return Promise.resolve({ data:{ ok:true, tables: D.tables }, error:null });
    if(name==='manager_upsert_table') return Promise.resolve({ data: D.tables[0], error:null });
    if(name==='manager_delete_table') return Promise.resolve({ data: true, error:null });
    if(name==='manager_set_table_status') return Promise.resolve({ data:{ ok:true }, error:null });
    if(name==='manager_regenerate_table_qr') return Promise.resolve({ data: D.tables[0], error:null });
    if(name==='manager_reset_staff_pin') return Promise.resolve({ data:{ pin: String(Math.floor(1000+Math.random()*9000)) }, error:null });
    if(name==='customer_track_order_json') return Promise.resolve({ data: D.orders[0], error:null });
    if(realRpc) return realRpc(name, args);
    return Promise.resolve({ data:null, error:{ message:'demo: '+name } });
  };

  window.db.from = function(table){
    var empty = { data:null, error:null };
    var chain = {
      select:function(){ return chain; },
      insert:function(v){ empty.data = Array.isArray(v)?v:[v]; return chain; },
      update:function(v){ empty.data = v; return chain; },
      delete:function(){ return chain; },
      eq:function(){ return chain; },
      in:function(){ return chain; },
      order:function(){ return chain; },
      limit:function(){ return chain; },
      maybeSingle:function(){ return Promise.resolve(pickSingle(table)); },
      single:function(){ return Promise.resolve(pickSingle(table)); },
      then:function(a,b){ return Promise.resolve(pick(table)).then(a,b); },
      catch:function(a){ return Promise.resolve(pick(table)).catch(a); }
    };
    function pick(t){
      if(t==='products') return { data: D.products, error:null };
      if(t==='orders') return { data: D.orders, error:null };
      if(t==='venue_tables') return { data: D.tables, error:null };
      if(t==='cooks') return { data: D.cooks, error:null };
      if(t==='couriers') return { data: D.couriers, error:null };
      if(t==='waiters') return { data: D.waiters, error:null };
      if(t==='venues') return { data: [D.venue], error:null };
      if(t==='manager_venues') return { data: [{ venue_id: D.venue.id, venues: D.venue }], error:null };
      if(t==='profiles') return { data: { id:'demo-user', email:'demo@qr-setka.ru', display_name:'Демо Пользователь', role:'manager' }, error:null };
      return { data:[], error:null };
    }
    function pickSingle(t){
      var p = pick(t);
      return { data: Array.isArray(p.data)?(p.data[0]||null):p.data, error:p.error };
    }
    return chain;
  };
}

// Баннер демо-режима
function showBanner(){
  if(document.getElementById('demo-banner')) return;
  var b = document.createElement('div');
  b.id = 'demo-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100001;background:linear-gradient(90deg,#f59e0b,#f97316);color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.2);font-family:sans-serif';
  b.innerHTML = '🎮 ДЕМО-РЕЖИМ — данные не сохраняются · <a href="index.html" style="color:#fff;text-decoration:underline" onclick="localStorage.removeItem(\'qr_demo_mode\')">Зарегистрироваться и получить полный доступ</a> · <a href="#" style="color:#fff;opacity:.8" onclick="localStorage.removeItem(\'qr_demo_mode\');location.reload();return false">✕</a>';
  document.body.appendChild(b);
  // Сдвигаем контент чтобы баннер не перекрывал шапку
  document.body.style.paddingTop = '36px';
}

function start(){
  patchDb();
  // Ждём пока window.db создан (config.js может загрузиться позже)
  var tries = 0;
  var timer = setInterval(function(){
    if(window.db && window.db.rpc){ patchDb(); clearInterval(timer); }
    if(++tries > 40) clearInterval(timer);
  }, 250);
  showBanner();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
