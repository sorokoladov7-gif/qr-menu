(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
var root=document.getElementById('app');
var panel=null;
function getVM(){
  if(!root)return null;
  if(root.__vueParentComponent&&root.__vueParentComponent.proxy)return root.__vueParentComponent.proxy;
  if(root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy)return root.__vue_app__._instance.proxy;
  return null;
}
function css(){if(document.getElementById('manager-tables-style'))return;var s=document.createElement('style');s.id='manager-tables-style';s.textContent='.mt-modal{position:fixed;inset:0;background:rgba(5,10,20,.78);backdrop-filter:blur(8px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px}.mt-box{width:min(900px,100%);max-height:90vh;overflow:auto;background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px;color:#fff;box-shadow:0 25px 80px rgba(0,0,0,.45)}.mt-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.mt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.mt-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px;text-align:center}.mt-qr{background:#fff;border-radius:12px;padding:8px;width:150px;height:150px;margin:10px auto;display:flex;align-items:center;justify-content:center}.mt-qr img{max-width:100%;max-height:100%}.mt-muted{color:#94a3b8;font-size:12px}.mt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mt-input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:10px}.mt-btn{border:0;border-radius:10px;padding:9px 12px;cursor:pointer;font-weight:700}.mt-primary{background:#6366f1;color:#fff}.mt-danger{background:#7f1d1d;color:#fff}.mt-ghost{background:rgba(255,255,255,.08);color:#fff}@media(max-width:600px){.mt-box{padding:14px}.mt-grid{grid-template-columns:1fr}.mt-head{align-items:flex-start}.mt-row{flex-direction:column;align-items:stretch}.mt-row .mt-btn{width:100%}}';document.head.appendChild(s)}
function addButton(){var tabs=document.querySelector('.tabs');if(!tabs)return;if(tabs.querySelector('[data-manager-tables]'))return;var b=document.createElement('button');b.type='button';b.textContent='🪑 Столы';b.setAttribute('data-manager-tables','1');b.onclick=openPanel;tabs.appendChild(b)}
function getVenue(){
  var vm=getVM();
  if(vm&&vm.venue&&vm.venue.id)return vm.venue;
  return null;
}
function tableUrl(t,v){return location.origin+location.pathname.replace(/manager\.html$/i,'menu.html')+'?venue='+encodeURIComponent(v.slug)+'&table='+encodeURIComponent(t.qr_token)}
function qr(el,text){el.innerHTML='';if(window.QRCode){new QRCode(el,{text:text,width:140,height:140,colorDark:'#111827',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});return}var img=document.createElement('img');img.src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(text);img.alt='QR';el.appendChild(img)}
async function openPanel(){
  css();
  var v=getVenue();
  if(!v){
    var vm=getVM();
    if(vm&&vm.myVenues&&vm.myVenues.length===1&&typeof vm.selectVenue==='function'){
      vm.selectVenue(vm.myVenues[0]);
      await new Promise(function(resolve){setTimeout(resolve,100)});
      v=getVenue();
    }
  }
  if(!v){alert('Сначала выберите своё заведение в кабинете управляющего.');return}
  if(panel)panel.remove();
  panel=document.createElement('div');panel.className='mt-modal';
  panel.innerHTML='<div class="mt-box"><div class="mt-head"><div><h2 style="margin:0">🪑 Столы и QR-коды</h2><div class="mt-muted" style="margin-top:5px">'+escapeHtml(v.name)+'</div></div><button class="mt-btn mt-ghost" id="mt-close">✕ Закрыть</button></div><div class="mt-row" style="margin-bottom:16px"><input id="mt-count" class="mt-input" type="number" min="1" max="100" value="5" placeholder="Количество"><button id="mt-create" class="mt-btn mt-primary">+ Создать столы</button><button id="mt-print" class="mt-btn mt-ghost">🖨 Печать всех</button></div><div id="mt-msg" class="mt-muted" style="margin-bottom:12px"></div><div id="mt-grid" class="mt-grid"></div></div>';
  document.body.appendChild(panel);panel.querySelector('#mt-close').onclick=function(){panel.remove();panel=null};panel.addEventListener('click',function(e){if(e.target===panel){panel.remove();panel=null}});panel.querySelector('#mt-create').onclick=function(){createTables(v)};panel.querySelector('#mt-print').onclick=function(){window.print()};await loadTables(v)
}
function escapeHtml(x){return String(x||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
async function loadTables(v){var g=panel.querySelector('#mt-grid'),m=panel.querySelector('#mt-msg');g.innerHTML='<div class="mt-muted">Загрузка...</div>';var r=await db.from('venue_tables').select('*').eq('venue_id',v.id).order('table_number');if(r.error){m.textContent='Ошибка: '+r.error.message;return}m.textContent=r.data.length?'Всего столов: '+r.data.length:'Столов пока нет';g.innerHTML='';(r.data||[]).forEach(function(t){var c=document.createElement('div');c.className='mt-card';c.innerHTML='<b style="font-size:18px">Стол '+t.table_number+'</b><div class="mt-muted">'+escapeHtml(t.name||'')+'</div><div class="mt-qr"></div><div class="mt-row" style="justify-content:center"><button class="mt-btn mt-primary">🖨 Печать</button><button class="mt-btn mt-danger">Удалить</button></div>';g.appendChild(c);qr(c.querySelector('.mt-qr'),tableUrl(t,v));c.querySelector('.mt-btn.mt-primary').onclick=function(){printOne(c)};c.querySelector('.mt-btn.mt-danger').onclick=function(){removeTable(t,v)} })}
async function createTables(v){var n=Math.max(1,Math.min(100,Number(panel.querySelector('#mt-count').value)||1));var m=panel.querySelector('#mt-msg');var r0=await db.from('venue_tables').select('table_number').eq('venue_id',v.id).order('table_number');if(r0.error){m.textContent='Ошибка: '+r0.error.message;return}var used=new Set((r0.data||[]).map(function(x){return Number(x.table_number)})),next=1,rows=[];for(var i=0;i<n;i++){while(used.has(next))next++;rows.push({venue_id:v.id,table_number:next,name:'Стол '+next,is_active:true});used.add(next);next++}var r=await db.from('venue_tables').insert(rows);if(r.error){m.textContent='Ошибка: '+r.error.message;return}m.textContent='Создано столов: '+n;await loadTables(v)}
async function removeTable(t,v){if(!confirm('Удалить Стол '+t.table_number+'?'))return;var r=await db.from('venue_tables').delete().eq('id',t.id);if(r.error){alert('Ошибка: '+r.error.message);return}await loadTables(v)}
function printOne(card){var clone=card.cloneNode(true);clone.querySelectorAll('button').forEach(function(b){b.remove()});var w=window.open('','_blank','width=500,height=600');if(!w){alert('Разрешите всплывающие окна для печати QR');return}w.document.write('<html><head><title>QR стола</title><style>body{font-family:Arial;text-align:center;padding:30px}.mt-qr{margin:20px auto}.mt-muted{color:#666;font-size:12px}</style></head><body>'+clone.outerHTML+'</body></html>');w.document.close();w.focus();setTimeout(function(){w.print();w.close()},400)}
var obs=new MutationObserver(function(){addButton()});function start(){css();addButton();obs.observe(document.body,{childList:true,subtree:true});setTimeout(addButton,1000);setTimeout(addButton,3000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();