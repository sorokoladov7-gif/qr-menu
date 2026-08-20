(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallBridge) return;
window.__managerHallBridge=true;
function loadScript(src,attr){
  if(document.querySelector('script['+attr+']')) return;
  var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(attr,'1');
  s.onerror=function(){console.warn('[manager-hall] '+src+' не найден, пропускаем');};
  document.head.appendChild(s);
}
function loadModules(){
  // Единый источник логики зала: manager-hall-view.js.
  // Создание, редактирование, удаление, статусы и QR уже реализованы внутри него.
  loadScript('/js/manager-hall-view.js?v=5','data-manager-hall-view');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadModules); else loadModules();
})();
