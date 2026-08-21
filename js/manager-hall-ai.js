/* QR Menu — compatibility bootstrap. Hall logic lives only in manager-hall.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP__=true;

  /* manager.html creates Vue immediately after loading this file. The
     selectVenueTemplate compatibility method therefore has to be injected
     when Vue itself becomes available, before createApp() is called. */
  function patchVue(Vue){
    try{
      if(!Vue || typeof Vue.createApp!=='function' || Vue.__QR_TEMPLATE_METHOD_PATCHED__) return;
      Vue.__QR_TEMPLATE_METHOD_PATCHED__=true;
      var originalCreateApp=Vue.createApp;
      Vue.createApp=function(options){
        if(options && typeof options==='object'){
          if(!options.methods) options.methods={};
          if(typeof options.methods.selectVenueTemplate!=='function'){
            options.methods.selectVenueTemplate=function(id){
              var list=Array.isArray(this.venueTemplates)?this.venueTemplates:[];
              var t=list.find(function(x){return String(x.id)===String(id);});
              if(!t) return;
              if(!this.newVenueForm) this.newVenueForm={};
              this.newVenueForm.template=t.id;
              if(!this.newVenueForm.name) this.newVenueForm.name=t.name||'';
              if(!this.newVenueForm.slug) this.newVenueForm.slug=t.id||'';
            };
          }
        }
        return originalCreateApp.apply(this,arguments);
      };
    }catch(e){
      console.warn('[QR Menu] Vue template bridge:',e);
    }
  }

  /* Vue is loaded by a normal <script> immediately after manager-hall-ai.js.
     Intercept the global assignment so the patch is installed synchronously
     before manager.html reaches Vue.createApp(). */
  try{
    var currentVue=window.Vue;
    if(currentVue) patchVue(currentVue);
    else if(!Object.prototype.hasOwnProperty.call(window,'__QR_VUE_BRIDGE_INSTALLED__')){
      window.__QR_VUE_BRIDGE_INSTALLED__=true;
      var descriptor=Object.getOwnPropertyDescriptor(window,'Vue');
      if(!descriptor || descriptor.configurable!==false){
        var vueValue;
        Object.defineProperty(window,'Vue',{
          configurable:true,
          enumerable:true,
          get:function(){return vueValue;},
          set:function(v){vueValue=v;patchVue(v);}
        });
      }
    }
  }catch(e){
    console.warn('[QR Menu] Vue bridge install failed:',e);
  }

  function loadScript(src, marker, onError){
    if(document.querySelector('script['+marker+']')) return;
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.setAttribute(marker,'1');
    s.onerror=onError;
    document.head.appendChild(s);
  }

  function load(){
    if(!(window.QRManagerHall&&window.QRManagerHall.open)){
      loadScript('/js/manager-hall.js?v=2','data-manager-hall-single',function(){
        console.error('[QR Hall] failed to load manager-hall.js');
      });
    }
    loadScript('/js/manager-recipes-ui.js?v=2','data-manager-recipes-ui',function(){
      console.error('[QR Recipes] failed to load manager-recipes-ui.js');
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();
