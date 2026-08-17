(function(){
'use strict';

if(!/\/manager\.html$/i.test(location.pathname)) return;

var root=null;
var panel=null;
var observer=null;

function getRoot(){
  if(!root) root=document.getElementById('app');
  return root;
}

function getVM(){
  var el=getRoot();
  try{
    if(!el) return null;
    if(el.__vueParentComponent && el.__vueParentComponent.proxy) return el.__vueParentComponent.proxy;
    if(el.__vue_app__ && el.__vue_app__._instance && el.__vue_app__._instance.proxy) return el.__vue_app__._instance.proxy;
  }catch(e){}
  return null;
}

function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>\"']/g,function(c){
    return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='\"'?'&quot;':'&#39;';
  });
}

function addStyles(){
  if(document.getElementById('manager-tables-style')) return;
  var s=document.createElement('style');
  s.id='manager-tables-style';
  s.textContent='.mt-modal{position:fixed;inset:0;background:rgba(5,10,20,.78);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}.mt-box{width:min(980px,100%);max-height:90vh;overflow:auto;background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px;color:#fff;box-shadow:0 25px 80px rgba(0,0,0,.45)}.mt-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.mt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.mt-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px;text-align:center}.mt-card.off{opacity:.58}.mt-qr{background:#fff;border-radius:12px;padding:8px;width:150px;height:150px;margin:10px auto;display:flex;align-items:center;justify-content:center}.mt-qr img{max-width:100%;max-height:100%}.mt-muted{color:#94a3b8;font-size:12px}.mt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mt-input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:10px}.mt-btn{border:0;border-radius:10px;padding:9px 12px;cursor:pointer;font-weight:700}.mt-primary{background:#6366f1;color:#fff}.mt-danger{background:#7f1d1d;color:#fff}.mt-green{background:#047857;color:#fff}.mt-ghost{background:rgba(255,255,255,.08);color:#fff}.mt-modal input::placeholder{color:#94a3b8}@media(max-width:600px){.mt-box{padding:14px}.mt-grid{grid-template-columns:1fr}.mt-row{flex-direction:column;align-items:stretch}.mt-row .mt-btn,.mt-row .mt-input{width:100%;box-sizing:border-box}}';
  document.head.appendChild(s);
}

function addButton(){
  var tabs=document.querySelector('.tabs');
  if(!tabs) return false;
  var b=tabs.querySelector('[data-manager-hall-tab]');
  if(!b){
    b=document.createElement('button');
    b.type='button';
    b.textContent='🪑 Зал / Столы';
    b.setAttribute('data-manager-hall-tab','1');
    tabs.appendChild(b);
  }
  b.onclick=function(e){
    if(e){e.preventDefault();e.stopPropagation();}
    openPanel();
  };
  return true;
}

async function getVenue(){
  var vm=getVM();
  if(vm && vm.venue && vm.venue.id) return vm.venue;
  try{
    var q=await db.from('manager_venues').select('venue_id, venues(*)');
    if(q.error || !q.data || !q.data.length) return null;
    var list=q.data.map(function(x){return x.venues;}).filter(Boolean);
    if(list.length===1) return list[0];
    var brand=document.querySelector('.brand span');
    var name=brand?String(brand.textContent||'').trim():'';
    return list.find(function(v){return v.name===name;})||null;
  }catch(e){return null;}
}

function tableUrl(t,v){
  return location.origin+location.pathname.replace(/manager\.html$/i,'menu.html')+'?venue='+encodeURIComponent(v.slug)+'&table='+encodeURIComponent(t.qr_token||'');
}

function renderQr(el,text){
  el.innerHTML='';
  if(window.QRCode){
    new QRCode(el,{text:text,width:140,height:140,colorDark:'#111827',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
  }else{
    var img=document.createElement('img');
    img.src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(text);
    img.alt='QR';
    el.appendChild(img);
  }
}

async function openPanel(){
  addStyles();
  var v=await getVenue();
  if(!v){
    var vm=getVM();
    if(vm && vm.myVenues && vm.myVenues.length===1 && typeof vm.selectVenue==='function'){
      vm.selectVenue(vm.myVenues[0]);
      await new Promise(function(resolve){setTimeout(resolve,400);});
      v=await getVenue();
    }
  }
  if(!v){alert('Не удалось определить выбранное заведение. Выберите заведение в кабинете управляющего.');return;}
  if(panel) panel.remove();
  panel=document.createElement('div');
  panel.className='mt-modal';
  panel.innerHTML='<div class="mt-box"><div class="mt-head"><div><h2 style="margin:0">🪑 Столы и QR-коды</h2><div class="mt-muted" style="margin-top:5px">'+escapeHtml(v.name)+'</div></div><button class="mt-btn mt-ghost" id="mt-close">✕ Закрыть</button></div><div class="mt-row" style="margin-bottom:16px"><input id="mt-count" class="mt-input" type="number" min="1" max="100" value="5" placeholder="Количество"><button id="mt-create" class="mt-btn mt-primary">+ Создать столы</button><button id="mt-print" class="mt-btn mt-ghost">🖨 Печать всех</button></div><div id="mt-msg" class="mt-muted" style="margin-bottom:12px"></div><div id="mt-grid" class="mt-grid"></div></div>';
  document.body.appendChild(panel);
  panel.querySelector('#mt-close').onclick=closePanel;
  panel.addEventListener('click',function(e){if(e.target===panel) closePanel();});
  panel.querySelector('#mt-create').onclick=function(){createTables(v);};
  panel.querySelector('#mt-print').onclick=printAll;
  await loadTables(v);
}

function closePanel(){if(panel) panel.remove();panel=null;}

async function loadTables(v){
  if(!panel) return;
  var grid=panel.querySelector('#mt-grid'),msg=panel.querySelector('#mt-msg');
  grid.innerHTML='<div class="mt-muted">Загрузка...</div>';
  var r=await db.from('venue_tables').select('*').eq('venue_id',v.id).order('table_number');
  if(r.error){msg.textContent='Ошибка: '+r.error.message;return;}
  var rows=r.data||[];msg.textContent=rows.length?'Всего столов: '+rows.length:'Столов пока нет';grid.innerHTML='';
  rows.forEach(function(t){
    var card=document.createElement('div');card.className='mt-card'+(t.is_active?'':' off');
    card.innerHTML='<b style="font-size:18px">'+escapeHtml(t.name||('Стол '+t.table_number))+'</b><div class="mt-muted">№'+t.table_number+' · '+(t.is_active?'🟢 Активен':'🔴 Отключён')+'</div><div class="mt-qr"></div><div class="mt-row" style="justify-content:center"><button class="mt-btn mt-primary">✏️ Изменить</button><button class="mt-btn mt-green">'+(t.is_active?'🔴 Отключить':'🟢 Включить')+'</button><button class="mt-btn mt-ghost">🖨 QR</button><button class="mt-btn mt-danger">🗑</button></div>';
    grid.appendChild(card);
    if(t.is_active) renderQr(card.querySelector('.mt-qr'),tableUrl(t,v)); else card.querySelector('.mt-qr').innerHTML='<div style="color:#111827;font-weight:700">ОТКЛЮЧЁН</div>';
    var buttons=card.querySelectorAll('button');buttons[0].onclick=function(){editTable(t,v);};buttons[1].onclick=function(){toggleTable(t,v);};buttons[2].onclick=function(){printOne(card,t,v);};buttons[3].onclick=function(){removeTable(t,v);};
  });
}

async function createTables(v){
  if(!panel)return;
  var count=Math.max(1,Math.min(100,Number(panel.querySelector('#mt-count').value)||1)),msg=panel.querySelector('#mt-msg');
  var existing=await db.from('venue_tables').select('table_number').eq('venue_id',v.id).order('table_number');
  if(existing.error){msg.textContent='Ошибка: '+existing.error.message;return;}
  var used=new Set((existing.data||[]).map(function(x){return Number(x.table_number);})),next=1,rows=[];
  for(var i=0;i<count;i++){while(used.has(next))next++;rows.push({venue_id:v.id,table_number:next,name:'Стол '+next,is_active:true});used.add(next);next++;}
  var result=await db.from('venue_tables').insert(rows);if(result.error){msg.textContent='Ошибка: '+result.error.message;return;}
  msg.textContent='Создано столов: '+count;await loadTables(v);
}

async function editTable(t,v){var name=prompt('Название стола:',t.name||('Стол '+t.table_number));if(name===null)return;name=String(name).trim();if(!name){alert('Название не может быть пустым');return;}var r=await db.from('venue_tables').update({name:name}).eq('id',t.id);if(r.error){alert('Ошибка: '+r.error.message);return;}await loadTables(v);}
async function toggleTable(t,v){var r=await db.from('venue_tables').update({is_active:!t.is_active}).eq('id',t.id);if(r.error){alert('Ошибка: '+r.error.message);return;}await loadTables(v);}
async function removeTable(t,v){if(!confirm('Удалить '+(t.name||('Стол '+t.table_number))+'?'))return;var r=await db.from('venue_tables').delete().eq('id',t.id);if(r.error){alert('Ошибка: '+r.error.message);return;}await loadTables(v);}

function printOne(card,t,v){var clone=card.cloneNode(true);clone.querySelectorAll('button').forEach(function(b){b.remove();});var w=window.open('','_blank','width=500,height=650');if(!w){alert('Разрешите всплывающие окна для печати QR');return;}w.document.write('<html><head><title>'+escapeHtml(t.name||('Стол '+t.table_number))+'</title><style>body{font-family:Arial;text-align:center;padding:30px}.mt-qr{margin:20px auto}.mt-qr img{max-width:100%}.mt-muted{color:#666;font-size:12px}</style></head><body>'+clone.outerHTML+'</body></html>');w.document.close();w.focus();setTimeout(function(){w.print();w.close();},400);}
function printAll(){if(!panel)return;var cards=panel.querySelectorAll('.mt-card');if(!cards.length)return;var w=window.open('','_blank','width=900,height=900');if(!w){alert('Разрешите всплывающие окна для печати QR');return;}var html='';cards.forEach(function(card){var clone=card.cloneNode(true);clone.querySelectorAll('button').forEach(function(b){b.remove();});html+='<div style="display:inline-block;width:30%;vertical-align:top;text-align:center;margin:10px;padding:12px;border:1px solid #ddd;border-radius:12px">'+clone.outerHTML+'</div>';});w.document.write('<html><head><title>QR-коды столов</title><style>body{font-family:Arial}.mt-qr{margin:10px auto;background:#fff;padding:8px;width:150px;height:150px}.mt-qr img{max-width:100%;max-height:100%}@media print{body{margin:10mm}}</style></head><body><h1>QR-коды столов</h1>'+html+'</body></html>');w.document.close();w.focus();setTimeout(function(){w.print();w.close();},500);}

function start(){
  addStyles();
  addButton();
  if(observer) observer.disconnect();
  observer=new MutationObserver(function(){addButton();});
  if(document.body) observer.observe(document.body,{childList:true,subtree:true});
  [250,750,1500,3000,5000].forEach(function(ms){setTimeout(addButton,ms);});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();