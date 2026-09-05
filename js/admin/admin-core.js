/* QR-Menu — ядро администратора */
(function(){
  'use strict';
  if (window.__QR_ADMIN_CORE__) return;
  window.__QR_ADMIN_CORE__ = true;

  var coreMixin = {
    data: function() {
      return {
        ready: false,
        busy: false,
        profile: null,
        tab: 'stats',
        ordersAll: [],
        ordersLoaded: false,
        ordersLoading: false,
        statsPeriod: '7'
      };
    },
    computed: {
      profileName: function() {
        return this.profile ? this.profile.display_name : '';
      }
    },
    methods: {
      fmt: function(v) { return window.fmt(v); },
      fmtDate: function(d) { return window.fmtDate(d); },
      esc: function(s) { return window.esc(s); },

      init: function() {
        var self = this;
        self.ready = false;
        if (typeof requireAuth === 'function') {
          requireAuth(['admin']).then(function(profile) {
            self.profile = profile;
            if (!profile) { self.ready = true; return; }
            return self.loadBaseData();
          }).then(function() {
            if (!self.profile) return;
            self.loadOrders();
            self.loadGlobalStats();
            self.loadAdminAnalytics();
            self.loadTemplates();
            self.loadUISettings();
            self.ready = true;
          }).catch(function(error) {
            console.error('[QR Admin] initialization failed:', error);
            /*
             * A failed secondary query must not leave the entire admin cabinet
             * permanently behind the "Загрузка…" screen. Individual sections
             * already tolerate empty arrays, so render the cabinet and expose
             * the failing request in the console instead.
             */
            self.ready = true;
          });
        } else {
          self.ready = true;
          console.warn('requireAuth не найдена');
        }
      },

      loadBaseData: function() {
        var self = this;
        var requests = [
          db.from('venues').select('*').order('created_at'),
          db.from('profiles').select('*').in('role', ['manager','admin']).order('email'),
          db.from('cooks').select('*,venues(name)'),
          db.from('couriers').select('*,venues(name)'),
          db.from('waiters').select('*,venues(name)'),
          db.from('manager_venues').select('*'),
          db.from('plans').select('*').order('price'),
          db.from('payments').select('*,venues(name),profiles(display_name)').order('created_at', {ascending:false}),
          db.from('subscriptions').select('*')
        ];
        return Promise.all(requests.map(function(request, index) {
          return Promise.resolve(request).catch(function(error) {
            console.error('[QR Admin] base data request failed:', index, error);
            return {data: [], error: error};
          });
        })).then(function(r) {
          self.venues = r[0].data || [];
          self.managers = r[1].data || [];
          self.cooksAll = r[2].data || [];
          self.couriersAll = r[3].data || [];
          self.waitersAll = r[4].data || [];
          self.links = r[5].data || [];
          self.plans = r[6].data || [];
          self.payments = r[7].data || [];
          self.subscriptions = r[8].data || [];
        });
      },

      loadOrders: function(force) {
        var self = this;
        if (self.ordersLoading) return;
        if (self.ordersLoaded && !force) return;
        self.ordersLoading = true;
        db.from('orders')
          .select('venue_id,total_price,status,created_at,order_type,payment_method,cook_name,courier_name,waiter_name,cooking_started_at,ready_at,customer_phone')
          .order('created_at', {ascending:false})
          .limit(800)
          .then(function(r) {
            self.ordersAll = (r.data || []).reverse();
            self.ordersLoaded = true;
            self.ordersLoading = false;
          }).catch(function(error) {
            console.error('[QR Admin] orders load failed:', error);
            self.ordersLoading = false;
          });
      },

      logout: function() {
        try { db.auth.signOut(); } catch(e) {}
        location.href = '/login.html';
      },

      switchTab: function(t) {
        this.tab = t;
        if ((t === 'activity' || t === 'subs') && !this.ordersLoaded && !this.ordersLoading) {
          this.loadOrders();
        }
        if (t === 'templates') this.loadTemplates();
        if (t === 'settings') this.applyUISettings();
        if (t === 'menu') this.loadMenuVenue();
        if (t === 'analytics') this.loadAdminAnalytics();
      }
    }
  };

  window.__QR_ADMIN_CORE_MIXIN__ = coreMixin;

  /* Make the new sidebar Design button use the exact same Vue action as the
     original admin design control, regardless of load timing. */
  document.addEventListener('click', function(event) {
    var button = event.target && event.target.closest
      ? event.target.closest('#qr-admin-shell .qr-nav button[data-nav-key="design"]')
      : null;
    if (!button) return;
    var app = window.__QR_ADMIN_VUE_APP__;
    var proxy = app && app._instance ? app._instance.proxy : null;
    if (proxy && typeof proxy.openDesignPanel === 'function') {
      proxy.openDesignPanel();
    }
  }, true);

  /* Load the premium console bridge after the Vue admin app is available. */
  (function loadEnhancer(){
    if(document.getElementById('qr-admin-console-enhancer-loader')) return;
    var s=document.createElement('script');
    s.id='qr-admin-console-enhancer-loader';
    s.src='/js/admin/admin-console-enhancer.js';
    s.async=true;
    document.head.appendChild(s);
  })();
})();
