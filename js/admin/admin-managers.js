/* QR-Menu — управляющие (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_MANAGERS__) return;
  window.__QR_ADMIN_MANAGERS__ = true;

  var managersMixin = {
    data: function() {
      return {
        managers: [],
        links: [],
        managerPeriods: {},
        addMgrModal: { show: false, name: '', email: '', password: '', role: 'manager', err: '' },
        mgrEditModal: { show: false, id: null, name: '', role: 'manager', allow_manage_delivery: false, allow_manage_design: false }
      };
    },
    computed: {
      managerVenuesMap: function() {
        var map = {};
        var self = this;
        this.managers.forEach(function(m) {
          var venueIds = self.links.filter(function(l) { return l.manager_id === m.id; }).map(function(l) { return l.venue_id; });
          var venues = venueIds.map(function(vid) {
            return self.venues.find(function(v) { return v.id === vid; });
          }).filter(function(v) { return v !== undefined; });
          map[m.id] = venues;
        });
        return map;
      }
    },
    methods: {
      addManager: function() {
        var self = this;
        self.busy = true;
        self.addMgrModal.err = '';
        var temp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, storageKey: 'admin-temp', autoRefreshToken: false, detectSessionInUrl: false }
        });
        temp.auth.signUp({
          email: self.addMgrModal.email,
          password: self.addMgrModal.password,
          options: { data: { display_name: self.addMgrModal.name, role: self.addMgrModal.role } }
        }).then(function(r) {
          self.busy = false;
          if (r.error) { self.addMgrModal.err = 'Ошибка: ' + r.error.message; return; }
          alert('Аккаунт создан! Передайте данные менеджеру.');
          self.addMgrModal.show = false;
          self.addMgrModal = { show: false, name: '', email: '', password: '', role: 'manager', err: '' };
          self.loadBaseData();
        });
      },

      openMgrEdit: function(m) {
        this.mgrEditModal = { show: true, id: m.id, name: m.display_name, role: m.role, allow_manage_delivery: !!m.allow_manage_delivery, allow_manage_design: !!m.allow_manage_design };
      },

      saveMgrEdit: function() {
        var self = this;
        db.from('profiles').update({
          display_name: self.mgrEditModal.name,
          role: self.mgrEditModal.role,
          allow_manage_delivery: self.mgrEditModal.allow_manage_delivery,
          allow_manage_design: self.mgrEditModal.allow_manage_design
        }).eq('id', self.mgrEditModal.id).then(function() {
          self.mgrEditModal.show = false;
          self.loadBaseData();
        });
      },

      toggleMgrVenue: function(mid, vid, on) {
        var self = this;
        var p = on ? db.from('manager_venues').insert({ manager_id: mid, venue_id: vid })
                   : db.from('manager_venues').delete().eq('manager_id', mid).eq('venue_id', vid);
        p.then(function() { self.loadBaseData(); });
      },

      delManager: function(m) {
        var self = this;
        if (!confirm('Удалить управляющего ' + m.display_name + '?')) return;
        db.from('manager_venues').delete().eq('manager_id', m.id).then(function() {
          return db.from('profiles').delete().eq('id', m.id);
        }).then(function() { self.loadBaseData(); });
      },

      isAssigned: function(m, v) {
        return this.links.some(function(l) { return l.manager_id === m && l.venue_id === v; });
      }
    }
  };

  window.__QR_ADMIN_MANAGERS_MIXIN__ = managersMixin;
})();