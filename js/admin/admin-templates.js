/* QR-Menu — шаблоны заведений (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_TEMPLATES__) return;
  window.__QR_ADMIN_TEMPLATES__ = true;

  var templatesMixin = {
    data: function() {
      return {
        templates: [],
        selectedTemplate: null,
        templateForm: {
          id: null, name: '', slug: '', emoji: '🍽️', description: '',
          is_active: true, sort_order: 100, niche: 'other', scale_code: 'M',
          target_product_count: 1, products: []
        },
        templateBusy: false,
        searchQuery: '',
        previewModal: { show: false, products: [] },
        placeholder: 'https://loremflickr.com/320/240/food?lock=1'
      };
    },
    computed: {
      filteredTemplates: function() {
        var q = this.searchQuery.toLowerCase();
        if (!q) return this.templates;
        return this.templates.filter(function(t) {
          var s = (t.name || '') + ' ' + (t.slug || '') + ' ' + (t.niche || '');
          return s.toLowerCase().includes(q);
        });
      },
      groupedPreview: function() {
        var groups = {};
        var self = this;
        (this.previewModal.products || []).forEach(function(p) {
          var cat = p.category || 'main';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(p);
        });
        var catMap = {
          main: '🍽 Блюда',
          drink: '🥤 Напитки',
          addon: '🧂 Добавки',
          breakfast: '🍳 Завтраки',
          salad: '🥗 Салаты',
          soup: '🍲 Супы',
          dessert: '🍰 Десерты',
          sauce: '🌶 Соусы',
          snack: '🥨 Закуски',
          hot: '🔥 Горячее',
          bbq: '🥩 Гриль'
        };
        var result = {};
        Object.keys(groups).sort().forEach(function(k) {
          var display = catMap[k] || k;
          result[display] = groups[k];
        });
        return result;
      }
    },
    methods: {
      loadTemplates: function() {
        var self = this;
        db.from('menu_templates').select('*').order('sort_order', { ascending: true }).then(function(res) {
          if (res.error) throw res.error;
          self.templates = (res.data || []).map(function(t) {
            if (t.products) {
              t.products = t.products.map(function(p) { return self.normalizeProduct(p); });
            } else {
              t.products = [];
            }
            return t;
          });
          if (self.selectedTemplate) {
            var found = self.templates.find(function(t) { return t.id === self.selectedTemplate.id; });
            if (found) self.selectTemplate(found);
            else { self.selectedTemplate = null; self.templateForm = self.getEmptyTemplateForm(); }
          } else if (self.templates.length) {
            self.selectTemplate(self.templates[0]);
          }
        }).catch(function(e) { console.error('Ошибка загрузки шаблонов:', e); });
      },

      getEmptyTemplateForm: function() {
        return {
          id: null, name: '', slug: '', emoji: '🍽️', description: '',
          is_active: true, sort_order: 100, niche: 'other', scale_code: 'M',
          target_product_count: 1, products: []
        };
      },

      normalizeProduct: function(p) {
        if (!p) return { name: '', price: 0, category: 'main', description: '', image_url: '', applies_to: 'all', is_available: true };
        return {
          ...p,
          category: p.category || 'main',
          applies_to: p.applies_to || 'all',
          is_available: p.is_available !== undefined ? p.is_available : true,
          image_url: p.image_url || ''
        };
      },

      selectTemplate: function(t) {
        this.selectedTemplate = t;
        var form = JSON.parse(JSON.stringify(t));
        form.products = (form.products || []).map(function(p) { return this.normalizeProduct(p); }.bind(this));
        this.templateForm = form;
      },

      newTemplate: function() {
        var newId = 'template-' + Date.now();
        var newT = {
          id: newId,
          name: 'Новый шаблон',
          slug: 'new-template-' + Date.now(),
          emoji: '🍽️',
          description: '',
          is_active: true,
          sort_order: 100,
          niche: 'other',
          scale_code: 'M',
          target_product_count: 1,
          products: []
        };
        this.templates.unshift(newT);
        this.selectTemplate(newT);
      },

      addProduct: function() {
        this.templateForm.products.push({
          name: '', description: '', price: 0, category: 'main', applies_to: 'all',
          image_url: '', is_available: true
        });
      },

      removeProduct: function(idx) {
        this.templateForm.products.splice(idx, 1);
      },

      duplicateProduct: function(idx) {
        var p = this.templateForm.products[idx];
        if (!p) return;
        var copy = JSON.parse(JSON.stringify(p));
        copy.name = (p.name || 'Позиция') + ' — копия';
        this.templateForm.products.splice(idx + 1, 0, copy);
      },

      uploadTemplatePhoto: function(ev, p) {
        var self = this;
        var f = ev.target.files[0];
        if (!f) return;
        self.resizeImage(f, 900, 0.85).then(function(blob) {
          var fn = 'templates/' + Date.now() + '_' + f.name;
          return db.storage.from('menu-images').upload(fn, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' })
            .then(function(r) {
              if (r.error) throw r.error;
              var url = db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
              p.image_url = url;
              alert('Фото загружено');
            });
        }).catch(function(e) {
          alert('Ошибка загрузки: ' + e.message);
        }).finally(function() {
          ev.target.value = '';
        });
      },

      duplicateTemplate: function() {
        var self = this;
        if (!this.selectedTemplate) return;
        var base = this.selectedTemplate;
        var newName = base.name + ' — копия';
        var newSlug = base.slug + '-copy';
        this.checkSlugUnique(newSlug).then(function(unique) {
          if (!unique) newSlug = base.slug + '-copy-' + Date.now();
          var newT = {
            name: newName,
            slug: newSlug,
            emoji: base.emoji || '🍽️',
            description: base.description || '',
            is_active: false,
            sort_order: (base.sort_order || 100) + 1,
            niche: base.niche || 'other',
            scale_code: base.scale_code || 'M',
            target_product_count: base.target_product_count || 1,
            products: (base.products || []).map(function(p) {
              var copy = JSON.parse(JSON.stringify(p));
              copy.name = p.name + ' (копия)';
              return copy;
            })
          };
          db.from('menu_templates').insert([newT]).select().single().then(function(res) {
            if (res.error) { alert('Ошибка дублирования: ' + res.error.message); return; }
            self.loadTemplates();
            var found = self.templates.find(function(t) { return t.id === res.data.id; });
            if (found) self.selectTemplate(found);
            alert('Шаблон дублирован');
          }).catch(function(e) { alert('Ошибка: ' + e.message); });
        });
      },

      checkSlugUnique: function(slug, excludeId) {
        var self = this;
        return new Promise(function(resolve, reject) {
          if (!slug) { resolve(false); return; }
          var q = db.from('menu_templates').select('id').eq('slug', slug);
          if (excludeId) q = q.neq('id', excludeId);
          q.then(function(r) {
            if (r.error) { reject(r.error); return; }
            resolve((r.data || []).length === 0);
          }).catch(reject);
        });
      },

      saveTemplate: function() {
        var self = this;
        var form = this.templateForm;
        if (!form.name || form.name.trim() === '') { alert('⚠️ Название шаблона обязательно'); return; }
        if (!form.slug || form.slug.trim() === '') { alert('⚠️ Slug обязателен'); return; }
        this.checkSlugUnique(form.slug, form.id && !form.id.startsWith('template-') ? form.id : null).then(function(unique) {
          if (!unique) { alert('⚠️ Шаблон с таким slug уже существует'); return; }
          var products = form.products || [];
          for (var i = 0; i < products.length; i++) {
            var p = products[i];
            if (!p.name || p.name.trim() === '') { alert('⚠️ Позиция #' + (i+1) + ' не имеет названия'); return; }
            if (typeof p.price !== 'number' || p.price < 0) { alert('⚠️ Позиция #' + (i+1) + ' имеет некорректную цену'); return; }
            if (!p.category) { alert('⚠️ Позиция #' + (i+1) + ' не выбрана категория'); return; }
            if (p.category === 'addon' && !p.applies_to) { alert('⚠️ Для добавки #' + (i+1) + ' не указано применение (applies_to)'); return; }
          }
          self.templateBusy = true;
          var data = {
            name: form.name,
            slug: form.slug,
            emoji: form.emoji || '🍽️',
            description: form.description || null,
            is_active: !!form.is_active,
            sort_order: Number(form.sort_order) || 100,
            niche: form.niche || 'other',
            scale_code: form.scale_code || 'M',
            target_product_count: Number(form.target_product_count) || form.products.length,
            products: form.products
          };
          var promise;
          if (form.id && form.id.startsWith('template-')) {
            promise = db.from('menu_templates').insert([data]).select().single();
          } else {
            promise = db.from('menu_templates').update(data).eq('id', form.id).select().single();
          }
          promise.then(function(res) {
            self.templateBusy = false;
            if (res.error) { alert('❌ Ошибка сохранения: ' + res.error.message); return; }
            if (form.id && form.id.startsWith('template-')) {
              var idx = self.templates.findIndex(function(t) { return t.id === form.id; });
              if (idx !== -1) self.templates.splice(idx, 1, res.data);
              else self.templates.push(res.data);
              self.selectedTemplate = res.data;
              self.selectTemplate(res.data);
            } else {
              var idx2 = self.templates.findIndex(function(t) { return t.id === res.data.id; });
              if (idx2 !== -1) self.templates.splice(idx2, 1, res.data);
              self.selectedTemplate = res.data;
              self.selectTemplate(res.data);
            }
            alert('✅ Шаблон сохранён');
          }).catch(function(e) {
            self.templateBusy = false;
            alert('❌ Ошибка: ' + e.message);
          });
        }).catch(function(e) { alert('❌ Ошибка проверки slug: ' + e.message); });
      },

      deleteTemplate: function() {
        var self = this;
        if (!this.selectedTemplate) return;
        if (!confirm('Удалить шаблон "' + this.selectedTemplate.name + '"?')) return;
        var id = this.selectedTemplate.id;
        if (id && id.startsWith('template-')) {
          var idx = this.templates.indexOf(this.selectedTemplate);
          if (idx > -1) this.templates.splice(idx, 1);
          this.selectedTemplate = null;
          this.templateForm = this.getEmptyTemplateForm();
          return;
        }
        db.from('menu_templates').delete().eq('id', id).then(function(res) {
          if (res.error) { alert('Ошибка удаления: ' + res.error.message); return; }
          self.loadTemplates();
          alert('Шаблон удалён');
        }).catch(function(e) { alert('Ошибка: ' + e.message); });
      },

      sortProducts: function() {
        this.templateForm.products.sort(function(a,b) {
          var catA = a.category || 'main';
          var catB = b.category || 'main';
          if (catA !== catB) return catA.localeCompare(catB, 'ru');
          return (a.name || '').localeCompare(b.name || '', 'ru');
        });
      },

      fillTarget: function() {
        var target = this.templateForm.target_product_count || 1;
        var current = this.templateForm.products.length;
        while (current < target) {
          this.templateForm.products.push({
            name: 'Позиция ' + (current+1),
            description: '',
            price: 0,
            category: 'main',
            applies_to: 'all',
            image_url: '',
            is_available: true
          });
          current++;
        }
      },

      previewTemplate: function() {
        if (!this.selectedTemplate) return;
        var products = (this.templateForm.products || []).map(function(p) { return this.normalizeProduct(p); }.bind(this));
        this.previewModal.products = products;
        this.previewModal.show = true;
      },

      // вспомогательная resizeImage
      resizeImage: function(file, mw, q) {
        return new Promise(function(res, rej) {
          var reader = new FileReader();
          reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
              var canvas = document.createElement('canvas');
              var w = img.width, h = img.height;
              if (w > mw) { h = Math.round(h * mw / w); w = mw; }
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d').drawImage(img, 0, 0, w, h);
              canvas.toBlob(function(b) { b ? res(b) : rej(new Error('err')); }, 'image/jpeg', q);
            };
            img.onerror = function() { rej(new Error('err')); };
            img.src = e.target.result;
          };
          reader.onerror = function() { rej(new Error('err')); };
          reader.readAsDataURL(file);
        });
      }
    }
  };

  window.__QR_ADMIN_TEMPLATES_MIXIN__ = templatesMixin;
})();
