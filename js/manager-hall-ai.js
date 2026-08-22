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
            options.methods.selectVenueTemplate=function(id){
              var list=Array.isArray(this.venueTemplates)?this.venueTemplates:[];
              var t=list.find(function(x){return String(x.id)===String(id);});
              if(!t)return;
              if(!this.newVenueForm)this.newVenueForm={};
              this.newVenueForm.template=t.id;
              if(!this.newVenueForm.name)this.newVenueForm.name=t.name||'';
              if(!this.newVenueForm.slug)this.newVenueForm.slug=t.id||'';
            };
          }
          if(typeof options.methods.selectVenue==='function' && !options.methods.__qrStaffVenueWrapped){
            var originalSelectVenue=options.methods.selectVenue;
            options.methods.selectVenue=function(v){
              try{window.__QR_MANAGER_SELECTED_VENUE_ID__=v&&v.id?v.id:null;window.__QR_MANAGER_SELECTED_VENUE__=v||null;}catch(e){}
              return originalSelectVenue.apply(this,arguments);
            };
            options.methods.__qrStaffVenueWrapped=true;
          }
          if(typeof options.methods.loadStaffAnalytics==='function' && !options.methods.__qrStaffAnalyticsWrapped){
            var originalLoadStaffAnalytics=options.methods.loadStaffAnalytics;
            options.methods.loadStaffAnalytics=function(){
              var self=this;
              try{window.__QR_MANAGER_SELECTED_VENUE_ID__=self.venue&&self.venue.id?self.venue.id:(window.__QR_MANAGER_SELECTED_VENUE_ID__||null);}catch(e){}
              var result=originalLoadStaffAnalytics.apply(this,arguments);
              var sync=function(){try{window.__QR_MANAGER_STAFF_ANALYTICS__=self.staffAnalytics||null;window.__QR_MANAGER_SELECTED_VENUE_ID__=self.venue&&self.venue.id?self.venue.id:(window.__QR_MANAGER_SELECTED_VENUE_ID__||null);}catch(e){}};
              if(result&&typeof result.then==='function')return result.then(function(v){sync();return v;});
              setTimeout(sync,0);
              return result;
            };
            options.methods.__qrStaffAnalyticsWrapped=true;
          }
        }
        return originalCreateApp.apply(this,arguments);
      };
    }catch(e){console.warn('[QR Menu] Vue template bridge:',e);}
  }

  function installVueBridge(){
    try{
      if(window.Vue)patchVue(window.Vue);
      else if(!Object.prototype.hasOwnProperty.call(window,'__QR_VUE_BRIDGE_INSTALLED__')){
        window.__QR_VUE_BRIDGE_INSTALLED__=true;
        var descriptor=Object.getOwnPropertyDescriptor(window,'Vue');
        if(!descriptor || descriptor.configurable!==false){
          var vueValue;
          Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return vueValue;},set:function(v){vueValue=v;patchVue(v);}});
        }
      }
    }catch(e){console.warn('[QR Menu] Vue bridge install failed:',e);}
  }

  function loadScript(src,key,onError){
    if(document.querySelector('script['+key+']'))return;
    var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(key,'1');s.onerror=onError;document.head.appendChild(s);
  }

  installVueBridge();
  loadScript('/js/manager-hall.js?v=2','data-manager-hall-single',function(){console.error('[QR Hall] failed to load manager-hall.js');});
  loadScript('/js/manager-recipes-ui.js?v=2','data-manager-recipes-ui',function(){console.error('[QR Recipes] failed to load manager-recipes-ui.js');});
  loadScript('/js/manager-personnel-integrated.js?v=2','data-manager-personnel-integrated',function(){console.error('[QR Personnel] failed to load manager-personnel-integrated.js');});
})();
