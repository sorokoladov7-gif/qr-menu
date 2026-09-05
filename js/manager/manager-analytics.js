/* QR-Menu — аналитика заведения */
(function(){
  'use strict';
  if (window.__QR_MANAGER_ANALYTICS__) return;
  window.__QR_MANAGER_ANALYTICS__ = true;

  var analyticsMixin = {
    data: function() {
      return {
        analyticsPeriod: '7',
        aiAnalyticsBusy: false,
        aiAnalyticsAnswer: '',
        analytics: {
          revenue: 0, orders: 0, clients: 0, avgCheck: 0, avgCookTime: 0,
          newClients: 0, repeatClients: 0, topItems: [], topAddons: [],
          typeStats: { pickup: 0, delivery: 0 },
          payStats: { cash: 0, card: 0 }, topHours: [], daily: [],
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
          var t = [], cm = {}, im = {}, am = {}, hours = {}, dailyMap = {};
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
              var key = it.product_id || ('name:' + String(it.name || ''));
              if (!im[key]) im[key] = { product_id: it.product_id || null, name: it.name || 'Без названия', count: 0, revenue: 0, price: 0 };
              var qty = Number(it.qty) || 0;
              var price = Number(it.price) || 0;
              im[key].count += qty;
              im[key].revenue += qty * price;
              if (price > 0) im[key].price = price;
            });
            (o.addons || []).forEach(function(a) {
              if (!am[a.name]) am[a.name] = { name: a.name, count: 0 };
              am[a.name].count++;
            });
            if (o.created_at) {
              var dt = new Date(o.created_at);
              var hr = dt.getHours();
              hours[hr] = (hours[hr] || 0) + 1;
              var keyDay = dt.toISOString().slice(0, 10);
              if (!dailyMap[keyDay]) dailyMap[keyDay] = 0;
              dailyMap[keyDay]++;
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
          self.aiAnalyticsAnswer = '';
        }).catch(function(e) {
          console.error('[Manager Analytics]', e);
          self.showToast('Ошибка загрузки аналитики: '+(e.message||String(e)),'error');
        });
      },
      runAIAnalytics: async function() {
        if (typeof this.requireAIFeature === 'function' && !this.requireAIFeature('analytics')) return;
        if (!this.venue) return;
        this.aiAnalyticsBusy = true;
        this.aiAnalyticsAnswer = '';
        try {
          var session = await db.auth.getSession();
          var token = session && session.data && session.data.session && session.data.session.access_token;
          if (!token) throw new Error('AUTH_REQUIRED');
          var context = JSON.stringify({
            period_days: this.analyticsPeriod === 'all' ? 'all' : Number(this.analyticsPeriod),
            venue: this.venue.name || '',
            venue_id: this.venue.id || null,
            revenue: this.analytics.revenue,
            orders: this.analytics.orders,
            clients: this.analytics.clients,
            avgCheck: this.analytics.avgCheck,
            avgCookTime: this.analytics.avgCookTime,
            newClients: this.analytics.newClients,
            repeatClients: this.analytics.repeatClients,
            topItems: this.analytics.topItems.slice(0, 10),
            topAddons: this.analytics.topAddons.slice(0, 5),
            topHours: this.analytics.topHours,
            typeStats: this.analytics.typeStats,
            payStats: this.analytics.payStats,
            cooks: this.analytics.cooks,
            couriers: this.analytics.couriers,
            waiters: this.analytics.waiters
          });
          var r = await fetch('/api/manager-ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({feature:'analytics',message:'Проанализируй текущую статистику заведения. Выдели 3 главных вывода, 3 проблемы/риска и 5 конкретных действий для увеличения выручки и эффективности. Не придумывай отсутствующие данные.',context:context})});
          var data = await r.json().catch(function(){return{};});
          if(!r.ok || !data.ok) throw new Error(data.error||('HTTP_'+r.status));
          this.aiAnalyticsAnswer = data.answer || '';
        } catch(e) {
          console.error('[Manager Analytics AI]', e);
          this.showToast('ИИ-аналитика: '+(e.message||String(e)),'error');
        } finally {
          this.aiAnalyticsBusy = false;
        }
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

  function installAIAnalyticsButton(){
    if(!/\/manager\.html$/i.test(location.pathname)) return;
    if(window.__QR_MANAGER_AI_ANALYTICS_UI__) return;
    window.__QR_MANAGER_AI_ANALYTICS_UI__=true;
    var style=document.createElement('style');
    style.textContent='.qr-ai-analytics-box{margin:0 0 14px;padding:14px;border:1px solid rgba(99,102,241,.35);border-radius:14px;background:rgba(99,102,241,.07)}.qr-ai-analytics-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.qr-ai-analytics-answer{white-space:pre-wrap;margin-top:12px;line-height:1.55;font-size:13px}.qr-ai-analytics-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(99,102,241,.45);background:rgba(99,102,241,.14);color:inherit;border-radius:9px;padding:8px 12px;cursor:pointer}.qr-ai-analytics-btn:disabled{opacity:.55;cursor:wait}';
    document.head.appendChild(style);
    function render(){
      var vm=window.__managerVue;
      if(!vm||vm.tab!=='analytics') return;
      var root=document.getElementById('app');
      if(!root||root.querySelector('.qr-ai-analytics-box')) return;
      var candidates=root.querySelectorAll('.glass.card');
      var host=null;
      for(var i=0;i<candidates.length;i++){
        var txt=(candidates[i].textContent||'');
        if(txt.indexOf('Аналитика')!==-1||txt.indexOf('Выручка')!==-1){host=candidates[i];break;}
      }
      if(!host) return;
      var box=document.createElement('div');
      box.className='qr-ai-analytics-box';
      box.innerHTML='<div class="qr-ai-analytics-head"><div><b>ИИ-анализ аналитики</b><div class="muted" style="font-size:11px;margin-top:3px">Интерпретация текущих показателей и конкретные действия</div></div><button type="button" class="qr-ai-analytics-btn">Запустить ИИ-анализ</button></div><div class="qr-ai-analytics-answer" hidden></div>';
      var btn=box.querySelector('button'),answer=box.querySelector('.qr-ai-analytics-answer');
      btn.onclick=function(){if(typeof vm.runAIAnalytics!=='function')return;vm.runAIAnalytics();};
      function sync(){
        var busy=!!vm.aiAnalyticsBusy;
        btn.disabled=busy;
        btn.textContent=busy?'ИИ анализирует…':'Запустить ИИ-анализ';
        answer.hidden=!vm.aiAnalyticsAnswer;
        answer.textContent=vm.aiAnalyticsAnswer||'';
      }
      setInterval(sync,300);
      host.parentNode.insertBefore(box,host);
    }
    var observer=new MutationObserver(render);
    observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
    setInterval(render,700);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installAIAnalyticsButton,{once:true}); else installAIAnalyticsButton();
})();