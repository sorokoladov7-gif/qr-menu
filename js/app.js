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
      if(insertError||!newProfile){safeRedirect('login.html','профиль не найден и не создан. Выполните SQL в Supabase');return null;}
      return newProfile;
    }
    if(roles && roles.length && roles.indexOf(profile.role)===-1){safeRedirect('login.html','нет доступа: нужна роль '+roles.join('/')+', у вас '+profile.role);return null;}
    return profile;
  }catch(e){console.error(e);safeRedirect('login.html','исключение: '+e.message);return null;}
}

async function logout(){
  try{await db.auth.signOut();}catch(e){}
  sessionStorage.clear();
  location.href='/login.html';
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
          return {id:s.id,manager_id:s.manager_id,name:m.display_name||m.email||s.manager_id,slug:m.email||'управляющий',planName:p?p.name:'—',subscription_end:s.current_period_end,status:s.status,totalOrders:ords.length,totalRevenue:rev,plan_id:s.plan_id,venueNames:names};
        });
      };

      options.computed.managerSubscription=function(){
        var self=this, by={}, result={};
        (this.subscriptions||[]).forEach(function(s){if(s&&s.manager_id) by[s.manager_id]=s;});
        (this.managers||[]).forEach(function(m){
          var s=by[m.id]||null;
          var p=s?self.plans.find(function(x){return x.id===s.plan_id}):null;
          var ids=managerVenueIds(self,m.id);
          result[m.id]={sub:s,plan:p,venues:ids.map(function(id){var v=self.venues.find(function(x){return x.id===id});return v?v.name:null}).filter(Boolean)};
        });
        return result;
      };

      options.methods.changeManagerPlan=async function(m,plan){
        this.busy=true;
        try{
          var sub=(this.managerSubscription[m.id]&&this.managerSubscription[m.id].sub)||null;
          var end=sub&&sub.current_period_end?sub.current_period_end:new Date(Date.now()+5*864e5).toISOString();
          var r=await db.from('subscriptions').upsert({manager_id:m.id,venue_id:null,plan_id:plan,status:'active',current_period_end:end},{onConflict:'manager_id'});
          if(r.error)throw r.error;
          var ids=managerVenueIds(this,m.id);
          if(ids.length) await db.from('venues').update({plan:plan}).in('id',ids);
          await this.loadBaseData();
        }catch(e){this.msg='Ошибка: '+e.message;}finally{this.busy=false;}
      };

      options.methods.extendManagerSub=async function(m,days){
        this.busy=true;
        try{
          days=Number(days)||30;

          var allowed=[5,10,15,20,30,45,60,90,120,180,365];
          if(allowed.indexOf(days)===-1){
            throw new Error('Недопустимый срок подписки');
          }

          var sub=(this.managerSubscription[m.id]&&this.managerSubscription[m.id].sub)||null;

          var end=sub&&sub.current_period_end&&new Date(sub.current_period_end)>new Date()
            ?new Date(sub.current_period_end)
            :new Date();

          end.setDate(end.getDate()+days);

          var planId=sub&&sub.plan_id
            ?sub.plan_id
            :(this.managerSubscription[m.id]&&this.managerSubscription[m.id].plan
              ?this.managerSubscription[m.id].plan.id
              :'start');

          var r=await db.from('subscriptions').upsert({
            manager_id:m.id,
            venue_id:null,
            plan_id:planId,
            status:'active',
            current_period_end:end.toISOString()
          },{onConflict:'manager_id'});

          if(r.error)throw r.error;

          var ids=managerVenueIds(this,m.id);

          if(ids.length){
            var vr=await db.from('venues').update({
              plan:planId,
              subscription_end:end.toISOString(),
              status:'active'
            }).in('id',ids);

            if(vr.error)throw vr.error;
          }

          this.msg='Подписка продлена на '+days+' дней. До '+end.toLocaleDateString('ru-RU');

          await this.loadBaseData();

        }catch(e){
          this.msg='Ошибка: '+e.message;
        }finally{
          this.busy=false;
        }
      };

      options.methods.changePlan=async function(v,plan){
        var mid=await managerIdForVenue(this,v.id); if(!mid){this.msg='Не найден управляющий';return;}
        return this.changeManagerPlan(this.managers.find(function(m){return m.id===mid})||{id:mid},plan);
      };

      options.methods.extendSub=async function(v){
        var mid=await managerIdForVenue(this,v.id); if(!mid){this.msg='Не найден управляющий';return;}
        return this.extendManagerSub(this.managers.find(function(m){return m.id===mid})||{id:mid});
      };

      options.methods.confirmPayment=async function(pay){
        this.busy=true;
        try{
          var mid=pay.manager_id || await managerIdForVenue(this,pay.venue_id);
          if(!mid) throw new Error('Не найден управляющий для оплаты');
          var end=new Date(); end.setMonth(end.getMonth()+1);
          var up=await db.from('subscriptions').upsert({manager_id:mid,venue_id:null,plan_id:pay.plan_id,status:'active',current_period_end:end.toISOString()},{onConflict:'manager_id'});
          if(up.error) throw up.error;
          var ids=managerVenueIds(this,mid);
          if(ids.length) await db.from('venues').update({plan:pay.plan_id,subscription_end:end.toISOString(),status:'active'}).in('id',ids);
          var pp=await db.from('payments').update({status:'confirmed'}).eq('id',pay.id);
          if(pp.error) throw pp.error;
          await this.loadBaseData();
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

      /* Move tariff controls from venue rows to manager rows before Vue compiles the DOM. */
      (function rewriteManagerSubscriptionUI(){
        try{
          var root=document.getElementById('app');
          if(!root) return;

          var venuePane=root.querySelector('[v-if="tab===\'venues\'"]');
          if(venuePane){
            var vt=venuePane.querySelector('table.tbl');
            if(vt&&vt.rows&&vt.rows[0]){
              var remove=[];
              Array.prototype.forEach.call(vt.rows[0].cells,function(cell,idx){
                if(/^(Тариф|Подписка|До)$/.test((cell.textContent||'').trim())) remove.push(idx);
              });
              remove.sort(function(a,b){return b-a;});
              remove.forEach(function(idx){Array.prototype.forEach.call(vt.rows,function(row){if(row.cells[idx])row.deleteCell(idx);});});
            }
          }

          var planPane=root.querySelector('[v-if="tab===\'plans\'"]');
          if(planPane){
            Array.prototype.forEach.call(planPane.querySelectorAll('*'),function(el){
              if(el.childNodes && el.childNodes.length===1 && el.firstChild.nodeType===3 && /Персональные тарифы назначаются/.test(el.textContent||'')){
                el.textContent='Назначение тарифов выполняется во вкладке «👤 Управляющие».';
              }
            });
          }

          var mgrPane=root.querySelector('[v-if="tab===\'managers\'"]');
          if(mgrPane){
            var mt=mgrPane.querySelector('table.tbl');
            if(mt&&mt.rows&&mt.rows[0]){
              var h=mt.rows[0], accessCell=-1;
              Array.prototype.forEach.call(h.cells,function(c,i){if((c.textContent||'').trim()==='Доступы к заведениям')accessCell=i;});
              if(accessCell<0) accessCell=h.cells.length-1;

              function th(text){
                var c=document.createElement('th');
                c.textContent=text;
                return c;
              }

              h.insertBefore(th('Тариф'),h.cells[accessCell]);
              h.insertBefore(th('Подписка'),h.cells[accessCell+1]);
              h.insertBefore(th('До'),h.cells[accessCell+2]);

              Array.prototype.forEach.call(mt.querySelectorAll('tr'),function(row,ri){
                if(ri===0)return;
                if(!row.getAttribute('v-for'))return;

                var make=function(html){
                  var c=document.createElement('td');
                  c.innerHTML=html;
                  return c;
                };

                row.insertBefore(
                  make(
                    '<select style="width:auto;padding:6px" v-if="managerSubscription[m.id]" v-bind:value="managerSubscription[m.id].sub ? managerSubscription[m.id].sub.plan_id : \'\'" v-on:change="changeManagerPlan(m,$event.target.value)">'+
                    '<option value="">— Нет тарифа —</option>'+
                    '<option v-for="p in plans" v-bind:key="p.id" v-bind:value="p.id">{{ p.name }}</option>'+
                    '</select>'+
                    '<span v-else class="muted">—</span>'
                  ),
                  row.cells[accessCell]
                );

                row.insertBefore(
                  make(
                    '<span v-if="managerSubscription[m.id] && managerSubscription[m.id].sub" class="badge" v-bind:class="managerSubscription[m.id].sub.status===\'trialing\'?\'b-trial\':\'b-on\'">'+
                    '{{ managerSubscription[m.id].sub.status===\'trialing\'?\'Триал\':\'Активна\' }}'+
                    '</span>'+
                    '<span v-else class="muted">Нет</span>'
                  ),
                  row.cells[accessCell+1]
                );

                row.insertBefore(
                  make(
                    '<div v-if="managerSubscription[m.id] && managerSubscription[m.id].sub">'+
                    '<div style="font-size:12px">{{ fmtDate(managerSubscription[m.id].sub.current_period_end) }}</div>'+
                    '<div style="display:flex;gap:5px;align-items:center;margin-top:5px;flex-wrap:wrap">'+
                    '<select v-model.number="managerPeriods[m.id]" style="width:auto;min-width:95px;padding:4px 6px;font-size:11px;border-radius:6px">'+
                    '<option :value="5">5 дней</option>'+
                    '<option :value="10">10 дней</option>'+
                    '<option :value="15">15 дней</option>'+
                    '<option :value="20">20 дней</option>'+
                    '<option :value="30">30 дней</option>'+
                    '<option :value="45">45 дней</option>'+
                    '<option :value="60">60 дней</option>'+
                    '<option :value="90">90 дней</option>'+
                    '<option :value="120">120 дней</option>'+
                    '<option :value="180">180 дней</option>'+
                    '<option :value="365">1 год</option>'+
                    '</select>'+
                    '<button class="btn btn-ghost btn-sm" style="padding:4px 7px;font-size:11px" v-on:click="extendManagerSub(m,managerPeriods[m.id]||30)">Продлить</button>'+
                    '</div>'+
                    '</div><span v-else class="muted">—</span>'
                  ),
                  row.cells[accessCell+2]
                );
              });
            }
          }
        }catch(e){
          console.warn('[QR Admin] subscription UI rewrite:',e);
        }
      })();
    }

    return originalCreateApp.apply(this,arguments);
  };
})();
