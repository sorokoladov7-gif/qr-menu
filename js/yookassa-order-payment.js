/* QR Menu — guest SBP order payment.
   Wires the customer "pay by SBP" path to the current YooKassa/SBP backend:
   - After create_public_order succeeds with payment_method 'sbp', call
     POST /api/payments/yookassa/create-order (server resolves the venue or
     shared payment account and returns a confirmation_url) and redirect there.
   - When YooKassa redirects back to menu.html?payment=order&order_id=…,
     poll POST /api/payments/yookassa/status-order until the payment reaches a
     terminal state and surface the result to the guest.
   The module is intentionally independent of the Vue app; it only augments
   window.db.rpc and shows a status banner. */
(function(){
  'use strict';
  if(window.__QR_YOOKASSA_ORDER_PAYMENT__) return;
  window.__QR_YOOKASSA_ORDER_PAYMENT__=true;

  var IS_DEMO = /[?&]demo=1(?:&|$)/i.test(location.search);
  var ERRORS = {
    venue_payment_not_configured: 'Оплата по СБП пока не подключена в этом заведении.',
    order_already_paid: 'Этот заказ уже оплачен.',
    order_payment_method_not_sbp: 'Для этого заказа оплата по СБП не требуется.',
    invalid_order_amount: 'Некорректная сумма заказа.',
    confirmation_url_missing: 'ЮKassa не вернула ссылку для оплаты.'
  };
  function errText(code, fallback){ return ERRORS[code] || fallback; }

  // ---- status banner (self-contained, no Vue coupling) ----
  function showBanner(text, kind){
    var el = document.getElementById('qr-sbp-banner');
    if(!el){
      el = document.createElement('div');
      el.id = 'qr-sbp-banner';
      el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;max-width:min(560px,92vw);padding:14px 18px;border-radius:14px;color:#fff;font-weight:700;line-height:1.35;box-shadow:0 10px 30px rgba(0,0,0,.45);font-family:inherit;text-align:center;cursor:pointer;';
      (document.body||document.documentElement).appendChild(el);
      el.addEventListener('click', function(){ el.remove(); });
    }
    var bg = {info:'#4f46e5', success:'#047857', error:'#9f1239'}[kind] || '#334155';
    el.style.background = bg;
    el.textContent = text;
    el.style.display = 'block';
  }

  // ---- 1) trigger SBP payment after the order is created (fallback only) ----
  // The primary guest SBP trigger lives in demo-mode.js ("Production customer SBP
  // bridge", window.__qrCustomerSbpPaymentPatched). We only install our own trigger
  // if that bridge is absent, so we never double-call create-order / double-redirect.
  if(!IS_DEMO && !window.__qrCustomerSbpPaymentPatched && window.db && typeof window.db.rpc === 'function'){
    var originalRpc = window.db.rpc.bind(window.db);
    window.db.rpc = function(name, args, options){
      var promise = originalRpc(name, args, options);
      if(name !== 'create_public_order' || !args || String(args.p_payment_method).toLowerCase() !== 'sbp') return promise;
      return Promise.resolve(promise).then(async function(result){
        // Let checkout's own .then/.catch handle creation failures.
        if(result && result.error) return result;
        var order = result && result.data;
        if(order && order.order) order = order.order;
        if(Array.isArray(order)) order = order[0];
        if(!order || !order.id){ console.warn('[QR SBP] order id missing; payment redirect skipped'); return result; }
        try{
          var res = await fetch('/api/payments/yookassa/create-order', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ order_id: order.id })
          });
          var data = await res.json().catch(function(){ return {}; });
          if(res.ok && data && data.ok && data.confirmation_url){
            showBanner('Перенаправляем на оплату по СБП…', 'info');
            setTimeout(function(){ window.location.href = data.confirmation_url; }, 400);
          } else {
            var code = data && data.error;
            console.error('[QR SBP] create-order failed:', code, data);
            showBanner(errText(code, 'Не удалось запустить оплату по СБП.') + ' Заказ создан — оплатите его у официанта.', 'error');
          }
        }catch(e){
          console.error('[QR SBP] create-order error:', e);
          showBanner('Не удалось запустить оплату по СБП. Заказ создан — оплатите его у официанта.', 'error');
        }
        return result;
      });
    };
  }

  // ---- 2) handle the return trip and poll payment status ----
  function clearStoredOrderId(){ try{ sessionStorage.removeItem('qr_sbp_order_id'); }catch(e){} }
  function pollStatus(orderId){
    var deadline = Date.now() + 40000;   // stop after 40s regardless
    var timer = null;
    function stop(){ if(timer){ clearInterval(timer); timer = null; } }
    function tick(){
      fetch('/api/payments/yookassa/status-order', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ order_id: orderId })
      }).then(function(r){ return r.json().catch(function(){ return {}; }); })
        .then(function(d){
          var st = d && d.payment_status;
          if(d && d.ok && (st === 'paid' || st === 'succeeded')){ showBanner('Оплата по СБП прошла успешно. Заказ подтверждён.', 'success'); clearStoredOrderId(); stop(); return; }
          if(st === 'cancelled' || st === 'canceled' || st === 'failed' || st === 'rejected'){ showBanner('Оплата не завершена. Заказ создан — можно оплатить у официанта.', 'error'); clearStoredOrderId(); stop(); return; }
          if(Date.now() > deadline){ showBanner('Оплата обрабатывается. Статус обновится автоматически.', 'info'); stop(); return; }
          showBanner('Проверяем статус оплаты по СБП…', 'info');
        })
        .catch(function(){
          if(Date.now() > deadline){ showBanner('Не удалось проверить статус оплаты. Обновите страницу.', 'error'); stop(); }
        });
    }
    tick();
    timer = setInterval(tick, 3000);
  }

  // Only treat this as a "returned from payment" moment when ?payment=order is present.
  function returnOrderId(){
    try{
      var q = new URLSearchParams(location.search);
      if(q.get('payment') === 'order'){
        var id = (q.get('order_id') || '').trim();
        if(!id){ try{ id = (sessionStorage.getItem('qr_sbp_order_id') || '').trim(); }catch(e){} }
        return id || null;
      }
    }catch(e){}
    return null;
  }

  var ret = returnOrderId();
  if(ret && !IS_DEMO){
    // Clean the payment params so a refresh doesn't re-poll the same view.
    try{
      var u = new URL(location.href);
      u.searchParams.delete('payment'); u.searchParams.delete('order_id');
      history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
    }catch(e){}
    function ready(fn){ if(document.body) fn(); else setTimeout(function(){ ready(fn); }, 50); }
    ready(function(){ pollStatus(ret); });
  }
})();
