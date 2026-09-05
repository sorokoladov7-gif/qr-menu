/* QR-Menu — платежи и тарифы (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_PAYMENTS__) return;
  window.__QR_ADMIN_PAYMENTS__ = true;

  var paymentsMixin = {
    data: function() {
      return { payments: [], busy: false };
    },
    computed: {
      pendingPayments: function() {
        return this.payments.filter(function(p) { return p.status === 'pending'; });
      }
    },
    methods: {
      showToast: function(text, type) {
        if (typeof this.toast !== 'undefined') {
          this.toast = { text: text, type: type || 'ok' };
          var self = this;
          clearTimeout(this._t);
          this._t = setTimeout(function() { self.toast = null; }, 2500);
        } else {
          alert((type === 'error' ? 'Ошибка: ' : '') + text);
        }
      },

      confirmPayment: async function(pay) {
        var self = this;
        if (!pay || !pay.id) return;
        self.busy = true;
        try {
          var r = await db.rpc('admin_confirm_manager_payment', { p_payment_id: pay.id });
          if (r.error) throw r.error;
          self.showToast('Оплата подтверждена, тариф активирован');
          if (typeof self.loadBaseData === 'function') await self.loadBaseData();
        } catch (err) {
          console.error('Ошибка подтверждения оплаты:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось подтвердить'), 'error');
        } finally {
          self.busy = false;
        }
      },

      rejectPayment: function(pay) {
        var self = this;
        self.busy = true;
        db.from('payments').update({ status: 'rejected' }).eq('id', pay.id).then(function(r) {
          if (r.error) throw r.error;
          self.showToast('Оплата отклонена');
          if (typeof self.loadBaseData === 'function') self.loadBaseData();
        }).catch(function(err) {
          console.error('Ошибка отклонения оплаты:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось отклонить'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      }
    }
  };

  window.__QR_ADMIN_PAYMENTS_MIXIN__ = paymentsMixin;
})();
