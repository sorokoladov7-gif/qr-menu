/* QR Menu — hall presentation compatibility helper. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  window.__QR_MANAGER_HALL_VIEW_COMPAT__=true;

  /*
   * Vue/db mutation compatibility is intentionally owned by manager-hall-ai.js.
   * This file must not wrap Vue.createApp or db.rpc: doing so created two
   * independent manager bootstrap layers and made script order observable.
   */
  function expose(){
    try{
      var root=document.getElementById('app');
      var app=root&&root.__vue_app__;
      var proxy=app&&app._instance&&app._instance.proxy;
      if(proxy){
        window.__managerVue=proxy;
        window.__managerVenue=function(){return proxy.venue||null;};
      }
    }catch(e){console.warn('[QR Manager] hall view expose:',e);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',expose,{once:true});
  else expose();
  [250,1000,2000].forEach(function(ms){setTimeout(expose,ms);});
})();
