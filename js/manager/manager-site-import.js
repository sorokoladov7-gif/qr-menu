/* QR Menu — AI import bridge.
 * Старый публичный интерфейс QRManagerSiteImport сохранён для совместимости.
 * AI-клиент загружается с /api/import-ai?client=1 и перехватывает импорт во вкладке «Меню».
 */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_COMPAT__) return;
  window.__QR_MANAGER_SITE_IMPORT_COMPAT__=true;

  window.QRManagerSiteImport={
    mount:function(){},
    unmount:function(){}
  };

  function loadAIClient(){
    if(window.__QR_MENU_AI_IMPORT__||document.querySelector('script[data-qr-menu-ai-import]'))return;
    var script=document.createElement('script');
    script.src='/api/import-ai?client=1&v=1';
    script.async=false;
    script.setAttribute('data-qr-menu-ai-import','1');
    script.onerror=function(){console.error('[QR Menu] Не удалось загрузить AI-импорт:',script.src);};
    document.head.appendChild(script);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAIClient,{once:true});
  else loadAIClient();
})();
