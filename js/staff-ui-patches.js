(function(){
  'use strict';
  var path=location.pathname.toLowerCase();
  var isCourier=/\/courier\.html$/i.test(path);
  var isWaiter=/\/waiter\.html$/i.test(path);

  function removeWaiterLegacy(){
    if(!isWaiter) return;
    document.querySelectorAll('a[href="staff-history.html"],a[href*="staff-history.html"]').forEach(function(a){
      var text=(a.textContent||'').trim().toLowerCase();
      if(text.indexOf('открыть отдельно')!==-1 || text.indexOf('отдельно')!==-1) a.remove();
    });
  }

  function waiterReleasePatch(){
    if(!isWaiter || !window.db || typeof window.db.rpc!=='function' || window.__QR_WAITER_RELEASE_PATCH__) return;
    window.__QR_WAITER_RELEASE_PATCH__=true;
    var originalRpc=window.db.rpc.bind(window.db);
    window.db.rpc=function(name,args,options){
      if(name==='staff_release_table') name='waiter_release_table';
      return originalRpc(name,args,options);
    };
  }

  function courierTokenPatch(Vue){
    if(!isCourier || !Vue || typeof Vue.createApp!=='function' || Vue.__QR_COURIER_SHIFT_PATCHED__) return;
    Vue.__QR_COURIER_SHIFT_PATCHED__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      try{
        if(options && options.methods && typeof options.methods.login==='function'){
          var originalLogin=options.methods.login;
          options.methods.login=async function(){
            var result=await originalLogin.apply(this,arguments);
            try{
              var slug=(this.form&&this.form.slug||'').trim();
              var pin=(this.form&&this.form.pin||'').trim();
              if(slug && /^\d{4}$/.test(pin)){
                var r=await window.db.rpc('staff_login',{p_type:'courier',p_slug:slug,p_pin:pin});
                if(!r.error && r.data && r.data.token){
                  localStorage.setItem('staff_token',r.data.token);
                  localStorage.setItem('courier_token',r.data.token);
                  localStorage.setItem('courier_session',JSON.stringify(Object.assign({},JSON.parse(localStorage.getItem('courier_session')||'{}'),{token:r.data.token})));
                  window.dispatchEvent(new Event('qr-courier-token-ready'));
                } else if(r.error){
                  console.warn('[QR Courier] staff token bootstrap:',r.error);
                }
              }
            }catch(e){ console.warn('[QR Courier] token bootstrap failed:',e); }
            return result;
          };
        }
      }catch(e){ console.warn('[QR Courier] Vue patch failed:',e); }
      return original.apply(this,arguments);
    };
  }

  function observe(){
    removeWaiterLegacy();
    waiterReleasePatch();
    if(document.body){
      var mo=new MutationObserver(function(){removeWaiterLegacy();waiterReleasePatch();});
      mo.observe(document.body,{childList:true,subtree:true});
      setTimeout(function(){mo.disconnect();},30000);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observe); else observe();

  try{
    if(window.Vue) courierTokenPatch(window.Vue);
    else {
      var current=window.Vue;
      if(!current){
        var descriptor=Object.getOwnPropertyDescriptor(window,'Vue');
        if(!descriptor || descriptor.configurable!==false){
          var value;
          Object.defineProperty(window,'Vue',{
            configurable:true,
            enumerable:true,
            get:function(){return value;},
            set:function(v){value=v;courierTokenPatch(v);}
          });
        }
      }
    }
  }catch(e){ console.warn('[QR Staff UI] bootstrap failed:',e); }
})();
