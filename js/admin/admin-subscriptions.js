/* QR-Menu — подписки и аналитика (админ) */
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
        var self = this;
        return this.venues.filter(function(v) { return v.status === 'active'; }).reduce(function(s, v) {
          var p = self.plans.find(function(x) { return x.id === v.plan; });
          return s + (p ? Number(p.price) : 0);
        }, 0);
      },
      subStats: function() {
        var self = this;
        var now = new Date();
        var soon = new Date(); soon.setDate(soon.getDate() + 7);
        var act = 0, trial = 0, expired = 0, expiring = 0;
        this.venues.forEach(function(v) {
          if (!v.subscription_end) { expired++; return; }
          var e = new Date(v.subscription_end);
          if (e < now) expired++;
          else {
            act++;
            if (e < soon) expiring++;
            var sub = self.subscriptions.find(function(s) { return s.venue_id === v.id; });
            if (sub && sub.status === 'trialing') trial++;
          }
        });
        return { active: act, trial: trial, expired: expired, expiringSoon: expiring };
      },
      venueSubs: function() {
        var self = this;
        return this.venues.map(function(v) {
          var pl = self.plans.find(function(p) { return p.id === v.plan; });
          var ords = self.ordersAll.filter(function(o) { return o.venue_id === v.id && o.status === 'done'; });
          var rev = ords.reduce(function(s, o) { return s + Number(o.total_price || 0); }, 0);
          return {
            id: v.id, name: v.name, slug: v.slug,
            planName: pl ? pl.name : '—',
            subscription_end: v.subscription_end,
            status: v.status,
            totalOrders: ords.length,
            totalRevenue: rev,
            plan_id: v.plan
          };
        });
      },
      planStats: function() {
        var self = this;
        return this.plans.map(function(p) {
          var vs = self.venues.filter(function(v) { return v.plan === p.id; });
          var now = new Date();
          var act = vs.filter(function(v) { return v.subscription_end && new Date(v.subscription_end) > now && v.status === 'active'; }).length;
          return { id: p.id, name: p.name, price: Number(p.price) || 0, count: vs.length, active: act, mrr: act * (Number(p.price) || 0) };
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
      }
    }
  };

  window.__QR_ADMIN_SUBSCRIPTIONS_MIXIN__ = subsMixin;
})();
