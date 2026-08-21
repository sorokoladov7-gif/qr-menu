/* QR Menu — single manager hall launcher. The hall is rendered directly over manager.html. */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_LAUNCHER__) return;
window.__QR_MANAGER_HALL_LAUNCHER__=true;
function boot(){
 if(window.QRManagerHall&&window.QRManagerHall.open)return;
 if(document.querySelector('script[data-qr-hall-direct]'))return;
 var s=document.createElement('script');
 s.src='/js/manager-hall-direct.js?v=7';
 s.async=false;
 s.setAttribute('data-qr-hall-direct','1');
 s.onerror=function(){console.error('[QR Hall] direct module failed to load');};
 document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
