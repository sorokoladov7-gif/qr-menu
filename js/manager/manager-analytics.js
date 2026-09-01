/* QR-Menu — аналитика заведения */
(function(){
  'use strict';
  if (window.__QR_MANAGER_ANALYTICS__) return;
  window.__QR_MANAGER_ANALYTICS__ = true;

  var analyticsMixin = {
    data: function() {
      return {
        analyticsPeriod: '7',
        analytics: {
          revenue: 0, orders: 0, clients: 0, avgCheck: 0, avgCookTime: 0,
          newClients: 0, repeatClients: 0, topItems: [], topAddons: [],
          typeStats: { pickup: 0, delivery: 0 },
          payStats: { cash: 0, card: 0 },
          topHours: [], daily: [],
          cooks: [], couriers: [], waiters: []
        }
      };
    },
    computed: {
      maxDaily: function() {
        var mx = 1;
        this.analytics.daily.forEach(function(d) { if (d.count > mx) mx = d.count; });
        return mx;
      }
    },
    methods: {
      loadAnalytics: function() {
        var self = this;
        var q = db.from('orders').select('total_price,customer_phone,status,created_at,order_type,payment_method,cooking_started_at,ready_at,cook_name,courier_name,waiter_name,items:order_items(*),addons:order_addons(*)')
          .eq('venue_id', this.venue.id).neq('status', 'cancelled');
        if (this.analyticsPeriod !== 'all') {
          var d = new Date();
          d.setDate(d.getDate() - parseInt(this.analyticsPeriod));
          q = q.gte('created_at', d.toISOString());
        }
        q.then(function(r) {
          var os = r.data || [];
          var done = os.filter(function(o) { return o.status === 'done'; });
          var rev = 0;
          done.forEach(function(o) { rev += Number(o.total_price || 0); });
          var phoneCount = {};
          os.forEach(function(o) {
            if (o.customer_phone) {
              var p = o.customer_phone.replace(/[^\d]/g, '');
              phoneCount[p] = (phoneCount[p] || 0) + 1;
            }
          });
          var clients = Object.keys(phoneCount).length;
          var repeat = 0;
          Object.keys(phoneCount).forEach(function(p) { if (phoneCount[p] > 1) repeat++; });
          var t = [];
          var cm = {}, im = {}, am = {}, hours = {}, dailyMap = {};
          var pickup = 0, delivery = 0, cash = 0, card = 0;
          var courierMap = {}, waiterMap = {};
          os.forEach(function(o) {
            if (o.order_type === 'delivery') delivery++; else pickup++;
            if (o.payment_method === 'card') card++; else cash++;
            if (o.cooking_started_at && o.ready_at) {
              var m = (new Date(o.ready_at) - new Date(o.cooking_started_at)) / 6e4;
              t.push(m);
              if (o.cook_name) {
                if (!cm[o.cook_name]) cm[o.cook_name] = { name: o.cook_name, count: 0, t: [] };
                cm[o.cook_name].count++;
                cm[o.cook_name].t.push(m);
              }
            }
            (o.items || []).forEach(function(it) {
              if (!im[it.name]) im[it.name] = { name: it.name, count: 0, revenue: 0 };
              im[it.name].count += it.qty;
              im[it.name].revenue += it.qty * Number(it.price || 0);
            });
            (o.addons || []).forEach(function(a) {
              if (!am[a.name]) am[a.name] = { name: a.name, count: 0 };
              am[a.name].count++;
            });
            if (o.created_at) {
              var dt = new Date(o.created_at);
              var hr = dt.getHours();
              hours[hr] = (hours[hr] || 0) + 1;
              var key = dt.toISOString().slice(0, 10);
              if (!dailyMap[key]) dailyMap[key] = 0;
              dailyMap[key]++;
            }
            if (o.status === 'done' && o.courier_name) courierMap[o.courier_name] = (courierMap[o.courier_name] || 0) + 1;
            if (o.status === 'done' && o.waiter_name) waiterMap[o.waiter_name] = (waiterMap[o.waiter_name] || 0) + 1;
          });
          var topHours = Object.keys(hours).map(function(h) {
            var nx = (parseInt(h) + 1);
            return { h: parseInt(h), label: (h < 10 ? '0' + h : h) + ':00–' + (nx < 10 ? '0' + nx : nx) + ':00', count: hours[h] };
          }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);
          var daily = Object.keys(dailyMap).sort().map(function(k) {
            var dt = new Date(k);
            return { date: k, label: (dt.getDate() < 10 ? '0' : '') + dt.getDate() + '.' + (dt.getMonth() + 1 < 10 ? '0' : '') + (dt.getMonth() + 1), count: dailyMap[k] };
          });
          self.analytics = {
            revenue: rev,
            orders: os.length,
            clients: clients,
            avgCheck: done.length ? Math.round(rev / done.length) : 0,
            avgCookTime: t.length ? Math.round(t.reduce(function(a, b) { return a + b; }, 0) / t.length) : 0,
            newClients: clients - repeat,
            repeatClients: repeat,
            topItems: Object.keys(im).map(function(k) { return im[k]; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10),
            topAddons: Object.keys(am).map(function(k) { return am[k]; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5),
            typeStats: { pickup: pickup, delivery: delivery },
            payStats: { cash: cash, card: card },
            topHours: topHours,
            daily: daily,
            cooks: Object.keys(cm).map(function(k) { var c = cm[k]; return { name: c.name, count: c.count, avg: Math.round(c.t.reduce(function(a, b) { return a + b; }, 0) / c.t.length) }; }).sort(function(a, b) { return b.count - a.count; }),
            couriers: Object.keys(courierMap).map(function(k) { return { name: k, count: courierMap[k] }; }).sort(function(a, b) { return b.count - a.count; }),
            waiters: Object.keys(waiterMap).map(function(k) { return { name: k, count: waiterMap[k] }; }).sort(function(a, b) { return b.count - a.count; })
          };
        });
      },

      typePercent: function(t) {
        var s = this.analytics.typeStats;
        var tot = s.pickup + s.delivery;
        return tot ? Math.round(s[t] * 100 / tot) : 0;
      },
      payPercent: function(p) {
        var s = this.analytics.payStats;
        var tot = s.cash + s.card;
        return tot ? Math.round(s[p] * 100 / tot) : 0;
      }
    }
  };

  window.__QR_MANAGER_ANALYTICS_MIXIN__ = analyticsMixin;
})();
