/* QR-SETKA — final native Personnel tab for manager cabinet. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_PERSONNEL_FINAL__) return;
  window.__QR_MANAGER_PERSONNEL_FINAL__ = true;

  function proxy(){try{var root=document.querySelector('#app'),app=root&&root.__vue_app__;return app&&app._instance&&app._instance.proxy||null;}catch(e){return null;}}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function n(v){return Number(v||0).toLocaleString('ru-RU');}
  function restoreCookTab(){document.querySelectorAll('.tabs button').forEach(function(btn){var t=(btn.textContent||'').trim();if(t.indexOf('Повара')!==-1&&t.indexOf('Персонал')===-1)btn.textContent='Повара';});}
  function hideAnalyticsStaff(){document.querySelectorAll('.glass.card').forEach(function(card){var text=(card.textContent||'').trim();if(text.indexOf('Повара (скорость и нагрузка)')!==-1||text.indexOf('Курьеры (доставки)')!==-1||text.indexOf('Официанты (выдачи)')!==-1||text.indexOf('Производительность персонала')!==-1)card.style.display='none';});}
  function getStaffButton(){var btn=null;document.querySelectorAll('.tabs button').forEach(function(b){if((b.textContent||'').trim()==='Повара')btn=b;});return btn;}
  function ensureTab(){var tabs=document.querySelector('.tabs');if(!tabs)return null;var existing=document.getElementById('qr-personnel-tab');if(existing)return existing;var cook=getStaffButton();if(!cook)return null;var b=document.createElement('button');b.id='qr-personnel-tab';b.type='button';b.textContent='👥 Персонал';b.addEventListener('click',function(){var p=proxy();if(p)p.tab='personnel';setTimeout(render,0);});cook.insertAdjacentElement('afterend',b);return b;}
  function render(){
    restoreCookTab();
    hideAnalyticsStaff();
    var tab=ensureTab(),p=proxy();
    if(!tab||!p)return;
    var active=p.tab==='personnel';
    tab.classList.toggle('on',active);
    var root=document.getElementById('qr-personnel-root');
    if(!active){if(root)root.style.display='none';return;}
    if(!root){root=document.createElement('div');root.id='qr-personnel-root';root.className='qr-personnel-native';document.querySelector('.tabs').insertAdjacentElement('afterend',root);}
    root.style.display='block';
    var sa=p.staffAnalytics||{period_days:30,cooks:[],couriers:[],waiters:[]},days=String(p.staffAnalyticsDays||30),cooks=Array.isArray(sa.cooks)?sa.cooks:[],couriers=Array.isArray(sa.couriers)?sa.couriers:[],waiters=Array.isArray(sa.waiters)?sa.waiters:[];
    root.innerHTML='<div class="glass card" style="margin-bottom:14px;border-color:#6366f1"><div class="spread" style="margin-bottom:12px"><div><h3 style="margin:0">👥 Персонал</h3><div class="muted" style="font-size:12px;margin-top:4px">Производительность сотрудников</div></div><select id="qr-personnel-days" style="width:auto"><option value="7"'+(days==='7'?' selected':'')+'>7 дней</option><option value="30"'+(days==='30'?' selected':'')+'>30 дней</option><option value="90"'+(days==='90'?' selected':'')+'>90 дней</option></select></div><div class="muted" style="font-size:12px;margin-bottom:12px">За последние '+n(sa.period_days||days)+' дней</div><div class="row" style="align-items:stretch;flex-wrap:wrap;gap:12px"><div class="glass card" style="flex:1;min-width:260px;background:rgba(255,255,255,.02)"><h4>👨‍🍳 Повара</h4><table class="tbl"><tr><th>Имя</th><th>Заказов</th><th>Ср. время</th><th>Выручка</th></tr>'+(cooks.map(function(c){return '<tr><td>'+esc(c.name)+'</td><td>'+n(c.orders_count)+'</td><td>'+n(c.avg_time_min)+' мин</td><td>'+n(c.revenue)+' ₽</td></tr>';}).join('')||'<tr><td colspan="4" class="muted">Нет данных</td></tr>')+'</table></div><div class="glass card" style="flex:1;min-width:260px;background:rgba(255,255,255,.02)"><h4>🤵 Официанты</h4><table class="tbl"><tr><th>Имя</th><th>Выдач</th><th>Выручка</th></tr>'+(waiters.map(function(w){return '<tr><td>'+esc(w.name)+'</td><td>'+n(w.served_count)+'</td><td>'+n(w.revenue)+' ₽</td></tr>';}).join('')||'<tr><td colspan="3" class="muted">Нет данных</td></tr>')+'</table></div><div class="glass card" style="flex:1;min-width:260px;background:rgba(255,255,255,.02)"><h4>🚗 Курьеры</h4><table class="tbl"><tr><th>Имя</th><th>Доставок</th><th>Выручка</th></tr>'+(couriers.map(function(c){return '<tr><td>'+esc(c.name)+'</td><td>'+n(c.deliveries_count)+'</td><td>'+n(c.revenue)+' ₽</td></tr>';}).join('')||'<tr><td colspan="3" class="muted">Нет данных</td></tr>')+'</table></div></div></div>';
    var sel=root.querySelector('#qr-personnel-days');
    if(sel)sel.onchange=function(){p.staffAnalyticsDays=String(this.value);if(typeof p.loadStaffAnalytics==='function')p.loadStaffAnalytics();setTimeout(render,150);};
  }
  function bind(){
    render();
    document.addEventListener('click',function(e){
      var btn=e.target&&e.target.closest?e.target.closest('.tabs button'):null;
      if(btn){setTimeout(render,0);}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bind,250);});else setTimeout(bind,250);
})();