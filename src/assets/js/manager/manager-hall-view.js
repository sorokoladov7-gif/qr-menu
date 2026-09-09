/* QR Menu — manager compatibility entrypoint. Canonical module lives under /src/assets/js/manager/legacy/. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_VIEW_ROOT_LOADER__=true;
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  var s=document.createElement('script');
  s.src='/src/assets/js/manager/legacy/manager-hall-view.js?v=fix-20260909';
  s.async=false;
  s.onload=function(){};
  s.onerror=function(){ console.error('[QR Hall View] canonical module failed to load:',s.src); };
  document.head.appendChild(s);
})();
