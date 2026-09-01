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

  /*
   * Manager-specific tariff persistence.
   * admin-app.js historically wraps Vue.createApp and injects its own
   * changeManagerPlan implementation. This wrapper runs after app.js is
   * loaded and replaces that implementation with one that updates the
   * existing manager subscription row instead of recreating it through
   * upsert, then synchronizes venue cache values.
   */
  if (window.Vue && typeof Vue.createApp === 'function' && !window.__QR_ADMIN_MANAGER_PLAN_PATCH__) {
    window.__QR_ADMIN_MANAGER_PLAN_PATCH__ = true;
    var originalCreateApp = Vue.createApp;
    Vue.createApp = function(options) {
      if (options && typeof options === 'object') {
        options.methods = options.methods || {};
        options.methods.changeManagerPlan = async function(m, plan) {
          var self = this;
          var managerId = m && m.id;
          var planId = String(plan || '').trim();
          if (!managerId) { self.msg = 'Не найден управляющий'; return; }
          if (!planId) { self.msg = 'Выберите тариф'; return; }

          var selectedPlan = (self.plans || []).find(function(p) { return p.id === planId; });
          if (!selectedPlan) { self.msg = 'Выбранный тариф не найден'; return; }

          self.busy = true;
          try {
            var existing = (self.subscriptions || []).find(function(s) {
              return s && s.manager_id === managerId;
            });

            var currentEnd = existing && existing.current_period_end
              ? existing.current_period_end
              : new Date(Date.now() + 5 * 864e5).toISOString();

            var payload = {
              manager_id: managerId,
              plan_id: planId,
              status: existing && existing.status ? existing.status : 'active',
              current_period_end: currentEnd
            };

            var result;
            if (existing && existing.id) {
              result = await db.from('subscriptions')
                .update(payload)
                .eq('id', existing.id)
                .eq('manager_id', managerId);
            } else {
              var firstVenue = (self.links || []).find(function(l) { return l.manager_id === managerId; });
              result = await db.from('subscriptions').insert({
                manager_id: managerId,
                venue_id: firstVenue ? firstVenue.venue_id : null,
                plan_id: planId,
                status: 'active',
                current_period_end: currentEnd
              });
            }

            if (result.error) throw result.error;

            var ids = (self.links || [])
              .filter(function(l) { return l.manager_id === managerId; })
              .map(function(l) { return l.venue_id; })
              .filter(Boolean);

            if (ids.length) {
              var venueResult = await db.from('venues').update({ plan: planId }).in('id', ids);
              if (venueResult.error) throw venueResult.error;
            }

            await self.loadBaseData();
            var saved = (self.subscriptions || []).find(function(s) { return s.manager_id === managerId; });
            if (!saved || saved.plan_id !== planId) {
              throw new Error('Тариф не подтвердился после сохранения');
            }
            self.msg = 'Тариф «' + selectedPlan.name + '» назначен управляющему';
          } catch (e) {
            self.msg = 'Ошибка сохранения тарифа: ' + (e.message || String(e));
          } finally {
            self.busy = false;
          }
        };
      }
      return originalCreateApp.apply(this, arguments);
    };
  }
})();
