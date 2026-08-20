(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerTableActions) return;
window.__managerTableActions=true;

function vm(){var el=document.getElementById('app');try{return el&&el.__vue_app__&&el.__vue_app__._instance&&el.__vue_app__._instance.proxy||null}catch(e){return null}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function baseUrl(){return location.origin+'/menu.html'}
function qrUrl(t){return baseUrl()+'?table='+encodeURIComponent(t.qr_token||'')}
function open(t){
 if(!t||!t.id)return;
 var old=document.getElementById('mta-modal');if(old)old.remove();
 var m=document.createElement('div');m.id='mta-modal';
 var status=t.occupancy_status==='occupied'?'Занят':'Свободен';
 m.innerHTML='<div class="mta-back"><div class="mta-box"><div class="mta-head"><div><h3>Стол '+esc(t.table_number||t.number||'')+'</h3><small>'+esc(t.name||'')+' · '+esc(status)+'</small></div><button id="mta-x">×</button></div><div class="mta-qr"><div id="mta-code"></div><div class="mta-link">'+esc(qrUrl(t))+'</div></div><div class="mta-actions"><button id="mta-copy">🔗 Копировать ссылку</button><button id="mta-print">🖨 Печать QR</button><button id="mta-regen">🔄 Новый QR</button><button id="mta-close">Закрыть</button></div><div id="mta-error"></div></div></div>';
 document.body.appendChild(m);
 var q=m.querySelector('#mta-code');
 if(window.QRCode){try{new QRCode(q,{text:qrUrl(t),width:190,height:190})}catch(e){q.textContent='QR недоступен'}}else q.innerHTML='<div style="padding:30px">QR-библиотека не загружена</div>';
 function close(){m.remove()};m.querySelector('#mta-x').onclick=close;m.querySelector('#mta-close').onclick=close;m.querySelector('.mta-back').onclick=function(e){if(e.target===this)close()};
 m.querySelector('#mta-copy').onclick=async function(){try{await navigator.clipboard.writeText(qrUrl(t));this.textContent='✓ Скопировано';setTimeout(()=>this.textContent='🔗 Копировать ссылку',1500)}catch(e){m.querySelector('#mta-error').textContent='Не удалось скопировать ссылку'}};
 m.querySelector('#mta-print').onclick=function(){var w=window.open('','_blank','width=500,height=650');if(!w){m.querySelector('#mta-error').textContent='Разрешите всплывающие окна';return}w.document.write('<html><head><title>QR Стол '+esc(t.table_number)+'</title></head><body style="font-family:Arial;text-align:center;padding:30px"><h1>Стол '+esc(t.table_number)+'</h1><div id="qr"></div><p>Отсканируйте QR-код для заказа</p><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById("qr"),{text:'+JSON.stringify(qrUrl(t))+',width:320,height:320});setTimeout(function(){window.print()},700)<\/script></body></html>');w.document.close()};
 m.querySelector('#mta-regen').onclick=async function(){if(!confirm('Перевыпустить QR-код? Старый QR перестанет работать.'))return;var b=this;b.disabled=true;b.textContent='Выпуск...';try{var r=await window.db.rpc('manager_regenerate_table_qr',{p_venue_id:vm().venue.id,p_table_id:t.id});if(r.error)throw r.error;var nt=Object.assign({},t,{qr_token:r.data&&r.data.qr_token||r.data&&r.data[0]&&r.data[0].qr_token});if(!nt.qr_token)throw new Error('Новый QR-токен не получен');close();open(nt);if(window.__managerHallRefresh)window.__managerHallRefresh()}catch(e){m.querySelector('#mta-error').textContent=e.message||'Ошибка перевыпуска QR';b.disabled=false;b.textContent='🔄 Новый QR'}};
}
function findTables(){var v=vm();return v&&Array.isArray(v.tables)?v.tables:[]}
function inject(){var tables=findTables();if(!tables.length)return;tables.forEach(function(t){var nodes=document.querySelectorAll('[data-table-id="'+CSS.escape(String(t.id))+'"]');nodes.forEach(function(n){if(n.querySelector('.mta-btn'))return;var b=document.createElement('button');b.className='mta-btn';b.textContent='📱 QR';b.title='QR стола';b.onclick=function(e){e.stopPropagation();open(t)};n.appendChild(b)})})}
function styles(){if(document.getElementById('mta-style'))return;var s=document.createElement('style');s.id='mta-style';s.textContent='.mta-back{position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px}.mta-box{width:min(440px,100%);background:#111827;color:#fff;border-radius:18px;padding:20px;border:1px solid rgba(255,255,255,.12);box-shadow:0 25px 80px rgba(0,0,0,.5)}.mta-head{display:flex;justify-content:space-between}.mta-head button{border:0;background:#ffffff12;color:#fff;border-radius:8px;font-size:22px;width:34px;height:34px}.mta-head small{color:#94a3b8}.mta-qr{text-align:center;margin:18px 0}.mta-link{font-size:11px;color:#94a3b8;word-break:break-all;margin-top:10px}.mta-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mta-actions button{padding:10px;border:0;border-radius:10px;background:#ffffff12;color:#fff;cursor:pointer}.mta-actions button:first-child{background:#4f46e5}.mta-actions button:disabled{opacity:.6}.mta-btn{margin-left:6px;padding:5px 8px;border:0;border-radius:7px;background:#4f46e5;color:#fff;cursor:pointer;font-size:11px}.mta-btn:hover{opacity:.85}#mta-error{color:#fca5a5;font-size:12px;margin-top:10px;min-height:16px}';document.head.appendChild(s)}
styles();
new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});
setTimeout(inject,500);setTimeout(inject,1500);
window.__managerOpenTableQR=open;
})();
