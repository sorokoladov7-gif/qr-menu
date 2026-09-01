/* QR-Menu — тарифы, подписки, оплаты */
(function(){
  'use strict';
  if (window.__QR_MANAGER_BILLING__) return;
  window.__QR_MANAGER_BILLING__ = true;

  var billingMixin = {
    data: function() {
      return {
        plans: [],
        subscriptionEnd: null,
        payPlan: null,
        myPayments: []
      };
    },
    computed: {
      daysLeft: function() {
        return this.subscriptionEnd ? Math.ceil((new Date(this.subscriptionEnd) - new Date()) / 864e5) : 0;
      },
      currentPlan: function() {
        if (!this.venue) return null;
        var planId = this.venue.plan;
        return this.plans.find(function(p) { return p.id === planId; }) || null;
      },
      currentPlanName: function() {
        return this.currentPlan ? this.currentPlan.name : '-';
      },
      maxProducts: function() {
        var plan = this.currentPlan;
        if (!plan) return 0;
        var limit = Number(plan.max_products);
        return Number.isFinite(limit) && limit > 0 ? limit : 0;
      }
    },
    methods: {
      loadPayments: function() {
        var self = this;
        return db.from('payments').select('*').eq('manager_id', this.profile.id).order('created_at', { ascending: false }).then(function(r) {
          self.myPayments = r.data || [];
        }).catch(function(e) {
          console.error('Ошибка загрузки платежей:', e);
          self.myPayments = [];
        });
      },

      choosePlan: function(p) {
        if (p.price === 0) this.subscribeFree(p);
        else this.payPlan = p;
      },

      subscribeFree: function(p) {
        var self = this;
        self.busy = true;
        var e = new Date();
        e.setMonth(e.getMonth() + 1);
        db.from('venues').update({ plan: p.id, subscription_end: e.toISOString() }).eq('id', this.venue.id).then(function() {
          return db.from('subscriptions').update({ plan_id: p.id, status: 'active', current_period_end: e.toISOString() }).eq('venue_id', self.venue.id);
        }).then(function() {
          self.subscriptionEnd = e.toISOString();
          self.showToast('Тариф изменен');
        }).catch(function(err) {
          console.error('Ошибка изменения тарифа:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось изменить тариф'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      },

      markPaid: function() {
        var self = this;
        self.busy = true;
        db.from('payments').insert({
          venue_id: this.venue.id,
          manager_id: this.profile.id,
          plan_id: this.payPlan.id,
          amount: this.payPlan.price
        }).then(function(r) {
          if (r.error) throw r.error;
          self.payPlan = null;
          self.loadPayments();
          self.showToast('Заявка отправлена!');
        }).catch(function(err) {
          console.error('Ошибка отправки заявки:', err);
          self.showToast('Ошибка: ' + (err.message || 'не удалось отправить заявку'), 'error');
        }).finally(function() {
          self.busy = false;
        });
      },

      planPriceLabel: function(p) {
        return p.price === 0 ? '0' : this.fmt(p.price) + ' ₽';
      },
      planBtnLabel: function(p) {
        return (this.currentPlan && this.currentPlan.id === p.id) ? 'Текущий' : 'Выбрать';
      },
      planBtnClass: function(p) {
        return (this.currentPlan && this.currentPlan.id === p.id) ? 'btn-ghost' : 'btn-primary';
      },
      isCurrentPlan: function(p) {
        return this.currentPlan && this.currentPlan.id === p.id;
      },
      payBadge: function(s) {
        return s === 'confirmed' ? 'b-ready' : s === 'rejected' ? 'b-cancelled' : 'b-cooking';
      },
      payLabel: function(s) {
        return s === 'confirmed' ? 'Активна' : s === 'rejected' ? 'Отклонена' : 'На проверке';
      },
      copySbp: function() {
        this.copyText(window.SBP_PHONE || '89053204350');
      }
    }
  };

  window.__QR_MANAGER_BILLING_MIXIN__ = billingMixin;
})();
