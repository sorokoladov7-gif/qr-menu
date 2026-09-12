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
        return db.from('orders').select('*,items:order_items(*),addons:order_addons(*)')
          .eq('venue_id',this.venue.id).order('created_at',{ascending:false}).limit(50)
          .then(function(r){
            if(r&&r.data) self.orders=r.data;
            else if(!self.orders.length) self.orders=[];
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
})();
