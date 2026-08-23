/* Manager personnel analytics: standalone tab bridge. */
(function () {
  'use strict';
  if (!/\/manager\.html$/i.test(location.pathname)) return;

  var panelId = 'qr-manager-personnel-panel';
  var installed = false;
  var panelVisible = false;
  var originalDisplays = new Map();

  function vm() {
    var app = document.getElementById('app');
    return app && app.__vueParentComponent && app.__vueParentComponent.proxy;
  }
  function tabs() { var t=document.querySelector('.tabs'); return t; }
  function findTabButton(text) {
    var t = tabs(); if (!t) return null;
    var buttons = t.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var tx = (buttons[i].textContent || '').trim();
      if (tx === text || tx.indexOf(text) !== -1) return buttons[i];
    }
    return null;
  }
  function escapeHtml(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
  function rub(v) { return Number(v || 0).toLocaleString('ru-RU') + ' ₽'; }

  function installStaffPinIdGuard() {
    var v = vm();
    if (!v || typeof v.resetStaffPin !== 'function' || v.__qrStaffPinIdGuardInstalled) {
      if (!v || typeof v.resetStaffPin !== 'function') setTimeout(installStaffPinIdGuard, 250);
      return;
    }
    var original = v.resetStaffPin;
    v.resetStaffPin = function(staff, type) {
      var source = type === 'cook' ? this.cooks : (type === 'courier' ? this.couriers : this.waiters);
      var suppliedId = staff && staff.id;
      var resolved = suppliedId ? staff : null;

      if (!resolved || !resolved.id) {
        var name = staff && String(staff.name || '').trim();
        if (name && Array.isArray(source)) {
          resolved = source.find(function(item) {
            return item && item.id && String(item.name || '').trim() === name;
          }) || null;
        }
      }

      if (!resolved || !resolved.id) {
        if (typeof this.showToast === 'function') this.showToast('Не удалось определить ID сотрудника. Обновите страницу.', 'error');
        console.error('[Manager PIN] staff id missing', { staff: staff, type: type, source: source });
        return;
      }

      return original.call(this, resolved, type);
    };
    v.__qrStaffPinIdGuardInstalled = true;
  }

  function hideVuePanels() {
    originalDisplays.clear();
    document.querySelectorAll('[v-if^="tab==="]').forEach(function(el){
      if (el.id === panelId) return;
      originalDisplays.set(el, el.style.display);
      el.style.display = 'none';
    });
  }
  function restoreVuePanels() {
    originalDisplays.forEach(function(display, el){ el.style.display = display || ''; });
    originalDisplays.clear();
  }
  function panelTemplate() {
    return '<div id="'+panelId+'" class="glass card" style="display:none;margin:0 0 18px">'+
      '<div class="spread" style="margin-bottom:14px"><div><h3 style="margin:0">👥 Персонал</h3><div class="muted" style="font-size:12px;margin-top:4px">Производительность и аналитика персонала</div></div>'+ 
      '<div class="row"><select id="qr-personnel-days" style="width:auto"><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="90">90 дней</option></select><button id="qr-personnel-refresh" class="btn btn-ghost btn-sm">Обновить</button></div></div>'+ 
      '<div id="qr-personnel-body" class="muted">Загрузка аналитики...</div></div>';
  }
  async function loadAnalytics() {
    var v = vm(), body = document.getElementById('qr-personnel-body');
    if (!v || !v.venue || !body || !window.db) return;
    var sel = document.getElementById('qr-personnel-days');
    var days = parseInt(sel && sel.value,10) || 30;
    body.innerHTML = '<div class="muted">Загрузка аналитики...</div>';
    try {
      var r = await window.db.rpc('manager_staff_performance',{p_venue_id:v.venue.id,p_days:days});
      if (r.error) throw r.error;
      var d=r.data||{}, cooks=Array.isArray(d.cooks)?d.cooks:[], couriers=Array.isArray(d.couriers)?d.couriers:[], waiters=Array.isArray(d.waiters)?d.waiters:[];
      var operations=cooks.reduce(function(a,x){return a+Number(x.orders_count||0)},0)+couriers.reduce(function(a,x){return a+Number(x.deliveries_count||0)},0)+waiters.reduce(function(a,x){return a+Number(x.served_count||0)},0);
      var revenue=cooks.concat(couriers,waiters).reduce(function(a,x){return a+Number(x.revenue||0)},0);
      function cookRows(){return cooks.length?cooks.map(function(x){return '<tr><td>'+escapeHtml(x.name)+'</td><td>'+Number(x.orders_count||0)+'</td><td>'+Number(x.avg_time_min||0)+' мин</td><td>'+rub(x.revenue)+'</td></tr>'}).join(''):'<tr><td colspan="4" class="muted">Нет данных</td></tr>'}
      function courierRows(){return couriers.length?couriers.map(function(x){return '<tr><td>'+escapeHtml(x.name)+'</td><td>'+Number(x.deliveries_count||0)+'</td><td>'+rub(x.revenue)+'</td></tr>'}).join(''):'<tr><td colspan="3" class="muted">Нет данных</td></tr>'}
      function waiterRows(){return waiters.length?waiters.map(function(x){return '<tr><td>'+escapeHtml(x.name)+'</td><td>'+Number(x.served_count||0)+'</td><td>'+rub(x.revenue)+'</td></tr>'}).join(''):'<tr><td colspan="3" class="muted">Нет данных</td></tr>'}
      body.innerHTML='<div class="analytics-grid">'+
        '<div class="glass stat"><div class="num">'+cooks.length+'</div><div class="lbl">Повара</div></div>'+ 
        '<div class="glass stat"><div class="num">'+couriers.length+'</div><div class="lbl">Курьеры</div></div>'+ 
        '<div class="glass stat"><div class="num">'+waiters.length+'</div><div class="lbl">Официанты</div></div>'+ 
        '<div class="glass stat"><div class="num">'+operations+'</div><div class="lbl">Операций</div></div>'+ 
        '<div class="glass stat"><div class="num">'+rub(revenue)+'</div><div class="lbl">Выручка</div></div></div>'+ 
        '<div class="row" style="align-items:stretch;flex-wrap:wrap;gap:14px">'+
        '<div class="glass card" style="flex:1;min-width:280px"><h4>👨‍🍳 Повара</h4><table class="tbl"><tr><th>Имя</th><th>Заказов</th><th>Ср. время</th><th>Выручка</th></tr>'+cookRows()+'</table></div>'+ 
        '<div class="glass card" style="flex:1;min-width:280px"><h4>🚗 Курьеры</h4><table class="tbl"><tr><th>Имя</th><th>Доставок</th><th>Выручка</th></tr>'+courierRows()+'</table></div>'+ 
        '<div class="glass card" style="flex:1;min-width:280px"><h4>🤵 Официанты</h4><table class="tbl"><tr><th>Имя</th><th>Выдач</th><th>Выручка</th></tr>'+waiterRows()+'</table></div></div>';
    } catch(e) { body.innerHTML='<div class="msg" style="color:#fca5a5">Не удалось загрузить аналитику персонала: '+escapeHtml(e && e.message || e)+'</div>'; }
  }
  function showPersonnel() {
    var v=vm(), panel=document.getElementById(panelId); if(!v||!v.venue||!panel)return;
    panelVisible=true; hideVuePanels(); panel.style.display='block';
    var b=document.querySelector('[data-manager-personnel-tab]'); if(b)b.classList.add('on');
    loadAnalytics();
  }
  function hidePersonnel() {
    if(!panelVisible)return;
    panelVisible=false; var p=document.getElementById(panelId); if(p)p.style.display='none'; restoreVuePanels();
    var b=document.querySelector('[data-manager-personnel-tab]'); if(b)b.classList.remove('on');
  }
  function install(){
    installStaffPinIdGuard();
    var v=vm(), t=tabs(); if(!v||!v.venue||!t){setTimeout(install,250);return;}
    var cooksButton=findTabButton('Повара'); if(!cooksButton){setTimeout(install,250);return;}
    if(!document.querySelector('[data-manager-personnel-tab]')){
      var button=document.createElement('button'); button.type='button'; button.setAttribute('data-manager-personnel-tab','1'); button.textContent='👥 Персонал'; button.addEventListener('click',showPersonnel); t.insertBefore(button,cooksButton);
    }
    if(!document.getElementById(panelId)){
      t.insertAdjacentHTML('afterend',panelTemplate());
      var days=document.getElementById('qr-personnel-days'), refresh=document.getElementById('qr-personnel-refresh');
      if(days)days.addEventListener('change',function(){if(panelVisible)loadAnalytics()});
      if(refresh)refresh.addEventListener('click',loadAnalytics);
    }
    t.querySelectorAll('button').forEach(function(btn){
      if(btn.getAttribute('data-manager-personnel-bound'))return;
      btn.setAttribute('data-manager-personnel-bound','1');
      if(btn.getAttribute('data-manager-personnel-tab')!=='1')btn.addEventListener('click',hidePersonnel);
    });
    installed=true;
    if (!v.__qrStaffPinIdGuardInstalled) setTimeout(installStaffPinIdGuard, 250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
