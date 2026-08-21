/* QR Menu — compatibility bootstrap. Hall logic lives only in manager-hall.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP__=true;
  function load(){
    if(window.QRManagerHall&&window.QRManagerHall.open)return;
    if(document.querySelector('script[data-manager-hall-single]'))return;
    var s=document.createElement('script');
    s.src='/js/manager-hall.js?v=1';
    s.async=false;
    s.setAttribute('data-manager-hall-single','1');
    s.onerror=function(){console.error('[QR Hall] failed to load manager-hall.js')};
    document.head.appendChild(s);
    var r=document.createElement('script');
    r.src='/js/manager-recipes-ui.js?v=1';
    r.async=false;
    r.setAttribute('data-manager-recipes-ui','1');
    r.onerror=function(){console.error('[QR Recipes] failed to load manager-recipes-ui.js')};
    document.head.appendChild(r);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
