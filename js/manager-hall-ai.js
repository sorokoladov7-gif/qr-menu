/* QR Menu — manager compatibility bootstrap v8. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V8__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V8__=true;

  function publish(app){
    try{
      window.__QR_MANAGER_VUE_APP__=app;
      window.__managerVue=(app&&app._instance&&app._instance.proxy)||null;
      window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
    }catch(e){console.warn('[QR Menu] publish Vue:',e);}
  }

  function patchVue(Vue){
    if(!Vue || typeof Vue.createApp!=='function' || Vue.__QR_MANAGER_PATCH_V8__) return;
    Vue.__QR_MANAGER_PATCH_V8__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      if(options && typeof options==='object'){
        options.computed=options.computed||{};
        options.computed.canCreateVenue=function(){ return true; };
      }
      var app=original.apply(this,arguments);
      var originalMount=app.mount;
      app.mount=function(){
        var result=originalMount.apply(this,arguments);
        publish(this);
        return result;
      };
      return app;
    };
  }

  function init(){
    try{ if(window.Vue) patchVue(window.Vue); }catch(e){ console.warn('[QR Menu] Vue patch:',e); }
  }
  init();

  function load(src,key){
    if(document.querySelector('script['+key+']')) return;
    var s=document.createElement('script');
    s.src=src; s.async=false; s.setAttribute(key,'1');
    s.onerror=function(){console.error('[QR Manager] failed to load '+src);};
    document.head.appendChild(s);
  }

  load('/js/manager-hall.js?v=5','data-manager-hall-single-v8');
  load('/js/manager-recipes-ui.js?v=5','data-manager-recipes-ui-v8');
  load('/js/manager-subscription-owner.js?v=6','data-manager-subscription-owner-v8');
  load('/js/manager-create-venue-flow.js?v=8','data-manager-create-venue-flow-v8');
  load('/js/manager-personnel-final.js?v=6','data-manager-personnel-final-v8');
})();
