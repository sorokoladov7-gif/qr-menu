/* QR MENU — legacy assistant compatibility shim. The old draggable assistant is intentionally removed. */
(function(){
  'use strict';
  function clean(){
    var root=document.getElementById('qr-ai-center');
    if(!root) return;
    var welcome=root.querySelector('.qr-ai-welcome');
    if(welcome) welcome.remove();
  }
  clean();
  if(window.MutationObserver){
    var obs=new MutationObserver(clean);
    obs.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(function(){obs.disconnect();clean();},10000);
  }
})();
