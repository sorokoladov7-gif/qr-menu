(function(){
  'use strict';
  if(window.__QR_YOOKASSA_ORDER_PAYMENT__)return;
  window.__QR_YOOKASSA_ORDER_PAYMENT__=true;

  // This module is intentionally limited to the SBP flow.
  // menu.html creates the order with p_payment_method='sbp',
  // and /api/payments/yookassa/create-order expects the same value.
  if(window.db&&typeof window.db.rpc==='function'&&!/[?&]demo=1(?:&|$)/i.test(location.search)){
    var originalRpc=window.db.rpc.bind(window.db);
    window.db.rpc=function(name,args,options){
      var promise=originalRpc(name,args,options);
      if(name!=='create_public_order'||!args||args.p_payment_method!=='sbp')return promise;

      return Promise.resolve(promise).then(async function(result){
        if(result&&result.error)throw result.error;
        var order=result&&result.data;
        if(order&&order.order)order=order.order;
        if(Array.isArray(order))order=order[0];
        if(!order||!order.id){
          console.warn('[QR YooKassa] order id missing; payment redirect skipped');
          return result;
        }

        try{
          var response=await fetch('/api/payments/yookassa/create-order',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({order_id:order.id})
          });
          var data=await response.json();
          if(!response.ok||!data.ok)throw new Error(data.error||'Не удалось создать оплату');
          if(!data.confirmation_url)throw new Error('ЮKassa не вернула ссылку на оплату');
          window.location.href=data.confirmation_url;
        }catch(e){
          console.error('[QR YooKassa] order payment:',e);
          var root=document.getElementById('app');
          var vm=root&&root.__vue_app__&&root.__vue_app__._instance?root.__vue_app__._instance.proxy:null;
          if(vm)vm.msg='Заказ создан, но оплату по СБП не удалось запустить: '+(e.message||'ошибка');
          else alert('Заказ создан, но оплату по СБП не удалось запустить.');
        }
        return result;
      });
    };
  }
})();
