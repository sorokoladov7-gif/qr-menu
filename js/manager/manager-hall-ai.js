/* QR Menu — compatibility entrypoint. Canonical hall bootstrap lives at /js/manager-hall-ai.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_AI_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_AI_ROOT_LOADER__=true;
  var s=document.createElement('script');
  s.src='/js/manager-hall-ai.js?v=fix-20260907';
  s.async=false;
  s.onload=function(){};
  s.onerror=function(){ console.error('[QR Hall AI] canonical module failed to load:',s.src); };
  document.head.appendChild(s);
})();
