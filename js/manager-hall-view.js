(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallView) return;
window.__managerHallView = true;

var panel=null, tables=[], venue=null, selected=null, editing=false, drag=null;

function getVM(){
  var el=document.getElementById('app');
  if(!el) return null;
  try{
    if(el.__vueParentComponent && el.__vueParentComponent.proxy) return el.__vueParentComponent.proxy;
    if(el.__vue_app__ && el.__vue_app__._instance && el.__vue_app__._instance.proxy) return el.__vue_app__._instance.proxy;
  }catch(e){}
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
  var stats=panel.querySelector('#mhv-stats');

  var busy=tables.filter(function(t){return t.occupancy_status==='occupied'}).length;
  var reserved=tables.filter(function(t){return t.occupancy_status==='reserved'}).length;
  var orders=tables.reduce(function(n,t){return n+Number(t.open_order_count||t.order_count||0)},0);
  var total=tables.reduce(function(n,t){return n+Number(t.total_amount||t.session_total||0)},0);

  stats.innerHTML='<div class="mhv-stat"><b>'+tables.length+'</b>Столов</div>'+
    '<div class="mhv-stat"><b style="color:#fcd34d">'+busy+'</b>Занято</div>'+
    '<div class="mhv-stat"><b style="color:#c7d2fe">'+reserved+'</b>Резерв</div>'+
    '<div class="mhv-stat"><b style="color:#6ee7b7">'+(tables.length-busy-reserved)+'</b>Свободно</div>'+
    '<div class="mhv-stat"><b>'+orders+'</b>Открытых заказов</div>'+
    '<div class="mhv-stat"><b>'+Number(total).toLocaleString('ru-RU')+' ₽</b>Сумма сессий</div>';

  // План-схема
  plan.innerHTML='';
  tables.forEach(function(t){
    var el=document.createElement('div');
    el.className='mhv-table '+stat(t)+(t.shape==='square'?' square':t.shape==='rectangle'?' rect':'');
    el.style.left=(Number(t.pos_x)||80)+'px';
    el.style.top=(Number(t.pos_y)||80)+'px';
    el.innerHTML='<b>'+esc(t.name||('Стол '+t.table_number))+'</b><span>'+statLabel(t)+'</span>'+
      (t.open_order_count?'<span>'+t.open_order_count+' зак.</span>':'');
    el.onclick=function(){ openCard(t); };
    // Drag & drop
    el.onmousedown=function(e){ startDrag(e,t,el); };
    plan.appendChild(el);
  });

  // Список карточек
  list.innerHTML='';
  tables.forEach(function(t){
    var card=document.createElement('div');
    card.className='mhv-card';
    card.innerHTML='<b style="font-size:16px">'+esc(t.name||('Стол '+t.table_number))+'</b>'+
      '<div class="mhv-muted">№'+t.table_number+' · '+statLabel(t)+' · '+Number(t.seats||4)+' мест</div>'+
      '<div class="mhv-qr"></div>'+
      '<div class="mhv-row">'+
      '<button class="mhv-btn mhv-primary" data-act="edit">✏️ Изменить</button>'+
      '<button class="mhv-btn mhv-ghost" data-act="reserve">'+(t.occupancy_status==='reserved'?'✖ Снять резерв':'🕐 Резерв')+'</button>'+
      '<button class="mhv-btn mhv-ghost" data-act="qr">🔄 QR</button>'+
      '<button class="mhv-btn mhv-danger" data-act="del">🗑</button>'+
      '</div>';
    var qrBox=card.querySelector('.mhv-qr');
    if(t.is_active!==false){ var img=document.createElement('img'); img.src=qrImg(t); img.alt='QR'; qrBox.appendChild(img); }
    else qrBox.innerHTML='<div style="color:#111827;font-weight:700">ОТКЛЮЧЁН</div>';

    card.querySelector('[data-act="edit"]').onclick=function(){ editTable(t); };
    card.querySelector('[data-act="reserve"]').onclick=function(){ reserveTable(t); };
    card.querySelector('[data-act="qr"]').onclick=function(){ regenQr(t); };
    card.querySelector('[data-act="del"]').onclick=function(){ removeTable(t); };
    list.appendChild(card);
  });
}

function startDrag(e,t,el){
  if(e.button!==0) return;
  var startX=e.clientX, startY=e.clientY;
  var origX=Number(t.pos_x)||80, origY=Number(t.pos_y)||80;
  var moved=false;
  function onMove(ev){
    var dx=ev.clientX-startX, dy=ev.clientY-startY;
    if(Math.abs(dx)>4||Math.abs(dy)>4) moved=true;
    el.style.left=(origX+dx)+'px';
    el.style.top=(origY+dy)+'px';
  }
  function onUp(ev){
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    if(!moved) return; // был клик, не drag
    var nx=Math.max(10,Math.min(2000,parseInt(el.style.left)||80));
    var ny=Math.max(10,Math.min(2000,parseInt(el.style.top)||80));
    rpc('manager_upsert_table',{p_venue_id:venue.id,p_table_id:t.id,p_table_number:t.table_number,p_name:t.name,p_seats:t.seats||4,p_shape:t.shape||'round',p_pos_x:nx,p_pos_y:ny})
      .then(function(r){ if(r.error) throw r.error; return load(); })
      .catch(function(err){ alert('Не удалось сохранить позицию: '+(err.message||err)); load(); });
  }
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
  e.preventDefault();
}

function openCard(t){ selected=t; alert((t.name||('Стол '+t.table_number))+'\n'+statLabel(t)+'\n\nИспользуйте карточку ниже для редактирования.'); }

function editTable(t){
  var name=prompt('Название стола:', t.name||('Стол '+t.table_number));
  if(name===null) return;
  var seats=prompt('Количество мест:', t.seats||4);
  if(seats===null) return;
  var shape=prompt('Форма (round / square / rectangle):', t.shape||'round');
  if(shape===null) return;
  if(['round','square','rectangle'].indexOf(shape)===-1){ alert('Неверная форма'); return; }
  rpc('manager_upsert_table',{p_venue_id:venue.id,p_table_id:t.id,p_table_number:t.table_number,p_name:name.trim(),p_seats:Number(seats)||4,p_shape:shape,p_pos_x:t.pos_x||80,p_pos_y:t.pos_y||80})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function addTable(){
  var name=prompt('Название нового стола:','Стол '+(tables.length+1));
  if(name===null) return;
  var seats=prompt('Количество мест:','4');
  if(seats===null) return;
  rpc('manager_upsert_table',{p_venue_id:venue.id,p_table_id:null,p_table_number:null,p_name:name.trim(),p_seats:Number(seats)||4,p_shape:'round',p_pos_x:80+(tables.length%5)*120,p_pos_y:80+Math.floor(tables.length/5)*120})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function reserveTable(t){
  if(t.occupancy_status==='reserved'){
    rpc('manager_set_table_status',{p_venue_id:venue.id,p_table_id:t.id,p_status:'free',p_reserved_until:null,p_note:null})
      .then(function(r){ if(r.error) throw r.error; return load(); })
      .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
    return;
  }
  var mins=prompt('Зарезервировать на сколько минут?','60');
  if(mins===null) return;
  var note=prompt('Комментарий (имя гостя):','')||null;
  var until=new Date(Date.now()+Number(mins)*60000).toISOString();
  rpc('manager_set_table_status',{p_venue_id:venue.id,p_table_id:t.id,p_status:'reserved',p_reserved_until:until,p_note:note})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function regenQr(t){
  if(!confirm('Старый QR перестанет работать. Создать новый?')) return;
  rpc('manager_regenerate_table_qr',{p_venue_id:venue.id,p_table_id:t.id})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function removeTable(t){
  if(!confirm('Удалить '+(t.name||('Стол '+t.table_number))+'?')) return;
  rpc('manager_delete_table',{p_venue_id:venue.id,p_table_id:t.id})
    .then(function(r){ if(r.error) throw r.error; return load(); })
    .catch(function(e){ alert('Ошибка: '+(e.message||e)); });
}

function printAll(){
  var w=window.open('','_blank','width=900,height=900');
  if(!w){ alert('Разрешите всплывающие окна'); return; }
  var html=tables.map(function(t){
    return '<div style="display:inline-block;width:30%;vertical-align:top;text-align:center;margin:10px;padding:12px;border:1px solid #ddd;border-radius:12px">'+
      '<b>'+esc(t.name||('Стол '+t.table_number))+'</b>'+
      '<img src="'+qrImg(t)+'" style="width:150px;height:150px;display:block;margin:10px auto">'+
      '<div style="color:#666;font-size:12px">Отсканируйте для заказа</div></div>';
  }).join('');
  w.document.write('<html><head><title>QR-коды столов</title></head><body style="font-family:Arial"><h1>QR-коды столов</h1>'+html+'</body></html>');
  w.document.close(); w.focus();
  setTimeout(function(){ w.print(); w.close(); },500);
}

function openPanel(){
  addStyles();
  var vm=getVM();
  venue=(vm&&vm.venue)||null;
  if(!venue && vm && vm.myVenues && vm.myVenues.length===1){ venue=vm.myVenues[0]; }
  if(!venue){ alert('Сначала выберите заведение в кабинете управляющего.'); return; }

  if(panel) panel.remove();
  panel=document.createElement('div');
  panel.className='mhv-modal';
  panel.innerHTML='<div class="mhv-box">'+
    '<div class="mhv-head"><div><h2 style="margin:0">🪑 Зал / Столы</h2><div class="mhv-muted">'+esc(venue.name)+' · перетаскивайте столы по схеме</div></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
    '<button class="mhv-btn mhv-primary" id="mhv-add">+ Стол</button>'+
    '<button class="mhv-btn mhv-ghost" id="mhv-print">🖨 Печать QR</button>'+
    '<button class="mhv-btn mhv-ghost" id="mhv-close">✕ Закрыть</button>'+
    '</div></div>'+
    '<div class="mhv-stats" id="mhv-stats"></div>'+
    '<div class="mhv-plan" id="mhv-plan"></div>'+
    '<div class="mhv-list" id="mhv-list"></div>'+
    '</div>';
  document.body.appendChild(panel);
  panel.querySelector('#mhv-close').onclick=closePanel;
  panel.querySelector('#mhv-add').onclick=addTable;
  panel.querySelector('#mhv-print').onclick=printAll;
  panel.onclick=function(e){ if(e.target===panel) closePanel(); };
  load();
}

function closePanel(){ if(panel) panel.remove(); panel=null; }

function addButton(){
  // Ищем вкладку «Зал / Столы» и вешаем на неё открытие панели
  var tabs=[].slice.call(document.querySelectorAll('button,.tab,.tabs button'));
  var hallTab=tabs.find(function(b){ return (b.textContent||'').indexOf('Зал')!==-1 && (b.textContent||'').indexOf('Столы')!==-1; });
  if(hallTab && !hallTab.__mhvBound){
    hallTab.__mhvBound=true;
    hallTab.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); openPanel(); },true);
    return true;
  }
  // Если вкладки нет — добавляем плавающую кнопку
  if(!document.getElementById('mhv-float-btn')){
    var b=document.createElement('button');
    b.id='mhv-float-btn';
    b.type='button';
    b.textContent='🪑 Зал';
    b.style.cssText='position:fixed;right:14px;bottom:80px;z-index:9998;border:0;border-radius:14px;padding:12px 16px;background:#6366f1;color:#fff;font-weight:800;box-shadow:0 8px 25px rgba(0,0,0,.35);cursor:pointer';
    b.onclick=openPanel;
    document.body.appendChild(b);
  }
  return !!hallTab;
}

function start(){
  addStyles();
  addButton();
  new MutationObserver(function(){ addButton(); }).observe(document.body,{childList:true,subtree:true});
  [300,800,1500,3000].forEach(function(ms){ setTimeout(addButton,ms); });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();
})();
