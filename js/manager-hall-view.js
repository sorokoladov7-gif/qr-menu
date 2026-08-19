(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallView) return;
window.__managerHallView = true;

var panel=null, tables=[], venue=null;

// Надёжное получение Vue-инстанса (несколько способов)
function getVM(){
  var el=document.getElementById('app');
  if(!el) return null;
  try{
    if(el.__vueParentComponent && el.__vueParentComponent.proxy) return el.__vueParentComponent.proxy;
    if(el.__vue_app__ && el.__vue_app__._instance && el.__vue_app__._instance.proxy) return el.__vue_app__._instance.proxy;
    // Vue 3 root
    if(el.__vue_app__ && el.__vue_app__._context && el.__vue_app__._context.provides) return null;
  }catch(e){}
  return null;
}

// Надёжное получение заведения: Vue → myVenues → Supabase
async function getVenue(){
  // 1. Прямое свойство venue из Vue
  var vm=getVM();
  if(vm && vm.venue && vm.venue.id) return vm.venue;

  // 2. Если в Vue есть список заведений и он один
  if(vm){
    var list=vm.myVenues||vm.venues||vm.venuesList||null;
    if(Array.isArray(list) && list.length===1 && list[0].id) return list[0];
    if(Array.isArray(list) && list.length>1){
      // Ищем по имени в шапке
      var brand=document.querySelector('.brand span')||document.querySelector('.topbar b');
      var name=brand?String(brand.textContent||'').trim():'';
      var found=list.find(function(v){return v.name===name;});
      if(found) return found;
    }
  }

  // 3. Запасной путь: запрос к manager_venues
  try{
    var q=await db.from('manager_venues').select('venue_id, venues(*)');
    if(!q.error && q.data && q.data.length){
      var rows=q.data.map(function(x){return x.venues;}).filter(Boolean);
      if(rows.length===1) return rows[0];
      var brand2=document.querySelector('.brand span')||document.querySelector('.topbar b');
      var name2=brand2?String(brand2.textContent||'').trim():'';
      return rows.find(function(v){return v.name===name2;})||null;
    }
  }catch(e){ console.warn('[hall] getVenue fallback error', e); }
  return null;
}

function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function rpc(n,a){ if(!window.db||!window.db.rpc) return Promise.reject(new Error('Supabase не подключён')); return window.db.rpc(n,a); }

function addStyles(){
  if(document.getElementById('mhv-style')) return;
  var s=document.createElement('style'); s.id='mhv-style';
  s.textContent='.mhv-modal{position:fixed;inset:0;background:rgba(5,10,20,.82);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}.mhv-box{width:min(1100px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px;color:#fff}.mhv-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px}.mhv-plan{position:relative;width:100%;height:420px;background:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:24px 24px;border:1px dashed rgba(255,255,255,.15);border-radius:14px;overflow:auto;margin-bottom:14px}.mhv-table{position:absolute;width:84px;height:84px;border-radius:14px;background:rgba(52,211,153,.16);border:2px solid rgba(52,211,153,.5);color:#6ee7b7;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;font-size:12px;text-align:center}.mhv-table.busy{background:rgba(251,191,36,.16);border-color:rgba(251,191,36,.55);color:#fcd34d}.mhv-table.reserved{background:rgba(99,102,241,.18);border-color:rgba(99,102,241,.55);color:#c7d2fe}.mhv-table.square{border-radius:8px}.mhv-table.rect{border-radius:8px;width:110px;height:70px}.mhv-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.mhv-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 14px;font-size:13px}.mhv-stat b{display:block;font-size:20px}.mhv-btn{border:0;border-radius:10px;padding:9px 14px;cursor:pointer;font-weight:700;font-size:13px}.mhv-primary{background:#6366f1;color:#fff}.mhv-ghost{background:rgba(255,255,255,.08);color:#fff}.mhv-danger{background:#7f1d1d;color:#fff}.mhv-green{background:#047857;color:#fff}.mhv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.mhv-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px}.mhv-qr{background:#fff;border-radius:12px;padding:8px;width:140px;height:140px;margin:10px auto;display:flex;align-items:center;justify-content:center}.mhv-qr img{max-width:100%;max-height:100%}.mhv-muted{color:#94a3b8;font-size:12px}.mhv-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}';
  document.head.appendChild(s);
}

function tableUrl(t){
  return location.origin + location.pathname.replace(/manager\.html$/i,'menu.html') + '?table=' + encodeURIComponent(t.qr_token||t.id);
}
function qrImg(t){
  return 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=8&data='+encodeURIComponent(tableUrl(t));
}
function stat(t){
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
  var r=await rpc('manager_table_board',{p_venue_id:venue.id});
  if(r.error){ alert(r.error.message||'Не удалось загрузить столы'); return; }
  var d=r.data;
  tables=Array.isArray(d)?d:(d&&Array.isArray(d.tables)?d.tables:[]);
  render();
}

function render(){
  if(!panel) return;
  var plan=panel.querySelector('#mhv-plan');
  var list=panel.querySelector('#mhv-list');
