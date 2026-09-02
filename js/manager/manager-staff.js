/* QR-Menu — персонал (повара, курьеры, официанты) */
(function(){
  'use strict';
  if (window.__QR_MANAGER_STAFF__) return;
  window.__QR_MANAGER_STAFF__ = true;

  var staffMixin = {
    data: function() {
      return {
        cooks: [],
        couriers: [],
        waiters: [],
        staffAnalytics: { period_days: 30, cooks: [], couriers: [], waiters: [] },
        staffAnalyticsDays: '30',
        createStaffModal: false,
        createStaffType: null,
        createStaffForm: { name: '', phone: '', pin: '' },
        createStaffBusy: false,
        createStaffError: ''
      };
    },
    computed: {
      maxCooks: function() { return this.currentPlan ? this.currentPlan.max_cooks : 999; },
      maxCouriers: function() { return this.currentPlan && this.currentPlan.max_couriers ? this.currentPlan.max_couriers : 999; },
      maxWaiters: function() { return this.currentPlan && this.currentPlan.max_waiters ? this.currentPlan.max_waiters : 999; }
    },
    methods: {
      loadCooks: function() {
        var self = this;
        return db.from('cooks').select('id,name,phone,venue_id,created_at').eq('venue_id', this.venue.id).order('created_at').then(function(r) { self.cooks = r.data || []; });
      },
      loadCouriers: function() {
        var self = this;
        return db.from('couriers').select('id,name,phone,venue_id,created_at').eq('venue_id', this.venue.id).order('created_at').then(function(r) { self.couriers = r.data || []; });
      },
      loadWaiters: function() {
        var self = this;
        return db.from('waiters').select('id,name,phone,venue_id,created_at').eq('venue_id', this.venue.id).order('created_at').then(function(r) { self.waiters = r.data || []; });
      },
      loadStaffAnalytics: function() {
        var self = this;
        if (!this.venue) return;
        var days = parseInt(this.staffAnalyticsDays) || 30;
        db.rpc('manager_staff_performance', { p_venue_id: this.venue.id, p_days: days }).then(function(r) {
          if (r.error) { console.warn('staff analytics:', r.error.message || r.error); return; }
          if (r.data) self.staffAnalytics = r.data;
        }).catch(function(e) { console.warn('staff analytics exception:', e); });
      },
      getStaffPhone: function(type, name) {
        var arr = type === 'cook' ? this.cooks : (type === 'courier' ? this.couriers : this.waiters);
        var found = arr.find(function(item) { return item.name === name; });
        return found ? found.phone || '' : '';
      },
      generateRandomPin: function() { this.createStaffForm.pin = String(Math.floor(1000 + Math.random() * 9000)); },

      /* Backend is the single source of truth for manager-wide staff quotas. */
      openCreateStaff: function(type) {
        if (!this.venue || !this.profile) return;
        if (type !== 'cook' && type !== 'courier' && type !== 'waiter') return;
        this.createStaffType = type;
        this.createStaffForm = { name: '', phone: '', pin: String(Math.floor(1000 + Math.random() * 9000)) };
        this.createStaffError = '';
        this.createStaffBusy = false;
        this.createStaffModal = true;
      },

      saveStaff: function() {
        var self = this;
        if (!this.createStaffForm.name.trim()) { this.createStaffError = 'Укажите имя'; return; }
        if (!/^[0-9]{4}$/.test(this.createStaffForm.pin)) { this.createStaffError = 'PIN должен быть из 4 цифр'; return; }
        this.createStaffBusy = true;
        this.createStaffError = '';
        db.rpc('manager_create_staff', {
          p_venue_id: this.venue.id,
          p_type: this.createStaffType,
          p_name: this.createStaffForm.name.trim(),
          p_phone: this.createStaffForm.phone.trim() || null,
          p_pin: this.createStaffForm.pin
        }).then(function(r) {
          self.createStaffBusy = false;
          if (r.error) { self.createStaffError = r.error.message || 'Ошибка создания'; return; }
          var pin = self.createStaffForm.pin;
          var name = self.createStaffForm.name;
          var type = self.createStaffType;
          var typeRu = type === 'cook' ? 'Повар' : (type === 'courier' ? 'Курьер' : 'Официант');
          self.createStaffModal = false;
          alert('✅ ' + typeRu + ' ' + name + ' добавлен!\n🔑 PIN: ' + pin + '\n⚠️ Сообщите PIN сотруднику сейчас.\nЭтот PIN больше не будет показан.');
          if (type === 'cook') self.loadCooks();
          else if (type === 'courier') self.loadCouriers();
          else self.loadWaiters();
          self.loadStaffAnalytics();
          self.showToast(typeRu + ' добавлен');
        }).catch(function(e) {
          self.createStaffBusy = false;
          self.createStaffError = 'Ошибка: ' + (e.message || String(e));
        });
      },

      resetStaffPin: function(staff, type) {
        var self = this;
        var typeRu = type === 'cook' ? 'повара' : (type === 'courier' ? 'курьера' : 'официанта');
        if (!confirm('Сбросить PIN у ' + staff.name + ' (' + typeRu + ')?\nНовый PIN будет показан только один раз.')) return;
        self.busy = true;
        db.rpc('manager_reset_staff_pin', {
          p_venue_id: this.venue.id,
          p_staff_id: staff.id,
          p_type: type
        }).then(function(r) {
          self.busy = false;
          if (r.error) { self.showToast('Ошибка: ' + (r.error.message || r.error), 'error'); return; }
          var newPin = r.data && r.data.pin ? r.data.pin : '';
          if (!newPin) { self.showToast('Ошибка: сервер не вернул новый PIN', 'error'); return; }
          alert('✅ Новый PIN для ' + staff.name + ':\n🔑 ' + newPin + '\n⚠️ Сообщите PIN сотруднику сейчас.\nЭтот PIN больше не будет показан.');
          self.loadStaffAnalytics();
        }).catch(function(e) {
          self.busy = false;
          self.showToast('Ошибка: ' + (e.message || String(e)), 'error');
        });
      },

      delCook: function(c) {
        if (!confirm('Удалить повара ' + c.name + '?')) return;
        var self = this;
        db.from('cooks').delete().eq('id', c.id).then(function() { self.loadCooks(); self.loadStaffAnalytics(); self.showToast('Удалено'); });
      },
      delCourier: function(c) {
        if (!confirm('Удалить курьера ' + c.name + '?')) return;
        var self = this;
        db.from('couriers').delete().eq('id', c.id).then(function() { self.loadCouriers(); self.loadStaffAnalytics(); self.showToast('Удалено'); });
      },
      delWaiter: function(w) {
        if (!confirm('Удалить официанта ' + w.name + '?')) return;
        var self = this;
        db.from('waiters').delete().eq('id', w.id).then(function() { self.loadWaiters(); self.loadStaffAnalytics(); self.showToast('Удалено'); });
      },
      copyCookAccess: function(c) { this.copyText('Вход для повара ' + c.name + ':\nСайт: ' + location.origin + '/cook.html\nКод заведения: ' + this.venue.slug + '\nНажмите «🔄 PIN» чтобы сгенерировать новый PIN.'); },
      copyCourierAccess: function(c) { this.copyText('Вход для курьера ' + c.name + ':\nСайт: ' + location.origin + '/courier.html\nКод заведения: ' + this.venue.slug + '\nНажмите «🔄 PIN» чтобы сгенерировать новый PIN.'); },
      copyWaiterAccess: function(w) { this.copyText('Вход для официанта ' + w.name + ':\nСайт: ' + location.origin + '/waiter.html\nКод заведения: ' + this.venue.slug + '\nНажмите «🔄 PIN» чтобы сгенерировать новый PIN.'); }
    }
  };

  window.__QR_MANAGER_STAFF_MIXIN__ = staffMixin;
})();
