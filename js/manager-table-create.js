(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerTableCreate) return;
window.__managerTableCreate=true;

function vm(){
  var el=document.getElementById('app');
  try{return el && el.__vue_app__ && el.__vue_app__._instance && el.__vue_app__._instance.proxy || null;}catch(e){return null;}
}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function open(){
  var v=vm(), venue=v&&v.venue;
  if(!venue||!venue.id){alert('Сначала выберите заведение.');return;}
  if(document.getElementById('manager-table-create-modal')) return;
  var m=document.createElement('div');m.id='manager-table-create-modal';
  m.innerHTML='<div class="mtc-backdrop"><div class="mtc-box"><div class="mtc-head"><div><h3 style="margin:0">Добавить стол</h3><div class="mtc-muted">'+esc(venue.name)+'</div></div><button class="mtc-x" id="mtc-close">×</button></div>'+
    '<div class="mtc-grid"><label>Номер стола<input id="mtc-number" type="number" min="1" placeholder="Авто"></label><label>Мест<input id="mtc-seats" type="number" min="1" max="50" value="4"></label></div>'+
    '<label>Название<input id="mtc-name" maxlength="80" placeholder="Стол 1"></label>'+ 
    '<label>Форма<select id="mtc-shape"><option value="round">Круглый</option><option value="square">Квадратный</option><option value="rectangle">Прямоугольный</option></select></label>'+
    '<div class="mtc-actions"><button class="mtc-btn mtc-primary" id="mtc-save">Создать стол</button><button class="mtc-btn" id="mtc-cancel">Отмена</button></div><div id="mtc-error" class="mtc-error"></div></div></div>';
  document.body.appendChild(m);
  var next=((v.tables||[]).reduce(function(x,t){return Math.max(x,Number(t.table_number||t.number)||0)},0)+1);
  var num=m.querySelector('#mtc-number'),name=m.querySelector('#mtc-name');
  num.placeholder=String(next); name.value='Стол '+next;
  num.addEventListener('input',function(){var n=Number(num.value)||next;name.value='Стол '+n;});
  function close(){m.remove();}
  m.querySelector('#mtc-close').onclick=close;m.querySelector('#mtc-cancel').onclick=close;m.querySelector('.mtc-backdrop').onclick=function(e){if(e.target===this)close();};
  m.querySelector('#mtc-save').onclick=async function(){
    var btn=this;btn.disabled=true;btn.textContent='Создание...';m.querySelector('#mtc-error').textContent='';
    try{
      var n=Number(num.value)||null,seats=Number(m.querySelector('#mtc-seats').value)||4,shape=m.querySelector('#mtc-shape').value;
      var nm=name.value.trim()||('Стол '+(n||next));
      var r=await window.db.rpc('manager_upsert_table',{p_venue_id:venue.id,p_table_id:null,p_table_number:n,p_name:nm,p_seats:seats,p_shape:shape,p_pos_x:80+((v.tables||[]).length%5)*150,p_pos_y:80+Math.floor((v.tables||[]).length/5)*150});
      if(r.error) throw r.error;
      close();
      if(typeof v.loadTables==='function') await v.loadTables();
      var hall=document.querySelector('[data-manager-hall-tab]');if(hall) hall.click();
      if(window.__managerHallRefresh) window.__managerHallRefresh();
    }catch(e){m.querySelector('#mtc-error').textContent=(e&&e.message)||'Не удалось создать стол';btn.disabled=false;btn.textContent='Создать стол';}
  };
}
function styles(){if(document.getElementById('mtc-style'))return;var s=document.createElement('style');s.id='mtc-style';s.textContent='.mtc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}.mtc-box{width:min(460px,100%);background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.45);color:#fff}.mtc-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}.mtc-muted{color:#94a3b8;font-size:12px;margin-top:4px}.mtc-x{border:0;background:rgba(255,255,255,.07);color:#fff;border-radius:9px;font-size:22px;width:34px;height:34px;cursor:pointer}.mtc-box label{display:block;color:#cbd5e1;font-size:12px;margin:10px 0}.mtc-box input,.mtc-box select{box-sizing:border-box;width:100%;margin-top:5px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0b1120;color:#fff}.mtc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mtc-actions{display:flex;gap:10px;margin-top:18px}.mtc-btn{border:0;border-radius:10px;padding:10px 14px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer}.mtc-primary{background:#6366f1;flex:1}.mtc-btn:disabled{opacity:.6;cursor:wait}.mtc-error{color:#fca5a5;font-size:12px;margin-top:10px;min-height:16px}';document.head.appendChild(s)}
function add(){var tab=document.querySelector('[data-manager-hall-tab]');if(!tab||document.getElementById('mtc-add'))return;var b=document.createElement('button');b.id='mtc-add';b.className=tab.className;b.textContent='+ Стол';b.title='Добавить стол';b.onclick=function(){open()};tab.parentNode.insertBefore(b,tab.nextSibling);}
styles();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();
new MutationObserver(add).observe(document.body,{childList:true,subtree:true});
})();
