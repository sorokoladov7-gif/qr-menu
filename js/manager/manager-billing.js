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

          /* manager-app.js owns the actual UI gate. Trigger its existing
             MutationObserver after reactive plan data has been refreshed. */
          try {
            var root = document.getElementById('app');
            if (root) {
              var marker = document.createComment('qr-manager-ai-entitlements-sync');
              root.appendChild(marker);
              root.removeChild(marker);
            }
          } catch (e) {}
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

      /* Manager subscription mutations are intentionally server-side only. */
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

  function startPlanEntitlementSync(vm) {
    if (!vm || vm.__qrManagerPlanSync || !vm.profile || vm.profile.role === 'admin') return;
    vm.__qrManagerPlanSync = true;

    var refresh = function() {
      if (!window.__managerVue || window.__managerVue !== vm) return;
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (typeof vm.refreshPlanEntitlements === 'function') vm.refreshPlanEntitlements();
    };

    /* First sync as soon as Vue/subscription is ready. Then keep the open
       manager cabinet current while an admin changes tariff AI flags. */
    refresh();
    vm.__qrManagerPlanSyncTimer = setInterval(refresh, 20000);

    vm.__qrManagerPlanSyncVisibility = function() {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', vm.__qrManagerPlanSyncVisibility);

    vm.__qrManagerPlanSyncFocus = refresh;
    window.addEventListener('focus', vm.__qrManagerPlanSyncFocus);
  }

  function stopPlanEntitlementSync(vm) {
    if (!vm) return;
    if (vm.__qrManagerPlanSyncTimer) clearInterval(vm.__qrManagerPlanSyncTimer);
    if (vm.__qrManagerPlanSyncVisibility) document.removeEventListener('visibilitychange', vm.__qrManagerPlanSyncVisibility);
    if (vm.__qrManagerPlanSyncFocus) window.removeEventListener('focus', vm.__qrManagerPlanSyncFocus);
    vm.__qrManagerPlanSyncTimer = null;
  }

  window.addEventListener('qr-manager-vue-ready', function() {
    var vm = window.__managerVue;
    if (vm) startPlanEntitlementSync(vm);
  });

  window.addEventListener('qr-manager-subscription-ready', function() {
    var vm = window.__managerVue;
    if (vm) startPlanEntitlementSync(vm);
  });

  /* The HTML entry still references manager-ai.js?v=3 for compatibility.
     Some browsers may keep that old asset even after production deploy.
     This loader promotes the already-updated canonical Qrchick client to v4,
     removes legacy AI UI, and then lets v4 own the assistant surface. */
  function promoteCanonicalManagerAI() {
    if (window.__QR_MANAGER_AI_CACHE_BRIDGE__) return;
    if (!window.__managerVue) return;
    window.__QR_MANAGER_AI_CACHE_BRIDGE__ = true;

    var old = document.getElementById('qr-ai-center');
    if (old) old.remove();
    var current = document.getElementById('qrchick-manager-root');
    if (current) current.remove();

    window.__QR_MANAGER_AI_CENTER__ = false;

    var script = document.createElement('script');
    script.src = '/js/manager/manager-ai.js?v=4';
    script.async = false;
    script.setAttribute('data-qr-manager-ai-canonical', 'v4');
    script.onload = function() {
      setTimeout(function() {
        var legacy = document.getElementById('qr-ai-center');
        if (legacy) legacy.remove();
      }, 350);
    };
    script.onerror = function() {
      console.error('[QR Manager] Не удалось загрузить канонический Qrchick v4:', script.src);
    };
    document.head.appendChild(script);
  }

  window.addEventListener('qr-manager-vue-ready', function() {
    setTimeout(promoteCanonicalManagerAI, 0);
    setTimeout(promoteCanonicalManagerAI, 250);
  });
  window.addEventListener('qr-manager-subscription-ready', function() {
    setTimeout(promoteCanonicalManagerAI, 0);
  });

  window.addEventListener('pagehide', function() {
    stopPlanEntitlementSync(window.__managerVue);
  });

  window.__QR_MANAGER_BILLING_MIXIN__ = billingMixin;
})();