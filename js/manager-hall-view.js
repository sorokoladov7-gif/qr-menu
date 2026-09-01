/* QR Menu — compatibility bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  window.__QR_MANAGER_HALL_VIEW_COMPAT__=true;

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
            var getManagerId=function(ctx){
              if(ctx && ctx.profile && ctx.profile.id) return Promise.resolve(ctx.profile.id);
              if(window.db && db.auth) return db.auth.getUser().then(function(r){ return r && r.data && r.data.user ? r.data.user.id : null; });
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
                .select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at')
                .eq('manager_id',managerId)
                .in('status',['trialing','active'])
                .gte('current_period_end',new Date().toISOString())
                .order('created_at',{ascending:false});
              if(r.error) throw r.error;
              var rows=r.data||[];
              // A manager's subscription may be attached to a venue. Do not require venue_id IS NULL.
              // Prefer the plan with the largest venue allowance; this prevents a lower-tier venue
              // subscription from masking the manager's actual multi-venue entitlement.
              var planIds=Array.from(new Set(rows.map(function(s){return s.plan_id;}).filter(Boolean)));
              var plans=[];
              if(planIds.length){
                var pr=await db.from('plans').select('id,name,max_venues,is_active').in('id',planIds);
                if(pr.error) throw pr.error;
                plans=pr.data||[];
              }
              var candidates=rows.map(function(s){
                var p=plans.find(function(x){return x.id===s.plan_id;});
                return p&&p.is_active!==false?{subscription:s,plan:p}:null;
              }).filter(Boolean).sort(function(a,b){
                var am=Number(a.plan.max_venues||0),bm=Number(b.plan.max_venues||0);
                if(am!==bm)return bm-am;
                return new Date(b.subscription.created_at||0)-new Date(a.subscription.created_at||0);
              });
              var best=candidates[0]||null;
              if(best){
                this.managerSubscription=best.subscription;
                this.currentPlan=best.plan;
                this.subscriptionEnd=best.subscription.current_period_end;
                return best.subscription;
              }
              this.managerSubscription=null;
              return null;
            };
            var originalLoadMyVenues=options.methods.loadMyVenues;
            if(typeof originalLoadMyVenues==='function'){
              options.methods.loadMyVenues=function(){
                var self=this;
                return Promise.resolve().then(function(){return self.loadManagerSubscription();})
                  .catch(function(e){console.warn('[QR Billing] subscription load:',e);self.managerSubscription=null;})
                  .then(function(){return originalLoadMyVenues.apply(self,arguments);});
              };
            }
            options.methods.subscribeFree=async function(p){
              if(!p || Number(p.price)!==0) return;
              this.busy=true;
              try{
                var managerId=await getManagerId(this);
                if(!managerId) throw new Error('Не удалось определить управляющего');
                var e=new Date(); e.setMonth(e.getMonth()+1);
                var r=await db.from('subscriptions').upsert({manager_id:managerId,venue_id:null,plan_id:p.id,status:'active',current_period_end:e.toISOString()},{onConflict:'manager_id'}).select().single();
                if(r.error) throw r.error;
                this.managerSubscription=r.data; this.subscriptionEnd=r.data.current_period_end; this.payPlan=null;
                this.showToast('Тариф управляющего изменен');
                if(typeof this.loadMyVenues==='function') await this.loadMyVenues();
              }catch(e){
                console.error('[QR Billing] subscribeFree:',e); this.showToast('Ошибка: '+(e.message||'не удалось изменить тариф'),'error');
              }finally{this.busy=false;}
            };
            options.methods.markPaid=async function(){
              this.busy=true;
              try{
                var managerId=await getManagerId(this);
                if(!managerId) throw new Error('Не удалось определить управляющего');
                if(!this.payPlan) throw new Error('Тариф не выбран');
                var r=await db.from('payments').insert({manager_id:managerId,venue_id:null,plan_id:this.payPlan.id,amount:Number(this.payPlan.price)||0,status:'pending'}).select().single();
                if(r.error) throw r.error;
                this.payPlan=null; if(typeof this.loadPayments==='function') await this.loadPayments(); this.showToast('Заявка на оплату отправлена!');
              }catch(e){console.error('[QR Billing] markPaid:',e);this.showToast('Ошибка: '+(e.message||'не удалось отправить оплату'),'error');}
              finally{this.busy=false;}
            };
            options.methods.loadPayments=async function(){
              try{var managerId=await getManagerId(this);if(!managerId){this.myPayments=[];return;}var r=await db.from('payments').select('*').eq('manager_id',managerId).order('created_at',{ascending:false});if(r.error)throw r.error;this.myPayments=r.data||[];}catch(e){console.warn('[QR Billing] load payments:',e);this.myPayments=[];}
            };
            options.computed=options.computed||{};
            options.computed.managerPlan=function(){
              var self=this;
              var planId=this.managerSubscription&&this.managerSubscription.plan_id;
              var plan=Array.isArray(this.plans)?this.plans.find(function(x){return x.id===planId;}):null;
              if(!plan&&this.currentPlan) plan=this.currentPlan;
              if(!plan&&Array.isArray(this.myVenues)&&this.myVenues.length){
                var now=new Date();
                var active=this.myVenues.find(function(v){return v.subscription_end&&new Date(v.subscription_end)>=now;})||this.myVenues[0];
                if(active&&active.plan) plan=Array.isArray(self.plans)?self.plans.find(function(x){return x.id===active.plan;})||null:null;
              }
              if(!plan&&this.venue&&this.venue.plan&&Array.isArray(this.plans)) plan=this.plans.find(function(x){return x.id===self.venue.plan;});
              return plan||null;
            };
            options.computed.venueLimit=function(){
              var plan=this.managerPlan;
              var limit=plan&&Number(plan.max_venues);
              return Number.isFinite(limit)&&limit>0?limit:1;
            };
            options.computed.venueLimitUsed=function(){return Array.isArray(this.myVenues)?this.myVenues.length:0;};
            options.computed.venueLimitRemaining=function(){return Math.max(0,this.venueLimit-this.venueLimitUsed);};
            options.computed.canCreateVenue=function(){
              var used=this.venueLimitUsed;
              var limit=this.venueLimit;
              if(!this.profile || this.profile.role==='admin') return true;
              var sub=this.managerSubscription;
              var validSub=!!(sub&&['trialing','active'].indexOf(sub.status)!==-1&&sub.current_period_end&&new Date(sub.current_period_end)>=new Date());
              var hasActiveVenue=Array.isArray(this.myVenues)&&this.myVenues.some(function(v){return !v.subscription_end||new Date(v.subscription_end)>=new Date();});
              if(!validSub&&!hasActiveVenue) return false;
              return used<limit;
            };
            var originalCreateVenue=options.methods.createVenue;
            if(typeof originalCreateVenue==='function'){
              options.methods.createVenue=async function(){
                var self=this;
                try{await this.loadManagerSubscription();}catch(e){console.warn('[QR Billing] pre-create sub load:',e);}
                if(!this.canCreateVenue){
                  var plan=this.managerPlan;
                  var name=plan&&plan.name?plan.name:(plan&&plan.id?plan.id:'');
                  var max=this.venueLimit;
                  var used=this.venueLimitUsed;
                  this.formError=name
                    ?('Вы достигли лимита заведений по тарифу '+name+': '+used+' из '+max+'.')
                    :('Лимит заведений исчерпан: '+used+' из '+max+'.');
                  return;
                }
                var planId=(this.managerSubscription&&this.managerSubscription.plan_id)||null;
                var subEnd=(this.managerSubscription&&this.managerSubscription.current_period_end)||null;
                if(!planId&&this.currentPlan) planId=this.currentPlan.id;
                if(!subEnd&&this.currentPlan&&this.subscriptionEnd) subEnd=this.subscriptionEnd;
                if(!planId&&Array.isArray(this.myVenues)&&this.myVenues.length){
                  var now=new Date();
                  var active=this.myVenues.find(function(v){return v.subscription_end&&new Date(v.subscription_end)>=now;})||this.myVenues[0];
                  if(active){
                    if(active.plan) planId=active.plan;
                    if(!subEnd&&active.subscription_end) subEnd=active.subscription_end;
                  }
                }
                if(!planId) planId='start';
                if(!subEnd){var e=new Date();e.setDate(e.getDate()+10);subEnd=e.toISOString();}
                var origRpc=db.rpc.bind(db);
                db.rpc=function(name,args){
                  if(name==='create_venue_for_manager'&&args&&typeof args==='object'){
                    args=Object.assign({},args,{p_plan:planId,p_subscription_end:subEnd});
                  }
                  return origRpc(name,args);
                };
                try{
                  return await Promise.resolve(originalCreateVenue.apply(self,arguments));
                }finally{
                  db.rpc=origRpc;
                }
              };
            }
          }
        }catch(e){console.warn('[QR Menu] Vue compatibility bridge:',e);}
        return originalCreateApp.apply(this,arguments);
      };
    }catch(e){console.warn('[QR Menu] Vue bridge install failed:',e);}
  }
  installVueBridge();
  function expose(){try{var root=document.getElementById('app');var p=root&&root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy;if(p){window.__managerVue=p;window.__managerVenue=function(){return p.venue||null;};if(typeof p.selectVenueTemplate!=='function'){p.selectVenueTemplate=function(id){var list=Array.isArray(p.venueTemplates)?p.venueTemplates:[];var t=list.find(function(x){return x.id===id;});if(!t)return;if(!p.newVenueForm)p.newVenueForm={};p.newVenueForm.template=id;if(!p.newVenueForm.name)p.newVenueForm.name=t.name;if(!p.newVenueForm.slug)p.newVenueForm.slug=id;};}}}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',expose);else expose();
  setTimeout(expose,250);setTimeout(expose,1000);setTimeout(expose,2000);
})();
