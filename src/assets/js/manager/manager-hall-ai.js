/* QR Menu — manager compatibility entrypoint. Canonical hall bootstrap lives at /js/manager-hall-ai.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_AI_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_AI_ROOT_LOADER__=true;

  /* Qrchick is the only manager AI entry point. Keep the compatibility guard
     small and safe: never call MutationObserver.observe() before body exists. */
  function hideLegacyAI(){
    if(!document.body)return;
    var nodes=document.querySelectorAll('body *');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!el||el.id==='qrchick-manager-root'||(el.closest&&el.closest('#qrchick-manager-root')))continue;
      var text=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!text||text.length>500)continue;
      var legacy=(text.indexOf('Ваш ИИ-помощник')!==-1&&text.indexOf('AI не подключён')!==-1)
        ||(text.indexOf('Доступ определяется выбранным тарифом')!==-1&&text.indexOf('Выберите тариф с включённым ИИ')!==-1)
        ||el.id==='qr-ai-center';
      if(legacy){
        el.style.display='none';
        el.setAttribute('aria-hidden','true');
        el.setAttribute('data-qr-legacy-ai','1');
      }
    }
  }

  function openQrchick(){
    var fab=document.getElementById('qrchick-manager-fab');
    if(fab){fab.click();return true;}
    return false;
  }

  function isLegacyAI(el){
    if(!el||!el.closest)return false;
    if(el.closest('#qrchick-manager-root'))return false;
    var node=el.closest('button,a,[role="button"],.ai-button,.qr-ai-button,[data-ai],[data-action],[data-tab]')||el;
    var text=((node.textContent||'')+' '+(node.getAttribute('aria-label')||'')+' '+(node.getAttribute('title')||'')+' '+(node.getAttribute('data-action')||'')+' '+(node.getAttribute('data-tab')||'')).replace(/\s+/g,' ').trim().toLowerCase();
    return text.indexOf('qr ai')!==-1||text.indexOf('qr-ai')!==-1||text.indexOf('ии-помощник')!==-1||text.indexOf('ии помощник')!==-1||text==='ai'||text==='ии'||text==='assistant'||text==='ии assistant';
  }

  function installAIConflictGuard(){
    if(window.__QR_MANAGER_AI_CONFLICT_GUARD__)return;
    if(!document.body){
      document.addEventListener('DOMContentLoaded',installAIConflictGuard,{once:true});
      return;
    }
    window.__QR_MANAGER_AI_CONFLICT_GUARD__=true;
    hideLegacyAI();
    document.addEventListener('click',function(e){
      if(!isLegacyAI(e.target))return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      hideLegacyAI();
      openQrchick();
    },true);
    var observer=new MutationObserver(function(){hideLegacyAI();});
    observer.observe(document.body,{subtree:true,childList:true});
    window.__QR_MANAGER_AI_CONFLICT_OBSERVER__=observer;
  }

  installAIConflictGuard();

  var s=document.createElement('script');
  s.src='/js/manager-hall-ai.js?v=fix-20260907-3';
  s.async=false;
  s.onload=function(){installAIConflictGuard();};
  s.onerror=function(){console.error('[QR Manager] Failed to load canonical hall AI:',s.src);};
  document.head.appendChild(s);
})();
