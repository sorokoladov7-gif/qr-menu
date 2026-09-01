/* QR-Menu — сборка приложения администратора */
(function(){
  'use strict';
  if (window.__QR_ADMIN_APP__) return;

  var coreMixin = window.__QR_ADMIN_CORE_MIXIN__;
  var venuesMixin = window.__QR_ADMIN_VENUES_MIXIN__;
  var managersMixin = window.__QR_ADMIN_MANAGERS_MIXIN__;
  var staffMixin = window.__QR_ADMIN_STAFF_MIXIN__;
  var subsMixin = window.__QR_ADMIN_SUBSCRIPTIONS_MIXIN__;
  var paymentsMixin = window.__QR_ADMIN_PAYMENTS_MIXIN__;
  var menuMixin = window.__QR_ADMIN_MENU_MIXIN__;
  var settingsMixin = window.__QR_ADMIN_SETTINGS_MIXIN__;
  var templatesMixin = window.__QR_ADMIN_TEMPLATES_MIXIN__;
  var statsMixin = window.__QR_ADMIN_STATISTICS_MIXIN__;

  var appData = function() {
    var state = {};
    var mixins = [coreMixin, venuesMixin, managersMixin, staffMixin, subsMixin, paymentsMixin, menuMixin, settingsMixin, templatesMixin, statsMixin];
    mixins.forEach(function(m) {
      if (m && m.data) Object.assign(state, m.data());
    });
    state.secretDesignPanel = false;
    state.designTarget = 'global';
    state.venueDesignTemplate = null;
    state.adminDesignTemplate = {
      brand_color:'#6366f1', button_color:'#8b5cf6', header_color:'#ffffff', font_family:'Plus+Jakarta+Sans',
      background_color:'#0b1120', card_background:'#141821', text_color:'#eef2f7', accent_color:'#a78bfa',
      border_color:'#29303d', border_radius:18, button_radius:12, shadow:8, font_size:16,
      heading_weight:700, body_weight:400, line_height:1.6, letter_spacing:0,
      gradient_start:'#0b1120', gradient_end:'#0b1120', gradient_direction:'to right',
      background_image:'', card_padding:12, card_image_height:130, card_text_align:'left',
      show_description:true, show_price:true, button_text_color:'#ffffff', button_weight:700,
      button_hover:'scale', border_width:1, transition_speed:0.2
    };
    return state;
  };

  var appComputed = {};
  var mixins = [coreMixin, venuesMixin, managersMixin, staffMixin, subsMixin, paymentsMixin, menuMixin, settingsMixin, templatesMixin, statsMixin];
  mixins.forEach(function(m) {
    if (m && m.computed) Object.assign(appComputed, m.computed);
  });

  var appMethods = {};
  mixins.forEach(function(m) {
    if (m && m.methods) Object.assign(appMethods, m.methods);
  });

  appMethods.openDesignPanel = function() {
    this.secretDesignPanel = true;
    this.designTarget = 'global';
    this.venueDesignTemplate = null;
    this.loadGlobalDesignSettings();
  };
  appMethods.loadGlobalDesignSettings = function() {};
  appMethods.getVenueName = function(id) {
    var v = this.venues.find(function(x){ return x.id === id; });
    return v ? v.name : '';
  };
  appMethods.onDesignTargetChange = function() {
    if (this.designTarget === 'global') {
      this.venueDesignTemplate = null;
    } else {
      var venue = this.venues.find(function(v){ return v.id === this.designTarget; }.bind(this));
      if (venue) {
        if (venue.design_settings) this.venueDesignTemplate = JSON.parse(JSON.stringify(venue.design_settings));
        else this.venueDesignTemplate = JSON.parse(JSON.stringify(this.adminDesignTemplate));
      } else this.venueDesignTemplate = null;
    }
  };
  appMethods.saveGlobalDesign = function() { alert('Глобальный шаблон сохранён (локально). В реальном проекте нужно сохранять в БД.'); };
  appMethods.saveVenueDesign = function() {
    if (this.designTarget === 'global') return;
    var self = this;
    if (!this.venueDesignTemplate) { alert('Нет данных для сохранения'); return; }
    db.from('venues').update({ design_settings: this.venueDesignTemplate }).eq('id', this.designTarget).then(function(){
      self.loadBaseData(); alert('Настройки дизайна для заведения сохранены!');
    }).catch(function(e){ alert('Ошибка сохранения: '+e.message); });
  };
  appMethods.applyGlobalToVenue = function() {
    if (this.designTarget === 'global') return;
    var self = this;
    var venue = this.venues.find(function(v){ return v.id === this.designTarget; }.bind(this));
    if (!venue) return;
    var settings = JSON.parse(JSON.stringify(this.adminDesignTemplate));
    db.from('venues').update({ design_settings: settings }).eq('id', this.designTarget).then(function(){
      self.loadBaseData(); self.venueDesignTemplate = settings;
      alert('Глобальный шаблон применён к заведению "'+venue.name+'"');
    }).catch(function(e){ alert('Ошибка: '+e.message); });
  };
  appMethods.applyGlobalToVenueById = function(venueId) {
    var self = this;
    var venue = this.venues.find(function(v){ return v.id === venueId; });
    if (!venue || !confirm('Применить глобальный шаблон к заведению "'+venue.name+'" ?')) return;
    var settings = JSON.parse(JSON.stringify(this.adminDesignTemplate));
    db.from('venues').update({ design_settings: settings }).eq('id', venueId).then(function(){
      self.loadBaseData(); alert('Глобальный шаблон применён к заведению "'+venue.name+'"');
    }).catch(function(e){ alert('Ошибка: '+e.message); });
  };
  appMethods.resetVenueDesign = function() {
    if (this.designTarget === 'global') return;
    var self = this;
    var venue = this.venues.find(function(v){ return v.id === this.designTarget; }.bind(this));
    if (!venue || !confirm('Сбросить настройки дизайна для заведения "'+venue.name+'" на глобальный шаблон?')) return;
    db.from('venues').update({ design_settings: null }).eq('id', this.designTarget).then(function(){
      self.loadBaseData(); self.venueDesignTemplate = null;
      alert('Настройки сброшены. Теперь заведение использует глобальный шаблон.');
    }).catch(function(e){ alert('Ошибка: '+e.message); });
  };
  appMethods.uploadBgImage = function(ev) {
    var self = this, f = ev.target.files[0];
    if (!f) return;
    self.resizeImage(f, 1920, 0.8).then(function(blob){
      var fn = 'bg/' + Date.now() + '.jpg';
      return db.storage.from('menu-images').upload(fn, blob, { cacheControl:'3600', upsert:true, contentType:'image/jpeg' }).then(function(r){
        if (r.error) throw r.error;
        var url = db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
        if (self.designTarget === 'global') self.adminDesignTemplate.background_image = url;
        else if (self.venueDesignTemplate) self.venueDesignTemplate.background_image = url;
        alert('Фоновое изображение загружено!');
      });
    }).catch(function(e){ alert('Ошибка: '+e.message); });
  };

  var appWatch = {
    tab: function(newTab) {
      if (newTab === 'templates') this.loadTemplates();
      if (newTab === 'settings') this.applyUISettings();
      if (newTab === 'menu') this.loadMenuVenue();
      if (newTab === 'analytics') this.loadAdminAnalytics();
      if (newTab === 'activity' || newTab === 'subs') if (!this.ordersLoaded && !this.ordersLoading) this.loadOrders();
    }
  };

  function mountApp(){
    if(window.__QR_ADMIN_VUE_APP__) return;
    var root = document.getElementById('app');
    if(!root){ console.error('[QR Admin] #app not found'); return; }
    if(typeof window.Vue === 'undefined'){ console.error('[QR Admin] Vue is not loaded'); return; }
    var app = Vue.createApp({ data: appData, computed: appComputed, methods: appMethods, watch: appWatch, mounted: function(){ this.init(); } });
    app.mount(root);
    window.__QR_ADMIN_VUE_APP__ = app;
    window.__QR_ADMIN_APP__ = true;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountApp, {once:true});
  else mountApp();
})();