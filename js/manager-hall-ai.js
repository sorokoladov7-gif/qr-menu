/* QR Menu — manager compatibility bootstrap. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP__=true;

  function patchVue(Vue){
    try{
      if(!Vue || typeof Vue.createApp!=='function' || Vue.__QR_TEMPLATE_METHOD_PATCHED__) return;
      Vue.__QR_TEMPLATE_METHOD_PATCHED__=true;
      var originalCreateApp=Vue.createApp;
      Vue.createApp=function(options){
        if(options && typeof options==='object'){
          options.computed=options.computed||{};
          /* Venue-count limits are enforced authoritatively by create_venue_for_manager().
             Keep the UI button clickable so the manager flow can perform the real check. */
          options.computed.canCreateVenue=function(){ return true; };
        }
        var app=originalCreateApp.apply(this,arguments);
        try{
          var originalMount=app.mount;
          app.mount=function(){
            var result=originalMount.apply(this,arguments);
            window.__QR_MANAGER_VUE_APP__=this;
            try{ window.__managerVue=this._instance && this._instance.proxy || null; }catch(e){}
            return result;
          };
        }catch(e){ console.warn('[QR Menu] Vue mount bridge:',e); }
        return app;
      };
    }catch(e){console.warn('[QR Menu] Vue bootstrap:',e);}
  }

  try{
    if(window.Vue) patchVue(window.Vue);
    else{
      var d=Object.getOwnPropertyDescriptor(window,'Vue');
      if(!d || d.configurable!==false){
        var value;
        Object.defineProperty(window,'Vue',{
          configurable:true,
          enumerable:true,
          get:function(){return value;},
          set:function(v){value=v;patchVue(v);}
        });
      }
    }
  }catch(e){console.warn('[QR Menu] Vue bridge install failed:',e);}

  function loadScript(src,key){
    if(document.querySelector('script['+key+']')) return;
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.setAttribute(key,'1');
    s.onerror=function(){console.error('[QR Manager] failed to load '+src);};
    document.head.appendChild(s);
  }

  loadScript('/js/manager-hall.js?v=3','data-manager-hall-single');
  loadScript('/js/manager-recipes-ui.js?v=3','data-manager-recipes-ui');
  loadScript('/js/manager-subscription-owner.js?v=4','data-manager-subscription-owner');
  loadScript('/js/manager-create-venue-flow.js?v=6','data-manager-create-venue-flow');
  loadScript('/js/manager-personnel-final.js?v=4','data-manager-personnel-final');
})();
