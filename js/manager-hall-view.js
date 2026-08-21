/* QR Menu — stable bridge for the manager hall. */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_STABLE_BRIDGE_V2__) return;
window.__QR_MANAGER_HALL_STABLE_BRIDGE_V2__=true;
function expose(app){try{var p=app&&app._instance&&app._instance.proxy;if(p){window.__managerVue=p;window.__managerVenue=function(){return p.venue||null;};}}catch(e){console.error('[QR Hall] Vue expose error',e);}}
function patchVue(){
  if(!window.Vue||window.Vue.__qrHallPatchedV2)return !!window.Vue;
  var original=window.Vue.createApp;if(typeof original!=='function')return false;
  window.Vue.createApp=function(){
    var app=original.apply(this,arguments),mount=app.mount;
    app.mount=function(){var result=mount.apply(this,arguments);setTimeout(function(){expose(app);},0);setTimeout(function(){expose(app);},100);setTimeout(function(){expose(app);},500);setTimeout(function(){expose(app);},1500);return result;};
    return app;
  };
  window.Vue.__qrHallPatchedV2=true;return true;
}
function loadDirect(){if(window.QRManagerHall&&window.QRManagerHall.open)return;if(document.querySelector('script[data-qr-hall-direct-v5]'))return;var s=document.createElement('script');s.src='/js/manager-hall-direct.js?v=stable5';s.async=false;s.setAttribute('data-qr-hall-direct-v5','1');s.onload=function(){if(window.__managerVue)expose({ _instance:{proxy:window.__managerVue} });};s.onerror=function(){console.error('[QR Hall] direct module load failed');};document.head.appendChild(s);}
function boot(){patchVue();loadDirect();var n=0,t=setInterval(function(){patchVue();if(window.__managerVue){expose({_instance:{proxy:window.__managerVue}});clearInterval(t);}if(++n>100)clearInterval(t);},100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
