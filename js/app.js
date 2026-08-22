window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',arrived:'📍 Курьер на месте',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',arrived:'#f472b6',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ return ({main:'🍽 Блюдо',drink:'🥤 Напиток',addon:'🧂 Доп',breakfast:'🍳 Завтрак',salad:'🥗 Салат',soup:'🍲 Суп',dessert:'🍰 Десерт',sauce:'🌶 Соус',snack:'🥨 Закуска',hot:'🔥 Горячее',bbq:'🥩 Гриль'}[c]||'🍽 Блюдо'); };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

function safeRedirect(fallbackUrl, reason) {
  var last = parseInt(sessionStorage.getItem('last_redirect') || '0', 10), now = Date.now();
  if (now - last < 3000) {
    document.body.innerHTML = '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Ваш email авторизован, но профиль не найден в базе данных.</p><p><b>Причина:</b> '+(reason||'неизвестно')+'</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px">🔄 Очистить и попробовать снова</button></div>';
    return;
  }
  sessionStorage.setItem('last_redirect',String(now)); location.href=fallbackUrl;
}

async function requireAuth(roles){
  try{
    const {data:{session}} = await db.auth.getSession();
    if(!session){safeRedirect('index.html','нет активной сессии');return null;}
    const {data:profile,error} = await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(error){console.error('Profile fetch error:',error);safeRedirect('index.html','ошибка чтения профиля: '+error.message);return null;}
    if(!profile){
      const {data:newProfile,error:insertError} = await db.from('profiles').insert({id:session.user.id,email:session.user.email,display_name:session.user.user_metadata?.display_name||session.user.email,role:'manager'}).select().single();
      if(insertError||!newProfile){safeRedirect('index.html','профиль не найден и не создан. Выполните SQL в Supabase');return null;}
      return newProfile;
    }
    if(roles && roles.length && roles.indexOf(profile.role)===-1){safeRedirect('index.html','нет доступа: нужна роль '+roles.join('/')+', у вас '+profile.role);return null;}
    return profile;
  }catch(e){console.error(e);safeRedirect('index.html','исключение: '+e.message);return null;}
}

async function logout(){
  try{await db.auth.signOut();}catch(e){}
  sessionStorage.clear();
  location.href='index.html';
}

(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  var lastVenueId=null, lastFee=null;
  function sync(){
    var el=document.getElementById('app');
    if(!el) return;
    try{
      var vm=el.__vueParentComponent?.proxy||el.vue_app?._instance?.proxy||null;
      if(!vm||!vm.venue) return;
      var id=vm.venue.id, raw=vm.venue.delivery_fee;
      var fee=raw===null||raw===undefined||raw===''?150:Number(raw);
      if(!isFinite(fee)||fee<0) fee=150;
      if(id!==lastVenueId||fee!==lastFee){window.DELIVERY_FEE=fee;lastVenueId=id;lastFee=fee;}
    }catch(e){}
  }
  if(typeof window.DELIVERY_FEE==='undefined') window.DELIVERY_FEE=150;
  function start(){sync();setInterval(sync,250);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();

/* Admin billing compatibility: subscriptions are owned by managers, while venues keep only cached plan/expiry values. */
(function(){
  'use strict';
  if(!/\/admin\.html$/i.test(location.pathname) || !window.Vue || !db) return;
  if(window.__QR_ADMIN_MANAGER_SUBS_PATCH__) return;
  window.__QR_ADMIN_MANAGER_SUBS_PATCH__=true;
  var originalCreateApp=Vue.createApp;
  Vue.createApp=function(options){
    if(options && typeof options==='object'){
      options.methods=options.methods||{};
      options.computed=options.computed||{};

      async function managerIdForVenue(vm, venueId){
        var r=await db.from('manager_venues').select('manager_id').eq('venue_id',venueId).limit(1).maybeSingle();
        return r.data ? r.data.manager_id : null;
      }

      function managerVenueIds(vm, managerId){
        return (vm.links||[]).filter(function(l){return l.manager_id===managerId}).map(function(l){return l.venue_id});
      }

      options.computed.mrr=function(){
        var self=this, seen={};
        return (this.subscriptions||[]).filter(function(s){
          return s && s.manager_id && ['active','trialing'].indexOf(s.status)!==-1 && s.current_period_end && new Date(s.current_period_end)>=new Date();
        }).reduce(function(sum,s){
          if(seen[s.manager_id]) return sum;
          seen[s.manager_id]=true;
          var p=self.plans.find(function(x){return x.id===s.plan_id});
          return sum+(p?Number(p.price)||0:0);
        },0);
      };

      options.computed.subStats=function(){
        var now=new Date(), active=0, trial=0, expired=0, expiring=0, list=this.subscriptions||[];
        list.forEach(function(s){
          if(!s||!s.manager_id){return;}
          var e=s.current_period_end?new Date(s.current_period_end):null;
          if(s.status==='trialing' && e && e>=now) trial++;
          if(e && e>=now && ['active','trialing'].indexOf(s.status)!==-1){
            active++;
            var soon=new Date(); soon.setDate(soon.getDate()+7);
            if(e<soon) expiring++;
          }else{expired++;}
        });
        return {total:list.filter(function(s){return s&&s.manager_id}).length,active:active,trial:trial,expired:expired,expiringSoon:expiring};
      };

      options.computed.planStats=function(){
        var self=this, now=new Date();
        return this.plans.map(function(p){
          var ss=(self.subscriptions||[]).filter(function(s){return s&&s.manager_id&&s.plan_id===p.id});
          var active=ss.filter(function(s){return ['active','trialing'].indexOf(s.status)!==-1&&s.current_period_end&&new Date(s.current_period_end)>now}).length;
          return {id:p.id,name:p.name,price:Number(p.price)||0,count:ss.length,active:active,mrr:active*(Number(p.price)||0)};
        });
      };

      options.computed.venueSubs=function(){
        var self=this;
        return (this.subscriptions||[]).filter(function(s){return s&&s.manager_id}).map(function(s){
          var m=self.managers.find(function(x){return x.id===s.manager_id})||{};
          var p=self.plans.find(function(x){return x.id===s.plan_id});
          var ids=managerVenueIds(self,s.manager_id);
          var ords=self.ordersAll.filter(function(o){return ids.indexOf(o.venue_id)!==-1&&o.status==='done'});
          var rev=ords.reduce(function(sum,o){return sum+Number(o.total_price||0)},0);
          var names=ids.map(function(id){var v=self.venues.find(function(x){return x.id===id});return v?v.name:null}).filter(Boolean);
          return {
            id:s.id,
            manager_id:s.manager_id,
            name:m.display_name||m.email||s.manager_id,
            slug:m.email||'управляющий',
            planName:p?p.name:'—',
            subscription_end:s.current_period_end,
            status:s.status,
            totalOrders:ords.length,
            totalRevenue:rev,
            plan_id:s.plan_id,
            venueNames:names
          };
        });
      };

      options.methods.changePlan=async function(v,plan){
        this.busy=true;
        try{
          var mid=await managerIdForVenue(this,v.id);
          if(!mid) throw new Error('У заведения пока нет назначенного управляющего');
          var current=await db.from('subscriptions').select('current_period_end').eq('manager_id',mid).maybeSingle();
          if(current.error) throw current.error;
          var up=await db.from('subscriptions').upsert({manager_id:mid,venue_id:null,plan_id:plan,status:'active',current_period_end:(current.data&&current.data.current_period_end)||new Date().toISOString()},{onConflict:'manager_id'}).select().single();
          if(up.error) throw up.error;
          await db.from('venues').update({plan:plan}).eq('id',v.id);
          this.loadBaseData();
        }catch(e){this.msg='Ошибка: '+e.message;}finally{this.busy=false;}
      };

      options.methods.extendSub=async function(v){
        this.busy=true;
        try{
          var mid=await managerIdForVenue(this,v.id);
          if(!mid) throw new Error('У заведения пока нет назначенного управляющего');
          var current=await db.from('subscriptions').select('current_period_end,plan_id,status').eq('manager_id',mid).maybeSingle();
          if(current.error) throw current.error;
          var e=current.data && current.data.current_period_end && new Date(current.data.current_period_end)>new Date() ? new Date(current.data.current_period_end) : new Date();
          e.setDate(e.getDate()+30);
          var up=await db.from('subscriptions').upsert({manager_id:mid,venue_id:null,plan_id:(current.data&&current.data.plan_id)||v.plan||'start',status:'active',current_period_end:e.toISOString()},{onConflict:'manager_id'});
          if(up.error) throw up.error;
          await db.from('venues').update({plan:(current.data&&current.data.plan_id)||v.plan||'start',subscription_end:e.toISOString(),status:'active'}).in('id',managerVenueIds(this,mid));
          this.loadBaseData();
        }catch(e){this.msg='Ошибка: '+e.message;}finally{this.busy=false;}
      };

      options.methods.confirmPayment=async function(pay){
        this.busy=true;
        try{
          var mid=pay.manager_id || await managerIdForVenue(this,pay.venue_id);
          if(!mid) throw new Error('Не найден управляющий для оплаты');
          var end=new Date(); end.setMonth(end.getMonth()+1);
          var up=await db.from('subscriptions').upsert({manager_id:mid,venue_id:null,plan_id:pay.plan_id,status:'active',current_period_end:end.toISOString()},{onConflict:'manager_id'});
          if(up.error) throw up.error;
          await db.from('venues').update({plan:pay.plan_id,subscription_end:end.toISOString(),status:'active'}).in('id',managerVenueIds(this,mid));
          var pp=await db.from('payments').update({status:'confirmed'}).eq('id',pay.id);
          if(pp.error) throw pp.error;
          this.loadBaseData();
        }catch(e){this.msg='Ошибка: '+e.message;}finally{this.busy=false;}
      };

      options.methods.createVenue=async function(){
        var self=this;self.msg='';
        if(!self.nform.name||!self.nform.slug){self.msg='Заполните название и slug';return}
        self.busy=true;
        try{
          var r=await db.from('venues').insert({name:self.nform.name,slug:self.nform.slug.toLowerCase(),plan:self.nform.plan,status:'active'}).select().single();
          if(r.error)throw r.error;
          self.showModal=false;self.nform={name:'',slug:'',plan:'start'};await self.loadBaseData();
        }catch(e){self.msg='Ошибка: '+e.message;}finally{self.busy=false;}
      };
    }
    return originalCreateApp.apply(this,arguments);
  };
})();
