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
    state.managerSubscription = state.managerSubscription || null;
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

  /* Canonical SaaS entitlement resolver: one manager-owned subscription controls venues. */
  appComputed.canCreateVenue = function(){
    if(!this.profile || this.profile.role === 'admin') return true;
    var sub=this.managerSubscription;
    if(!sub || !['trialing','active'].includes(sub.status) || !sub.current_period_end || new Date(sub.current_period_end) < new Date()) return false;
    var plan=(this.plans||[]).find(function(p){return p.id===sub.plan_id;});
    var limit=plan ? Number(plan.max_venues||0) : 0;
    var used=Array.isArray(this.myVenues)?this.myVenues.length:0;
    return limit>0 && used<limit;
  };

  /* Keep the existing init flow, then hydrate the canonical manager subscription once. */
  var baseInit=appMethods.init;
  if(typeof baseInit==='function'){
    appMethods.init=async function(){
      await baseInit.call(this);
      if(!this.profile || this.profile.role==='admin') return;
      var r=await db.from('subscriptions')
        .select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at,payment_status,payment_id')
        .eq('manager_id',this.profile.id)
        .is('venue_id',null)
        .order('created_at',{ascending:false})
        .limit(1)
        .maybeSingle();
      if(r.error) throw r.error;

      var sub=r.data||null;
      /* Self-heal legacy accounts: infer the canonical manager subscription from an existing managed venue, otherwise start a fresh 10-day Trial. */
      if(!sub){
        var seedVenue=Array.isArray(this.myVenues)&&this.myVenues.length ? this.myVenues[0] : null;
        var now=new Date();
        var end=seedVenue && seedVenue.subscription_end && new Date(seedVenue.subscription_end) > now
          ? new Date(seedVenue.subscription_end)
          : new Date(now.getTime()+10*864e5);
        var planId=seedVenue && seedVenue.plan ? seedVenue.plan : 'start';
        var ins=await db.from('subscriptions').insert({
          manager_id:this.profile.id,
          venue_id:null,
          plan_id:planId,
          status:(seedVenue && end>now)?'active':'trialing',
          current_period_end:end.toISOString()
        }).select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at,payment_status,payment_id').single();
        if(ins.error) throw ins.error;
        sub=ins.data||null;
      }
      this.managerSubscription=sub;
      if(sub && sub.current_period_end) this.subscriptionEnd=sub.current_period_end;
      try{ window.dispatchEvent(new CustomEvent('qr-manager-subscription-ready',{detail:{subscription:sub,managerId:this.profile.id}})); }catch(e){}
    };
  }

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