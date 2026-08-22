/* QR-SETKA — manager-owned subscription bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUBSCRIPTION_OWNER__) return;
  window.__QR_MANAGER_SUBSCRIPTION_OWNER__=true;

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
        var oldSelect=options.methods.selectVenue;
        options.methods.selectVenue=async function(v){
          if(typeof oldSelect==='function') await oldSelect.call(this,v);
          else { this.venue=v; this.tab='menu'; }
          await this.loadManagerSubscription();
        };

        options.methods.loadManagerSubscription=async function(){
          try{
            var managerId=this.profile && this.profile.id;
            if(!managerId && db && db.auth){
              var ur=await db.auth.getUser();
              managerId=ur && ur.data && ur.data.user ? ur.data.user.id : null;
            }
            if(!managerId){ this.managerSubscription=null; return null; }
            var r=await db.from('subscriptions')
              .select('id,manager_id,plan_id,status,current_period_end,created_at')
              .eq('manager_id',managerId)
              .maybeSingle();
            if(r.error) throw r.error;
            this.managerSubscription=r.data||null;
            if(r.data){
              this.subscriptionEnd=r.data.current_period_end;
              if(this.venue){
                this.venue.plan=r.data.plan_id;
                this.venue.subscription_end=r.data.current_period_end;
              }
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
            var managerId=this.profile && this.profile.id;
            if(!managerId){
              var ur=await db.auth.getUser();
              managerId=ur && ur.data && ur.data.user ? ur.data.user.id : null;
            }
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
            if(this.venue){ this.venue.plan=up.data.plan_id; this.venue.subscription_end=up.data.current_period_end; }
            this.payPlan=null;
            this.showToast('Тариф управляющего изменен');
          }catch(e){
            console.error('[QR Subscription] subscribeFree:',e);
            this.showToast('Ошибка: '+(e.message||'не удалось изменить тариф'),'error');
          }finally{ this.busy=false; }
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
