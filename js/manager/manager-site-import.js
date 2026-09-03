/* QR Menu — compatibility bridge.
 * Импорт меню перенесён во вкладку «Меню».
 * Файл оставлен на прежнем пути, чтобы существующие вызовы mount/unmount
 * из manager-venues.js не ломали кабинет управляющего.
 */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_COMPAT__) return;
  window.__QR_MANAGER_SITE_IMPORT_COMPAT__=true;
  window.QRManagerSiteImport={
    mount:function(){},
    unmount:function(){}
  };
})();