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

      /* Refresh plan data so tariff AI flags changed in the admin cabinet are
         reflected in an already-open manager session without a page reload. */
      refreshPlanEntitlements: function() {
        var self = this;
        if (!self.profile || self.profile.role === 'admin') return Promise.resolve(false);
        return db.from('plans').select('*').order('price').then(function(r) {
          if (r.error) throw r.error;
          var next = Array.isArray(r.data) ? r.data : [];
          var prevSignature = JSON.stringify((self.plans || []).map(function(p) {
            return { id: p.id, ai_enabled: p.ai_enabled, ai_features: p.ai_features || {} };
          }));
          var nextSignature = JSON.stringify(next.map(function(p) {
            return { id: p.id, ai_enabled: p.ai_enabled, ai_features: p.ai_features || {} };
          }));
          if (prevSignature === nextSignature) return false;
          self.plans = next;
          try {
            window.dispatchEvent(new CustomEvent('qr-manager-ai-entitlements-updated', {
              detail: { managerId: self.profile.id }
            }));
          } catch (e) {}
          return true;
        }).catch(function(e) {
          console.warn('[QR Manager] Не удалось обновить тарифные AI-разрешения:', e);
          return false;
        });
      },

      choosePlan: function(p) {
        if (!p) return;
        if (Number(p.price) === 0) {
          this.showToast('Бесплатный тариф недоступен для самостоятельной активации', 'error');
          return;
        }
        this.payPlan = p;
      },

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

  /* Canonical client-side AI entitlement bridge.
     The manager subscription's plan_id is the source of truth. */
  function installAIEntitlementBridge(vm) {
    if (!vm || vm.__qrManagerAIEntitlementBridge) return;
    vm.__qrManagerAIEntitlementBridge = true;
    vm.hasAIFeature = function(feature) {
      feature = String(feature || '').trim();
      if (!feature) return false;
      if (this.profile && this.profile.role === 'admin') return true;
      /* Subscription is loaded asynchronously during manager startup. An
         unresolved entitlement is not a denial; backend authorization remains
         authoritative once the request is sent. */
      if (this.aiEntitlementReady !== true) return true;
      var sub = this.managerSubscription;
      if (!sub || ['active', 'trialing'].indexOf(sub.status) === -1 || !sub.current_period_end || new Date(sub.current_period_end) < new Date()) return false;
      if (sub.status === 'trialing') return true;
      var plans = Array.isArray(this.plans) ? this.plans : [];
      var plan = plans.find(function(p) { return p && p.id === sub.plan_id; }) || null;
      if (!plan) return false;
      if (plan.ai_enabled !== true) return false;
      var features = plan.ai_features && typeof plan.ai_features === 'object' ? plan.ai_features : {};
      if (features[feature] === true) return true;
      return feature === 'assistant' && Object.keys(features).length === 0;
    };
  }

  function startPlanEntitlementSync(vm) {
    if (!vm || vm.__qrManagerPlanSync || !vm.profile || vm.profile.role === 'admin') return;
    vm.__qrManagerPlanSync = true;
    installAIEntitlementBridge(vm);

    var refresh = function() {
      if (!window.__managerVue || window.__managerVue !== vm) return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (typeof vm.refreshPlanEntitlements === 'function') vm.refreshPlanEntitlements();
    };

    refresh();
    vm.__qrManagerPlanSyncTimer = setInterval(refresh, 20000);

    vm.__qrManagerPlanSyncVisibility = function() {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', vm.__qrManagerPlanSyncVisibility);

    vm.__qrManagerPlanSyncFocus = refresh;
    window.addEventListener('focus', vm.__qrManagerPlanSyncFocus);
  }

  function queuePlanEntitlementSync() {
    if (window.__qrManagerPlanSyncPending) return;
    window.__qrManagerPlanSyncPending = true;
    var attempts = 0;
    var timer = setInterval(function() {
      var current = window.__managerVue;
      if (current && current.profile) {
        clearInterval(timer);
        window.__qrManagerPlanSyncPending = false;
        startPlanEntitlementSync(current);
        return;
      }
      attempts++;
      if (attempts >= 120) {
        clearInterval(timer);
        window.__qrManagerPlanSyncPending = false;
      }
    }, 250);
  }

  function stopPlanEntitlementSync(vm) {
    if (!vm) return;
    if (vm.__qrManagerPlanSyncTimer) clearInterval(vm.__qrManagerPlanSyncTimer);
    if (vm.__qrManagerPlanSyncVisibility) document.removeEventListener('visibilitychange', vm.__qrManagerPlanSyncVisibility);
    if (vm.__qrManagerPlanSyncFocus) window.removeEventListener('focus', vm.__qrManagerPlanSyncFocus);
    vm.__qrManagerPlanSyncTimer = null;
  }

  window.addEventListener('qr-manager-vue-ready', function() {
    queuePlanEntitlementSync();
  });

  window.addEventListener('qr-manager-subscription-ready', function() {
    queuePlanEntitlementSync();
  });

  if (window.__managerVue && window.__managerVue.profile) {
    startPlanEntitlementSync(window.__managerVue);
  } else {
    queuePlanEntitlementSync();
  }

  window.addEventListener('pagehide', function() {
    stopPlanEntitlementSync(window.__managerVue);
  });

  window.__QR_MANAGER_BILLING_MIXIN__ = billingMixin;
})();