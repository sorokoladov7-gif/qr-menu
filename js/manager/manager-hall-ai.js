/* QR Menu — manager compatibility entrypoint. Canonical hall bootstrap lives at /js/manager-hall-ai.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_AI_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_AI_ROOT_LOADER__=true;
  var s=document.createElement('script');
  s.src='/js/manager-hall-ai.js?v=fix-20260907';
  s.async=false;
  s.onload=function(){
    /* Legacy AI conflict guard: the manager must expose one AI entry point — Qrchick. */
    if(window.__QR_MANAGER_AI_CONFLICT_GUARD__)return;
    window.__QR_MANAGER_AI_CONFLICT_GUARD__=true;
    function hideLegacy(){
      var old=document.getElementById('qr-ai-center');
      if(old){old.style.display='none';old.setAttribute('aria-hidden','true');}
    }
    function openQrchick(){
      var fab=document.getElementById('qrchick-manager-fab');
      if(fab){fab.click();return true;}
      return false;
    }
    function isLegacyAI(el){
      if(!el||!el.closest)return false;
      if(el.closest('#qrchick-manager-root'))return false;
      var node=el.closest('button,a,[role="button"],.ai-button,.qr-ai-button,[data-ai],[data-action]')||el;
      var text=((node.textContent||'')+' '+(node.getAttribute('aria-label')||'')+' '+(node.getAttribute('title')||'')+' '+(node.getAttribute('data-action')||'')).replace(/\s+/g,' ').trim().toLowerCase();
      return text.indexOf('qr ai')!==-1||text.indexOf('qr-ai')!==-1||text.indexOf('ии-помощник')!==-1||text.indexOf('ии помощник')!==-1||text==='ai'||text==='ии';
    }
    document.addEventListener('click',function(e){
      if(!isLegacyAI(e.target))return;
      hideLegacy();
      if(openQrchick()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}
    },true);
    var observer=new MutationObserver(function(){hideLegacy();});
    observer.observe(document.body,{subtree:true,childList:true});
    hideLegacy();
  };
  s.onerror=function(){console.error('[QR Manager] Failed to load canonical hall AI:',s.src);};
  document.head.appendChild(s);
})();
