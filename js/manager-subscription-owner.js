/* QR-SETKA — manager-owned subscription bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUBSCRIPTION_OWNER__) return;
  window.__QR_MANAGER_SUBSCRIPTION_OWNER__=true;

  function getManagerId(ctx){
    if(ctx && ctx.profile && ctx.profile.id) return Promise.resolve(ctx.profile.id);
    if(window.db && db.auth) return db.auth.getUser().then(function(r){ return r && r.data && r.data.user ? r.data.user.id : null; });
    return Promise.resolve(null);
  }

  function patchVue(Vue){
    if(!Vue || typeof Vue.createApp!=='function' || Vue.__QR_MANAGER_SUBSCRIPTION_PATCHED__) return;
    Vue.__QR_MANAGER_SUBSCRIPTION_PATCHED__=true;
    var originalCreateApp=Vue.createApp;

    Vue.createApp=function(options){
      if(options && typeof options==='object'){
        var oldData=options.data;
        options.data=function(){
          var state=typeof oldData==='function' ? oldData.apply(this,arguments) : (oldData||{});
          state.managerSubscription = state.managerSubscription || null;
          return state;
        };

        options.methods=options.methods||{};

        options.methods.loadManagerSubscription=async function(){
          try{
            var managerId=await getManagerId(this);
            if(!managerId){ this.managerSubscription=null; return null; }
            var r=await db.from('subscriptions')
              .select('id,manager_id,plan_id,status,current_period_end,created_at')
              .eq('manager_id',managerId)
              .maybeSingle();
            if(r.error) throw r.error;
            this.managerSubscription=r.data||null;
            if(r.data){
              this.subscriptionEnd=r.data.current_period_end;
            }
            return r.data||null;
          }catch(e){
            console.warn('[QR Subscription] load manager subscription:',e);
            this.managerSubscription=null;
            return null;
          }
        };

        options.methods.subscribeFree=async function(p){
          if(!p || p.price!==0) return;
          this.busy=true;
          try{
            var managerId=await getManagerId(this);
            if(!managerId) throw new Error('Не удалось определить управляющего');
            var e=new Date(); e.setMonth(e.getMonth()+1);
            var up=await db.from('subscriptions').upsert({
              manager_id:managerId,
              venue_id:null,
              plan_id:p.id,
              status:'active',
              current_period_end:e.toISOString()
            },{onConflict:'manager_id'}).select().single();
            if(up.error) throw up.error;
            this.managerSubscription=up.data;
            this.subscriptionEnd=up.data.current_period_end;
            this.payPlan=null;
            this.showToast('Тариф управляющего изменен');
          }catch(e){
            console.error('[QR Subscription] subscribeFree:',e);
            this.showToast('Ошибка: '+(e.message||'не удалось изменить тариф'),'error');
          }finally{ this.busy=false; }
        };

        options.methods.markPaid=async function(){
          this.busy=true;
          try{
            var managerId=await getManagerId(this);
            if(!managerId) throw new Error('Не удалось определить управляющего');
            if(!this.payPlan) throw new Error('Тариф не выбран');
            var payment={
              manager_id:managerId,
              venue_id:null,
              plan_id:this.payPlan.id,
              amount:Number(this.payPlan.price)||0,
              status:'pending'
            };
            var r=await db.from('payments').insert(payment).select().single();
            if(r.error) throw r.error;
            this.payPlan=null;
            if(typeof this.loadPayments==='function') await this.loadPayments();
            this.showToast('Заявка на оплату отправлена!');
          }catch(e){
            console.error('[QR Subscription] markPaid:',e);
            this.showToast('Ошибка: '+(e.message||'не удалось отправить оплату'),'error');
          }finally{ this.busy=false; }
        };

        options.methods.loadPayments=async function(){
          try{
            var managerId=await getManagerId(this);
            if(!managerId){ this.myPayments=[]; return; }
            var r=await db.from('payments').select('*').eq('manager_id',managerId).order('created_at',{ascending:false});
            if(r.error) throw r.error;
            this.myPayments=r.data||[];
          }catch(e){
            console.warn('[QR Subscription] load payments:',e);
            this.myPayments=[];
          }
        };

        options.computed=options.computed||{};
        options.computed.managerPlan=function(){
          var id=this.managerSubscription && this.managerSubscription.plan_id;
          return this.plans.find(function(p){return p.id===id;})||null;
        };
      }
      return originalCreateApp.apply(this,arguments);
    };
  }

  try{
    if(window.Vue) patchVue(window.Vue);
    else{
      var d=Object.getOwnPropertyDescriptor(window,'Vue');
      if(!d || d.configurable!==false){
        var value;
        Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;patchVue(v);}});
      }
    }
  }catch(e){ console.warn('[QR Subscription] Vue bridge failed:',e); }
})();
