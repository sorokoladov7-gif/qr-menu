/* QR Menu — manager hall bootstrap. Captures the real Vue manager instance before mount. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_LAUNCHER__) return;
  window.__QR_MANAGER_HALL_LAUNCHER__ = true;

  function loadScript(src, attr, next){
    if(document.querySelector('script['+attr+']')){if(next)next();return;}
    var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(attr,'1');s.onload=function(){if(next)next();};s.onerror=function(){console.error('[QR Hall] failed to load '+src);};document.head.appendChild(s);
  }
  function captureVueApp(app){
    if(!app||!app.mount||app.__qrHallWrapped)return app;
    app.__qrHallWrapped=true;
    var originalMount=app.mount;
    app.mount=function(){
      var result=originalMount.apply(this,arguments);
      try{
        var root=document.getElementById('app');var instance=root&&root.__vue_app__&&root.__vue_app__._instance;if(!instance&&this._instance)instance=this._instance;
        if(instance&&instance.proxy){
          window.__managerVue=instance.proxy;
          window.__managerVenue=function(){var p=window.__managerVue;return p&&p.venue?p.venue:null;};
          try{if(instance.proxy.venue&&instance.proxy.venue.id){window.__managerSelectedVenue=instance.proxy.venue;localStorage.setItem('manager_venue_id',instance.proxy.venue.id);localStorage.setItem('selectedVenueId',instance.proxy.venue.id);}}catch(e){}
        }
      }catch(e){console.error('[QR Hall] Vue capture failed',e);}
      return result;
    };
    return app;
  }
  if(window.Vue&&typeof window.Vue.createApp==='function'){var originalCreateApp=window.Vue.createApp;window.Vue.createApp=function(){return captureVueApp(originalCreateApp.apply(this,arguments));};}
  function loadCreateFix(){loadScript('/js/manager-hall-create-fix.js?v=2','data-qr-hall-create-fix',loadEnhancements);}
  function loadEnhancements(){loadScript('/js/manager-hall-enhancements.js?v=2','data-qr-hall-enhancements',loadEditDelete);}
  function loadEditDelete(){loadScript('/js/manager-hall-edit-delete.js?v=1','data-qr-hall-edit-delete');}
  function boot(){
    if(window.QRManagerHall&&window.QRManagerHall.open){loadCreateFix();return;}
    if(document.querySelector('script[data-qr-hall-direct]')){loadCreateFix();return;}
    var s=document.createElement('script');s.src='/js/manager-hall-direct.js?v=10';s.async=false;s.setAttribute('data-qr-hall-direct','1');s.onload=loadCreateFix;s.onerror=function(){console.error('[QR Hall] direct module failed to load');};document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
