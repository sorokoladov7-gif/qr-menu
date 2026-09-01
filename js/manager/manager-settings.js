/* QR-Menu — настройки заведения */
(function(){
  'use strict';
  if (window.__QR_MANAGER_SETTINGS__) return;
  window.__QR_MANAGER_SETTINGS__ = true;

  var settingsMixin = {
    data: function() {
      return {
        vform: {
          name: '', description: '', brand_color: '#6366f1', logo_url: '',
          address: '', latitude: null, longitude: null,
          delivery_min_order: 0, delivery_min_order_free: 0,
          delivery_base_fee: 0, delivery_rate_per_km: 0, delivery_max_km: 0
        },
        msg: '',
        msgType: ''
      };
    },
    computed: {
      clientLink: function() {
        return this.venue ? location.origin + '/menu.html?venue=' + encodeURIComponent(this.venue.slug) : '';
      },
      qrUrl: function() {
        return this.clientLink ? 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(this.clientLink) : '';
      },
      perms: function() {
        var p = (this.venue && this.venue.manager_permissions) ? this.venue.manager_permissions : {};
        return {
          addons: p.addons !== false,
          products: p.products !== false,
          prices: p.prices !== false,
          delivery: p.delivery !== false && p.can_edit_delivery !== false,
          design: p.design !== false && p.can_edit_design !== false,
          branding: p.branding === true || p.can_edit_branding === true,
          venue: p.venue === true || p.can_edit_venue === true
        };
      }
    },
    methods: {
      saveVenue: function() {
        var self = this;
        self.busy = true;
        self.msg = '';
        var venueId = self.venue && self.venue.id;
        if (!venueId) {
          self.busy = false;
          self.showToast('Не выбрано заведение', 'error');
          return;
        }
        var name = String(self.vform.name == null ? '' : self.vform.name).trim();
        if (!name) {
          self.busy = false;
          self.showToast('Введите название заведения', 'error');
          return;
        }
        var brandColor = String(self.vform.brand_color || '').trim();
        if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) brandColor = '#6366f1';
        var basePayload = {
          name: name,
          description: String(self.vform.description == null ? '' : self.vform.description).trim() || null,
          logo_url: String(self.vform.logo_url || '').trim() || null,
          brand_color: brandColor || null
        };
        var deliveryPayload = null;
        if (self.perms.delivery) {
          var lat = Number(self.vform.latitude);
          var lng = Number(self.vform.longitude);
          deliveryPayload = {
            address: String(self.vform.address || '').trim() || null,
            delivery_min_order: Math.max(0, Number(self.vform.delivery_min_order) || 0),
            delivery_min_order_free: Math.max(0, Number(self.vform.delivery_min_order_free) || 0),
            delivery_base_fee: Math.max(0, Number(self.vform.delivery_base_fee) || 0),
            delivery_rate_per_km: Math.max(0, Number(self.vform.delivery_rate_per_km) || 0),
            delivery_max_km: Math.max(0, Number(self.vform.delivery_max_km) || 0)
          };
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            deliveryPayload.latitude = lat;
            deliveryPayload.longitude = lng;
            deliveryPayload.lat = lat;
            deliveryPayload.lng = lng;
          }
          if (deliveryPayload.delivery_min_order_free > 0 && deliveryPayload.delivery_min_order_free < deliveryPayload.delivery_min_order) {
            self.busy = false;
            self.showToast('Сумма бесплатной доставки не может быть меньше минимального заказа', 'error');
            return;
          }
        }
        db.from('venues').update(basePayload).eq('id', venueId)
          .then(function(r) {
            if (r.error) throw r.error;
            if (!deliveryPayload) return { data: null, error: null };
            return db.from('venues').update(deliveryPayload).eq('id', venueId);
          })
          .then(function(r) {
            if (r && r.error) {
              console.error('[Manager] saveVenue delivery update:', r.error);
              self.showToast('Основные настройки сохранены, но параметры доставки не сохранены: ' + (r.error.message || String(r.error)), 'error');
            }
            return db.from('venues').select('*').eq('id', venueId).maybeSingle();
          })
          .then(function(r) {
            if (r.error) throw r.error;
            self.venue = r.data;
            var v = r.data || {};
            self.vform = Object.assign({}, self.vform, {
              name: v.name || '',
              description: v.description || '',
              brand_color: v.brand_color || '#6366f1',
              logo_url: v.logo_url || '',
              address: v.address || '',
              latitude: v.latitude != null ? Number(v.latitude) : (v.lat != null ? Number(v.lat) : null),
              longitude: v.longitude != null ? Number(v.longitude) : (v.lng != null ? Number(v.lng) : null),
              delivery_min_order: v.delivery_min_order != null ? Number(v.delivery_min_order) : 0,
              delivery_min_order_free: v.delivery_min_order_free != null ? Number(v.delivery_min_order_free) : 0,
              delivery_base_fee: v.delivery_base_fee != null ? Number(v.delivery_base_fee) : (v.delivery_base_price != null ? Number(v.delivery_base_price) : 0),
              delivery_rate_per_km: v.delivery_rate_per_km != null ? Number(v.delivery_rate_per_km) : (v.delivery_per_km != null ? Number(v.delivery_per_km) : 0),
              delivery_max_km: v.delivery_max_km != null ? Number(v.delivery_max_km) : 0
            });
            self.busy = false;
            self.showToast('Настройки сохранены');
          })
          .catch(function(e) {
            console.error('[Manager] saveVenue:', e);
            self.busy = false;
            self.showToast('Ошибка сохранения: ' + (e.message || String(e)), 'error');
          });
      },

      geocodeVenueAddress: function() {
        var self = this;
        var address = String(this.vform.address || '').trim();
        if (!address) {
          this.showToast('Введите адрес заведения', 'error');
          return;
        }
        this.geoBusy = true;
        this.geoError = '';
        var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ru&q=' + encodeURIComponent(address);
        fetch(url, { headers: { 'Accept': 'application/json' } })
          .then(function(r) {
            if (!r.ok) throw new Error('Не удалось выполнить геокодирование');
            return r.json();
          })
          .then(function(data) {
            if (!Array.isArray(data) || !data.length) {
              throw new Error('Адрес не найден. Уточните город, улицу и номер дома.');
            }
            var item = data[0];
            var lat = Number(item.lat);
            var lon = Number(item.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              throw new Error('Сервис не вернул корректные координаты');
            }
            self.vform.latitude = lat;
            self.vform.longitude = lon;
            if (item.display_name) {
              self.vform.address = item.display_name;
            }
            self.showToast('Координаты заведения определены');
          })
          .catch(function(e) {
            console.error('[Manager] geocode:', e);
            self.geoError = e.message || 'Не удалось определить координаты';
            self.showToast(self.geoError, 'error');
          })
          .finally(function() {
            self.geoBusy = false;
          });
      },

      uploadLogo: function(ev) {
        var self = this;
        var f = ev.target.files[0];
        if (!f) return;
        self.uploadingLogo = true;
        self.resizeImage(f, 512, .9).then(function(blob) {
          var fn = 'logos/' + self.venue.id + '/' + Date.now() + '.jpg';
          return db.storage.from('menu-images').upload(fn, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' }).then(function(r) {
            if (r.error) throw r.error;
            self.vform.logo_url = db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;
            self.showToast('Логотип загружен. Нажмите «Сохранить»');
          });
        }).catch(function(e) { self.showToast('Ошибка: ' + e.message, 'error'); })
          .finally(function() { self.uploadingLogo = false; ev.target.value = ''; });
      },

      downloadQr: function() {
        var self = this;
        var big = 'https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=' + encodeURIComponent(self.clientLink);
        fetch(big).then(function(r) {
          if (!r.ok) throw new Error('fetch');
          return r.blob();
        }).then(function(b) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'qr-' + (self.venue ? self.venue.slug : 'menu') + '.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          self.showToast('QR скачан');
        }).catch(function(e) { window.open(big, '_blank'); });
      }
    }
  };

  window.__QR_MANAGER_SETTINGS_MIXIN__ = settingsMixin;
})();
