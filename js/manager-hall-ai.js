(function(){
'use strict';

/* Manager hall integration: the selected venue is taken from the real Vue app state.
   No manual venue UUID is required. */

function asId(v){ return v && v.id ? String(v.id) : ''; }

function getVueApp(){
  try{
    var el=document.getElementById('app');
    return el && el.__vue_app__ ? el.__vue_app__ : null;
  }catch(e){ return null; }
}

function getRootProxy(){
  try{
    var app=getVueApp();
    return app && app._instance && app._instance.proxy ? app._instance.proxy : null;
  }catch(e){ return null; }
}

function findVenueProxy(){
  var root=getRootProxy();
  if(root && root.venue && root.venue.id) return root;
  try{
    var inst=getVueApp() && getVueApp()._instance;
    if(!inst) return null;
    var seen=[];
    function walk(c){
      if(!c || seen.indexOf(c)>=0) return null;
      seen.push(c);
      try{ if(c.proxy && c.proxy.venue && c.proxy.venue.id) return c.proxy; }catch(e){}
      var kids=c.subTree && c.subTree.component ? [c.subTree.component] : [];
      if(c.subTree && c.subTree.children && Array.isArray(c.subTree.children)){
        c.subTree.children.forEach(function(ch){ if(ch && ch.component) kids.push(ch.component); });
      }
      for(var i=0;i<kids.length;i++){ var r=walk(kids[i]); if(r) return r; }
      return null;
    }
    return walk(inst);
  }catch(e){ return null; }
}

function getVenueId(){
  var p=findVenueProxy();
  var id=asId(p && p.venue);
  if(id) return id;
  try{
    id=new URLSearchParams(location.search).get('venue')||'';
    if(id) return id;
  }catch(e){}
  try{
    return localStorage.getItem('manager_venue_id') || localStorage.getItem('selectedVenueId') || '';
  }catch(e){ return ''; }
}

function saveVenueId(id){
  if(!id) return;
  try{
    localStorage.setItem('manager_venue_id',String(id));
    localStorage.setItem('selectedVenueId',String(id));
  }catch(e){}
}

function hookVueSelection(){
  var p=findVenueProxy();
  if(!p || p.__hallVenueHooked) return;
  try{
    if(typeof p.selectVenue==='function'){
      var original=p.selectVenue;
      p.selectVenue=function(v){
        var id=asId(v);
        if(id) saveVenueId(id);
        var result=original.apply(this,arguments);
        try{ var after=asId(this.venue); if(after) saveVenueId(after); }catch(e){}
        return result;
      };
    }
    p.__hallVenueHooked=true;
    var id=asId(p.venue);
    if(id) saveVenueId(id);
  }catch(e){}
}

function ensureStyles(){
  if(document.getElementById('manager-integrated-tabs-style')) return;
  var s=document.createElement('style');
  s.id='manager-integrated-tabs-style';
  s.textContent=''+
    '.manager-integrated-panel{margin-top:0;min-height:620px}'+
    '.manager-integrated-frame{width:100%;height:calc(100vh - 245px);min-height:620px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:#0b1120;display:block}'+
    '@media(max-width:720px){.manager-integrated-frame{height:calc(100vh - 255px);min-height:540px;border-radius:14px}.tabs{overflow-x:auto;flex-wrap:nowrap!important;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}.tabs button{white-space:nowrap}}';
  document.head.appendChild(s);
}

function createPanel(type,id){
  var existing=document.getElementById('manager-integrated-'+type);
  if(existing) return existing;
  var panel=document.createElement('div');
  panel.id='manager-integrated-'+type;
  panel.className='glass card manager-integrated-panel';
  panel.style.display='none';
  var frame=document.createElement('iframe');
  frame.className='manager-integrated-frame';
  frame.setAttribute('allow','geolocation');
  frame.title=type==='hall'?'Управление залом':'Права управляющего';
  panel.appendChild(frame);
  var head=document.createElement('div');
  head.className='spread'; head.style.marginBottom='12px';
  head.innerHTML=type==='hall'?'<div><h3 style="margin:0">🪑 Зал и столы</h3><div class="muted" style="font-size:12px;margin-top:4px">Перетаскивание столов, резерв, посадка, освобождение и QR.</div></div>':'<div><h3 style="margin:0">🔐 Права управляющего</h3><div class="muted" style="font-size:12px;margin-top:4px">Разрешения на меню, цены, доставку, дизайн и данные заведения.</div></div>';
  panel.insertBefore(head,frame);
  var anchor=document.querySelector('.tabs');
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel,anchor.nextSibling);
  else (document.querySelector('#app .wrap')||document.body).appendChild(panel);
  return panel;
}

function loadPanel(type,id){
  if(!id){
    alert('Не удалось определить выбранное заведение. Выберите заведение в кабинете управляющего и снова откройте этот раздел.');
    return false;
  }
  saveVenueId(id);
  var panel=createPanel(type,id), frame=panel.querySelector('iframe');
  var target=type==='hall'?'hall.html':'admin-permissions.html';
  var url=target+'?venue='+encodeURIComponent(id)+'&embedded=1';
  frame.src=url;
  frame.onload=function(){
    try{ frame.contentWindow.postMessage({type:'manager-venue-context',venue_id:id},location.origin); }catch(e){}
  };
  panel.style.display='block';
  return true;
}

function setActiveTab(type){
  hookVueSelection();
  var id=getVenueId();
  if(!id){
    /* Vue selection may have just completed; give Vue one tick to expose the new state. */
    setTimeout(function(){
      hookVueSelection();
      var retry=getVenueId();
      if(retry) loadPanel(type,retry);
      else alert('Не выбрано заведение. Сначала выберите заведение в кабинете управляющего.');
    },50);
    return;
  }
  var p=findVenueProxy();
  if(p){ try{p.tab=type;}catch(e){} }
  if(type==='analytics' && p && typeof p.loadAnalytics==='function'){try{p.loadAnalytics();}catch(e){}}
  loadPanel(type,id);
  var hall=document.getElementById('manager-integrated-hall');
  var permissions=document.getElementById('manager-integrated-permissions');
  if(hall) hall.style.display=type==='hall'?'block':'none';
  if(permissions) permissions.style.display=type==='permissions'?'block':'none';
}

function addPermissionsTab(){
  var tabs=document.querySelector('.tabs');
  if(!tabs) return;
  if(!tabs.querySelector('[data-manager-tab="permissions"]')){
    var btn=document.createElement('button');
    btn.type='button'; btn.textContent='🔐 Права'; btn.setAttribute('data-manager-tab','permissions');
    tabs.appendChild(btn);
  }
  tabs.querySelectorAll('button').forEach(function(b){
    if(b.hasAttribute('data-manager-tab')) return;
    var txt=(b.textContent||'').trim();
    if(txt.includes('Меню'))b.setAttribute('data-manager-tab','menu');
    else if(txt.includes('Заказы'))b.setAttribute('data-manager-tab','orders');
    else if(txt.includes('Аналитика'))b.setAttribute('data-manager-tab','analytics');
    else if(txt.includes('Зал'))b.setAttribute('data-manager-tab','hall');
    else if(txt.includes('Повара'))b.setAttribute('data-manager-tab','staff');
    else if(txt.includes('Курьеры'))b.setAttribute('data-manager-tab','couriers');
    else if(txt.includes('Официанты'))b.setAttribute('data-manager-tab','waiters');
    else if(txt.includes('Тарифы'))b.setAttribute('data-manager-tab','billing');
    else if(txt.includes('Настройки'))b.setAttribute('data-manager-tab','settings');
  });
}

function bind(){
  ensureStyles();
  addPermissionsTab();
  hookVueSelection();
  if(document.getElementById('manager-integrated-listener')) return;
  var marker=document.createElement('span'); marker.id='manager-integrated-listener'; marker.style.display='none'; document.body.appendChild(marker);

  document.addEventListener('click',function(e){
    var btn=e.target.closest && e.target.closest('.tabs button');
    if(!btn) return;
    var text=(btn.textContent||'').trim();
    var type=btn.getAttribute('data-manager-tab');
    if(!type&&text.includes('Зал'))type='hall';
    if(!type&&text.includes('Права'))type='permissions';
    if(type==='hall'||type==='permissions'){
      e.preventDefault(); e.stopImmediatePropagation();
      setActiveTab(type); return;
    }
    var h=document.getElementById('manager-integrated-hall'),p=document.getElementById('manager-integrated-permissions');
    if(h)h.style.display='none'; if(p)p.style.display='none';
  },true);

  var observer=new MutationObserver(function(){ addPermissionsTab(); hookVueSelection(); });
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setInterval(function(){hookVueSelection();},500);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();
