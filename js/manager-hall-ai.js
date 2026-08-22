/* QR Menu — compatibility bootstrap. */
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
          if(!options.methods) options.methods={};
          if(typeof options.methods.selectVenueTemplate!=='function'){
            options.methods.selectVenueTemplate=function(id){var list=Array.isArray(this.venueTemplates)?this.venueTemplates:[],t=list.find(function(x){return String(x.id)===String(id);});if(!t)return;if(!this.newVenueForm)this.newVenueForm={};this.newVenueForm.template=t.id;if(!this.newVenueForm.name)this.newVenueForm.name=t.name||'';if(!this.newVenueForm.slug)this.newVenueForm.slug=t.id||'';};
          }
        }
        return originalCreateApp.apply(this,arguments);
      };
    }catch(e){console.warn('[QR Menu] Vue template bridge:',e);}
  }
  try{if(window.Vue)patchVue(window.Vue);else{var d=Object.getOwnPropertyDescriptor(window,'Vue');if(!d||d.configurable!==false){var value;Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;patchVue(v);}});}}}catch(e){console.warn('[QR Menu] Vue bridge install failed:',e);}
  function loadScript(src,key){if(document.querySelector('script['+key+']'))return;var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(key,'1');s.onerror=function(){console.error('[QR Manager] failed to load '+src)};document.head.appendChild(s);}
  loadScript('/js/manager-hall.js?v=2','data-manager-hall-single');
  loadScript('/js/manager-recipes-ui.js?v=2','data-manager-recipes-ui');
  loadScript('/js/manager-personnel-integrated.js?v=3','data-manager-personnel-integrated');
})();
// Production sync marker: force the GitHub -> Vercel production pipeline to deploy the current main branch.
