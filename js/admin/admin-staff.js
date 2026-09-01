/* QR-Menu — персонал (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_STAFF__) return;
  window.__QR_ADMIN_STAFF__ = true;

  var staffMixin = {
    data: function() {
      return {
        cooksAll: [],
        couriersAll: [],
        waitersAll: [],
        cookForm: { venue_id: '', name: '', phone: '' },
        courierForm: { venue_id: '', name: '', phone: '' },
        waiterForm: { venue_id: '', name: '', phone: '' },
        staffEditModal: { show: false, table: '', id: null, venue_id: null, name: '', phone: '', pin: '' }
      };
    },
    methods: {
      genPin: function(list) {
        var pin, a = 0;
        do { pin = String(Math.floor(1000 + Math.random() * 9000)); a++; }
        while (list.some(function(c) { return c.pin === pin; }) && a < 10);
        return pin;
      },

      addCookAdmin: function() {
        var self = this;
        var pin = this.genPin(self.cooksAll);
        db.from('cooks').insert({ venue_id: self.cookForm.venue_id, name: self.cookForm.name, phone: self.cookForm.phone || null, pin: pin }).then(function() {
          alert('Повар добавлен! PIN: ' + pin);
          self.cookForm = { venue_id: '', name: '', phone: '' };
          self.loadBaseData();
        });
      },

      addCourierAdmin: function() {
        var self = this;
        var pin = this.genPin(self.couriersAll);
        db.from('couriers').insert({ venue_id: self.courierForm.venue_id, name: self.courierForm.name, phone: self.courierForm.phone || null, pin: pin }).then(function() {
          alert('Курьер добавлен! PIN: ' + pin);
          self.courierForm = { venue_id: '', name: '', phone: '' };
          self.loadBaseData();
        });
      },

      addWaiterAdmin: function() {
        var self = this;
        var pin = this.genPin(self.waitersAll);
        db.from('waiters').insert({ venue_id: self.waiterForm.venue_id, name: self.waiterForm.name, phone: self.waiterForm.phone || null, pin: pin }).then(function() {
          alert('Официант добавлен! PIN: ' + pin);
          self.waiterForm = { venue_id: '', name: '', phone: '' };
          self.loadBaseData();
        });
      },

      delCook: function(c) {
        var self = this;
        if (!confirm('Удалить повара ' + c.name + '?')) return;
        db.from('cooks').delete().eq('id', c.id).then(function() { self.loadBaseData(); });
      },

      delCourier: function(c) {
        var self = this;
        if (!confirm('Удалить курьера ' + c.name + '?')) return;
        db.from('couriers').delete().eq('id', c.id).then(function() { self.loadBaseData(); });
      },

      delWaiter: function(w) {
        var self = this;
        if (!confirm('Удалить официанта ' + w.name + '?')) return;
        db.from('waiters').delete().eq('id', w.id).then(function() { self.loadBaseData(); });
      },

      openStaffEdit: function(table, obj) {
        this.staffEditModal = { show: true, table: table, id: obj.id, venue_id: obj.venue_id, name: obj.name, phone: obj.phone || '', pin: obj.pin };
      },

      saveStaffEdit: function() {
        var self = this;
        var m = this.staffEditModal;
        db.from(m.table).update({ venue_id: m.venue_id, name: m.name, phone: m.phone || null, pin: m.pin }).eq('id', m.id).then(function() {
          self.staffEditModal.show = false;
          self.loadBaseData();
        });
      }
    }
  };

  window.__QR_ADMIN_STAFF_MIXIN__ = staffMixin;
})();
