/* QR-Menu — унифицированный интерфейс повара и столов */
(function(){
  'use strict';
  if(window.__QR_COOK_TABLE_UNIFIED__) return;
  window.__QR_COOK_TABLE_UNIFIED__ = true;

  function tok(){ return new URLSearchParams(location.search).get('token')||''; }
  function fmt(v){ return Number(v||0).toLocaleString('ru-RU'); }
  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  async function rpc(method, args){
    var res = await fetch('/api/rpc/'+method, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(args||{})
    });
    var data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error?.message || data.error || 'RPC failed');
    return data;
  }

  function modal(title, htmlPromise){
    var old = document.getElementById('qr-cook-modal');
    if(old) old.remove();
    var d = document.createElement('div');
    d.id = 'qr-cook-modal';
    d.className = 'qr-cook-modal';
    d.innerHTML = '<div class="qr-cook-modal-bg"></div><div class="qr-cook-modal-box"><div class="qr-cook-modal-head"><h3>'+esc(title)+'</h3><button class="qr-cook-btn close" onclick="document.getElementById(\'qr-cook-modal\').remove()">×</button></div><div class="qr-cook-modal-body" id="qr-cook-modal-content">Загрузка...</div></div>';
    document.body.appendChild(d);
    htmlPromise.then(function(html){ document.getElementById('qr-cook-modal-content').innerHTML = html; }).catch(function(e){ document.getElementById('qr-cook-modal-content').innerHTML = '<div class="qr-cook-empty">Ошибка: '+esc(e.message||e)+'</div>'; });
    d.querySelector('.qr-cook-modal-bg').onclick = function(){ d.remove(); };
  }

  function card(o){
    return '<div class="qr-cook-card"><div class="qr-cook-head"><b>№'+esc(o.order_number)+'</b> <span class="badge">'+esc(o.status)+'</span></div><div class="qr-cook-items">'+(o.items||[]).map(function(i){return '<div>'+esc(i.qty)+'× '+esc(i.product_name)+'</div>';}).join('')+'</div><div class="qr-cook-actions"><button class="qr-cook-btn" onclick="nextStatus(\''+o.id+'\',\''+o.status+'\')">Далее</button></div></div>';
  }

  async function open(k){
    var title = {new:'🆕 Новые заказы',cooking:'🔥 Готовятся',ready:'✅ Выдача',tables:'🪑 Столы',history:'📜 История заказов',reset:'🧹 Закрыть рабочий день'}[k];
    try {
      if(k==='reset'){
        return modal(title, Promise.resolve('<div class="qr-cook-card"><b>Закрыть рабочий день?</b><div class="qr-cook-muted" style="margin-top:8px">История не удаляется из базы. Она будет скрыта у персонала, а все текущие счётчики начнутся заново.</div><div class="qr-cook-actions"><button id="qr-reset-confirm" class="qr-cook-btn reset">Закрыть день и обнулить</button></div></div>'));
      }
      if(k==='tables'){
        var d = await rpc('cook_get_table_dashboard',{p_token:tok()});
        var rows = d.tables||[];
        return modal(title, Promise.resolve('<div class="qr-cook-grid">'+(rows.length?rows.map(t=>'<div class="qr-cook-card"><b>🪑 '+esc(t.name||('Стол '+t.table_number))+'</b><span class="badge">'+(t.occupancy_status==='occupied'?'Занят':t.occupancy_status==='reserved'?'Резерв':'Свободен')+'</span><div class="qr-cook-muted" style="margin-top:7px">'+(t.session?'Заказов: '+(t.session.order_count||0)+' · '+fmt(t.session.total_price||0)+' ₽':'Нет активной сессии')+'</div></div>').join(''):'<div class="qr-cook-empty">Столы не настроены</div>')+'</div>'));
      }
      if(k==='history'){
        var hs = await rpc('staff_history_json',{p_token:tok()});
        return modal(title, Promise.resolve('<div class="qr-cook-grid">'+(hs.length?hs.map(card).join(''):'<div class="qr-cook-empty">История заказов пуста</div>')+'</div>'));
      }
      var os = await rpc('staff_orders_json',{p_token:tok()});
      var rows = os.filter(o => k==='new'?(o.status==='new'||o.status==='changed'):k==='cooking'?o.status==='cooking':o.status==='ready');
      return modal(title, Promise.resolve('<div class="qr-cook-grid">'+(rows.length?rows.map(card).join(''):'<div class="qr-cook-empty">Нет заказов</div>')+'</div>'));
    } catch (e) {
      console.error('Ошибка при открытии вкладки повара:', e);
      return modal(title, Promise.resolve('<div class="qr-cook-empty">Ошибка загрузки данных: ' + esc(e.message || e) + '</div>'));
    }
  }

  window.nextStatus = async function(id, current){
    var next = current==='new'?'cooking':current==='cooking'?'ready':'completed';
    try{
      await rpc('staff_update_order_status',{p_token:tok(), p_order_id:id, p_status:next});
      var btn = event.target;
      if(btn){ btn.textContent='✓'; btn.disabled=true; }
      setTimeout(function(){ document.getElementById('qr-cook-modal')?.remove(); open(current); }, 400);
    }catch(e){ alert('Ошибка: '+(e.message||e)); }
  };

  function install(){
    var nav = document.getElementById('qr-cook-nav');
    if(!nav) return;
    nav.innerHTML = ['new','cooking','ready','tables','history','reset'].map(function(k){
      return '<button class="qr-cook-tab" data-k="'+k+'" onclick="open(\''+k+'\')">'+{new:'🆕 Новые',cooking:'🔥 Готовятся',ready:'✅ Выдача',tables:'🪑 Столы',history:'📜 История',reset:'🧹 Сброс'}[k]+'</button>';
    }).join('');
    open('new');
    
    // Исправление: безопасная обработка клика по кнопке сброса
    document.addEventListener('click', function(e){
      if(e.target && e.target.id === 'qr-reset-confirm'){
        e.target.disabled = true;
        rpc('reset_staff_workday',{p_token:tok()}).then(function(){ location.reload(); }).catch(function(err){ 
          alert('Ошибка: '+(err.message||err)); 
          e.target.disabled = false; 
        });
      }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install);
  else setTimeout(install,0);
})();
