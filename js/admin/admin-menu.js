/* QR-Menu — просмотр меню заведений (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_MENU__) return;
  window.__QR_ADMIN_MENU__ = true;

  var menuMixin = {
    data: function() {
      return {
        menuVenueId: '',
        menuVenueProducts: [],
        prodModal: { show: false, venueId: null, venueName: '', list: [], form: { name: '', price: 0, category: 'main' } },
        DEFAULT_IMG: window.DEFAULT_IMG || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>"
      };
    },
    methods: {
      categoryLabel: function(category) {
        var labels = {
          main: 'Основные блюда',
          starters: 'Закуски',
          salads: 'Салаты',
          soups: 'Супы',
          hot: 'Горячие блюда',
          pizza: 'Пицца',
          burgers: 'Бургеры',
          rolls: 'Роллы',
          sushi: 'Суши',
          desserts: 'Десерты',
          drinks: 'Напитки',
          coffee: 'Кофе',
          tea: 'Чай',
          cocktails: 'Коктейли',
          sides: 'Гарниры',
          sauces: 'Соусы',
          addons: 'Добавки',
          breakfast: 'Завтраки',
          lunch: 'Обеды',
          other: 'Другое'
        };
        var key = String(category == null ? '' : category).trim().toLowerCase();
        return labels[key] || (category ? String(category) : 'Без категории');
      },

      loadMenuVenue: function() {
        var self = this;
        if (!self.menuVenueId) { self.menuVenueProducts = []; return; }
        db.from('products').select('*').eq('venue_id', self.menuVenueId).order('category').then(function(r) {
          if (r.error) throw r.error;
          self.menuVenueProducts = r.data || [];
        }).catch(function(e) { console.warn('Ошибка загрузки меню:', e); });
      },

      openVenueMenu: function(v) {
        var self = this;
        self.prodModal = { show: true, venueId: v.id, venueName: v.name, list: [], form: { name: '', price: 0, category: 'main' } };
        db.from('products').select('*').eq('venue_id', v.id).order('created_at').then(function(r) {
          if (r.error) throw r.error;
          self.prodModal.list = (r.data || []).map(function(p) { return p; });
        }).catch(function(e) { console.warn('Ошибка загрузки меню:', e); });
      },

      openVenueMenuById: function(venueId) {
        if (!venueId) return;
        var venue = this.venues.find(function(v) { return v.id === venueId; });
        if (venue) this.openVenueMenu(venue);
      },

      uploadProdPhoto: function(ev, p) {
        var self = this;
        var f = ev.target.files[0];
        if (!f) return;
        self.resizeImage(f, 900, .85).then(function(blob) {
          var fn = self.prodModal.venueId + '/prod_' + Date.now() + '.jpg';
          return db.storage.from('menu-images').upload(fn, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' }).then(function(r) {
            if (r.error) throw r.error;
            var url = db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
            return db.from('products').update({ image_url: url }).eq('id', p.id).then(function(ur) {
              if (ur.error) throw ur.error;
              p.image_url = url;
            });
          });
        }).catch(function(e) { alert('Ошибка: ' + e.message); }).finally(function() { ev.target.value = ''; });
      },

      saveProductRow: function(p) {
        db.from('products').update({ name: p.name, price: Number(p.price) || 0, category: p.category }).then(function(r) {
          if (r.error) console.warn('Ошибка сохранения блюда:', r.error);
        });
      },

      toggleAvailRow: function(p) {
        p.is_available = !p.is_available;
        db.from('products').update({ is_available: p.is_available }).eq('id', p.id).then(function(r) {
          if (r.error) console.warn('Ошибка изменения доступности:', r.error);
        });
      },

      delProductRow: function(p) {
        var self = this;
        if (!confirm('Удалить «' + p.name + '»?')) return;
        db.from('products').delete().eq('id', p.id).then(function(r) {
          if (r.error) throw r.error;
          self.prodModal.list = self.prodModal.list.filter(function(x) { return x.id !== p.id; });
        }).catch(function(e) { alert('Ошибка: ' + e.message); });
      },

      addProductRow: function() {
        var self = this;
        if (!self.prodModal.form.name) return;
        db.from('products').insert({
          venue_id: self.prodModal.venueId,
          name: self.prodModal.form.name,
          price: Number(self.prodModal.form.price) || 0,
          category: self.prodModal.form.category,
          applies_to: 'all',
          is_available: true
        }).select().single().then(function(r) {
          if (r.error) throw r.error;
          if (r.data) { self.prodModal.list.push(r.data); }
          self.prodModal.form = { name: '', price: 0, category: 'main' };
        }).catch(function(e) { alert('Ошибка добавления блюда: ' + e.message); });
      }
    }
  };

  window.__QR_ADMIN_MENU_MIXIN__ = menuMixin;
})();
