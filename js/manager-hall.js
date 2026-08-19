(function(){
'use strict';
// Работаем только на странице управляющего
if(!/\/manager\.html$/i.test(location.pathname)) return;

// Защита от повторного подключения
if(window.__managerHallBridge) return;
window.__managerHallBridge=true;

function loadScript(src,attr,done){
  // Не грузим дважды
  if(document.querySelector('script['+attr+']')){ if(done)done(); return; }
  var s=document.createElement('script');
  s.src=src;
  s.async=false;
  s.setAttribute(attr,'1');
  s.onload=function(){ if(done)done(); };
  // Не падаем если файл не найден — просто пропускаем
  s.onerror=function(){ console.warn('[manager-hall] '+src+' не найден, пропускаем'); };
  document.head.appendChild(s);
}

function loadModules(){
  // ============================================================
  // ИСПРАВЛЕНО: manager-tables.js БОЛЬШЕ НЕ ЗАГРУЖАЕТСЯ
  // Причина: использовал прямые запросы к venue_tables (insert/update/delete)
  // в обход RPC — небезопасно. Также добавлял дубль кнопки «Столы»,
  // конфликтующую с вкладкой «Зал / Столы».
  // Управление столами теперь идёт через вкладку «Зал / Столы» (RPC manager_table_board).
  // ============================================================

  // Загружаем только manager-design.js, если он существует в проекте
  loadScript('/js/manager-design.js?v=1','data-manager-design-loader');
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadModules);
else loadModules();
})();
