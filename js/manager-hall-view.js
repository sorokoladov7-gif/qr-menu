/* QR Menu — compatibility bridge only. No hall UI, no click handlers, no iframe. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  window.__QR_MANAGER_HALL_VIEW_COMPAT__=true;
  function expose(){
    try{
      var root=document.getElementById('app');
      var p=root && root.__vue_app__ && root.__vue_app__._instance && root.__vue_app__._instance.proxy;
      if(p){
        window.__managerVue=p;
        window.__managerVenue=function(){return p.venue||null;};
      }
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',expose);
  else expose();
  setTimeout(expose,250);
  setTimeout(expose,1000);
})();
