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
          var r = await db.rpc('admin_confirm_manual_payment', { p_payment_id: pay.id });
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
      },

      createPlan: function() {
        var self = this;
        self.busy = true;
        db.from('plans').insert({ id: 'custom_' + Date.now(), name: 'Персональный тариф', price: 0, max_venues: 1, max_cooks: 5, max_couriers: 10, max_waiters: 10, max_products: 50 }).then(function(r) {
          if (r.error) throw r.error;
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
        db.from('plans').delete().eq('id', p.id).then(function(r) {
          if (r.error) throw r.error;
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
        }).eq('id', p.id).then(function(r) {
          if (r.error) throw r.error;
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

  /* Final billing authority: override legacy manager-plan methods before admin Vue app creation. */
  if (window.Vue && typeof Vue.createApp === 'function' && !window.__QR_ADMIN_SAAS_BILLING_PATCH__) {
    window.__QR_ADMIN_SAAS_BILLING_PATCH__ = true;
    var originalCreateApp = Vue.createApp;
    Vue.createApp = function(options) {
      if (options && typeof options === 'object') {
        options.methods = options.methods || {};
        options.methods.changeManagerPlan = async function(m, plan) {
          var self = this;
          var managerId = m && m.id;
          var planId = String(plan || '').trim();
          if (!managerId || !planId) { self.msg = 'Не выбран управляющий или тариф'; return; }
          self.busy = true;
          try {
            var r = await db.rpc('admin_set_manager_plan', { p_manager_id: managerId, p_plan_id: planId });
            if (r.error) throw r.error;
            await self.loadBaseData();
            self.msg = 'Тариф назначен управляющему';
          } catch (e) {
            self.msg = 'Ошибка сохранения тарифа: ' + (e.message || e);
          } finally {
            self.busy = false;
          }
        };

        options.methods.extendManagerSub = async function(m, days) {
          var self = this;
          var managerId = m && m.id;
          days = Number(days) || 30;
          if (!managerId) { self.msg = 'Не найден управляющий'; return; }
          self.busy = true;
          try {
            var r = await db.rpc('admin_extend_manager_subscription', { p_manager_id: managerId, p_days: days });
            if (r.error) throw r.error;
            await self.loadBaseData();
            self.msg = 'Подписка продлена на ' + days + ' дней';
          } catch (e) {
            self.msg = 'Ошибка продления: ' + (e.message || e);
          } finally {
            self.busy = false;
          }
        };

        options.methods.changePlan = async function(v, plan) {
          var mid = null;
          var r = await db.from('manager_venues').select('manager_id').eq('venue_id', v.id).limit(1).maybeSingle();
          if (!r.error && r.data) mid = r.data.manager_id;
          if (!mid) { this.msg = 'Не найден управляющий'; return; }
          return this.changeManagerPlan({ id: mid }, plan);
        };

        options.methods.extendSub = async function(v) {
          var r = await db.from('manager_venues').select('manager_id').eq('venue_id', v.id).limit(1).maybeSingle();
          if (r.error || !r.data) { this.msg = 'Не найден управляющий'; return; }
          return this.extendManagerSub({ id: r.data.manager_id }, 30);
        };
      }
      return originalCreateApp.apply(this, arguments);
    };
  }
})();
