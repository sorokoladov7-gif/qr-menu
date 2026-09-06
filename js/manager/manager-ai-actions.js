/* QR Menu — compatibility shell for the canonical Qrchick manager AI UI. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_ACTIONS__)return;
  window.__QR_MANAGER_AI_ACTIONS__=true;
  function removeLegacyAI(){
    var old=document.getElementById('qr-ai-center');
    if(old)old.remove();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeLegacyAI,{once:true});
  else removeLegacyAI();
  window.addEventListener('qr-manager-vue-ready',function(){setTimeout(removeLegacyAI,50);});
  window.addEventListener('qr-manager-subscription-ready',function(){setTimeout(removeLegacyAI,50);});
})();
