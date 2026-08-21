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
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
