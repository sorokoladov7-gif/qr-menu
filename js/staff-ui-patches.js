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

  /* ------------------------------------------------------------
     Order edit/cancel controls for waiter + cook.
     Uses the staff-token RPCs so RLS is not bypassed in the browser.
  ------------------------------------------------------------ */
  (function(){
    if(!isWaiter&&!isCook)return;
    if(window.__QR_STAFF_ORDER_ACTIONS__)return;
    window.__QR_STAFF_ORDER_ACTIONS__=true;

    var cache={orders:[],products:[],loadedAt:0,productsLoadedAt:0};
    var busy=false;
    var cssId='qr-order-actions-style';

    function getToken(){return sessionStorage.getItem(tokenKey())||sessionStorage.getItem('staff_token')||'';}
    function getSession(){try{return JSON.parse(sessionStorage.getItem(sessionKey())||'{}')}catch(e){return {};}}
    function db(){return window.db;}
    function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function money(n){return Number(n||0).toLocaleString('ru-RU');}
    function parseItems(o){if(Array.isArray(o&&o.items))return o.items;if(typeof(o&&o.items)==='string')try{return JSON.parse(o.items)}catch(e){}return [];}
    function status(o){return o&&o.status||'';}
    function canAct(o){return o&&['new','changed','cooking'].indexOf(o.status)!==-1;}

    function ensureStyle(){
      if(document.getElementById(cssId))return;
      var s=document.createElement('style');s.id=cssId;
      s.textContent=''+
      '.qr-order-action-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}'+
      '.qr-order-action-bar button{border:0;border-radius:10px;padding:10px 13px;color:#fff;font-weight:800;cursor:pointer}'+
      '.qr-order-edit{background:#4f46e5}.qr-order-cancel{background:#991b1b}'+
      '.qr-order-editor{position:fixed;inset:0;z-index:100002;background:rgba(2,6,23,.86);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:14px}'+
      '.qr-order-editor-box{width:min(760px,100%);max-height:94vh;overflow:auto;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.5)}'+
      '.qr-order-editor-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}'+
      '.qr-order-product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}'+
      '.qr-order-product{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px;background:rgba(255,255,255,.035)}'+
      '.qr-order-product b{display:block;margin-bottom:5px}.qr-order-product small{color:#94a3b8}'+
      '.qr-order-qty{display:flex;align-items:center;gap:7px;margin-top:8px}.qr-order-qty button{width:32px;height:32px;border:0;border-radius:8px;background:rgba(255,255,255,.1);color:#fff;font-weight:900;cursor:pointer}.qr-order-qty span{min-width:24px;text-align:center;font-weight:900}'+
      '.qr-order-cart{margin:14px 0;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08);padding:10px 0}'+
      '.qr-order-cart-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0}.qr-order-muted{color:#94a3b8;font-size:12px}'+
      '.qr-order-comment{width:100%;min-height:70px;resize:vertical;background:#0b1220;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;margin-top:10px}'+
      '.qr-order-editor-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.qr-order-editor-actions button{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}.qr-order-save{background:#047857;color:#fff}.qr-order-close{background:rgba(255,255,255,.1);color:#fff}';
      document.head.appendChild(s);
    }

    async function loadOrders(force){
      var t=getToken();if(!t)return [];
      if(!force&&cache.orders.length&&Date.now()-cache.loadedAt<1200)return cache.orders;
      var r=await db().rpc('staff_orders_json',{p_token:t});
      if(r.error)throw r.error;
      cache.orders=Array.isArray(r.data)?r.data:[];cache.loadedAt=Date.now();
      return cache.orders;
    }

    async function loadProducts(){
      var sess=getSession();
      if(cache.products.length&&Date.now()-cache.productsLoadedAt<10000)return cache.products;
      if(!sess.venueId)throw new Error('Не найдено заведение сотрудника');
      var r=await db().from('products').select('id,name,price,category,is_available').eq('venue_id',sess.venueId).eq('is_available',true).neq('category','addon');
      if(r.error)throw r.error;
      cache.products=r.data||[];cache.productsLoadedAt=Date.now();return cache.products;
    }

    function findOrderByNumber(n){
      return cache.orders.find(function(o){return String(o.order_number)===String(n);});
    }

    function findOrderNumberInModal(modal){
      var h=modal.querySelector('h2,h3');
      var text=h?h.textContent:modal.textContent;
      var m=String(text||'').match(/Заказ\s*№\s*([0-9]+)/i);
      return m?m[1]:null;
    }

    function addActionsToModal(modal){
      if(!modal||modal.dataset.qrOrderActions==='1')return;
      var n=findOrderNumberInModal(modal);if(!n)return;
      var o=findOrderByNumber(n);if(!o)return;
      modal.dataset.qrOrderActions='1';
      if(!canAct(o))return;
      ensureStyle();
      var host=modal.querySelector('.sheet');if(!host)return;
      var bar=document.createElement('div');bar.className='qr-order-action-bar';
      var edit=document.createElement('button');edit.className='qr-order-edit';edit.textContent='✏️ Изменить заказ';
      var cancel=document.createElement('button');cancel.className='qr-order-cancel';cancel.textContent='✕ Отменить заказ';
      edit.onclick=function(e){e.stopPropagation();openEditor(o);};
      cancel.onclick=function(e){e.stopPropagation();cancelOrder(o);};
      bar.appendChild(edit);bar.appendChild(cancel);host.appendChild(bar);
    }

    async function cancelOrder(o){
      if(!canAct(o))return alert('Этот заказ уже нельзя отменить.');
      var reason=prompt('Причина отмены заказа (необязательно):','');
      if(reason===null)return;
      var t=getToken();if(!t)return alert('Сессия сотрудника не найдена.');
      var r=await db().rpc('staff_cancel_order',{p_token:t,p_order_id:o.id,p_reason:String(reason||'').trim()});
      if(r.error||r.data&&r.data.error){alert('Не удалось отменить заказ: '+((r.error&&r.error.message)||(r.data&&r.data.error)||'Ошибка'));return;}
      closeEditor();await reloadPageData();
    }

    function closeEditor(){var e=document.getElementById('qr-order-editor');if(e)e.remove();}

    async function openEditor(o){
      if(!canAct(o))return alert('Этот заказ уже нельзя изменить.');
      try{
        ensureStyle();
        var products=await loadProducts();
        var items=parseItems(o);
        var cart={};
        items.forEach(function(it){if(it.product_id)cart[it.product_id]=Number(it.qty||it.quantity||1);});
        var modal=document.getElementById('qr-order-editor');if(modal)modal.remove();
        modal=document.createElement('div');modal.id='qr-order-editor';modal.className='qr-order-editor';
        var box=document.createElement('div');box.className='qr-order-editor-box';
        box.innerHTML='<div class="qr-order-editor-head"><h2 style="margin:0">✏️ Изменить заказ №'+esc(o.order_number)+'</h2><button class="qr-order-editor-close qr-order-close" style="border:0;border-radius:10px;padding:8px 11px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer">✕</button></div><div class="qr-order-muted">Изменения сохранятся в текущий заказ. Для официанта заказ снова попадёт в кухню как «Изменён».</div><div class="qr-order-cart" id="qr-order-cart"></div><div class="qr-order-product-grid" id="qr-order-products"></div><textarea class="qr-order-comment" id="qr-order-comment" placeholder="Комментарий к заказу"></textarea><div class="qr-order-editor-actions"><button class="qr-order-close" id="qr-order-cancel-edit">Закрыть</button><button class="qr-order-save" id="qr-order-save">Сохранить изменения</button></div>';
        box.querySelectorAll('.qr-order-close').forEach(function(b){b.onclick=closeEditor;});
        modal.appendChild(box);document.body.appendChild(modal);
        var comment=box.querySelector('#qr-order-comment');comment.value=o.comment||'';
        var grid=box.querySelector('#qr-order-products');
        products.forEach(function(p){
          var card=document.createElement('div');card.className='qr-order-product';
          card.innerHTML='<b>'+esc(p.name)+'</b><small>'+money(p.price)+' ₽</small><div class="qr-order-qty"><button type="button" data-minus>−</button><span data-q>0</span><button type="button" data-plus>+</button></div>';
          var q=card.querySelector('[data-q]');function redraw(){q.textContent=String(cart[p.id]||0);}redraw();
          card.querySelector('[data-minus]').onclick=function(){var v=Math.max(0,(cart[p.id]||0)-1);if(v)cart[p.id]=v;else delete cart[p.id];redraw();drawCart();};
          card.querySelector('[data-plus]').onclick=function(){cart[p.id]=Math.min(99,(cart[p.id]||0)+1);redraw();drawCart();};
          grid.appendChild(card);
        });
        function drawCart(){
          var c=box.querySelector('#qr-order-cart');var entries=Object.keys(cart);
          if(!entries.length){c.innerHTML='<div class="qr-order-muted">Корзина пуста. Добавьте хотя бы один товар.</div>';return;}
          var total=0;c.innerHTML=entries.map(function(id){var p=products.find(function(x){return x.id===id;});var q=cart[id];var sum=Number(p?p.price:0)*q;total+=sum;return '<div class="qr-order-cart-row"><span>'+esc(p?p.name:'Товар')+' × '+q+'</span><b>'+money(sum)+' ₽</b></div>';}).join('')+'<div class="qr-order-cart-row"><b>Новая сумма товаров</b><b>'+money(total)+' ₽</b></div>';
        }
        drawCart();
        modal.onclick=function(e){if(e.target===modal)closeEditor();};
        box.querySelector('#qr-order-save').onclick=async function(){
          var items=Object.keys(cart).map(function(id){return {product_id:id,qty:cart[id]};});
          if(!items.length){alert('Заказ не может быть пустым.');return;}
          var b=this;b.disabled=true;b.textContent='Сохраняем...';
          try{
            var r=await db().rpc('staff_edit_order',{p_token:getToken(),p_order_id:o.id,p_items:items,p_comment:comment.value});
            if(r.error||r.data&&r.data.error)throw new Error((r.error&&r.error.message)||(r.data&&r.data.error)||'Не удалось изменить заказ');
            closeEditor();await reloadPageData();
          }catch(e){alert(e.message||'Ошибка изменения заказа');b.disabled=false;b.textContent='Сохранить изменения';}
        };
      }catch(e){alert(e.message||'Не удалось открыть редактор заказа');}
    }

    async function reloadPageData(){
      cache.loadedAt=0;
      try{await loadOrders(true);}catch(e){}
      if(isWaiter){
        if(typeof window.load==='function')try{await window.load();return;}catch(e){}
      }
      if(isCook){
        /* Vue app is not globally exposed; a reload guarantees all computed columns refresh. */
        location.reload();
      }
    }

    function scan(){
      if(!getToken())return;
      document.querySelectorAll('.modal,.detail-modal,.order-detail-modal').forEach(addActionsToModal);
    }

    async function start(){
      var tries=0;
      while(!getToken()&&tries++<120)await new Promise(function(r){setTimeout(r,250);});
      if(!getToken())return;
      try{await loadOrders(true);}catch(e){console.warn('[QR Order Actions] orders load failed',e);}
      ensureStyle();scan();
      var mo=new MutationObserver(function(){scan();});
      if(document.body)mo.observe(document.body,{childList:true,subtree:true});
      setInterval(function(){if(getToken())loadOrders(true).then(scan).catch(function(){});},3000);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  })();
})();
