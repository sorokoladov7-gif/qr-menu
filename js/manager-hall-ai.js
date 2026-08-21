/* QR Menu — direct manager hall launcher. No iframe, no URL venue handoff. */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_LAUNCHER__) return;
window.__QR_MANAGER_HALL_LAUNCHER__=true;
function loadDirect(){
  if(document.querySelector('script[data-qr-manager-hall-direct]')) return;
  var s=document.createElement('script');
  s.src='/js/manager-hall-direct.js?v=1';
  s.async=false;
  s.setAttribute('data-qr-manager-hall-direct','1');
  s.onerror=function(){console.error('[QR Menu] Не удалось загрузить прямой модуль зала');};
  document.head.appendChild(s);
}
function getVenueFromButton(btn){
  var p=btn&&btn.__vueParentComponent;
  var seen=[];
  while(p && seen.indexOf(p)<0){
    seen.push(p);
    if(p.proxy && p.proxy.venue && p.proxy.venue.id) return p.proxy.venue;
    p=p.parent;
  }
  var root=document.getElementById('app');
  var app=root&&root.__vue_app__;
  if(app&&app._instance&&app._instance.proxy&&app._instance.proxy.venue&&app._instance.proxy.venue.id) return app._instance.proxy.venue;
  if(window.__managerVue&&window.__managerVue.venue&&window.__managerVue.venue.id) return window.__managerVue.venue;
  return null;
}
function bind(){
  var btn=document.querySelector('[data-manager-hall-tab]');
  if(!btn || btn.__qrdBound) return;
  btn.__qrdBound=true;
  btn.addEventListener('click',function(){
    var venue=getVenueFromButton(btn);
    if(!venue){
      setTimeout(function(){
        venue=getVenueFromButton(btn);
        if(venue&&window.QRManagerHall) window.QRManagerHall.open(venue);
        else alert('Не удалось определить выбранное заведение. Обновите кабинет и выберите заведение заново.');
      },100);
      return;
    }
    setTimeout(function(){if(window.QRManagerHall) window.QRManagerHall.open(venue);},0);
  },true);
}
function boot(){loadDirect();bind();var n=0;var t=setInterval(function(){bind();if(++n>80)clearInterval(t);},250);}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
