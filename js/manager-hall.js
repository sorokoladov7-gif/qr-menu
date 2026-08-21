/* QR Menu — single manager hall loader. The visual hall is owned only by manager-hall-direct.js. */
(function(){
  'use strict';
  if(!/\/manager\.html$/i.test(location.pathname)) return;
  if(window.__QR_MANAGER_HALL_LOADER_V3__) return;
  window.__QR_MANAGER_HALL_LOADER_V3__=true;

  function loadDirect(){
    if(window.QRManagerHall && window.QRManagerHall.open) return;
    if(document.querySelector('script[data-manager-hall-direct]')) return;
    var s=document.createElement('script');
    s.src='/js/manager-hall-direct.js?v=8';
    s.async=false;
    s.setAttribute('data-manager-hall-direct','1');
    s.onload=function(){
      try{
        var root=document.getElementById('app');
        var p=root && root.__vue_app__ && root.__vue_app__._instance && root.__vue_app__._instance.proxy;
        if(p){window.__managerVue=p;window.__managerVenue=function(){return p.venue||null;};}
      }catch(e){console.error('[QR Hall] Vue bridge error',e);}
    };
    s.onerror=function(){console.error('[QR Hall] failed to load manager-hall-direct.js');};
    document.head.appendChild(s);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadDirect);
  else loadDirect();
})();
