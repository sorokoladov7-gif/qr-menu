/* QR Menu — compatibility bootstrap. Hall logic lives only in manager-hall.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP__=true;

  function loadScript(src, marker, onError){
    if(document.querySelector('script['+marker+']')) return;
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.setAttribute(marker,'1');
    s.onerror=onError;
    document.head.appendChild(s);
  }

  function load(){
    /* Keep the existing hall bootstrap independent from the recipe shortcut. */
    if(!(window.QRManagerHall&&window.QRManagerHall.open)){
      loadScript('/js/manager-hall.js?v=2','data-manager-hall-single',function(){
        console.error('[QR Hall] failed to load manager-hall.js');
      });
    }

    /* Recipes must always load, even when hall logic is already present. */
    loadScript('/js/manager-recipes-ui.js?v=2','data-manager-recipes-ui',function(){
      console.error('[QR Recipes] failed to load manager-recipes-ui.js');
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();
