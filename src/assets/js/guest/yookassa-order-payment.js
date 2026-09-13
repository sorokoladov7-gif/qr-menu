(function(){
  'use strict';
  if(window.__QR_YOOKASSA_ORDER_PAYMENT__)return;
  window.__QR_YOOKASSA_ORDER_PAYMENT__=true;

  function showMessage(text,isError){
    var root=document.getElementById('app');
    var vm=root&&root.__vue_app__&&root.__vue_app__._instance?root.__vue_app__._instance.proxy:null;
    if(vm){vm.msg=text;vm.msgType=isError?'error':'ok';return;}
    var el=document.querySelector('[data-qr-payment-status]');
    if(!el){el=document.createElement('div');el.setAttribute('data-qr-payment-status','1');el.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;padding:14px 16px;border-radius:12px;background:#111827;color:#fff;font:600 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.25)';document.body.appendChild(el);}
    el.textContent=text;
  }

  async function pollPayment(orderId){
    var key='qr-menu-payment-poll:'+orderId;
    if(sessionStorage.getItem(key)==='done')return;
    sessionStorage.setItem(key,'active');
    showMessage('Проверяем статус оплаты заказа…',false);
    for(var i=0;i<30;i++){
      try{
        var response=await fetch('/api/payments/yookassa/status-order?order_id='+encodeURIComponent(orderId),{cache:'no-store'});
        var data=await response.json().catch(function(){return{};});
        if(response.ok&&data.ok){
          if(data.paid||data.payment_status==='paid'){
            sessionStorage.setItem(key,'done');
            sessionStorage.removeItem('qr-menu-payment-order');
            showMessage('Оплата заказа подтверждена. Спасибо!',false);
            return;
          }
          if(['cancelled','failed','refunded'].indexOf(data.payment_status)!==-1){
            sessionStorage.removeItem(key);
            showMessage('Оплата не завершена: '+data.payment_status,false);
            return;
          }
        }
      }catch(e){console.warn('[QR YooKassa] status poll:',e);}
      await new Promise(function(resolve){setTimeout(resolve,3000);});
    }
    sessionStorage.removeItem(key);
    showMessage('Платёж ещё обрабатывается. Статус заказа обновится автоматически.',false);
  }

  async function createPaymentFromOrderRpc(){
    if(!window.db||typeof window.db.rpc!=='function')return;
    var originalRpc=window.db.rpc.bind(window.db);
    window.db.rpc=function(name,args,options){
      var promise=originalRpc(name,args,options);
      if(name!=='create_public_order'||!args||args.p_payment_method!=='sbp')return promise;
      return Promise.resolve(promise).then(async function(result){
        if(result&&result.error)throw result.error;
        var order=result&&result.data;
        if(order&&order.order)order=order.order;
        if(Array.isArray(order))order=order[0];
        if(!order||!order.id)return result;
        sessionStorage.setItem('qr-menu-payment-order',String(order.id));
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
          showMessage('Заказ создан, но оплату по СБП не удалось запустить: '+(e.message||'ошибка'),true);
        }
        return result;
      });
    };
  }

  function handleReturn(){
    var params=new URLSearchParams(location.search);
    if(params.get('payment')!=='order')return;
    var orderId=params.get('order_id')||sessionStorage.getItem('qr-menu-payment-order');
    if(!orderId)return;
    sessionStorage.setItem('qr-menu-payment-order',orderId);
    params.delete('payment');params.delete('order_id');
    var clean=location.pathname+(params.toString()?'?'+params.toString():'')+location.hash;
    try{history.replaceState({},document.title,clean);}catch(_){ }
    pollPayment(orderId);
  }

  function boot(){
    if(!/[?&]demo=1(?:&|$)/i.test(location.search))createPaymentFromOrderRpc();
    handleReturn();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
