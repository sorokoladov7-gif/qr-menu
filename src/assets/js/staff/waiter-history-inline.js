/* QR-SETKA waiter inline history. Removes legacy iframe/external-history controls. */
(function(){
  'use strict';
  if(window.__QR_WAITER_HISTORY_INLINE__) return;
  window.__QR_WAITER_HISTORY_INLINE__=true;
  function token(){return localStorage.getItem('staff_token')||'';}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]});}
  function fmt(n){return Number(n||0).toLocaleString('ru-RU');}
  function items(o){var v=o&&o.items; if(Array.isArray(v)) return v; try{return JSON.parse(v||'[]')||[]}catch(e){return[]}}
  function render(){
    var panels=document.querySelectorAll('#p-history');
    panels.forEach(function(panel){
      var head=panel.querySelector('.section-head');
      if(head){
        var link=head.querySelector('a[href*="staff-history"]');
        if(link)link.remove();
      }
      var iframe=panel.querySelector('iframe.history-frame');
      if(iframe) iframe.remove();
      if(panel.dataset.qrHistoryMounted) return;
      panel.dataset.qrHistoryMounted='1';
      var body=document.createElement('div');body.id='qr-waiter-history-body';body.innerHTML='<div class="empty">Загрузка истории…</div>';panel.appendChild(body);
      load(body);
    });
  }
  async function load(body){
    if(!token()){body.innerHTML='<div class="empty">Войдите в аккаунт официанта.</div>';return;}
    var r=await window.db.rpc('staff_history_json',{p_token:token()});
    if(r.error){body.innerHTML='<div class="empty">Ошибка загрузки истории: '+esc(r.error.message||r.error)+'</div>';return;}
    var rows=Array.isArray(r.data)?r.data:[];
    if(!rows.length){body.innerHTML='<div class="empty">История текущей смены пуста.</div>';return;}
    var grid=document.createElement('div');grid.className='grid';
    rows.forEach(function(o){
      var card=document.createElement('div');card.className='card';
      var date=o.created_at?new Date(o.created_at).toLocaleString('ru-RU'):'';
      var its=items(o).map(function(i){return '<div>'+esc(i.qty||i.quantity||1)+'× '+esc(i.name||i.product_name||'Товар')+'</div>';}).join('');
      card.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px"><b>№'+esc(o.order_number||o.id)+'</b><span class="badge">Выдан</span></div>'
        +'<div class="muted" style="margin-top:6px">'+esc(date)+' · '+fmt(o.total_price)+' ₽</div>'
        +'<div style="margin-top:10px">'+(its||'<span class="muted">Состав не указан</span>')+'</div>'
        +(o.table_name||o.table_number?'<div class="muted" style="margin-top:8px">🪑 '+esc(o.table_name||('Стол '+o.table_number))+'</div>':'');
      grid.appendChild(card);
    });
    body.replaceChildren(grid);
  }
  function boot(){render();var mo=new MutationObserver(render);if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(function(){mo.disconnect()},30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
