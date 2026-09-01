/* QR-Menu — платежи и тарифы (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_PAYMENTS__) return;
  window.__QR_ADMIN_PAYMENTS__ = true;

  var paymentsMixin = {
    data: function() {
      return {
        payments: []
      };
    },
    computed: {
      pendingPayments: function() {
        return this.payments.filter(function(p) { return p.status === 'pending'; });
      }
    },
    methods: {
      confirmPayment: function(pay) {
        var self = this;
        var end = new Date();
        end.setMonth(end.getMonth() + 1);
        db.from('venues').update({ plan: pay.plan_id, subscription_end: end.toISOString(), status: 'active' }).eq('id', pay.venue_id).then(function() {
          return db.from('subscriptions').update({ plan_id: pay.plan_id, status: 'active', current_period_end: end.toISOString() }).eq('venue_id', pay.venue_id);
        }).then(function() {
          return db.from('payments').update({ status: 'confirmed' }).eq('id', pay.id);
        }).then(function() { self.loadBaseData(); });
      },

      rejectPayment: function(pay) {
        var self = this;
        db.from('payments').update({ status: 'rejected' }).eq('id', pay.id).then(function() { self.loadBaseData(); });
      },

      createPlan: function() {
        var self = this;
        db.from('plans').insert({ id: 'custom_' + Date.now(), name: 'Персональный тариф', price: 0, max_venues: 1, max_cooks: 5, max_couriers: 10, max_waiters: 10, max_products: 50 }).then(function() { self.loadBaseData(); });
      },

      delPlan: function(p) {
        var self = this;
        var used = self.venues.some(function(v) { return v.plan === p.id; });
        if (used) { alert('Тариф назначен заведениям — сначала переведите их на другой.'); return; }
        if (!confirm('Удалить тариф «' + p.name + '»?')) return;
        db.from('plans').delete().eq('id', p.id).then(function() { self.loadBaseData(); });
      },

      savePlan: function(p) {
        db.from('plans').update({
          name: p.name,
          price: Number(p.price) || 0,
          max_venues: +p.max_venues,
          max_cooks: +p.max_cooks,
          max_couriers: +p.max_couriers || 0,
          max_waiters: +p.max_waiters || 0,
          max_products: +p.max_products
        }).eq('id', p.id).then(function() {
          alert('Тариф «' + p.name + '» сохранён');
        });
      }
    }
  };

  window.__QR_ADMIN_PAYMENTS_MIXIN__ = paymentsMixin;
})();
