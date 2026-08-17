(function(){
'use strict';
if(!/\/manager\.html$/i.test(location.pathname)) return;
if(window.__managerHallBridge)return;
window.__managerHallBridge=true;

function loadScript(src,attr,done){
  if(document.querySelector('script['+attr+']')){if(done)done();return;}
  var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(attr,'1');
  s.onload=function(){if(done)done();};
  s.onerror=function(e){console.error(src+' load error',e);};
  document.head.appendChild(s);
}
function loadModules(){
  loadScript('/js/manager-tables.js?v=1','data-manager-tables-loader',function(){window.__managerTablesLoaded=true;console.info('manager-tables.js loaded');});
  loadScript('/js/manager-design.js?v=1','data-manager-design-loader');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadModules); else loadModules();
})();
