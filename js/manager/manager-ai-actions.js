/* QR Menu — authoritative compatibility loader for the canonical Qrchick manager AI UI. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_ACTIONS__)return;
  window.__QR_MANAGER_AI_ACTIONS__=true;
  function cleanup(){
    var old=document.getElementById('qr-ai-center');
    if(old)old.remove();
  }
  function loadCanonical(){
    cleanup();
    if(document.querySelector('script[data-qrchick-canonical]'))return;
    window.__QR_MANAGER_AI_CENTER__=false;
    var s=document.createElement('script');
    s.src='/js/manager/manager-ai.js?v=6';
    s.async=false;
    s.setAttribute('data-qrchick-canonical','v6');
    s.onload=function(){setTimeout(cleanup,100);};
    s.onerror=function(){console.error('[QR Manager] Не удалось загрузить Qrchick v6');};
    document.head.appendChild(s);
  }
  function boot(){cleanup();if(window.__managerVue)loadCanonical();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,0);},{once:true});
  else setTimeout(boot,0);
  window.addEventListener('qr-manager-vue-ready',function(){setTimeout(boot,0);setTimeout(boot,200);});
  window.addEventListener('qr-manager-subscription-ready',function(){setTimeout(boot,0);});
})();
