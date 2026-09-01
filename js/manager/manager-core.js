/* QR-Menu — общие данные и методы управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_CORE__) return;
  window.__QR_MANAGER_CORE__ = true;

  var coreMixin = {
    data: function() {
      return {
        ready: false,
        busy: false,
        geoBusy: false,
        geoError: '',
        uploading: false,
        uploadingLogo: false,
        loadError: '',
        profile: null,
        toast: null,
        timer: null,
        DEFAULT_IMG: window.DEFAULT_IMG || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>"
      };
    },
    computed: {
      profileName: function() {
        return this.profile ? this.profile.display_name : '';
      }
    },
    methods: {
      fmt: function(v) { return window.fmt(v); },
      fmtDate: function(d) { return window.fmtDate(d); },
      statusName: function(s) { return window.statusName(s); },
      statusColor: function(s) { return window.statusColor(s); },
      categoryLabel: function(c) { return window.categoryLabel(c); },
      esc: function(s) { return window.esc(s); },
      slugify: function(v) { return window.slugify(v); },
      norm: function(s) { return window.norm(s); },
      copyText: function(t) { window.copyText(t, this.showToast); },

      showToast: function(text, type) {
        type = type || 'ok';
        this.toast = { text: text, type: type };
        var self = this;
        clearTimeout(this._t);
        this._t = setTimeout(function() { self.toast = null; }, 2500);
      },

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
              canvas.toBlob(function(b) { b ? res(b) : rej(new Error('Ошибка сжатия')); }, 'image/jpeg', q);
            };
            img.onerror = function() { rej(new Error('Не удалось загрузить изображение')); };
            img.src = e.target.result;
          };
          reader.onerror = function() { rej(new Error('Ошибка чтения файла')); };
          reader.readAsDataURL(file);
        });
      },

      logout: function() {
        try { db.auth.signOut(); } catch(e) {}
        if (this.timer) clearInterval(this.timer);
        location.href = '/index.html';
      },

      init: async function() {
        var self = this;
        self.loadError = '';
        self.ready = false;
        try {
          if (typeof db === 'undefined') throw new Error('Supabase не подключен');
          if (typeof requireAuth !== 'function') throw new Error('Функция requireAuth не найдена. Проверьте app.js');

          var profile = await requireAuth(['manager', 'admin']);
          self.profile = profile;
          if (!profile) { self.ready = true; return; }

          await db.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);

          var planResult = await db.from('plans').select('*').order('price');
          if (planResult.error) throw planResult.error;
          self.plans = planResult.data || [];

          if (typeof self.loadVenueTemplates === 'function') await self.loadVenueTemplates();
          if (typeof self.loadMyVenues === 'function') await self.loadMyVenues();

          self.ready = true;

          /*
           * ВАЖНО: manager_venue_id хранится в localStorage браузера и переживает
           * выход из аккаунта. Поэтому после входа другого управляющего сохранённый
           * venue_id нельзя считать доверенным, пока он не найден в self.myVenues.
           * Иначе вкладка рецептур отправляет старое заведение в
           * manager_ingredient_list и получает P0001 forbidden.
           */
          var saved = localStorage.getItem('manager_venue_id');
          var selected = null;
          if (saved && self.myVenues && self.myVenues.length) {
            selected = self.myVenues.find(function(v) { return String(v.id) === String(saved); }) || null;
          }

          if (!selected && self.myVenues && self.myVenues.length) {
            try {
              localStorage.removeItem('manager_venue_id');
              localStorage.removeItem('selectedVenueId');
            } catch(e) {}
            selected = self.myVenues[0];
          }

          if (selected && typeof self.selectVenue === 'function') {
            self.selectVenue(selected);
          }
        } catch(e) {
          console.error('[Manager] init:', e);
          self.loadError = e && e.message ? e.message : String(e);
          self.ready = true;
        }
      }
    }
  };

  window.__QR_MANAGER_CORE_MIXIN__ = coreMixin;
})();
