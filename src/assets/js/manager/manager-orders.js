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
        var self=this;
        if(!this.venue||!this.venue.id) return Promise.resolve([]);
        return db.from('orders').select('*,items:order_items(*),addons:order_addons(*)')
          .eq('venue_id',this.venue.id).order('created_at',{ascending:false}).limit(50)
          .then(function(r){
            if(r&&r.error){
              console.error('[Manager] orders:',r.error);
              self.showToast&&self.showToast('Не удалось загрузить заказы: '+(r.error.message||'ошибка'),'error');
              return [];
            }
            self.orders=(r&&r.data)||[];
            return self.orders;
          });
      },
      setStatus: function(id,status) {
        var self=this;
        var u={status:status};
        if(status==='cooking')u.cooking_started_at=new Date().toISOString();
        if(status==='ready')u.ready_at=new Date().toISOString();

        if(!navigator.onLine && window.OfflineSync){
          window.OfflineSync.add({operation:'update',table:'orders',payload:u,filters:{id:id},venue_id:self.venue&&self.venue.id})
            .then(function(){
              var local=self.orders.find(function(o){return o.id===id;});
              if(local)Object.keys(u).forEach(function(k){local[k]=u[k];});
              self.$forceUpdate&&self.$forceUpdate();
            });
          return;
        }

        var action=window.__QR_RUN_MANAGER_ACTION__;
        if(typeof action!=='function'){
          self.showToast&&self.showToast('Канал действий управляющего не загружен.','error');
          return;
        }
        action({type:'update_order',payload:Object.assign({venue_id:self.venue&&self.venue.id,order_id:id},u)})
          .then(function(){return self.loadOrders();})
          .catch(function(e){
            if(e&&e.message){
              console.error('[Manager] order status:',e);
              self.showToast&&self.showToast('Ошибка изменения статуса: '+e.message,'error');
            }
          });
      },
      orderBadge:function(s){return 'b-'+s;},
      deliveryIcon:function(t){return t==='delivery'?'🚗':'';},
      isReadyOrDelivery:function(s){return s==='ready'||s==='delivery';},
      isNewOrCooking:function(s){return s==='new'||s==='cooking';}
    }
  };
  window.__QR_MANAGER_ORDERS_MIXIN__=ordersMixin;

  /* The orders tab used to have no lifecycle hook after the manager refactor.
     Load the selected venue's orders exactly when the tab becomes visible. */
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
      vm.loadOrders().catch(function(e){console.error('[Manager] orders tab loader:',e);});
    },250);
    window.addEventListener('beforeunload',function(){clearInterval(timer);},{once:true});
  })();
})();
