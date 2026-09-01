/* QR-Menu — меню заведения */
(function(){
  'use strict';
  if (window.__QR_MANAGER_MENU__) return;
  window.__QR_MANAGER_MENU__ = true;

  var menuMixin = {
    data: function() {
      return {
        products: [],
        showModal: false,
        editing: null,
        pform: { name: '', description: '', price: 0, category: 'main', image_url: '', applies_to: 'all' },
        detailProduct: null
      };
    },
    computed: {
      modalTitle: function() {
        return this.editing ? 'Редактировать' : 'Новое блюдо';
      }
    },
    methods: {
      loadProducts: function() {
        var self = this;
        return db.from('products').select('*').eq('venue_id', this.venue.id).order('created_at').then(function(r) {
          self.products = r.data || [];
        });
      },

      openAdd: function() {
        if (!this.perms.products && !this.perms.addons) { this.showToast('Нет прав: добавление запрещено админом', 'error'); return; }
        if (this.currentPlan && this.products.length >= this.currentPlan.max_products) { this.showToast('Лимит позиций', 'error'); return; }
        this.editing = null;
        this.pform = { name: '', description: '', price: 0, category: 'main', image_url: '', applies_to: 'all' };
        this.formError = '';
        this.showModal = true;
      },

      openEdit: function(p) {
        if (p.category === 'addon' && !this.perms.addons) { this.showToast('Нет прав на дополнения', 'error'); return; }
        this.editing = p;
        this.pform = { name: p.name, description: p.description || '', price: Number(p.price) || 0, category: p.category, image_url: p.image_url || '', applies_to: p.applies_to || 'all' };
        this.formError = '';
        this.showModal = true;
      },

      closeModal: function() {
        this.showModal = false;
        this.pform = {};
      },

      saveProduct: function() {
        var self = this;
        if (!this.pform.name) { this.formError = 'Введите название'; return; }
        self.busy = true;
        var row = {
          name: this.pform.name,
          description: this.pform.description || null,
          price: Number(this.pform.price) || 0,
          category: this.pform.category,
          image_url: this.pform.image_url || null,
          applies_to: this.pform.applies_to || 'all'
        };
        var p;
        if (this.editing) {
          p = db.from('products').update(row).eq('id', this.editing.id);
        } else {
          row.venue_id = this.venue.id;
          row.is_available = true;
          p = db.from('products').insert(row);
        }
        p.then(function(r) {
          if (r.error) throw r.error;
          self.showModal = false;
          self.loadProducts().then(function() { self.showToast('Сохранено'); });
        }).catch(function(e) { self.formError = 'Ошибка: ' + e.message; })
          .finally(function() { self.busy = false; });
      },

      uploadImage: function(ev) {
        var self = this;
        var f = ev.target.files[0];
        if (!f) return;
        self.uploading = true;
        self.resizeImage(f, 900, .85).then(function(blob) {
          var fn = self.venue.id + '/' + Date.now() + '.jpg';
          return db.storage.from('menu-images').upload(fn, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' }).then(function(r) {
            if (r.error) throw r.error;
            self.pform.image_url = db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
          });
        }).catch(function(e) { self.showToast('Ошибка: ' + e.message, 'error'); })
          .finally(function() { self.uploading = false; ev.target.value = ''; });
      },

      delProduct: function(p) {
        if (!confirm('Удалить «' + p.name + '»?')) return;
        var self = this;
        db.from('products').delete().eq('id', p.id).then(function() { self.loadProducts(); self.showToast('Удалено'); });
      },

      toggleAvail: function(p) {
        var self = this;
        db.from('products').update({ is_available: !p.is_available }).eq('id', p.id).then(function() { self.loadProducts(); });
      },

      showProductDetail: function(product) {
        this.detailProduct = product;
      },
      closeProductDetail: function() {
        this.detailProduct = null;
      }
    }
  };

  window.__QR_MANAGER_MENU_MIXIN__ = menuMixin;
})();
