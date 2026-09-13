/* QR-Menu — унифицированный интерфейс повара и столов */
(function(){
  'use strict';
  if(window.__QR_COOK_TABLE_UNIFIED__) return;
  window.__QR_COOK_TABLE_UNIFIED__ = true;

  var currentPanel='new';
  var syncTimer=null;

  function tok(){ return new URLSearchParams(location.search).get('token')||''; }
  function fmt(v){ return Number(v||0).toLocaleString('ru-RU'); }
  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function statusText(s){ return s==='occupied'?'Занят':s==='reserved'?'Резерв':'Свободен'; }

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
    htmlPromise.then(function(html){ var c=document.getElementById('qr-cook-modal-content'); if(c)c.innerHTML=html; }).catch(function(e){ var c=document.getElementById('qr-cook-modal-content'); if(c)c.innerHTML='<div class="qr-cook-empty">Ошибка: '+esc(e.message||e)+'</div>'; });
    d.querySelector('.qr-cook-modal-bg').onclick = function(){ d.remove(); };
  }

  function card(o){
    return '<div class="qr-cook-card"><div class="qr-cook-head"><b>№'+esc(o.order_number)+'</b> <span class="badge">'+esc(o.status)+'</span></div><div class="qr-cook-items">'+(o.items||[]).map(function(i){return '<div>'+esc(i.qty)+'× '+esc(i.product_name)+'</div>';}).join('')+'</div><div class="qr-cook-actions"><button class="qr-cook-btn" onclick="nextStatus(\''+o.id+'\',\''+o.status+'\',this)">Далее</button></div></div>';
  }

  function tableCard(t,canControl){
    var status=t.occupancy_status||'free';
    var active=!!t.session;
    var summary=active?'Заказов: '+(t.session.order_count||0)+' · '+fmt(t.session.total_price||0)+' ₽':'Нет активной сессии';
    var actions='';
    if(canControl){
      if(status==='free' || status==='reserved'){
        actions='<div class="qr-cook-actions" style="margin-top:10px">'+
          '<button class="qr-cook-btn" onclick="cookSeatTable(\''+t.id+'\',\''+t.seats+'\')">Посадить гостей</button>'+
          '<button class="qr-cook-btn" onclick="cookReserveTable(\''+t.id+'\')">Зарезервировать</button>'+ 
        '</div>';
      }else if(status==='occupied'){
        actions='<div class="qr-cook-actions" style="margin-top:10px"><button class="qr-cook-btn reset" onclick="cookCloseTable(\''+t.id+'\')">Освободить стол</button></div>';
      }
    }
    return '<div class="qr-cook-card"><div class="qr-cook-head"><b>🪑 '+esc(t.name||('Стол '+t.table_number))+'</b><span class="badge">'+statusText(status)+'</span></div><div class="qr-cook-muted" style="margin-top:7px">'+summary+'</div>'+
      (t.reserved_until?'<div class="qr-cook-muted">Резерв до: '+esc(new Date(t.reserved_until).toLocaleString('ru-RU'))+'</div>':'')+
      (canControl?'<div class="qr-cook-muted" style="margin-top:7px">👨‍🍳 Управление столами доступно: в заведении нет активного официанта.</div>':'')+actions+'</div>';
  }

  async function panelHtml(k){
    if(k==='tables'){
      var d = await rpc('cook_get_table_dashboard',{p_token:tok()});
      var rows = d.tables||[];
      var canControl=d.can_control_tables===true;
      return '<div class="qr-cook-card" style="margin-bottom:10px"><b>'+(canControl?'👨‍🍳 Повар управляет залом':'👤 Управление столами выполняет официант')+'</b><div class="qr-cook-muted" style="margin-top:6px">'+
        (canControl?'В заведении нет активных официантов. Повар может посадить гостей, поставить резерв и освободить стол.':'При наличии активного официанта управление столами у повара отключено.')+
        '</div></div><div class="qr-cook-grid">'+(rows.length?rows.map(function(t){return tableCard(t,canControl);}).join(''):'<div class="qr-cook-empty">Столы не настроены</div>')+'</div>';
    }
    if(k==='history'){
      var hs = await rpc('staff_history_json',{p_token:tok()});
      return '<div class="qr-cook-grid">'+(hs.length?hs.map(card).join(''):'<div class="qr-cook-empty">История заказов пуста</div>')+'</div>';
    }
    var os = await rpc('staff_orders_json',{p_token:tok()});
    var rows = os.filter(function(o){return k==='new'?(o.status==='new'||o.status==='changed'):k==='cooking'?o.status==='cooking':o.status==='ready';});
    return '<div class="qr-cook-grid">'+(rows.length?rows.map(card).join(''):'<div class="qr-cook-empty">Нет заказов</div>')+'</div>';
  }

  async function openPanel(k){
    currentPanel=k;
    var title = {new:'🆕 Новые заказы',cooking:'🔥 Готовятся',ready:'✅ Выдача',tables:'🪑 Столы',history:'📜 История заказов',reset:'🧹 Закрыть рабочий день'}[k];
    try {
      if(k==='reset'){
        return modal(title, Promise.resolve('<div class="qr-cook-card"><b>Закрыть рабочий день?</b><div class="qr-cook-muted" style="margin-top:8px">История не удаляется из базы. Она будет скрыта у персонала, а все текущие счётчики начнутся заново.</div><div class="qr-cook-actions"><button id="qr-reset-confirm" class="qr-cook-btn reset">Закрыть день и обнулить</button></div></div>'));
      }
      return modal(title, panelHtml(k));
    } catch (e) {
      console.error('Ошибка при открытии вкладки повара:', e);
      return modal(title, Promise.resolve('<div class="qr-cook-empty">Ошибка загрузки данных: ' + esc(e.message || e) + '</div>'));
    }
  }

  async function refreshPanelSilently(){
    if(document.hidden || !document.getElementById('qr-cook-modal') || currentPanel==='reset') return;
    try{
      var html=await panelHtml(currentPanel);
      var c=document.getElementById('qr-cook-modal-content');
      if(c && document.getElementById('qr-cook-modal')) c.innerHTML=html;
    }catch(e){ console.warn('[QR Cook] live sync:',e); }
  }

  function startLiveSync(){
    if(syncTimer) clearInterval(syncTimer);
    syncTimer=setInterval(refreshPanelSilently,5000);
  }

  window.openCookPanel = openPanel;

  window.nextStatus = async function(id,current,button){
    var next = current==='new'?'cooking':current==='cooking'?'ready':'completed';
    try{
      if(button){button.disabled=true;button.textContent='…';}
      await rpc('staff_update_order_status',{p_token:tok(), p_order_id:id, p_status:next});
      if(button){button.textContent='✓';}
      setTimeout(function(){ var m=document.getElementById('qr-cook-modal'); if(m)m.remove(); openPanel(current); },400);
    }catch(e){ if(button){button.disabled=false;button.textContent='Далее';} alert('Ошибка: '+(e.message||e)); }
  };

  window.cookSeatTable = async function(tableId,seats){
    var max=Math.max(1,Number(seats||1));
    var raw=window.prompt('Сколько гостей посадить? (1–'+max+')','1');
    if(raw===null)return;
    var count=Number(raw);
    if(!Number.isInteger(count)||count<1||count>max){alert('Количество гостей должно быть от 1 до '+max+'.');return;}
    try{
      await rpc('staff_seat_table',{p_token:tok(),p_table_id:tableId,p_guest_count:count});
      var m=document.getElementById('qr-cook-modal');if(m)m.remove();openPanel('tables');
    }catch(e){alert('Не удалось посадить гостей: '+(e.message||e));}
  };

  window.cookReserveTable = async function(tableId){
    var hours=window.prompt('На сколько часов поставить резерв?','2');
    if(hours===null)return;
    var h=Number(hours);
    if(!Number.isFinite(h)||h<=0||h>24){alert('Укажите срок резерва от 0 до 24 часов.');return;}
    var note=window.prompt('Комментарий к резерву (необязательно):','');
    if(note===null)return;
    try{
      await rpc('cook_reserve_table',{p_token:tok(),p_table_id:tableId,p_reserved_until:new Date(Date.now()+h*3600000).toISOString(),p_note:note});
      var m=document.getElementById('qr-cook-modal');if(m)m.remove();openPanel('tables');
    }catch(e){alert('Не удалось поставить резерв: '+(e.message||e));}
  };

  window.cookCloseTable = async function(tableId){
    if(!window.confirm('Освободить стол? Операция будет отклонена сервером, если по столу ещё есть открытые заказы.'))return;
    try{
      await rpc('staff_close_table_session',{p_token:tok(),p_table_id:tableId});
      var m=document.getElementById('qr-cook-modal');if(m)m.remove();openPanel('tables');
    }catch(e){alert('Не удалось освободить стол: '+(e.message||e));}
  };

  function install(){
    var nav = document.getElementById('qr-cook-nav');
    if(!nav) return;
    nav.innerHTML = ['new','cooking','ready','tables','history','reset'].map(function(k){
      return '<button class="qr-cook-tab" data-k="'+k+'" onclick="openCookPanel(\''+k+'\')">'+{new:'🆕 Новые',cooking:'🔥 Готовятся',ready:'✅ Выдача',tables:'🪑 Столы',history:'📜 История',reset:'🧹 Сброс'}[k]+'</button>';
    }).join('');
    openPanel('new');
    startLiveSync();

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
