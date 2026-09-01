/* QR-Menu — глобальная статистика и аналитика (админ) */
(function(){
  'use strict';
  if (window.__QR_ADMIN_STATISTICS__) return;
  window.__QR_ADMIN_STATISTICS__ = true;

  var statsMixin = {
    data: function() {
      return {
        globalStats: { revenue: 0, orders: 0, clients: 0, venueStats: [] },
        adminAnalyticsPeriod: '30',
        adminAnalytics: {
          revenue: 0, orders: 0, clients: 0, repeatClients: 0, newClients: 0,
          avgCheck: 0, avgCookTime: 0,
          pickup: 0, delivery: 0, cash: 0, card: 0,
          topItems: [], topAddons: [], topHours: [], daily: [],
          mrr: 0, churnRate: 0, arpu: 0, trialConversion: 0, planDist: [],
          venueActivity: [], managerActivity: [],
          cookActivity: [], courierActivity: [], waiterActivity: []
        }
      };
    },
    methods: {
      loadGlobalStats: function() {
        var self = this;
        var q = db.from('orders').select('venue_id,total_price,customer_phone,cooking_started_at,ready_at,venues(name)').eq('status','done');
        if (self.statsPeriod !== 'all') {
          var d = new Date();
          d.setDate(d.getDate() - parseInt(self.statsPeriod));
          q = q.gte('created_at', d.toISOString());
        }
        q.then(function(r) {
          var orders = r.data || [];
          var rev = 0, ph = {}, m = {};
          orders.forEach(function(o) {
            rev += Number(o.total_price || 0);
            if (o.customer_phone) ph[o.customer_phone.replace(/[^\d]/g,'')] = 1;
            if (!m[o.venue_id]) m[o.venue_id] = { id: o.venue_id, name: o.venues ? o.venues.name : '—', revenue: 0, orders: 0, clients: {}, t: [] };
            m[o.venue_id].revenue += Number(o.total_price || 0);
            m[o.venue_id].orders++;
            if (o.customer_phone) m[o.venue_id].clients[o.customer_phone.replace(/[^\d]/g,'')] = 1;
            if (o.cooking_started_at && o.ready_at) m[o.venue_id].t.push((new Date(o.ready_at) - new Date(o.cooking_started_at)) / 6e4);
          });
          self.globalStats = {
            revenue: rev,
            orders: orders.length,
            clients: Object.keys(ph).length,
            venueStats: Object.values(m).map(function(v) {
              return {
                id: v.id, name: v.name, revenue: v.revenue, orders: v.orders,
                clients: Object.keys(v.clients).length,
                avgCheck: v.orders ? Math.round(v.revenue / v.orders) : 0,
                avgCookTime: v.t.length ? Math.round(v.t.reduce(function(a,b){ return a+b; },0) / v.t.length) : 0
              };
            }).sort(function(a,b){ return b.revenue - a.revenue; })
          };
        });
      },

      loadAdminAnalytics: function() {
        var self = this;
        var period = this.adminAnalyticsPeriod;
        var baseUrl = db.from('orders')
          .select('venue_id,total_price,status,created_at,order_type,payment_method,cook_name,courier_name,waiter_name,cooking_started_at,ready_at,customer_phone')
          .neq('status','cancelled');
        if (period !== 'all') {
          var d2 = new Date();
          d2.setDate(d2.getDate() - parseInt(period));
          baseUrl = baseUrl.gte('created_at', d2.toISOString());
        }
        baseUrl.then(function(r) {
          if (r.error) { console.error('Ошибка загрузки аналитики:', r.error); return; }
          var os = r.data || [];
          if (!os.length) {
            self.adminAnalytics = { revenue: 0, orders: 0, clients: 0, repeatClients: 0, newClients: 0, avgCheck: 0, avgCookTime: 0, pickup: 0, delivery: 0, cash: 0, card: 0, topItems: [], topAddons: [], topHours: [], daily: [], mrr: self.mrr, churnRate: 0, arpu: 0, trialConversion: 0, planDist: [], venueActivity: [], managerActivity: [], cookActivity: [], courierActivity: [], waiterActivity: [] };
            return;
          }
          var done = os.filter(function(o){ return o.status === 'done'; });
          var rev = 0;
          done.forEach(function(o){ rev += Number(o.total_price || 0); });
          var phoneCount = {};
          os.forEach(function(o){ if (o.customer_phone) { var p = o.customer_phone.replace(/[^\d]/g,''); phoneCount[p] = (phoneCount[p] || 0) + 1; } });
          var clients = Object.keys(phoneCount).length;
          var repeat = 0;
          Object.keys(phoneCount).forEach(function(p){ if (phoneCount[p] > 1) repeat++; });
          var t = [], hours = {}, dailyMap = {};
          var pickup = 0, delivery = 0, cash = 0, card = 0;
          os.forEach(function(o) {
            if (o.order_type === 'delivery') delivery++; else pickup++;
            if (o.payment_method === 'card') card++; else cash++;
            if (o.cooking_started_at && o.ready_at) t.push((new Date(o.ready_at) - new Date(o.cooking_started_at)) / 6e4);
            if (o.created_at) {
              var dt = new Date(o.created_at);
              var hr = dt.getHours();
              hours[hr] = (hours[hr] || 0) + 1;
              var key = dt.toISOString().slice(0,10);
              if (!dailyMap[key]) dailyMap[key] = 0;
              dailyMap[key]++;
            }
          });
          var topHours = Object.keys(hours).map(function(h) {
            var nx = parseInt(h) + 1;
            return { h: parseInt(h), label: (h < 10 ? '0' + h : h) + ':00–' + (nx < 10 ? '0' + nx : nx) + ':00', count: hours[h] };
          }).sort(function(a,b){ return b.count - a.count; }).slice(0,5);
          var daily = Object.keys(dailyMap).sort().map(function(k) {
            var dt = new Date(k);
            return { date: k, label: (dt.getDate() < 10 ? '0' : '') + dt.getDate() + '.' + (dt.getMonth() + 1 < 10 ? '0' : '') + (dt.getMonth() + 1), count: dailyMap[k] };
          });
          var totalVenues = self.venues.length;
          var planDist = self.plans.map(function(p) {
            var vs = self.venues.filter(function(v){ return v.plan === p.id; });
            var now = new Date();
            var act = vs.filter(function(v){ return v.subscription_end && new Date(v.subscription_end) > now && v.status === 'active'; }).length;
            return { id: p.id, name: p.name, count: vs.length, mrr: act * Number(p.price || 0), percent: totalVenues ? Math.round(vs.length * 100 / totalVenues) : 0 };
          });
          var activeSubs = self.subStats.active;
          var expiredSubs = self.subStats.expired;
          var churnRate = activeSubs + expiredSubs ? Math.round(expiredSubs * 100 / (activeSubs + expiredSubs)) : 0;
          var arpu = activeSubs ? Math.round(self.mrr / activeSubs) : 0;
          var venueActivity = self.venues.map(function(v) {
            var vords = os.filter(function(o){ return o.venue_id === v.id; });
            var vdone = vords.filter(function(o){ return o.status === 'done'; });
            var vrev = vdone.reduce(function(s,o){ return s + Number(o.total_price || 0); }, 0);
            var last = null;
            vords.forEach(function(o){ if (o.created_at) { var d = new Date(o.created_at); if (!last || d > last) last = d; } });
            return { id: v.id, name: v.name, orders: vords.length, revenue: vrev, lastOrder: last ? last.toLocaleDateString('ru-RU') + ' ' + last.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '—', subscription_end: v.subscription_end, status: v.status, plan: v.plan };
          }).sort(function(a,b){ return b.orders - a.orders; });
          var managerActivity = self.managers.map(function(m) {
            var vIds = self.links.filter(function(l){ return l.manager_id === m.id; }).map(function(l){ return l.venue_id; });
            var mords = os.filter(function(o){ return vIds.indexOf(o.venue_id) !== -1; });
            var mdone = mords.filter(function(o){ return o.status === 'done'; });
            var mrev = mdone.reduce(function(s,o){ return s + Number(o.total_price || 0); }, 0);
            return { id: m.id, name: m.display_name, email: m.email, venues: vIds.length, orders: mords.length, revenue: mrev, lastLogin: m.last_login_at ? new Date(m.last_login_at).toLocaleDateString('ru-RU') + ' ' + new Date(m.last_login_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '—' };
          }).sort(function(a,b){ return b.orders - a.orders; });
          var cookActivity = self.cooksAll.map(function(c) {
            var cords = os.filter(function(o){ return o.venue_id === c.venue_id && o.cook_name === c.name; });
            var times = [];
            cords.forEach(function(o){ if (o.cooking_started_at && o.ready_at) times.push((new Date(o.ready_at) - new Date(o.cooking_started_at)) / 6e4); });
            var avg = times.length ? Math.round(times.reduce(function(a,b){ return a + b; },0) / times.length) : 0;
            return { id: c.id, name: c.name, venue: c.venues ? c.venues.name : '—', orders: cords.length, avgTime: avg, lastLogin: c.last_login_at ? new Date(c.last_login_at).toLocaleDateString('ru-RU') + ' ' + new Date(c.last_login_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '—' };
          }).sort(function(a,b){ return b.orders - a.orders; });
          var courierActivity = self.couriersAll.map(function(c) {
            var dords = os.filter(function(o){ return o.venue_id === c.venue_id && o.courier_name === c.name; });
            var delivered = dords.filter(function(o){ return o.status === 'done'; }).length;
            return { id: c.id, name: c.name, venue: c.venues ? c.venues.name : '—', delivered: delivered, lastLogin: c.last_login_at ? new Date(c.last_login_at).toLocaleDateString('ru-RU') + ' ' + new Date(c.last_login_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '—' };
          }).sort(function(a,b){ return b.delivered - a.delivered; });
          var waiterActivity = self.waitersAll.map(function(w) {
            var words = os.filter(function(o){ return o.venue_id === w.venue_id && o.waiter_name === w.name; });
            var served = words.filter(function(o){ return o.status === 'done'; }).length;
            return { id: w.id, name: w.name, venue: w.venues ? w.venues.name : '—', served: served, lastLogin: w.last_login_at ? new Date(w.last_login_at).toLocaleDateString('ru-RU') + ' ' + new Date(w.last_login_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '—' };
          }).sort(function(a,b){ return b.served - a.served; });
          self.adminAnalytics = {
            revenue: rev, orders: os.length, clients: clients, repeatClients: repeat, newClients: clients - repeat,
            avgCheck: done.length ? Math.round(rev / done.length) : 0,
            avgCookTime: t.length ? Math.round(t.reduce(function(a,b){ return a + b; },0) / t.length) : 0,
            pickup: pickup, delivery: delivery, cash: cash, card: card,
            topItems: [], topAddons: [], topHours: topHours, daily: daily,
            mrr: self.mrr, arpu: arpu, churnRate: churnRate, trialConversion: 0, planDist: planDist,
            venueActivity: venueActivity, managerActivity: managerActivity, cookActivity: cookActivity,
            courierActivity: courierActivity, waiterActivity: waiterActivity
          };

          /* order_items/order_addons не имеют created_at. Фильтр периода берём через orders.id. */
          var orderIds = os.map(function(o){ return o.id; }).filter(Boolean);
          if (!orderIds.length) return;

          var itemsQ = db.from('order_items').select('name,qty,price,order_id').in('order_id', orderIds);
          itemsQ.then(function(ir) {
            if (ir.error) { console.error('Ошибка загрузки топа блюд:', ir.error); return; }
            var groups = {};
            (ir.data || []).forEach(function(x) {
              var name = x.name || 'Без названия';
              if (!groups[name]) groups[name] = { name: name, count: 0, revenue: 0 };
              groups[name].count += Number(x.qty) || 0;
              groups[name].revenue += (Number(x.qty) || 0) * (Number(x.price) || 0);
            });
            self.adminAnalytics.topItems = Object.keys(groups).map(function(k){ return groups[k]; })
              .sort(function(a,b){ return b.count - a.count; }).slice(0,15);
          });

          var addQ = db.from('order_addons').select('name,order_id').in('order_id', orderIds);
          addQ.then(function(ar) {
            if (ar.error) { console.error('Ошибка загрузки топа добавок:', ar.error); return; }
            var groups = {};
            (ar.data || []).forEach(function(x) {
              var name = x.name || 'Без названия';
              groups[name] = (groups[name] || 0) + 1;
            });
            self.adminAnalytics.topAddons = Object.keys(groups).map(function(name){ return { name: name, count: groups[name] }; })
              .sort(function(a,b){ return b.count - a.count; }).slice(0,10);
          });
        }).catch(function(e) { console.error('Ошибка загрузки аналитики:', e); });
      },

      adminTypePercent: function(t) {
        var s = this.adminAnalytics;
        var tot = s.pickup + s.delivery;
        return tot ? Math.round(s[t] * 100 / tot) : 0;
      },
      adminPayPercent: function(p) {
        var s = this.adminAnalytics;
        var tot = s.cash + s.card;
        return tot ? Math.round(s[p] * 100 / tot) : 0;
      }
    }
  };

  window.__QR_ADMIN_STATISTICS_MIXIN__ = statsMixin;
})();
