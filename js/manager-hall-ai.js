/* QR Menu — manager compatibility bootstrap v7. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V7__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V7__=true;

  function patchVue(Vue){
    try{
      if(!Vue||typeof Vue.createApp!=='function'||Vue.__QR_TEMPLATE_METHOD_PATCHED_V7__)return;
      Vue.__QR_TEMPLATE_METHOD_PATCHED_V7__=true;
      var original=Vue.createApp;
      Vue.createApp=function(options){
        if(options&&typeof options==='object'){
          options.computed=options.computed||{};
          options.computed.canCreateVenue=function(){return true;};
        }
        var app=original.apply(this,arguments);
        try{
          var mount=app.mount;
          app.mount=function(){
            var result=mount.apply(this,arguments);
            window.__QR_MANAGER_VUE_APP__=this;
            try{window.__managerVue=this._instance&&this._instance.proxy||null;}catch(e){}
            return result;
          };
        }catch(e){}
        return app;
      };
    }catch(e){console.warn('[QR Menu] Vue bootstrap:',e);}
  }
  try{
    if(window.Vue)patchVue(window.Vue);
    else{
      var d=Object.getOwnPropertyDescriptor(window,'Vue'),value;
      if(!d||d.configurable!==false)Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;patchVue(v);}});
    }
  }catch(e){}
  function load(src,key){
    if(document.querySelector('script['+key+']'))return;
    var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(key,'1');
    s.onerror=function(){console.error('[QR Manager] failed to load '+src);};document.head.appendChild(s);
  }
  load('/js/manager-hall.js?v=4','data-manager-hall-single-v7');
  load('/js/manager-recipes-ui.js?v=4','data-manager-recipes-ui-v7');
  load('/js/manager-subscription-owner.js?v=5','data-manager-subscription-owner-v7');
  load('/js/manager-create-venue-flow.js?v=7','data-manager-create-venue-flow-v7');
  load('/js/manager-personnel-final.js?v=5','data-manager-personnel-final-v7');
})();
