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
  var mixins = [coreMixin, venuesMixin, managersMixin, staffMixin, subsMixin, paymentsMixin, menuMixin, settingsMixin, templatesMixin, statsMixin];

  /* Public AI branding. The provider/model remains an implementation detail. */
  window.__QR_AI_BRAND__ = window.__QR_AI_BRAND__ || {
    name: 'Qrchick',
    shortName: 'Q',
    avatar: null
  };

  function applyQrchickBrand(root) {
    if (!root) return;
    var brand = window.__QR_AI_BRAND__;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && /Gemini/i.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(/Gemini/gi, brand.name);
      }
    }
    root.querySelectorAll('.qr-ai-avatar').forEach(function(el) {
      if (!el.closest('.qr-ai-user')) el.textContent = brand.shortName;
    });
    var fab = root.querySelector('#qr-ai-fab');
    if (fab) {
      fab.textContent = brand.shortName;
      fab.title = 'Открыть ' + brand.name;
      fab.setAttribute('aria-label', 'Открыть ' + brand.name);
    }
    var drawer = root.querySelector('#qr-ai-drawer');
    if (drawer) drawer.setAttribute('aria-label', brand.name + ' — инженерный помощник');
    var input = root.querySelector('#qr-ai-message');
    if (input) input.placeholder = input.placeholder.replace(/Gemini/gi, brand.name);
  }

  function watchQrchickBrand() {
    var apply = function(){
      var root = document.getElementById('qr-ai-center');
      if (root) applyQrchickBrand(root);
    };
    if (window.MutationObserver) {
      var observer = new MutationObserver(function(){ apply(); });
      observer.observe(document.body, {childList:true, subtree:true, characterData:true});
      window.__QR_QRCHICK_BRAND_OBSERVER__ = observer;
    }
    apply();
  }

  var appData = function() {
    var state = {};
    mixins.forEach(function(m) { if (m && m.data) Object.assign(state, m.data()); });
    state.secretDesignPanel = false;
    state.designTarget = 'global';
    state.venueDesignTemplate = null;
    state.adminDesignTemplate = {
      brand_color:'#6366f1', button_color:'#8b5cf6', header_color:'#ffffff', font_family:'Plus+Jakarta+Sans',
      background_color:'#0b1120', card_background:'#141821', text_color:'#eef2f7', accent_color:'#a78bfa',
      border_color:'#29303d', border_radius:18, button_radius:12, shadow:8, font_size:16,
      heading_weight:700, body_weight:400, line_height:1.6, letter_spacing:0,
      gradient_start:'#0b1120', gradient_end:'#0b1120', gradient_direction:'to right', background_image:'',
      card_padding:12, card_image_height:130, card_text_align:'left', show_description:true, show_price:true,
      button_text_color:'#ffffff', button_weight:700, button_hover:'scale', border_width:1, transition_speed:0.2
    };
    return state;
  };

  var appComputed = {};
  mixins.forEach(function(m) { if (m && m.computed) Object.assign(appComputed, m.computed); });

  var appMethods = {};
  mixins.forEach(function(m) { if (m && m.methods) Object.assign(appMethods, m.methods); });

  appMethods.openDesignPanel = function() {
    this.secretDesignPanel = true;
    this.designTarget = 'global';
    this.venueDesignTemplate = null;
    if (typeof this.loadGlobalDesignSettings === 'function') this.loadGlobalDesignSettings();
  };
  appMethods.loadGlobalDesignSettings = function() {};
  appMethods.getVenueName = function(id) {
    var v = (this.venues || []).find(function(x){ return x.id === id; });
    return v ? v.name : '';
  };
  appMethods.onDesignTargetChange = function() {
    if (this.designTarget === 'global') { this.venueDesignTemplate = null; return; }
    var venue = (this.venues || []).find(function(v){ return v.id === this.designTarget; }.bind(this));
    if (!venue) { this.venueDesignTemplate = null; return; }
    this.venueDesignTemplate = venue.design_settings
      ? JSON.parse(JSON.stringify(venue.design_settings))
      : JSON.parse(JSON.stringify(this.adminDesignTemplate));
  };
  appMethods.getDesignSettings = function() {
    var t = this.adminDesignTemplate || {};
    return {
      brand_color:t.brand_color, button_color:t.button_color, header_color:t.header_color, font_family:t.font_family,
      background_color:t.background_color, card_background:t.card_background, text_color:t.text_color, accent_color:t.accent_color,
      border_color:t.border_color, border_radius:t.border_radius, button_radius:t.button_radius, shadow:t.shadow,
      font_size:t.font_size, heading_weight:t.heading_weight, body_weight:t.body_weight, line_height:t.line_height,
      letter_spacing:t.letter_spacing, gradient_start:t.gradient_start, gradient_end:t.gradient_end,
      gradient_direction:t.gradient_direction, background_image:t.background_image, card_padding:t.card_padding,
      card_image_height:t.card_image_height, card_text_align:t.card_text_align, show_description:t.show_description,
      show_price:t.show_price, button_text_color:t.button_text_color, button_weight:t.button_weight,
      button_hover:t.button_hover, border_width:t.border_width, transition_speed:t.transition_speed
    };
  };
  appMethods.saveGlobalDesign = function() { alert('Глобальный шаблон сохранён (локально). В реальном проекте нужно сохранять в БД.'); };
  appMethods.saveVenueDesign = function() {
    if (this.designTarget === 'global' || !this.venueDesignTemplate) return;
    var self = this;
    db.from('venues').update({design_settings:this.venueDesignTemplate}).eq('id',this.designTarget).then(function(r){
      if(r.error) throw r.error; return self.loadBaseData();
    }).then(function(){ alert('Настройки дизайна для заведения сохранены!'); }).catch(function(e){ alert('Ошибка сохранения: '+e.message); });
  };
  appMethods.applyGlobalToVenue = function() {
    if (this.designTarget === 'global') return;
    var self=this, venue=(this.venues||[]).find(function(v){return v.id===self.designTarget;});
    if(!venue) return;
    var settings=JSON.parse(JSON.stringify(this.adminDesignTemplate));
    db.from('venues').update({design_settings:settings}).eq('id',this.designTarget).then(function(r){
      if(r.error) throw r.error; self.venueDesignTemplate=settings; return self.loadBaseData();
    }).then(function(){alert('Глобальный шаблон применён к заведению "'+venue.name+'"');}).catch(function(e){alert('Ошибка: '+e.message);});
  };
  appMethods.applyGlobalToVenueById = function(venueId) {
    var self=this, venue=(this.venues||[]).find(function(v){return v.id===venueId;});
    if(!venue || !confirm('Применить глобальный шаблон к заведению "'+venue.name+'" ?')) return;
    var settings=JSON.parse(JSON.stringify(this.adminDesignTemplate));
    db.from('venues').update({design_settings:settings}).eq('id',venueId).then(function(r){
      if(r.error) throw r.error; return self.loadBaseData();
    }).then(function(){alert('Глобальный шаблон применён к заведению "'+venue.name+'"');}).catch(function(e){alert('Ошибка: '+e.message);});
  };
  appMethods.resetVenueDesign = function() {
    if (this.designTarget === 'global') return;
    var self=this, venue=(this.venues||[]).find(function(v){return v.id===self.designTarget;});
    if(!venue || !confirm('Сбросить настройки дизайна для заведения "'+venue.name+'" на глобальный шаблон?')) return;
    db.from('venues').update({design_settings:null}).eq('id',this.designTarget).then(function(r){
      if(r.error) throw r.error; self.venueDesignTemplate=null; return self.loadBaseData();
    }).then(function(){alert('Настройки сброшены. Теперь заведение использует глобальный шаблон.');}).catch(function(e){alert('Ошибка: '+e.message);});
  };
  appMethods.resetAdminTemplate = function() {
    if (!confirm('Сбросить глобальный шаблон к стандартным настройкам?')) return;
    this.adminDesignTemplate = {
      brand_color:'#6366f1', button_color:'#8b5cf6', header_color:'#ffffff', font_family:'Plus+Jakarta+Sans',
      background_color:'#0b1120', card_background:'#141821', text_color:'#eef2f7', accent_color:'#a78bfa', border_color:'#29303d',
      border_radius:18, button_radius:12, shadow:8, font_size:16, heading_weight:700, body_weight:400, line_height:1.6,
      letter_spacing:0, gradient_start:'#0b1120', gradient_end:'#0b1120', gradient_direction:'to right', background_image:'',
      card_padding:12, card_image_height:130, card_text_align:'left', show_description:true, show_price:true,
      button_text_color:'#ffffff', button_weight:700, button_hover:'scale', border_width:1, transition_speed:0.2
    };
    alert('Глобальный шаблон сброшен');
  };
  appMethods.uploadBgImage = function(ev) {
    var self=this, f=ev.target.files[0]; if(!f) return;
    if(typeof self.resizeImage !== 'function'){ alert('Функция обработки изображения недоступна'); return; }
    self.resizeImage(f,1920,0.8).then(function(blob){
      var fn='bg/'+Date.now()+'.jpg';
      return db.storage.from('menu-images').upload(fn,blob,{cacheControl:'3600',upsert:true,contentType:'image/jpeg'}).then(function(r){
        if(r.error) throw r.error;
        var url=db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
        if(self.designTarget==='global') self.adminDesignTemplate.background_image=url;
        else if(self.venueDesignTemplate) self.venueDesignTemplate.background_image=url;
        alert('Фоновое изображение загружено!');
      });
    }).catch(function(e){alert('Ошибка: '+e.message);});
  };

  var appWatch = {
    tab:function(newTab){
      if(newTab==='templates') this.loadTemplates();
      if(newTab==='settings') this.applyUISettings();
      if(newTab==='menu') this.loadMenuVenue();
      if(newTab==='analytics') this.loadAdminAnalytics();
      if((newTab==='activity'||newTab==='subs')&&!this.ordersLoaded&&!this.ordersLoading) this.loadOrders();
    }
  };

  function mountApp(){
    if(window.__QR_ADMIN_VUE_APP__) return;
    var root=document.getElementById('app');
    if(!root){console.error('[QR Admin] #app not found');return;}
    if(typeof window.Vue==='undefined'){console.error('[QR Admin] Vue is not loaded');return;}
    var app=Vue.createApp({data:appData,computed:appComputed,methods:appMethods,watch:appWatch,mounted:function(){this.init();}});
    app.mount(root);
    window.__QR_ADMIN_VUE_APP__=app;
    window.__QR_ADMIN_APP__=true;
    var ai=document.createElement('script'); ai.src='/js/admin/admin-ai-audit.js'; ai.async=true; document.head.appendChild(ai);
    watchQrchickBrand();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mountApp,{once:true});
  else mountApp();
})();
