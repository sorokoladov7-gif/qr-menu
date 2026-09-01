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

  function loadInstruction(){
    if(window.__QR_MANAGER_INSTRUCTION_V6__ || window.__QR_MANAGER_INSTRUCTION_LOADING__) return;
    window.__QR_MANAGER_INSTRUCTION_LOADING__ = true;
    var script=document.createElement('script');
    script.src='/js/manager-instruction-tab-v2.js?v=6';
    script.async=false;
    script.setAttribute('data-qr-manager-instruction','v6');
    script.onload=function(){ window.__QR_MANAGER_INSTRUCTION_LOADING__=false; };
    script.onerror=function(){ window.__QR_MANAGER_INSTRUCTION_LOADING__=false; console.error('[QR Manager] Не удалось загрузить полную инструкцию:',script.src); };
    document.head.appendChild(script);
  }

  if(!appMethods.openStaffGuide){
    appMethods.openStaffGuide = function(){
      if(typeof window.__QR_MANAGER_INSTRUCTION_SHOW__ === 'function'){
        window.__QR_MANAGER_INSTRUCTION_SHOW__('start');
        return;
      }
      loadInstruction();
      setTimeout(function(){
        if(typeof window.__QR_MANAGER_INSTRUCTION_SHOW__ === 'function') window.__QR_MANAGER_INSTRUCTION_SHOW__('start');
      },100);
    };
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

  function loadPaymentSettings(){
    if(window.__QR_MANAGER_PAYMENT_SETTINGS_V3__) return;
    if(document.querySelector('script[data-qr-manager-payment-settings]')) return;
    var script=document.createElement('script');
    script.src='/js/manager-payment-settings.js';
    script.async=false;
    script.setAttribute('data-qr-manager-payment-settings','1');
    script.onerror=function(){console.error('[QR Manager] Не удалось загрузить модуль СБП:',script.src);};
    document.head.appendChild(script);
  }

  function loadCreateVenueFlow(){
    if(window.__QR_MANAGER_CREATE_FLOW_V11__ || window.__QR_MANAGER_CREATE_FLOW_V12__) return;
    if(document.querySelector('script[data-qr-manager-create-venue-flow]')) return;
    var script=document.createElement('script');
    script.src='/js/manager-create-venue-flow.js?v=12';
    script.async=false;
    script.setAttribute('data-qr-manager-create-venue-flow','1');
    script.onerror=function(){console.error('[QR Manager] Не удалось загрузить существующую логику создания заведения:',script.src);};
    document.head.appendChild(script);
  }

  function loadSiteImport(){
    if(window.QRManagerSiteImport) return;
    if(document.querySelector('script[data-qr-manager-site-import]')) return;
    var script=document.createElement('script');
    script.src='/js/manager-site-import.js?v=8';
    script.async=false;
    script.setAttribute('data-qr-manager-site-import','1');
    script.onerror=function(){console.error('[QR Manager] Не удалось загрузить модуль импорта сайта:',script.src);};
    document.head.appendChild(script);
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

    loadInstruction();
    loadSiteImport();
    loadCreateVenueFlow();

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
    loadPaymentSettings();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', mountApp, {once:true});
  }else{
    mountApp();
  }
})();
