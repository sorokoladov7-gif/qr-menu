/* QR-SETKA manager personnel: integrates existing analytics into the staff tab. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_PERSONNEL_INTEGRATED__) return;
  window.__QR_MANAGER_PERSONNEL_INTEGRATED__=true;

  function fmt(v){return Number(v||0).toLocaleString('ru-RU');}
  function safe(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function hideAnalyticsPersonnel(){
    var cards=document.querySelectorAll('.glass.card');
    cards.forEach(function(card){var text=(card.textContent||'').trim();if(text.indexOf('Повара (скорость и нагрузка)')!==-1||text.indexOf('Курьеры (доставки)')!==-1||text.indexOf('Официанты (выдачи)')!==-1||text.indexOf('Производительность персонала')!==-1)card.style.display='none';});
  }
  function renamePersonnelTab(){document.querySelectorAll('.tabs button').forEach(function(b){var t=(b.textContent||'').trim();if(t==='Повара'&&b.getAttribute('data-manager-hall-tab')===null)b.textContent='👥 Персонал';});}
  function findStaffRoot(){var active=document.querySelector('.tabs button.on'),activeText=(active&&active.textContent||'').trim();if(activeText.indexOf('Персонал')===-1)return null;var btns=document.querySelectorAll('button');for(var i=0;i<btns.length;i++){if((btns[i].textContent||'').indexOf('Добавить повара')!==-1)return btns[i].closest('.card')||btns[i].parentElement;}return null;}
  function getVueProxy(){try{var root=document.querySelector('#app'),app=root&&root.__vue_app__;return app&&app._instance&&app._instance.proxy;}catch(e){return null;}}
  function renderPersonnel(proxy){
    if(!proxy)return;var root=findStaffRoot();if(!root)return;var container=root.parentElement;if(!container)return;var old=document.getElementById('qr-integrated-personnel-panel');if(old)old.remove();
    var analytics=proxy.analytics||{},sa=proxy.staffAnalytics||{period_days:30,cooks:[],couriers:[],waiters:[]},days=proxy.staffAnalyticsDays||30;
    var panel=document.createElement('div');panel.id='qr-integrated-personnel-panel';panel.className='glass card';panel.style.cssText='margin-bottom:14px;border-color:#6366f1';
    var cooks=Array.isArray(analytics.cooks)?analytics.cooks:[],couriers=Array.isArray(analytics.couriers)?analytics.couriers:[],waiters=Array.isArray(analytics.waiters)?analytics.waiters:[],sc=Array.isArray(sa.cooks)?sa.cooks:[],scr=Array.isArray(sa.couriers)?sa.couriers:[],sw=Array.isArray(sa.waiters)?sa.waiters:[];
    panel.innerHTML=''
      +'<div class="spread" style="margin-bottom:14px"><div><h3 style="margin:0">👥 Персонал</h3><div class="muted" style="font-size:12px;margin-top:4px">Статистика текущего заведения</div></div><select id="qr-personnel-period" style="width:auto"><option value="7" '+(String(days)==='7'?'selected':'')+'>7 дней</option><option value="30" '+(String(days)==='30'?'selected':'')+'>30 дней</option><option value="90" '+(String(days)==='90'?'selected':'')+'>90 дней</option></select></div>'
      +'<p class="muted" style="font-size:12px;margin-bottom:12px">За последние '+safe(sa.period_days||days)+' дней · данные из заказов</p>'
      +'<div class="row" style="align-items:stretch;flex-wrap:wrap;margin-bottom:14px">'
      +'<div class="glass card" style="flex:1;min-width:220px;background:rgba(255,255,255,.02)"><h4 style="margin:0 0 10px">👨‍🍳 Повара</h4><table class="tbl"><tr><th>Повар</th><th>Заказов</th><th>Ср. готовка</th></tr>'+(cooks.map(function(c){return '<tr><td>'+safe(c.name)+'</td><td>'+fmt(c.count)+'</td><td>'+fmt(c.avg)+' мин</td></tr>';}).join('')||( '<tr><td colspan="3" class="muted">Нет данных</td></tr>'))+'</table></div>'
      +'<div class="glass card" style="flex:1;min-width:220px;background:rgba(255,255,255,.02)"><h4 style="margin:0 0 10px">🚗 Курьеры</h4><table class="tbl"><tr><th>Курьер</th><th>Доставлено</th></tr>'+(couriers.map(function(c){return '<tr><td>'+safe(c.name)+'</td><td>'+fmt(c.count)+'</td></tr>';}).join('')||'<tr><td colspan="2" class="muted">Нет данных</td></tr>')+'</table></div>'
      +'<div class="glass card" style="flex:1;min-width:220px;background:rgba(255,255,255,.02)"><h4 style="margin:0 0 10px">🤵 Официанты</h4><table class="tbl"><tr><th>Официант</th><th>Выдано</th></tr>'+(waiters.map(function(w){return '<tr><td>'+safe(w.name)+'</td><td>'+fmt(w.count)+'</td></tr>';}).join('')||'<tr><td colspan="2" class="muted">Нет данных</td></tr>')+'</table></div></div>'
      +'<div class="glass card" style="background:rgba(255,255,255,.02)"><h4 style="margin:0 0 10px">📊 Производительность персонала</h4><div class="row" style="align-items:stretch;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:220px"><h5 style="margin:0 0 8px;color:#fcd34d">👨‍🍳 Повара</h5><table class="tbl"><tr><th>Имя</th><th>Заказов</th><th>Ср. время</th><th>Выручка</th></tr>'+(sc.map(function(c){return '<tr><td>'+safe(c.name)+'</td><td>'+fmt(c.orders_count)+'</td><td>'+fmt(c.avg_time_min)+' мин</td><td>'+fmt(c.revenue)+' ₽</td></tr>';}).join('')||'<tr><td colspan="4" class="muted">Нет данных</td></tr>')+'</table></div>'
      +'<div style="flex:1;min-width:220px"><h5 style="margin:0 0 8px;color:#c4b5fd">🚗 Курьеры</h5><table class="tbl"><tr><th>Имя</th><th>Доставок</th><th>Выручка</th></tr>'+(scr.map(function(c){return '<tr><td>'+safe(c.name)+'</td><td>'+fmt(c.deliveries_count)+'</td><td>'+fmt(c.revenue)+' ₽</td></tr>';}).join('')||'<tr><td colspan="3" class="muted">Нет данных</td></tr>')+'</table></div>'
      +'<div style="flex:1;min-width:220px"><h5 style="margin:0 0 8px;color:#67e8f9">🤵 Официанты</h5><table class="tbl"><tr><th>Имя</th><th>Выдач</th><th>Выручка</th></tr>'+(sw.map(function(w){return '<tr><td>'+safe(w.name)+'</td><td>'+fmt(w.served_count)+'</td><td>'+fmt(w.revenue)+' ₽</td></tr>';}).join('')||'<tr><td colspan="3" class="muted">Нет данных</td></tr>')+'</table></div></div></div>';
    container.insertBefore(panel,root);
    var sel=panel.querySelector('#qr-personnel-period');if(sel)sel.onchange=function(){proxy.staffAnalyticsDays=String(this.value);if(typeof proxy.loadStaffAnalytics==='function')proxy.loadStaffAnalytics();setTimeout(sync,150);};
  }
  function sync(){renamePersonnelTab();hideAnalyticsPersonnel();var proxy=getVueProxy();if(!proxy)return;if(proxy.tab==='staff')renderPersonnel(proxy);}
  function patchVue(Vue){if(!Vue||typeof Vue.createApp!=='function'||Vue.__QR_PERSONNEL_PATCHED__)return;Vue.__QR_PERSONNEL_PATCHED__=true;var original=Vue.createApp;Vue.createApp=function(options){if(options&&typeof options==='object'){options.watch=options.watch||{};var oldWatch=options.watch.tab;options.watch.tab=function(n,o){if(typeof oldWatch==='function')oldWatch.call(this,n,o);setTimeout(sync,0);};}return original.apply(this,arguments);};}
  if(window.Vue)patchVue(window.Vue);else{var d=Object.getOwnPropertyDescriptor(window,'Vue');if(!d||d.configurable!==false){var value;Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;patchVue(v);}});}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(sync,100);});else setTimeout(sync,100);
  var mo=new MutationObserver(function(){sync();});mo.observe(document.documentElement,{childList:true,subtree:true});
})();
