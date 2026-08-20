(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;

if(window.__managerHallBridge) return;
window.__managerHallBridge=true;

function loadScript(src,attr,done){
  if(document.querySelector('script['+attr+']')){ if(done)done(); return; }
  var s=document.createElement('script');
  s.src=src;
  s.async=false;
  s.setAttribute(attr,'1');
  s.onload=function(){ if(done)done(); };
  s.onerror=function(){ console.warn('[manager-hall] '+src+' не найден, пропускаем'); };
  document.head.appendChild(s);
}

function loadModules(){
  // Загружаем только manager-hall-view.js (всё остальное уже не нужно)
  loadScript('/js/manager-hall-view.js?v=3','data-manager-hall-view');
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadModules);
else loadModules();
})();
