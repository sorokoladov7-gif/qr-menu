/* QR-Menu — сборка приложения управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_APP__) return;
  window.__QR_MANAGER_APP__ = true;

  // Ждём загрузки всех миксинов
  var coreMixin = window.__QR_MANAGER_CORE_MIXIN__;
  var venuesMixin = window.__QR_MANAGER_VENUES_MIXIN__;
  var menuMixin = window.__QR_MANAGER_MENU_MIXIN__;
  var ordersMixin = window.__QR_MANAGER_ORDERS_MIXIN__;
  var staffMixin = window.__QR_MANAGER_STAFF_MIXIN__;
  var billingMixin = window.__QR_MANAGER_BILLING_MIXIN__;
  var analyticsMixin = window.__QR_MANAGER_ANALYTICS_MIXIN__;
  var settingsMixin = window.__QR_MANAGER_SETTINGS_MIXIN__;

  // Объединяем все data, computed, methods
  var appData = function() {
    var state = {};
    // Собираем data из всех миксинов
    var mixins = [coreMixin, venuesMixin, menuMixin, ordersMixin, staffMixin, billingMixin, analyticsMixin, settingsMixin];
    mixins.forEach(function(m) {
      if (m && m.data) {
        var d = m.data();
        Object.assign(state, d);
      }
    });
    // Добавляем специфичные для manager поля (если не определены)
    if (!state.tab) state.tab = 'menu';
    if (!state.isBlocked) state.isBlocked = false;
    return state;
  };

  var appComputed = {};
  var mixins = [coreMixin, venuesMixin, menuMixin, ordersMixin, staffMixin, billingMixin, analyticsMixin, settingsMixin];
  mixins.forEach(function(m) {
    if (m && m.computed) {
      Object.assign(appComputed, m.computed);
    }
  });

  var appMethods = {};
  mixins.forEach(function(m) {
    if (m && m.methods) {
      Object.assign(appMethods, m.methods);
    }
  });

  // Добавляем дополнительные методы, которые были в оригинальном manager.html,
  // но не попали в миксины (например, openStaffGuide, renderHall, init — уже есть)
  // Некоторые методы переопределены в миксинах, но мы можем добавить недостающие.
  appMethods.openStaffGuide = function() {
    window.open('/staff-guide.html', '_blank');
  };

  appMethods.renderHall = function() {
    var container = document.getElementById('hall-container');
    if (!container) return;
    if (window.QRManagerHall && typeof window.QRManagerHall.renderIn === 'function') {
      if (!this.hallRendered) {
        window.QRManagerHall.renderIn(container, this.venue);
        this.hallRendered = true;
      }
    } else {
      console.warn('QRManagerHall.renderIn not available');
    }
  };

  // Переопределяем init, чтобы он вызывал загрузку данных после авторизации
  var originalInit = appMethods.init;
  appMethods.init = function() {
    var self = this;
    originalInit.call(this);
    // После того как профиль загружен, загружаем планы, шаблоны, заведения
    // Это делается через watch или mounted
  };

  // Добавляем watch на tab для рендера зала
  var appWatch = {
    tab: function(newTab) {
      if (newTab === 'hall' && this.venue) {
        this.$nextTick(function() {
          this.renderHall();
        });
      }
    }
  };

  // Создаём Vue-приложение
  var app = Vue.createApp({
    data: appData,
    computed: appComputed,
    methods: appMethods,
    watch: appWatch,
    mounted: function() {
      this.init();
      // После инициализации подгружаем данные, если есть профиль
      var self = this;
      if (this.profile) {
        db.from('plans').select('*').order('price').then(function(pl) {
          self.plans = pl.data || [];
          return self.loadVenueTemplates().then(function() { return self.loadMyVenues(); });
        }).then(function() {
          self.ready = true;
          // Если есть выбранное заведение в localStorage, выбираем его
          var saved = localStorage.getItem('manager_venue_id');
          if (saved && self.myVenues.length) {
            var v = self.myVenues.find(function(x) { return x.id === saved; });
            if (v) self.selectVenue(v);
          }
        });
      }
    },
    beforeUnmount: function() {
      if (this.timer) clearInterval(this.timer);
    }
  });

  // Монтируем приложение
  app.mount('#app');

  // Сохраняем глобальный доступ к Vue-экземпляру
  window.__managerVue = app._instance && app._instance.proxy;
  window.__QR_MANAGER_VUE_APP__ = app;
  window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));

  window.__QR_MANAGER_APP__ = true;
})();
