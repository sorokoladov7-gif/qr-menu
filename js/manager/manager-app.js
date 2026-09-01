/* QR-Menu — сборка приложения управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_APP__) return;

  var mixins = [
    window.__QR_MANAGER_CORE_MIXIN__,
    window.__QR_MANAGER_VENUES_MIXIN__,
    window.__QR_MANAGER_MENU_MIXIN__,
    window.__QR_MANAGER_ORDERS_MIXIN__,
    window.__QR_MANAGER_STAFF_MIXIN__,
    window.__QR_MANAGER_BILLING_MIXIN__,
    window.__QR_MANAGER_ANALYTICS_MIXIN__,
    window.__QR_MANAGER_SETTINGS_MIXIN__
  ];

  var appData = function(){
    var state = {};
    mixins.forEach(function(m){
      if(m && m.data) Object.assign(state, m.data());
    });
    if(!state.tab) state.tab = 'menu';
    return state;
  };

  var appComputed = {};
  var appMethods = {};
  mixins.forEach(function(m){
    if(!m) return;
    if(m.computed) Object.assign(appComputed, m.computed);
    if(m.methods) Object.assign(appMethods, m.methods);
  });

  if(!appMethods.openStaffGuide){
    appMethods.openStaffGuide = function(){ window.location.href = '/staff-guide.html'; };
  }

  if(!appMethods.renderHall){
    appMethods.renderHall = function(){
      var container = document.getElementById('hall-container');
      if(!container || !window.QRManagerHall || typeof window.QRManagerHall.renderIn !== 'function') return;
      if(!this.hallRendered){
        window.QRManagerHall.renderIn(container,this.venue);
        this.hallRendered = true;
      }
    };
  }

  function mountApp(){
    if(window.__QR_MANAGER_VUE_APP__) return;
    var root = document.getElementById('app');
    if(!root){
      console.error('[QR Manager] #app not found');
      return;
    }
    if(typeof window.Vue === 'undefined'){
      console.error('[QR Manager] Vue is not loaded');
      return;
    }

    var app = Vue.createApp({
      data: appData,
      computed: appComputed,
      methods: appMethods,
      watch: {
        tab: function(newTab){
          if(newTab === 'hall' && this.venue){
            var self = this;
            this.$nextTick(function(){ self.renderHall(); });
          }
        },
        showCreateVenue: function(show){
          if(!show || typeof this.prepareCreateVenueModal !== 'function') return;
          this.prepareCreateVenueModal();
        }
      },
      mounted: function(){
        this.init();
      },
      beforeUnmount: function(){
        if(this.timer) clearInterval(this.timer);
      }
    });

    app.mount(root);
    window.__managerVue = app._instance && app._instance.proxy;
    window.__QR_MANAGER_VUE_APP__ = app;
    window.__QR_MANAGER_APP__ = true;
    window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', mountApp, {once:true});
  }else{
    mountApp();
  }
})();
