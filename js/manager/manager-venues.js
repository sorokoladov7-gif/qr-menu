/* QR-Menu — заведения управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_VENUES__) return;
  window.__QR_MANAGER_VENUES__ = true;

  var venuesMixin = {
    data: function() {
      return {
        myVenues: [],
        venue: null,
        showCreateVenue: false,
        newVenueForm: { name: '', slug: '', template: 'coffee' },
        venueTemplates: [
          { id: 'coffee', name: 'Кофейня', emoji: '☕', description: 'Готовое меню кофейни', niche: 'coffee', scale_code: 'M', target_product_count: 1, products: [{ name: 'Эспрессо', description: '30 мл.', price: 150, category: 'drink' }] },
          { id: 'shawarma', name: 'Шаурма', emoji: '🌯', description: 'Готовое меню шаурмы', niche: 'shawarma_canteen', scale_code: 'M', target_product_count: 1, products: [{ name: 'Шаурма классическая', description: 'Курица, овощи, соус.', price: 320, category: 'main' }] }
        ],
        formError: '',
        isBlocked: false,
        hallRendered: false
      };
    },
    computed: {
      venueName: function() { return this.venue ? this.venue.name : 'Мои заведения'; },
      canCreateVenue: function() {
        if (!this.profile || this.profile.role === 'admin') return true;
        var used = Array.isArray(this.myVenues) ? this.myVenues.length : 0;
        var limit = Number(this.venueLimit || 0);
        if (!limit && this.currentPlan) limit = Number(this.currentPlan.max_venues || 0);
        if (!limit && this.managerSubscription && Array.isArray(this.plans)) {
          var subPlan = this.plans.find(function(x) { return x.id === this.managerSubscription.plan_id; });
          if (subPlan) limit = Number(subPlan.max_venues || 0);
        }
        return used < limit;
      },
      selectedVenueTemplate: function() {
        var self = this;
        return this.venueTemplates.find(function(t) { return t.id === self.newVenueForm.template; }) || null;
      },
      isExpired: function() {
        return function(v) { return v.subscription_end && new Date(v.subscription_end) < new Date(); };
      }
    },
    methods: {
      ensureSiteImporter: function() {
        if (window.QRManagerSiteImport) return Promise.resolve();
        if (window.__QR_MANAGER_SITE_IMPORT_LOADING__) return window.__QR_MANAGER_SITE_IMPORT_LOADING__;
        window.__QR_MANAGER_SITE_IMPORT_LOADING__ = new Promise(function(resolve) {
          var s = document.createElement('script');
          s.src = '/js/manager-site-import.js?v=7';
          s.async = false;
          s.onload = function() { resolve(); };
          s.onerror = function(e) {
            console.error('[Manager] Не удалось загрузить импорт сайта:', e);
            resolve();
          };
          document.head.appendChild(s);
        });
        return window.__QR_MANAGER_SITE_IMPORT_LOADING__;
      },
      prepareCreateVenueModal: function() {
        var self = this;
        return this.ensureSiteImporter().then(function() {
          return new Promise(function(resolve) {
            self.$nextTick(function() {
              var root = document.getElementById('app');
              var modal = root && root.querySelector('.modal');
              if (!modal) { resolve(); return; }
              var content = modal.firstElementChild;
              if (!content) { resolve(); return; }
              var label = Array.prototype.find.call(content.querySelectorAll('label'), function(x) { return /шаблон ниши/i.test(x.textContent || ''); });
              var grid = content.querySelector('.template-grid');
              var fields = content.querySelectorAll('.field input');
              var nameInput = null, slugInput = null;
              Array.prototype.forEach.call(fields, function(input) {
                var p = (input.placeholder || '').toLowerCase();
                if (!nameInput && (p.indexOf('coffee point') !== -1 || p.indexOf('название') !== -1)) nameInput = input;
                if (!slugInput && (p.indexOf('coffee-point') !== -1 || p.indexOf('slug') !== -1)) slugInput = input;
              });
              if (!nameInput && fields[0]) nameInput = fields[0];
              if (!slugInput && fields[1]) slugInput = fields[1];
              var buttons = content.querySelectorAll('button');
              var submit = null;
              Array.prototype.forEach.call(buttons, function(b) {
                if (!submit && /создать заведение/i.test(b.textContent || '')) submit = b;
              });
              if (grid) grid.id = 'qr-template-grid-v10';
              if (nameInput) nameInput.id = 'qr-venue-name-v10';
              if (slugInput) slugInput.id = 'qr-venue-slug-v10';
              if (submit) submit.id = 'qr-create-submit-v10';
              var preview = content.querySelector('.template-preview');
              if (preview) preview.id = 'qr-template-preview-v10';
              self.decorateVenueTemplateCards();
              if (window.QRManagerSiteImport && typeof window.QRManagerSiteImport.mount === 'function') {
                window.QRManagerSiteImport.mount(modal);
              }
              if (window.QRManagerSiteImport) {
                window.dispatchEvent(new CustomEvent('qr:manager-create-modal-ready', { detail: { modal: modal } }));
              }
              resolve();
            });
          });
        });
      },
      loadMyVenues: function() {
        var self = this;
        self.ensureSiteImporter();
        return new Promise(function(resolve) {
          var ids = null;
          var p = Promise.resolve();
          if (self.profile && self.profile.role !== 'admin') {
            p = db.from('manager_venues').select('venue_id').eq('manager_id', self.profile.id).then(function(l) {
              if (!l.error) ids = (l.data || []).map(function(x) { return x.venue_id; });
            });
          }
          p.then(function() {
            var q = db.from('venues').select('*');
            if (self.profile && self.profile.role !== 'admin') {
              if (ids === null) {
                if (!self.profile.venue_id) { self.myVenues = []; resolve(); return; }
                q = q.eq('id', self.profile.venue_id);
              } else if (!ids.length) { self.myVenues = []; resolve(); return; }
              else q = q.in('id', ids);
            }
            q.order('created_at', { ascending: false }).then(function(r) {
              self.myVenues = r.data || [];
              resolve();
            });
          });
        });
      },
      loadVenueTemplates: function() {
        var self = this;
        return db.from('menu_templates').select('id,name,slug,emoji,description,is_active,sort_order,products,niche,scale_code,target_product_count').eq('is_active', true).order('sort_order').order('name').then(function(r) {
          if (r.error) { console.warn('menu_templates недоступна:', r.error.message); return; }
          if (!r.data || !r.data.length) return;
          self.venueTemplates = r.data.map(function(t) {
            var products = Array.isArray(t.products) ? t.products : [];
            return {
              id: t.id,
              name: t.name,
              slug: t.slug || '',
              emoji: t.emoji || '🍽️',
              description: t.description || '',
              niche: t.niche || 'other',
              scale_code: t.scale_code || 'M',
              target_product_count: Number(t.target_product_count || products.length || 0),
              products: products
            };
          });
        }).catch(function(e) { console.warn('Ошибка загрузки шаблонов:', e.message || e); });
      },
      decorateVenueTemplateCards: function() {
        var self = this;
        this.$nextTick(function() {
          var root = document.getElementById('app');
          if (!root) return;
          var cards = root.querySelectorAll('.template-card');
          if (!cards.length) return;
          var nicheMap = {
            fastfood: 'Fast food', bakery: 'Пекарня', coffee: 'Кофейня', confectionery: 'Кондитерская',
            cafe: 'Кафе', shawarma_canteen: 'Шаурма-столовая', cafe_bar: 'Кафе-бар', sushi: 'Суши-бар',
            pizzeria: 'Пиццерия', restaurant: 'Ресторан', other: 'Другое'
          };
          Array.prototype.forEach.call(cards, function(card, index) {
            var t = self.venueTemplates[index];
            if (!t) return;
            var meta = card.querySelector('.qr-template-meta');
            if (!meta) {
              meta = document.createElement('div');
              meta.className = 'qr-template-meta';
              meta.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:3px;font-size:11px;color:#94a3b8;line-height:1.35;';
              card.appendChild(meta);
            }
            meta.innerHTML = '<span>🏷️ '+String(nicheMap[t.niche] || t.niche || 'Другое').replace(/[<>]/g,'')+'</span>' +
              '<span>📐 Масштаб: '+String(t.scale_code || 'M').replace(/[<>]/g,'')+'</span>' +
              '<span>🍽️ '+Number((t.products || []).length || t.target_product_count || 0)+' позиций</span>';
            card.style.cursor = 'pointer';
            card.style.transition = 'transform .18s ease, border-color .18s ease, box-shadow .18s ease';
          });
        });
      },
      backToList: function() {
        this.venue = null;
        this.hallRendered = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        this.loadMyVenues();
      },
      selectVenue: function(v) {
        if (!v || !v.id) return;
        var self = this;
        try {
          if (window.QRManagerHall && typeof window.QRManagerHall.close === 'function') {
            window.QRManagerHall.close();
          }
        } catch(e) { console.warn('[Manager] Не удалось закрыть старый зал:', e); }
        this.venue = v;
        this.hallRendered = false;
        this.detailProduct = null;
        this.products = [];
        this.orders = [];
        try {
          localStorage.setItem('manager_venue_id', String(v.id));
          window.dispatchEvent(new CustomEvent('manager-venue-selected', { detail: { id: v.id, name: v.name || '', slug: v.slug || '' } }));
        } catch(e) {}
        this.tab = 'menu';
        this.subscriptionEnd = v.subscription_end;
        window.__managerSelectedVenue = v;
        window.__managerCurrentVenue = { id: v.id, name: v.name || '', slug: v.slug || '', logo_url: v.logo_url || null };
        try { localStorage.setItem('manager_venue_id', String(v.id)); } catch(e) {}
        window.__managerVue = this;
        if (this.isExpired(v)) { this.isBlocked = true; this.tab = 'billing'; } else { this.isBlocked = false; }
        if (!this.isBlocked && typeof this.loadProducts === 'function') {
          this.busy = true;
          this.loadProducts()
            .catch(function(e) {
              console.error('[Manager] Ошибка загрузки меню:', e);
              self.showToast('Не удалось загрузить меню: ' + (e.message || e), 'error');
            })
            .finally(function() { self.busy = false; });
        }
      },
      selectVenueTemplate: function(id) {
        this.newVenueForm.template = id;
        this.decorateVenueTemplateCards();
      },
      createVenue: function() {
        var self = this;
        self.formError = '';
        if (!this.newVenueForm.name || !this.newVenueForm.slug) { this.formError = 'Заполните название и код заведения'; return; }
        if (!this.canCreateVenue) { this.formError = 'Лимит заведений'; return; }
        var template = this.selectedVenueTemplate;
        if (!template) { this.formError = 'Выберите шаблон ниши'; return; }
        if (this.currentPlan && this.currentPlan.max_products && template.products.length > this.currentPlan.max_products) {
          this.formError = 'В выбранном тарифе недостаточно места для шаблона (' + template.products.length + ' позиций).'; return; }
        self.busy = true;
        var planId = (this.managerSubscription && this.managerSubscription.plan_id) || (this.currentPlan && this.currentPlan.id) || null;
        var subscriptionEnd = (this.managerSubscription && this.managerSubscription.current_period_end) || this.subscriptionEnd || null;
        if (!planId && Array.isArray(this.plans) && this.venue && this.venue.plan) {
          planId = this.venue.plan;
        }
        if (!planId) planId = 'start';
        if (!subscriptionEnd) {
          var e = new Date();
          e.setDate(e.getDate() + 10);
          subscriptionEnd = e.toISOString();
        }
        var slug = window.slugify(this.newVenueForm.slug);
        if (!slug) { self.formError = 'Некорректный slug'; self.busy = false; return; }
        db.rpc('create_venue_for_manager', {
          p_name: this.newVenueForm.name.trim(),
          p_slug: slug,
          p_plan: planId,
          p_subscription_end: subscriptionEnd
        }).then(function(r) {
          if (r.error) throw r.error;
          var venue = r.data;
          var rows = template.products.map(function(item) {
            return {
              venue_id: venue.id,
              name: item.name,
              description: item.description || null,
              price: Number(item.price) || 0,
              category: item.category || 'main',
              image_url: item.image_url || null,
              applies_to: item.applies_to || 'all',
              is_available: true
            };
          });
          return db.from('products').insert(rows).then(function(r2) {
            if (r2.error) throw r2.error;
            return venue;
          });
        }).then(function(venue) {
          self.showCreateVenue = false;
          self.newVenueForm = { name: '', slug: '', template: self.venueTemplates[0] ? self.venueTemplates[0].id : 'coffee' };
          return self.loadMyVenues().then(function() {
            self.selectVenue(venue);
            self.showToast('Заведение создано: ' + template.name + ' · ' + template.products.length + ' позиций добавлено');
          });
        }).catch(function(err) {
          console.error('createVenue error:', err);
          self.formError = 'Ошибка: ' + (err.message || String(err));
        }).finally(function() { self.busy = false; });
      },
      venueBadge: function(v) { return this.isExpired(v) ? 'b-cancelled' : 'b-ready'; },
      venueLabel: function(v) { return this.isExpired(v) ? 'Истекла' : 'Активна'; }
    }
  };
  window.__QR_MANAGER_VENUES_MIXIN__ = venuesMixin;
})();