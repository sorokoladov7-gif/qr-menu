/* QR-Menu — тарифы, подписки, оплаты */
(function(){
  'use strict';
  if (window.__QR_MANAGER_BILLING__) return;
  window.__QR_MANAGER_BILLING__ = true;

  var billingMixin = {
    data: function() {
      return {
        plans: [],
        managerSubscription: null,
        subscriptionEnd: null,
        payPlan: null,
        myPayments: []
      };
    },
    computed: {
      daysLeft: function() {
        var end = this.managerSubscription && this.managerSubscription.current_period_end ? this.managerSubscription.current_period_end : this.subscriptionEnd;
        return end ? Math.max(0, Math.ceil((new Date(end) - new Date()) / 864e5)) : 0;
      },
      currentPlan: function() {
        var managerPlanId = this.managerSubscription && this.managerSubscription.plan_id;
        if (managerPlanId) {
          var managerPlan = this.plans.find(function(p) { return p.id === managerPlanId; });
          if (managerPlan) return managerPlan;
        }
        if (!this.venue) return null;
        return this.plans.find(function(p) { return p.id === this.venue.plan; }) || null;
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
        if (!p) return;
        if (Number(p.price) === 0) {
          self = this;
          self.showToast('Бесплатный тариф недоступен для самостоятельной активации', 'error');
          return;
        }
        this.payPlan = p;
      },

      /*
       * Manager subscription mutations are intentionally not performed from the browser.
       * Paid plan changes/renewals go through /api/payments/yookassa/create-subscription
       * and the payment webhook. Admin changes use the admin billing flow.
       */
      subscribeFree: async function() {
        this.showToast('Изменение тарифа выполняется через биллинг', 'error');
      },

      markPaid: function() {
        var self = this;
        if (!this.payPlan || !this.profile) return;
        self.busy = true;
        db.from('payments').insert({
          venue_id: this.venue ? this.venue.id : null,
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
        return Number(p.price) === 0 ? '0' : this.fmt(p.price) + ' ₽';
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
