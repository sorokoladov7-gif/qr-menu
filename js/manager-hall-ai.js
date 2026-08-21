(function(){
'use strict';

function getAppProxy(){
  try{
    var root=document.getElementById('app');
    if(root && root.__vueParentComponent) return root.__vueParentComponent.proxy || null;
  }catch(e){}
  return null;
}

function readVenueFromParent(){
  try{
    if(window.parent && window.parent !== window){
      var parentApp=window.parent.document && window.parent.document.getElementById('app');
      if(parentApp && parentApp.__vueParentComponent){
        var p=parentApp.__vueParentComponent.proxy;
        if(p && p.venue && p.venue.id) return String(p.venue.id);
      }
    }
  }catch(e){}
  return '';
}

function venueId(){
  var proxy=getAppProxy();
  var id=(proxy && proxy.venue && proxy.venue.id) ? String(proxy.venue.id) : '';
  if(id) return id;
  id=readVenueFromParent();
  if(id) return id;
  try{id=new URLSearchParams(location.search).get('venue')||'';}catch(e){}
  if(id) return id;
  return localStorage.getItem('manager_venue_id')||localStorage.getItem('selectedVenueId')||'';
}

function syncVenueContext(){
  var id=venueId();
  if(id) localStorage.setItem('manager_venue_id',id);
  return id;
}

function ensureStyles(){
  if(document.getElementById('manager-integrated-tabs-style')) return;
  var s=document.createElement('style');
  s.id='manager-integrated-tabs-style';
  s.textContent=`
    .manager-integrated-panel{margin-top:0;min-height:620px}
    .manager-integrated-frame{width:100%;height:calc(100vh - 245px);min-height:620px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:#0b1120;display:block}
    .manager-tab-group{display:flex;gap:8px;flex-wrap:wrap}
    .manager-tab-more{position:relative}
    @media(max-width:720px){
      .manager-integrated-frame{height:calc(100vh - 255px);min-height:540px;border-radius:14px}
      .tabs{overflow-x:auto;flex-wrap:nowrap!important;scrollbar-width:none}
      .tabs::-webkit-scrollbar{display:none}
      .tabs button{white-space:nowrap}
    }
  `;
  document.head.appendChild(s);
}

function createPanel(type){
  var existing=document.getElementById('manager-integrated-'+type);
  if(existing) return existing;
  var id=syncVenueContext();
  var panel=document.createElement('div');
  panel.id='manager-integrated-'+type;
  panel.className='glass card manager-integrated-panel';
  panel.style.display='none';

  var frame=document.createElement('iframe');
  frame.className='manager-integrated-frame';
  frame.setAttribute('loading','lazy');
  frame.setAttribute('allow','geolocation');
  frame.title=type==='hall'?'Управление залом':'Права управляющего';
  frame.src=type==='hall'
    ? 'hall.html'+(id?'?venue='+encodeURIComponent(id):'')
    : 'admin-permissions.html'+(id?'?venue='+encodeURIComponent(id):'');

  frame.addEventListener('load',function(){
    var current=syncVenueContext();
    if(current){
      try{frame.contentWindow.postMessage({type:'manager-venue-context',venue_id:current},location.origin);}catch(e){}
      var target=type==='hall'?'hall.html':'admin-permissions.html';
      if(frame.src.indexOf('venue=')===-1){
        frame.src=target+'?venue='+encodeURIComponent(current);
      }
    }
  });

  var head=document.createElement('div');
  head.className='spread';
  head.style.marginBottom='12px';
  head.innerHTML=type==='hall'
    ? '<div><h3 style="margin:0">🪑 Зал и столы</h3><div class="muted" style="font-size:12px;margin-top:4px">Перетаскивание столов, резерв, посадка, освобождение и QR.</div></div>'
    : '<div><h3 style="margin:0">🔐 Права управляющего</h3><div class="muted" style="font-size:12px;margin-top:4px">Разрешения на меню, цены, доставку, дизайн и данные заведения.</div></div>';
  panel.appendChild(head);
  panel.appendChild(frame);

  var anchor=document.querySelector('.tabs');
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel,anchor.nextSibling);
  else document.querySelector('#app .wrap')?.appendChild(panel);
  return panel;
}

function setActiveTab(type){
  var id=syncVenueContext();
  var proxy=getAppProxy();
  if(proxy){
    try{proxy.tab=type; if(type==='analytics' && typeof proxy.loadAnalytics==='function') proxy.loadAnalytics();}catch(e){}
  }
  var hall=createPanel('hall');
  var permissions=createPanel('permissions');
  [hall,permissions].forEach(function(panel){
    var frame=panel.querySelector('iframe');
    if(frame && id){
      var target=panel.id.indexOf('hall')!==-1?'hall.html':'admin-permissions.html';
      var src=target+'?venue='+encodeURIComponent(id);
      if(frame.src !== location.origin+'/'+src && frame.getAttribute('src') !== src) frame.src=src;
      try{frame.contentWindow.postMessage({type:'manager-venue-context',venue_id:id},location.origin);}catch(e){}
    }
  });
  hall.style.display=type==='hall'?'block':'none';
  permissions.style.display=type==='permissions'?'block':'none';
  document.querySelectorAll('.tabs button').forEach(function(b){
    var t=b.getAttribute('data-manager-tab');
    if(t) b.classList.toggle('on',t===type);
  });
}

function addPermissionsTab(){
  var tabs=document.querySelector('.tabs');
  if(!tabs || tabs.querySelector('[data-manager-tab="permissions"]')) return;
  var btn=document.createElement('button');
  btn.type='button';
  btn.textContent='🔐 Права';
  btn.setAttribute('data-manager-tab','permissions');
  btn.addEventListener('click',function(e){e.preventDefault();setActiveTab('permissions');},true);
  tabs.appendChild(btn);

  tabs.querySelectorAll('button').forEach(function(b){
    if(!b.hasAttribute('data-manager-tab')){
      var txt=(b.textContent||'').trim();
      if(txt.includes('Меню')) b.setAttribute('data-manager-tab','menu');
      else if(txt.includes('Заказы')) b.setAttribute('data-manager-tab','orders');
      else if(txt.includes('Аналитика')) b.setAttribute('data-manager-tab','analytics');
      else if(txt.includes('Зал')) b.setAttribute('data-manager-tab','hall');
      else if(txt.includes('Повара')) b.setAttribute('data-manager-tab','staff');
      else if(txt.includes('Курьеры')) b.setAttribute('data-manager-tab','couriers');
      else if(txt.includes('Официанты')) b.setAttribute('data-manager-tab','waiters');
      else if(txt.includes('Тарифы')) b.setAttribute('data-manager-tab','billing');
      else if(txt.includes('Настройки')) b.setAttribute('data-manager-tab','settings');
    }
  });
}

function bind(){
  ensureStyles();
  addPermissionsTab();
  syncVenueContext();
  if(document.getElementById('manager-integrated-listener')) return;
  var marker=document.createElement('span');
  marker.id='manager-integrated-listener';
  marker.style.display='none';
  document.body.appendChild(marker);

  document.addEventListener('click',function(e){
    var btn=e.target.closest('.tabs button');
    if(!btn) return;
    var text=(btn.textContent||'').trim();
    var type=btn.getAttribute('data-manager-tab');
    if(!type && text.includes('Зал')) type='hall';
    if(!type && text.includes('Права')) type='permissions';

    if(type==='hall' || type==='permissions'){
      e.preventDefault();
      e.stopImmediatePropagation();
      setActiveTab(type);
      return;
    }

    if(type){
      var h=document.getElementById('manager-integrated-hall');
      var p=document.getElementById('manager-integrated-permissions');
      if(h) h.style.display='none';
      if(p) p.style.display='none';
    }
  },true);

  window.addEventListener('message',function(e){
    if(e.origin!==location.origin || !e.data || e.data.type!=='manager-venue-context') return;
    if(e.data.venue_id) localStorage.setItem('manager_venue_id',String(e.data.venue_id));
  });

  var observer=new MutationObserver(function(){
    addPermissionsTab();
    var id=syncVenueContext();
    var active=document.querySelector('.tabs button.on');
    if(active && id){
      var text=(active.textContent||'').trim();
      if(text.includes('Зал')){var h=createPanel('hall');h.style.display='block';}
      if(text.includes('Права')){var p=createPanel('permissions');p.style.display='block';}
    }
  });
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

  setTimeout(function(){
    var id=syncVenueContext();
    if(id) localStorage.setItem('manager_venue_id',id);
  },500);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();
