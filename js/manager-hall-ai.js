/* Legacy compatibility loader.
 * The hall UI is now integrated directly into manager.html.
 * This file only loads the single active hall module and never creates an iframe.
 */
(function(){
  'use strict';
  function load(){
    if(document.querySelector('script[data-qr-manager-hall-v7]')) return;
    var s=document.createElement('script');
    s.src='/js/manager-hall-view.js?v=7';
    s.async=false;
    s.setAttribute('data-qr-manager-hall-v7','1');
    s.onerror=function(){console.error('[QR Menu] Не удалось загрузить модуль зала');};
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load);
  else load();
})();
