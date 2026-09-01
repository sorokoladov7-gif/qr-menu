(function(){
  'use strict';
  var path = location.pathname.toLowerCase();
  if (!/\/manager\.html$/i.test(path)) return;

  function getVm(){
    var app = document.getElementById('app');
    return app && app.__vueParentComponent && app.__vueParentComponent.proxy;
  }

  async function getVenueCreateAllowance(vm){
    try{
      if (!vm || !window.db || !window.db.auth) return {allowed:false};
      var sessionResult = await window.db.auth.getSession();
      var session = sessionResult && sessionResult.data && sessionResult.data.session;
      var managerId = session && session.user && session.user.id;
      if (!managerId) return {allowed:false};

      var subResult = await window.db.from('subscriptions')
        .select('id,manager_id,venue_id,plan_id,status,current_period_end,created_at')
        .eq('manager_id', managerId)
        .in('status',['trialing','active'])
        .gte('current_period_end',new Date().toISOString())
        .order('created_at',{ascending:false})
        .limit(50);
      if (subResult.error) return {allowed:false};

      var subs = subResult.data || [];
      var ids = Array.from(new Set(subs.map(function(s){return s.plan_id;}).filter(Boolean)));
      var plans = [];
      if(ids.length){
        var pr = await window.db.from('plans').select('id,max_venues,is_active').in('id',ids);
        if(!pr.error) plans = pr.data || [];
      }

      var ranked = subs.map(function(s){
        var p = plans.find(function(x){return x.id===s.plan_id;});
        return {subscription:s,plan:p,max:Number(p&&p.max_venues||0)};
      }).filter(function(x){return x.plan && x.max>0;}).sort(function(a,b){
        if(a.max!==b.max)return b.max-a.max;
        if(!!a.subscription.venue_id!==!!b.subscription.venue_id)return a.subscription.venue_id?1:-1;
        return new Date(b.subscription.created_at||0)-new Date(a.subscription.created_at||0);
      });

      var selected = ranked[0] || null;
      if(!selected && Array.isArray(vm.myVenues) && vm.myVenues.length){
        var activeVenue = vm.myVenues.find(function(v){return v.subscription_end&&new Date(v.subscription_end)>=new Date();}) || vm.myVenues[0];
        if(activeVenue && activeVenue.plan){
          var vp = await window.db.from('plans').select('id,max_venues,is_active').eq('id',activeVenue.plan).maybeSingle();
          if(!vp.error && vp.data) selected={subscription:{venue_id:activeVenue.id,plan_id:activeVenue.plan,status:'trialing',current_period_end:activeVenue.subscription_end},plan:vp.data,max:Number(vp.data.max_venues||0)};
        }
      }

      var count = Array.isArray(vm.myVenues) ? vm.myVenues.length : 0;
      if(selected){
        vm.managerSubscription = selected.subscription;
        if(selected.subscription.current_period_end) vm.subscriptionEnd=selected.subscription.current_period_end;
      }
      return {allowed:!!selected && count<selected.max,limit:selected?selected.max:0,count:count,subscription:selected&&selected.subscription,plan:selected&&selected.plan};
    }catch(e){
      console.warn('[Venue create guard]',e);
      return {allowed:false};
    }
  }

  function installVenueCreateGuard(){
    var vm = getVm();
    if (!vm) { setTimeout(installVenueCreateGuard,250); return; }

    async function sync(){
      var state=await getVenueCreateAllowance(vm);
      var buttons=document.querySelectorAll('button');
      buttons.forEach(function(btn){
        var text=(btn.textContent||'').replace(/\s+/g,' ').trim();
        if(text==='+ Создать' || text==='Создать'){
          btn.disabled=!state.allowed;
          if(state.allowed){
            btn.removeAttribute('disabled');
            btn.style.pointerEvents='auto';
            btn.style.opacity='1';
            btn.title='Доступно заведений: '+Math.max(0,state.limit-state.count)+' из '+state.limit;
          }else btn.title='Достигнут лимит заведений по тарифу';
        }
      });
    }

    sync();
    setInterval(sync,1500);
    var observer=new MutationObserver(function(){
      clearTimeout(window.__QR_MANAGER_CREATE_GUARD_TIMER__);
      window.__QR_MANAGER_CREATE_GUARD_TIMER__=setTimeout(sync,80);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
  }

  function install(){
    var vm=getVm();
    var tabs=document.querySelector('.tabs');
    if(!vm||!tabs||!vm.venue){setTimeout(install,250);return;}
    if(document.getElementById('manager-staff-quick-actions'))return;
    var wrap=document.createElement('div');
    wrap.id='manager-staff-quick-actions';
    wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);align-items:center;';
    var title=document.createElement('span');
    title.textContent='Персонал:';
    title.style.cssText='font-weight:800;margin-right:4px;color:#e5e7eb;';
    wrap.appendChild(title);
    function addButton(type,text,color){
      var b=document.createElement('button');
      b.type='button';b.className='btn btn-green btn-sm';b.textContent=text;b.style.background=color;
      b.onclick=function(){if(vm&&typeof vm.openCreateStaff==='function')vm.openCreateStaff(type);};
      wrap.appendChild(b);
    }
    addButton('cook','👨‍🍳 Добавить повара','#047857');
    addButton('waiter','🤵 Добавить официанта','#0e7490');
    addButton('courier','🚗 Добавить курьера','#b45309');
    tabs.parentNode.insertBefore(wrap,tabs);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install);
    document.addEventListener('DOMContentLoaded',installVenueCreateGuard);
  }else{
    install();
    installVenueCreateGuard();
  }
})();
