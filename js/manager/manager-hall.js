/* QR Menu — compatibility entrypoint. Canonical manager hall lives at /js/manager-hall.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_ROOT_LOADER__=true;

  if(window.__QR_MANAGER_HALL_SINGLE__) return;

  var s=document.createElement('script');
  s.src='/js/manager-hall.js?v=fix-20260907';
  s.async=false;
  s.onerror=function(){ console.error('[QR Manager] failed to load canonical hall:',s.src); };
  document.head.appendChild(s);
})();
