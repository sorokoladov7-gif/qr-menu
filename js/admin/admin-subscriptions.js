/* QR-Menu — тарифы, подписки, оплаты (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_SUBSCRIPTIONS__) return;
  window.__QR_ADMIN_SUBSCRIPTIONS__ = true;

  var subsMixin = {
    data: function() {
      return {
        subscriptions: [],
        plans: []
      };
    },
    computed: {
      mrr: function() {
        var self = this, seen = {};
        return (this.subscriptions || []).filter(function(s) {
          return s && s.manager_id && ['active','trialing'].indexOf(s.status) !== -1 && s.current_period_end && new Date(s.current_period_end) >= new Date();
        }).reduce(function(sum, s) {
          if (seen[s.manager_id]) return sum;
          seen[s.manager_id] = true;
          var p = self.plans.find(function(x) { return x.id === s.plan_id; });
          return sum + (p ? Number(p.price) || 0 : 0);
        }, 0);
      },
      subStats: function() {
        var now = new Date(), active = 0, trial = 0, expired = 0, expiring = 0;
        var list = this.subscriptions || [];
        list.forEach(function(s) {
          if (!s || !s.manager_id) return;
          var e = s.current_period_end ? new Date(s.current_period_end) : null;
          if (s.status === 'trialing' && e && e >= now) trial++;
          if (e && e >= now && ['active','trialing'].indexOf(s.status) !== -1) {
            active++;
            var soon = new Date(); soon.setDate(soon.getDate() + 7);
            if (e < soon) expiring++;
          } else expired++;
        });
        return { total:list.filter(function(s){return s && s.manager_id;}).length, active:active, trial:trial, expired:expired, expiringSoon:expiring };
      },
      venueSubs: function() {
        var self = this;
        return (this.subscriptions || []).filter(function(s){return s && s.manager_id;}).map(function(s) {
          var m = self.managers.find(function(x){return x.id === s.manager_id;}) || {};
          var p = self.plans.find(function(x){return x.id === s.plan_id;});
          var ids = (self.links || []).filter(function(l){return l.manager_id === s.manager_id;}).map(function(l){return l.venue_id;});
          var ords = self.ordersAll.filter(function(o){return ids.indexOf(o.venue_id)!==-1 && o.status==='done';});
          var rev = ords.reduce(function(sum,o){return sum + Number(o.total_price || 0);},0);
          var names = ids.map(function(id){var v=self.venues.find(function(x){return x.id===id;});return v?v.name:null;}).filter(Boolean);
          return { id:s.id, manager_id:s.manager_id, name:m.display_name||m.email||s.manager_id, slug:m.email||'управляющий', planName:p?p.name:'—', subscription_end:s.current_period_end, status:s.status, totalOrders:ords.length, totalRevenue:rev, plan_id:s.plan_id, venueNames:names };
        });
      },
      planStats: function() {
        var self = this, now = new Date();
        return this.plans.map(function(p) {
          var ss = (self.subscriptions || []).filter(function(s){return s && s.manager_id && s.plan_id === p.id;});
          var active = ss.filter(function(s){return ['active','trialing'].indexOf(s.status)!==-1 && s.current_period_end && new Date(s.current_period_end)>now;}).length;
          return { id:p.id, name:p.name, price:Number(p.price)||0, count:ss.length, active:active, mrr:active*(Number(p.price)||0), is_public:p.is_public !== false };
        });
      }
    },
    methods: {
      subClass: function(v) {
        if (!v.subscription_end) return 'b-off';
        var e = new Date(v.subscription_end);
        var d = (e - new Date()) / 864e5;
        return e < new Date() ? 'b-off' : d <= 3 ? 'b-trial' : 'b-on';
      },
      subLabel: function(v) {
        if (!v.subscription_end) return 'Нет';
        var e = new Date(v.subscription_end);
        var d = (e - new Date()) / 864e5;
        return e < new Date() ? 'Истекла' : d <= 3 ? 'Осталось ' + Math.ceil(d) + ' дн' : 'Активна';
      },

      changeManagerPlan: async function(m, plan) {
        var managerId = m && m.id;
        var planId = String(plan || '').trim();
        if (!managerId) { this.msg = 'Не найден управляющий'; return; }
        if (!planId) { this.msg = 'Выберите тариф'; return; }
        var selectedPlan = (this.plans || []).find(function(p){ return p.id === planId; });
        if (!selectedPlan) { this.msg = 'Выбранный тариф не найден'; return; }
        this.busy = true;
        try {
          var r = await db.rpc('admin_set_manager_plan', {
            p_manager_id: managerId,
            p_plan_id: planId,
            p_days: null
          });
          if (r.error) throw r.error;
          await this.loadBaseData();
          this.msg = 'Тариф «' + selectedPlan.name + '» назначен управляющему';
        } catch(e) {
          this.msg = 'Ошибка сохранения тарифа: ' + (e.message || e);
        } finally {
          this.busy = false;
        }
      },

      extendManagerSub: async function(m, days) {
        var managerId = m && m.id;
        days = Number(days) || 30;
        if (!managerId) { this.msg = 'Не найден управляющий'; return; }
        this.busy = true;
        try {
          var r = await db.rpc('admin_extend_manager_subscription', {
            p_manager_id: managerId,
            p_days: days
          });
          if (r.error) throw r.error;
          await this.loadBaseData();
          this.msg = 'Подписка продлена на ' + days + ' дней';
        } catch(e) {
          this.msg = 'Ошибка продления: ' + (e.message || e);
        } finally {
          this.busy = false;
        }
      },

      changePlan: async function(v, plan) {
        if (!v || !v.id) return;
        var r = await db.from('manager_venues')
          .select('manager_id')
          .eq('venue_id', v.id)
          .limit(1)
          .maybeSingle();
        if (r.error || !r.data) {
          this.msg = 'Не найден управляющий для заведения';
          return;
        }
        return this.changeManagerPlan({ id: r.data.manager_id }, plan);
      },

      extendSub: async function(v) {
        if (!v || !v.id) return;
        var r = await db.from('manager_venues')
          .select('manager_id')
          .eq('venue_id', v.id)
          .limit(1)
          .maybeSingle();
        if (r.error || !r.data) {
          this.msg = 'Не найден управляющий для заведения';
          return;
        }
        return this.extendManagerSub({ id: r.data.manager_id }, 30);
      },

      createPlan: function() {
        var stamp = Date.now().toString(36);
        var id = 'custom_' + stamp;
        var maxSort = (this.plans || []).reduce(function(max,p){ return Math.max(max, Number(p.sort_order)||0); },0);
        this.plans.push({
          id: id,
          name: 'Новый индивидуальный тариф',
          price: 0,
          period: 'month',
          features: [],
          max_products: 10,
          max_cooks: 1,
          max_venues: 1,
          max_managers: 1,
          max_couriers: 1,
          max_waiters: 1,
          is_active: true,
          is_public: false,
          sort_order: maxSort + 1,
          __draft: true
        });
        this.$nextTick(function(){
          var cards = document.querySelectorAll('.plans-grid > .card');
          if (cards.length) cards[cards.length - 1].scrollIntoView({behavior:'smooth', block:'nearest'});
        });
      },

      savePlan: async function(plan) {
        if (!plan) return;
        var name = String(plan.name || '').trim();
        if (!name) { this.msg = 'Укажите название тарифа'; return; }
        var id = String(plan.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'_');
        if (!id) { this.msg = 'Некорректный идентификатор тарифа'; return; }
        this.busy = true;
        try {
          var payload = {
            id:id,
            name:name,
            price:Number(plan.price)||0,
            period:plan.period || 'month',
            features:Array.isArray(plan.features) ? plan.features : [],
            max_products:Math.max(1,Number(plan.max_products)||1),
            max_cooks:Math.max(1,Number(plan.max_cooks)||1),
            max_venues:Math.max(1,Number(plan.max_venues)||1),
            max_managers:Math.max(1,Number(plan.max_managers)||1),
            max_couriers:Math.max(1,Number(plan.max_couriers)||1),
            max_waiters:Math.max(1,Number(plan.max_waiters)||1),
            is_active:plan.is_active !== false,
            is_public:plan.is_public !== false,
            sort_order:Number(plan.sort_order)||0
          };
          var exists = (this.plans || []).some(function(p){return p !== plan && p.id === id && !p.__draft;});
          if (exists) throw new Error('Тариф с таким ID уже существует');
          var r = plan.__draft
            ? await db.from('plans').insert(payload)
            : await db.from('plans').update(payload).eq('id', plan.id);
          if (r.error) throw r.error;
          delete plan.__draft;
          plan.id = id;
          this.msg = 'Тариф «' + name + '» сохранён';
          await this.loadBaseData();
        } catch(e) {
          this.msg = 'Ошибка сохранения тарифа: ' + (e.message || e);
        } finally { this.busy = false; }
      },

      togglePlanVisibility: async function(plan) {
        if (!plan || !plan.id || plan.__draft) {
          if (plan) plan.is_public = plan.is_public === false;
          return;
        }
        var next = plan.is_public === false;
        this.busy = true;
        try {
          var r = await db.from('plans').update({is_public:next}).eq('id', plan.id);
          if (r.error) throw r.error;
          plan.is_public = next;
          this.msg = next ? 'Тариф «' + plan.name + '» теперь видим управляющим' : 'Тариф «' + plan.name + '» скрыт от управляющих';
        } catch(e) {
          this.msg = 'Ошибка изменения видимости: ' + (e.message || e);
        } finally { this.busy = false; }
      },

      delPlan: async function(plan) {
        if (!plan || !plan.id) return;
        if (plan.__draft) { this.plans = this.plans.filter(function(p){return p !== plan;}); return; }
        var used = (this.subscriptions || []).some(function(s){return s && s.plan_id === plan.id;});
        if (used) { this.msg = 'Тариф нельзя удалить: он назначен управляющему. Сначала назначьте ему другой тариф.'; return; }
        if (!confirm('Удалить тариф «' + plan.name + '»?')) return;
        this.busy = true;
        try {
          var r = await db.from('plans').delete().eq('id', plan.id);
          if (r.error) throw r.error;
          this.plans = this.plans.filter(function(p){return p.id !== plan.id;});
          this.msg = 'Тариф удалён';
        } catch(e) {
          this.msg = 'Ошибка удаления тарифа: ' + (e.message || e);
        } finally { this.busy = false; }
      }
    }
  };

  window.__QR_ADMIN_SUBSCRIPTIONS_MIXIN__ = subsMixin;

  /* Добавляем в существующий шаблон индикатор и переключатель видимости до компиляции Vue. */
  function enhancePlanCards() {
    var root = document.querySelector('.plans-grid');
    if (!root || root.getAttribute('data-plan-visibility-enhanced') === '1') return;
    root.setAttribute('data-plan-visibility-enhanced','1');
    var card = root.children && root.children[0];
    if (!card) return;
    var saveButton = Array.prototype.find.call(card.querySelectorAll('button'), function(b){ return (b.textContent||'').indexOf('Сохранить тариф') !== -1; });
    if (!saveButton) return;
    var box = document.createElement('div');
    box.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.025);';
    box.innerHTML = '<span style="font-size:12px;color:#94a3b8">{{ p.is_public === false ? \'Тариф скрыт от управляющих\' : \'Тариф видим управляющим\' }}</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" v-on:click="togglePlanVisibility(p)" v-bind:disabled="busy">{{ p.is_public === false ? \'🙈 Скрыт\' : \'👁 Видим\' }}</button>';
    saveButton.parentNode.insertBefore(box, saveButton);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhancePlanCards, {once:true});
  else enhancePlanCards();
})();
