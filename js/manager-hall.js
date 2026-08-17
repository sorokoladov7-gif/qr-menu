(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallBridge)return;
window.__managerHallBridge=true;

function loadTablesModule(){
  if(window.__managerTablesLoaded || document.querySelector('script[data-manager-tables-loader]')) return;
  var s=document.createElement('script');
  s.src='/js/manager-tables.js?v=1';
  s.async=false;
  s.setAttribute('data-manager-tables-loader','1');
  s.onload=function(){window.__managerTablesLoaded=true;console.info('manager-tables.js loaded');};
  s.onerror=function(e){console.error('manager-tables.js load error',e);};
  document.head.appendChild(s);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadTablesModule); else loadTablesModule();
})();
