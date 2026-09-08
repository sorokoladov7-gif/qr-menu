/* QR Menu — compatibility entrypoint. Canonical manager hall lives at /js/manager-hall.js. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_ROOT_LOADER__) return;
  window.__QR_MANAGER_HALL_ROOT_LOADER__=true;

  function load(src,key){
    if(document.querySelector('script['+key+']')) return;
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.setAttribute(key,'1');
    s.onerror=function(){ console.error('[QR Manager] failed to load '+src); };
    document.head.appendChild(s);
  }

  load('/js/manager-hall.js?v=fix-20260907','data-manager-hall-single-v11');

  function getVue(){
    return window.__managerVue ||
      (window.__QR_MANAGER_VUE_APP__ &&
       window.__QR_MANAGER_VUE_APP__._instance &&
       window.__QR_MANAGER_VUE_APP__._instance.proxy) || null;
  }

  function mountHall(){
    var vm=getVue();
    if(!vm || vm.tab!=='hall') return false;
    var container=document.getElementById('hall-container');
    var api=window.QRManagerHall;
    if(!container || !api) return false;

    try{
      if(typeof api.renderIn==='function'){
        if(container.__qrHallMountedForVenue===vm.venueId && container.querySelector('#qmh-board')) return true;
        var venue=typeof api.resolveVenue==='function' ? api.resolveVenue() : vm.venue;
        if(venue && typeof venue.then==='function'){
          venue.then(function(v){
            if(!v || !v.id || getVue()!==vm || vm.tab!=='hall') return;
            api.renderIn(container,v);
            container.__qrHallMountedForVenue=v.id;
          }).catch(function(e){ console.error('[QR Hall] mount failed:',e); });
        }else if(venue && venue.id){
          api.renderIn(container,venue);
          container.__qrHallMountedForVenue=venue.id;
        }
        return true;
      }

      if(typeof api.open==='function'){
        var v=typeof api.resolveVenue==='function'?api.resolveVenue():vm.venue;
        if(v && typeof v.then==='function'){
          v.then(function(x){if(x&&x.id&&getVue()===vm&&vm.tab==='hall')api.open(x);}).catch(function(e){console.error('[QR Hall] open failed:',e);});
        }else if(v&&v.id){
          api.open(v);
        }
        return true;
      }
    }catch(e){
      console.error('[QR Hall] mount failed:',e);
    }
    return false;
  }

  function startHallBridge(){
    if(window.__QR_MANAGER_HALL_TAB_BRIDGE__) return;
    window.__QR_MANAGER_HALL_TAB_BRIDGE__=true;

    var lastTab='';
    var lastVenue='';
    var timer=setInterval(function(){
      var vm=getVue();
      if(!vm){return;}
      var venue=vm.venue&&vm.venue.id||'';
      if(vm.tab!==lastTab || venue!==lastVenue){
        lastTab=vm.tab||'';
        lastVenue=venue;
        if(lastTab==='hall'){
          setTimeout(mountHall,50);
        }
      }else if(lastTab==='hall'){
        var c=document.getElementById('hall-container');
        if(c && !c.querySelector('#qmh-board')) mountHall();
      }
    },250);

    document.addEventListener('click',function(e){
      var b=e.target&&e.target.closest?e.target.closest('.tabs button'):null;
      if(!b) return;
      var text=(b.textContent||'').replace(/\s+/g,' ').trim();
      if(text.indexOf('Зал / Столы')!==-1) setTimeout(mountHall,80);
    },true);

    window.addEventListener('qr-manager-vue-ready',function(){
      setTimeout(mountHall,100);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',startHallBridge,{once:true});
  }else{
    startHallBridge();
  }
})();
