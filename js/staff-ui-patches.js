(function(){
  'use strict';
  var path=location.pathname.toLowerCase();
  var isCourier=/\/courier\.html$/i.test(path);
  var isWaiter=/\/waiter\.html$/i.test(path);
  var isCook=/\/cook\.html$/i.test(path);
  var role=isCourier?'courier':(isWaiter?'waiter':(isCook?'cook':null));

  function tokenKey(){return role?role+'_token':'staff_token';}
  function sessionKey(){return role?role+'_session':'staff_session';}
  function syncRoleToken(){
    if(!role || !window.StaffAuth || typeof window.StaffAuth.login!=='function') return;
    try{
      var t=sessionStorage.getItem(tokenKey());
      if(!t)return;
      var raw=sessionStorage.getItem(sessionKey());
      var sess={token:t};
      try{sess=Object.assign(sess,JSON.parse(raw||'{}'));}catch(e){}
      sess.token=t;
      window.StaffAuth.login(role,sess);
    }catch(e){console.warn('[QR Staff UI] role token sync failed:',e);}
  }

  function removeWaiterLegacy(){
    if(!isWaiter)return;
    document.querySelectorAll('a[href="staff-history.html"],a[href*="staff-history.html"]').forEach(function(a){
      var text=(a.textContent||'').trim().toLowerCase();
      if(text.indexOf('открыть отдельно')!==-1||text.indexOf('отдельно')!==-1)a.remove();
    });
  }

  function waiterReleasePatch(){
    if(!isWaiter||!window.db||typeof window.db.rpc!=='function'||window.__QR_WAITER_RELEASE_PATCH__)return;
    window.__QR_WAITER_RELEASE_PATCH__=true;
    var originalRpc=window.db.rpc.bind(window.db);
    window.db.rpc=function(name,args,options){
      if(name==='staff_release_table')name='waiter_release_table';
      return originalRpc(name,args,options);
    };
  }

  function waiterLoginIntercept(){
    if(!isWaiter||window.__QR_WAITER_LOGIN_PATCH__)return;
    window.__QR_WAITER_LOGIN_PATCH__=true;
    document.addEventListener('click',function(e){
      var el=e.target && e.target.closest ? e.target.closest('#go') : null;
      if(!el)return;
      var slug=document.getElementById('slug');
      var pin=document.getElementById('pin');
      if(!slug||!pin)return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      el.disabled=true;
      el.textContent='Проверяем...';
      var err=document.querySelector('#app .err, #app [style*="f87171"]');
      var s=String(slug.value||'').trim().toLowerCase();
      var p=String(pin.value||'').replace(/\s+/g,'').trim();
      if(!s){if(err)err.textContent='Введите код заведения';el.disabled=false;el.textContent='Войти';return;}
      if(!/^\d{4}$/.test(p)){if(err)err.textContent='PIN должен состоять из 4 цифр';el.disabled=false;el.textContent='Войти';return;}
      window.db.rpc('staff_login',{p_type:'waiter',p_slug:s,p_pin:p}).then(function(r){
        if(r.error||!r.data||r.data.error){
          var m=(r.error&&r.error.message)||(r.data&&r.data.error)||'Не удалось войти';
          m=String(m);
          if(m.indexOf('slug_or_pin_required')!==-1)m='Не передан код заведения или PIN';
          else if(m.indexOf('wrong_pin')!==-1)m='Неверный PIN';
          else if(m.indexOf('venue_not_found')!==-1)m='Заведение не найдено или неактивно';
          if(err)err.textContent=m;
          el.disabled=false;el.textContent='Войти';
          return;
        }
        sessionStorage.setItem('waiter_token',r.data.token);
        sessionStorage.setItem('waiter_session',JSON.stringify({token:r.data.token,venueId:r.data.venueId,venueName:r.data.venueName,staffName:r.data.staffName}));
        sessionStorage.setItem('waiter_tab','overview');
        syncRoleToken();
        location.reload();
      }).catch(function(x){
        if(err)err.textContent=(x&&x.message)||'Ошибка входа';
        el.disabled=false;el.textContent='Войти';
      });
    },true);
  }

  function courierTokenPatch(Vue){
    if(!isCourier||!Vue||typeof Vue.createApp!=='function'||Vue.__QR_COURIER_SHIFT_PATCHED__)return;
    Vue.__QR_COURIER_SHIFT_PATCHED__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      try{
        if(options&&options.methods&&typeof options.methods.login==='function'){
          options.methods.login=(function(originalLogin){return async function(){
            var result=await originalLogin.apply(this,arguments);
            try{
              var slug=(this.form&&this.form.slug||'').trim().toLowerCase();
              var pin=(this.form&&this.form.pin||'').trim();
              if(slug&&/^\d{4}$/.test(pin)){
                var r=await window.db.rpc('staff_login',{p_type:'courier',p_slug:slug,p_pin:pin});
                if(!r.error&&r.data&&r.data.token){
                  sessionStorage.setItem('courier_token',r.data.token);
                  sessionStorage.setItem('courier_session',JSON.stringify(Object.assign({},JSON.parse(sessionStorage.getItem('courier_session')||'{}'),{token:r.data.token})));
                  syncRoleToken();
                }
              }
            }catch(e){console.warn('[QR Courier] token bootstrap failed:',e);}
            return result;
          };})(options.methods.login);
        }
      }catch(e){console.warn('[QR Courier] Vue patch failed:',e);}
      return original.apply(this,arguments);
    };
  }

  function observe(){
    syncRoleToken();
    removeWaiterLegacy();
    waiterReleasePatch();
    waiterLoginIntercept();
    if(document.body){
      var mo=new MutationObserver(function(){syncRoleToken();removeWaiterLegacy();waiterReleasePatch();});
      mo.observe(document.body,{childList:true,subtree:true});
      setTimeout(function(){mo.disconnect();},30000);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
  try{
    if(window.Vue)courierTokenPatch(window.Vue);
    else{
      var descriptor=Object.getOwnPropertyDescriptor(window,'Vue');
      if(!descriptor||descriptor.configurable!==false){
        var value;
        Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;courierTokenPatch(v);}});
      }
    }
  }catch(e){console.warn('[QR Staff UI] bootstrap failed:',e);}
})();
