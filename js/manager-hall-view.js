/* QR Menu — compatibility bridge only. No hall UI, no click handlers, no iframe. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  window.__QR_MANAGER_HALL_VIEW_COMPAT__=true;

  // manager.html loads this file BEFORE Vue.createApp().
  // Therefore adding a method to the Vue proxy after mount is too late.
  // Patch createApp once so the compatibility method exists in the component
  // options before Vue compiles the template and runs mounted/init.
  function installVueBridge(){
    try{
      if(!window.Vue || typeof window.Vue.createApp!=='function' || window.__QR_MANAGER_VUE_TEMPLATE_BRIDGE__) return;
      window.__QR_MANAGER_VUE_TEMPLATE_BRIDGE__=true;
      var originalCreateApp=window.Vue.createApp;
      window.Vue.createApp=function(options){
        try{
          if(options && typeof options==='object'){
            if(!options.methods) options.methods={};
            if(typeof options.methods.selectVenueTemplate!=='function'){
              options.methods.selectVenueTemplate=function(id){
                var list=Array.isArray(this.venueTemplates)?this.venueTemplates:[];
                var t=list.find(function(x){return x.id===id;});
                if(!t) return;
                if(!this.newVenueForm) this.newVenueForm={};
                this.newVenueForm.template=id;
                if(!this.newVenueForm.name) this.newVenueForm.name=t.name;
                if(!this.newVenueForm.slug) this.newVenueForm.slug=id;
              };
            }
          }
        }catch(e){ console.warn('[QR Menu] Vue template bridge:',e); }
        return originalCreateApp.apply(this,arguments);
      };
    }catch(e){ console.warn('[QR Menu] Vue bridge install failed:',e); }
  }

  installVueBridge();

  function expose(){
    try{
      var root=document.getElementById('app');
      var p=root && root.__vue_app__ && root.__vue_app__._instance && root.__vue_app__._instance.proxy;
      if(p){
        window.__managerVue=p;
        window.__managerVenue=function(){return p.venue||null;};
        if(typeof p.selectVenueTemplate!=='function'){
          p.selectVenueTemplate=function(id){
            var list=Array.isArray(p.venueTemplates)?p.venueTemplates:[];
            var t=list.find(function(x){return x.id===id;});
            if(!t) return;
            if(!p.newVenueForm) p.newVenueForm={};
            p.newVenueForm.template=id;
            if(!p.newVenueForm.name) p.newVenueForm.name=t.name;
            if(!p.newVenueForm.slug) p.newVenueForm.slug=id;
          };
        }
      }
    }catch(e){}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',expose);
  else expose();
  setTimeout(expose,250);
  setTimeout(expose,1000);
  setTimeout(expose,2000);
})();
