/* QR Menu — compatibility entrypoint. Canonical manager hall lives at /js/manager-hall.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_ROOT_LOADER__=true;

  function load(src,key){
    if(document.querySelector('script['+key+']')) return;
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.setAttribute(key,'1');
    s.onerror=function(){ console.error('[QR Manager] failed to load '+src); };
    document.head.appendChild(s);
  }

  load('/js/manager-hall.js?v=fix-20260907','data-manager-hall-single-v11');
  load('/js/manager-payment-settings.js?v=fix-20260908','data-qr-manager-payment-settings-loader-v1');

  function openHallFromTab(){
    setTimeout(async function(){
      try{
        var api=window.QRManagerHall;
        if(!api||typeof api.open!=='function'){
          console.error('[QR Hall] canonical API is not ready');
          return;
        }
        var v=typeof api.resolveVenue==='function'?await api.resolveVenue():null;
        if(v&&v.id){
          api.open(v);
        }else{
          console.error('[QR Hall] cannot resolve selected venue');
        }
      }catch(e){
        console.error('[QR Hall] open failed:',e);
      }
    },80);
  }

  function installTabBridge(){
    if(window.__QR_MANAGER_HALL_TAB_BRIDGE__) return;
    window.__QR_MANAGER_HALL_TAB_BRIDGE__=true;
    document.addEventListener('click',function(e){
      var b=e.target&&e.target.closest?e.target.closest('.tabs button'):null;
      if(!b) return;
      var text=(b.textContent||'').replace(/\s+/g,' ').trim();
      if(text.indexOf('Зал / Столы')===-1) return;
      openHallFromTab();
    },true);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installTabBridge,{once:true});
  }else{
    installTabBridge();
  }
})();
