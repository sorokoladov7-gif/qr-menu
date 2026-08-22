/* Compatibility module. Kitchen table controls are now a native tab in cook.html. */
(function(){
  'use strict';
  window.CookTableUnified={version:'3.0',managedBy:'cook.html'};
  function removeLegacyButton(){
    var b=document.getElementById('staff-table-control-btn');
    if(b) b.remove();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',removeLegacyButton);
  else removeLegacyButton();
  var mo=new MutationObserver(removeLegacyButton);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect();},15000);
})();
