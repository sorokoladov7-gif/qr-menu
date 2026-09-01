/* QR-Menu — платежи и тарифы (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_PAYMENTS__) return;
  window.__QR_ADMIN_PAYMENTS__ = true;

  var paymentsMixin = {
    data: function() {
      return {
        payments: [],
        busy: false
      };
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

      confirmPayment: function(pay) {
        var self = this;
        var end = new Date();
        end.setMonth(end.getMonth() + 1);
        self.busy = true;
        db.from('venues').update({ plan: pay.plan_id, subscription_end: end.toISOString(), status: 'active' }).eq('id', pay.venue_id).then(function() {
          return db.from('subscriptions').update({ plan_id: pay.plan_id, status: 'active', current_period_end: end.toISOString() }).eq('venue_id', pay.venue_id);
        }).then(function() {
          return db.from('payments').update({ status: 'confirmed' }).eq('id', pay.id);
        }).then(function() { 
          self.showToast('Оплата подтверждена');
          if (typeof self.loadBaseData === 'function') self.loadBaseData(); 
        }).catch(function(err) {
          console.error('Ошибка подтверждения оплаты:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось подтвердить'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      },

      rejectPayment: function(pay) {
        var self = this;
        self.busy = true;
        db.from('payments').update({ status: 'rejected' }).eq('id', pay.id).then(function() { 
          self.showToast('Оплата отклонена');
          if (typeof self.loadBaseData === 'function') self.loadBaseData(); 
        }).catch(function(err) {
          console.error('Ошибка отклонения оплаты:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось отклонить'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      },

      createPlan: function() {
        var self = this;
        self.busy = true;
        db.from('plans').insert({ id: 'custom_' + Date.now(), name: 'Персональный тариф', price: 0, max_venues: 1, max_cooks: 5, max_couriers: 10, max_waiters: 10, max_products: 50 }).then(function() { 
          self.showToast('Тариф создан');
          if (typeof self.loadBaseData === 'function') self.loadBaseData(); 
        }).catch(function(err) {
          console.error('Ошибка создания тарифа:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось создать'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      },

      delPlan: function(p) {
        var self = this;
        var used = self.venues.some(function(v) { return v.plan === p.id; });
        if (used) { self.showToast('Тариф назначен заведениям — сначала переведите их на другой.', 'error'); return; }
        if (!confirm('Удалить тариф «' + p.name + '»?')) return;
        self.busy = true;
        db.from('plans').delete().eq('id', p.id).then(function() { 
          self.showToast('Тариф удален');
          if (typeof self.loadBaseData === 'function') self.loadBaseData(); 
        }).catch(function(err) {
          console.error('Ошибка удаления тарифа:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось удалить'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      },

      savePlan: function(p) {
        var self = this;
        self.busy = true;
        db.from('plans').update({
          name: p.name,
          price: Number(p.price) || 0,
          max_venues: +p.max_venues,
          max_cooks: +p.max_cooks,
          max_couriers: +p.max_couriers || 0,
          max_waiters: +p.max_waiters || 0,
          max_products: +p.max_products
        }).eq('id', p.id).then(function() {
          self.showToast('Тариф «' + p.name + '» сохранён');
        }).catch(function(err) {
          console.error('Ошибка сохранения тарифа:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      }
    }
  };

  window.__QR_ADMIN_PAYMENTS_MIXIN__ = paymentsMixin;
})();
