/* QR Menu — compatibility entrypoint. Canonical manager design lives at /js/manager-design.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_DESIGN_ROOT_LOADER__) return;
  window.__QR_MANAGER_DESIGN_ROOT_LOADER__=true;
  if(window.__managerDesignLoaded) return;
  var s=document.createElement('script');
  s.src='/js/manager-design.js?v=fix-20260907';
  s.async=false;
  s.onload=function(){};
  s.onerror=function(){ console.error('[Manager Design] canonical module failed to load:',s.src); };
  document.head.appendChild(s);
})();
