/* QR Menu — manager compatibility entrypoint. Canonical hall bootstrap lives under /src/assets/js/manager/legacy/. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_ROOT_LOADER__=true;
  var s=document.createElement('script');
  s.src='/src/assets/js/manager/legacy/manager-hall.js?v=20260909';
  s.async=false;
  s.onload=function(){};
  s.onerror=function(){console.error('[QR Hall] canonical module failed to load:',s.src);};
  document.head.appendChild(s);
})();
