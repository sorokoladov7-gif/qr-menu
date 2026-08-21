/* QR Menu — stable bridge for the manager hall. */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_STABLE_BRIDGE__) return;
window.__QR_MANAGER_HALL_STABLE_BRIDGE__=true;
function expose(app){try{var p=app&&app._instance&&app._instance.proxy;if(p){window.__managerVue=p;window.__managerVenue=function(){return p.venue||null;};}}catch(e){console.error('[QR Hall] Vue expose error',e);}}
function patchVue(){
  if(!window.Vue||window.Vue.__qrHallPatched)return !!window.Vue;
  var original=window.Vue.createApp;if(typeof original!=='function')return false;
  window.Vue.createApp=function(){
    var app=original.apply(this,arguments),mount=app.mount;
    app.mount=function(){var result=mount.apply(this,arguments);setTimeout(function(){expose(app);},0);setTimeout(function(){expose(app);},100);setTimeout(function(){expose(app);},500);return result;};
    return app;
  };
  window.Vue.__qrHallPatched=true;return true;
}
function loadDirect(){if(document.querySelector('script[data-qr-hall-direct]'))return;var s=document.createElement('script');s.src='/js/manager-hall-direct.js?v=stable4';s.async=false;s.setAttribute('data-qr-hall-direct','1');s.onerror=function(){console.error('[QR Hall] direct module load failed');};document.head.appendChild(s);}
function boot(){patchVue();loadDirect();var n=0,t=setInterval(function(){patchVue();if(window.__managerVue)clearInterval(t);if(++n>80)clearInterval(t);},100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
