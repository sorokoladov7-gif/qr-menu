/* QR-Menu — общие данные и методы управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_CORE__) return;
  window.__QR_MANAGER_CORE__ = true;

  // Глобальные помощники (если не определены)
  if (!window.fmt) console.warn('utils.js не загружен');

  // Регистрируем общие методы, которые будут использоваться в Vue
  // Они будут добавлены в data, computed, methods через миксины

  // Создаём миксин для core
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

      init: function() {
        var self = this;
        self.loadError = '';
        self.ready = false;
        try {
          if (typeof db === 'undefined') throw new Error('Supabase не подключен');
          if (typeof requireAuth === 'function') {
            requireAuth(['manager', 'admin']).then(function(profile) {
              self.profile = profile;
              if (!profile) { self.ready = true; return; }
              // обновляем last_login
              db.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id).then(function(){});
              // загружаем планы и шаблоны через другие модули
              // они вызовутся в manager-app.js
            });
          } else {
            self.ready = true;
            self.loadError = 'Функция requireAuth не найдена. Проверьте app.js';
          }
        } catch(e) {
          self.loadError = e.message || String(e);
          self.ready = true;
        }
      }
    }
  };

  // Сохраняем миксин глобально
  window.__QR_MANAGER_CORE_MIXIN__ = coreMixin;
})();
