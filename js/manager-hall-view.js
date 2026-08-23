/* QR Menu — compatibility bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  window.__QR_MANAGER_HALL_VIEW_COMPAT__=true;

  // manager.html loads this file BEFORE Vue.createApp().
  // Keep compatibility patches here so they exist before Vue compiles the template.
  function installVueBridge(){
    try{
      if(!window.Vue || typeof window.Vue.createApp!=='function' || window.__QR_MANAGER_VUE_TEMPLATE_BRIDGE__) return;
      window.__QR_MANAGER_VUE_TEMPLATE_BRIDGE__=true;
      var originalCreateApp=window.Vue.createApp;
      window.Vue.createApp=function(options){
        try{
          if(options && typeof options==='object'){
            if(!options.methods) options.methods={};

            if(typeof options.methods.selectVenueTemplate!=='function'){
              options.methods.selectVenueTemplate=function(id){
                var list=Array.isArray(this.venueTemplates)?this.venueTemplates:[];
                var t=list.find(function(x){return x.id===id;});
                if(!t) return;
                if(!this.newVenueForm) this.newVenueForm={};
                this.newVenueForm.template=id;
                if(!this.newVenueForm.name) this.newVenueForm.name=t.name;
                if(!this.newVenueForm.slug) this.newVenueForm.slug=id;
              };
            }

            // Billing was migrated from venue-owned subscriptions to manager-owned
            // subscriptions. manager.html still contains the legacy direct-table
            // operations, so normalize them here before the app is mounted.
            var getManagerId=function(ctx){
              if(ctx && ctx.profile && ctx.profile.id) return Promise.resolve(ctx.profile.id);
              if(window.db && db.auth) return db.auth.getUser().then(function(r){
                return r && r.data && r.data.user ? r.data.user.id : null;
              });
              return Promise.resolve(null);
            };

            options.data=(function(oldData){
              return function(){
                var state=typeof oldData==='function' ? oldData.apply(this,arguments) : (oldData||{});
                state.managerSubscription=state.managerSubscription||null;
                return state;
              };
            })(options.data);

            options.methods.loadManagerSubscription=async function(){
              var managerId=await getManagerId(this);
              if(!managerId){ this.managerSubscription=null; return null; }
              var r=await db.from('subscriptions')
                .select('id,manager_id,plan_id,status,current_period_end,created_at')
                .eq('manager_id',managerId)
                .maybeSingle();
              if(r.error) throw r.error;
              this.managerSubscription=r.data||null;
              if(r.data) this.subscriptionEnd=r.data.current_period_end;
              return r.data||null;
            };

            var originalLoadMyVenues=options.methods.loadMyVenues;
            if(typeof originalLoadMyVenues==='function'){
              options.methods.loadMyVenues=function(){
                var self=this;
                return Promise.resolve()
                  .then(function(){ return self.loadManagerSubscription(); })
                  .catch(function(e){ console.warn('[QR Billing] subscription load:',e); self.managerSubscription=null; })
                  .then(function(){ return originalLoadMyVenues.apply(self,arguments); });
              };
            }

            options.methods.subscribeFree=async function(p){
              if(!p || Number(p.price)!==0) return;
              this.busy=true;
              try{
                var managerId=await getManagerId(this);
                if(!managerId) throw new Error('Не удалось определить управляющего');
                var e=new Date(); e.setMonth(e.getMonth()+1);
                var r=await db.from('subscriptions').upsert({
                  manager_id:managerId,
                  venue_id:null,
                  plan_id:p.id,
                  status:'active',
                  current_period_end:e.toISOString()
                },{onConflict:'manager_id'}).select().single();
                if(r.error) throw r.error;
                this.managerSubscription=r.data;
                this.subscriptionEnd=r.data.current_period_end;
                this.payPlan=null;
                this.showToast('Тариф управляющего изменен');
                if(typeof this.loadMyVenues==='function') await this.loadMyVenues();
              }catch(e){
                console.error('[QR Billing] subscribeFree:',e);
                this.showToast('Ошибка: '+(e.message||'не удалось изменить тариф'),'error');
              }finally{ this.busy=false; }
            };

            options.methods.markPaid=async function(){
              this.busy=true;
              try{
                var managerId=await getManagerId(this);
                if(!managerId) throw new Error('Не удалось определить управляющего');
                if(!this.payPlan) throw new Error('Тариф не выбран');
                var r=await db.from('payments').insert({
                  manager_id:managerId,
                  venue_id:null,
                  plan_id:this.payPlan.id,
                  amount:Number(this.payPlan.price)||0,
                  status:'pending'
                }).select().single();
                if(r.error) throw r.error;
                this.payPlan=null;
                if(typeof this.loadPayments==='function') await this.loadPayments();
                this.showToast('Заявка на оплату отправлена!');
              }catch(e){
                console.error('[QR Billing] markPaid:',e);
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
                console.warn('[QR Billing] load payments:',e);
                this.myPayments=[];
              }
            };

            options.computed=options.computed||{};
            options.computed.canCreateVenue=function(){
              var planId=this.managerSubscription && this.managerSubscription.plan_id;
              var plan=this.plans.find(function(x){return x.id===planId;});
              if(!plan) plan=this.plans.find(function(x){return x.id==='start';});
              return this.myVenues.length < (plan && plan.max_venues ? plan.max_venues : 1);
            };
          }
        }catch(e){ console.warn('[QR Menu] Vue compatibility bridge:',e); }
        return originalCreateApp.apply(this,arguments);
      };
    }catch(e){ console.warn('[QR Menu] Vue bridge install failed:',e); }
  }

  installVueBridge();

  function expose(){
    try{
      var root=document.getElementById('app');
      var p=root && root.__vue_app__ && root.__vue_app__._instance && root.__vue_app__._instance.proxy;
      if(p){
        window.__managerVue=p;
        window.__managerVenue=function(){return p.venue||null;};
        if(typeof p.selectVenueTemplate!=='function'){
          p.selectVenueTemplate=function(id){
            var list=Array.isArray(p.venueTemplates)?p.venueTemplates:[];
            var t=list.find(function(x){return x.id===id;});
            if(!t) return;
            if(!p.newVenueForm) p.newVenueForm={};
            p.newVenueForm.template=id;
            if(!p.newVenueForm.name) p.newVenueForm.name=t.name;
            if(!p.newVenueForm.slug) p.newVenueForm.slug=id;
          };
        }
      }
    }catch(e){}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',expose);
  else expose();
  setTimeout(expose,250);
  setTimeout(expose,1000);
  setTimeout(expose,2000);
})();
