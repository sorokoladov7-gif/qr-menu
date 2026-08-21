/* QR Menu — compatibility loader for the integrated manager hall. */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_LAUNCHER__) return;
window.__QR_MANAGER_HALL_LAUNCHER__=true;
function loadDirect(){
  if(document.querySelector('script[data-qr-manager-hall-direct]')) return;
  var s=document.createElement('script');
  s.src='/js/manager-hall-direct.js?v=2';
  s.async=false;
  s.setAttribute('data-qr-manager-hall-direct','1');
  s.onerror=function(){console.error('[QR Menu] Не удалось загрузить модуль зала');};
  document.head.appendChild(s);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadDirect); else loadDirect();
})();
