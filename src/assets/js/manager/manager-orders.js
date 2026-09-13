/* QR-Menu — заказы управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_ORDERS__) return;
  window.__QR_MANAGER_ORDERS__ = true;

  var ordersMixin = {
    data: function() { return { orders: [] }; },
    computed: {
      revenue: function() { return this.orders.filter(function(o){return o.status==='done';}).reduce(function(s,o){return s+Number(o.total_price||0);},0); },
      activeCount: function() { return this.orders.filter(function(o){return ['new','cooking','delivery'].indexOf(o.status)!==-1;}).length; }
    },
    methods: {
      loadOrders: function() {
        var self=this, venueId=this.venue&&this.venue.id;
        if(!venueId) return Promise.resolve([]);
        return db.from('orders').select('*')
          .eq('venue_id',venueId).order('created_at',{ascending:false}).limit(50)
          .then(function(r){
            if(r&&r.error) throw r.error;
            var rows=(r&&r.data)||[];
            var ids=rows.map(function(o){return o.id;}).filter(Boolean);
            if(!ids.length){self.orders=[];return self.orders;}
            return Promise.all([
              db.from('order_items').select('*').in('order_id',ids),
              db.from('order_addons').select('*').in('order_id',ids)
            ]).then(function(parts){
              var itemResult=parts[0],addonResult=parts[1];
              if(itemResult&&itemResult.error)throw itemResult.error;
              if(addonResult&&addonResult.error)throw addonResult.error;
              var items=(itemResult&&itemResult.data)||[],addons=(addonResult&&addonResult.data)||[];
              var itemMap={},addonMap={};
              items.forEach(function(x){(itemMap[x.order_id]||(itemMap[x.order_id]=[])).push(x);});
              addons.forEach(function(x){(addonMap[x.order_id]||(addonMap[x.order_id]=[])).push(x);});
              rows.forEach(function(o){o.items=itemMap[o.id]||[];o.addons=addonMap[o.id]||[];});
              self.orders=rows;
              return self.orders;
            });
          })
          .catch(function(e){
            console.error('[Manager] orders:',e);
            self.showToast&&self.showToast('Не удалось загрузить заказы: '+(e&&e.message||'ошибка'),'error');
            return [];
          });
      },
      setStatus: function(id,status) {
        var self=this, venueId=this.venue&&this.venue.id;
        if(!venueId||!id)return Promise.resolve();
        var payload={venue_id:venueId,order_id:id,status:status};
        if(status==='cooking')payload.cooking_started_at=new Date().toISOString();
        if(status==='ready')payload.ready_at=new Date().toISOString();

        if(!navigator.onLine && window.OfflineSync){
          return window.OfflineSync.add({operation:'update',table:'orders',payload:{status:status},filters:{id:id,venue_id:venueId},venue_id:venueId})
            .then(function(){
              var local=self.orders.find(function(o){return o.id===id;});
              if(local){local.status=status;if(payload.cooking_started_at)local.cooking_started_at=payload.cooking_started_at;if(payload.ready_at)local.ready_at=payload.ready_at;}
              self.$forceUpdate&&self.$forceUpdate();
            });
        }

        var runner=window.__QR_RUN_MANAGER_ACTION__;
        if(typeof runner!=='function')return Promise.reject(new Error('Канонический API действий менеджера недоступен'));
        return runner({type:'update_order',payload:payload})
          .then(function(){return self.loadOrders();})
          .catch(function(e){
            console.error('[Manager] order status:',e);
            self.showToast&&self.showToast('Ошибка изменения статуса: '+(e&&e.message||'ошибка'),'error');
            throw e;
          });
      },
      orderBadge:function(s){return 'b-'+s;},
      deliveryIcon:function(t){return t==='delivery'?'🚗':'';},
      isReadyOrDelivery:function(s){return s==='ready'||s==='delivery';},
      isNewOrCooking:function(s){return s==='new'||s==='cooking';}
    }
  };
  window.__QR_MANAGER_ORDERS_MIXIN__=ordersMixin;

  (function installOrdersTabLoader(){
    var lastKey='';
    var timer=setInterval(function(){
      var vm=window.__managerVue;
      if(!vm)return;
      if(vm.tab!=='orders'){lastKey='';return;}
      if(!vm.venue||!vm.venue.id)return;
      var key=String(vm.venue.id);
      if(key===lastKey)return;
      lastKey=key;
      if(typeof vm.loadOrders==='function')vm.loadOrders().catch(function(e){console.error('[Manager] orders tab loader:',e);});
    },250);
    window.addEventListener('beforeunload',function(){clearInterval(timer);},{once:true});
  })();
})();
