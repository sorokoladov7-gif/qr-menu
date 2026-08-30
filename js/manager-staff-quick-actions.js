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
      if (!vm || !window.db || !window.db.auth) return false;
      var sessionResult = await window.db.auth.getSession();
      var session = sessionResult && sessionResult.data && sessionResult.data.session;
      var managerId = session && session.user && session.user.id;
      if (!managerId) return false;

      var subResult = await window.db.from('subscriptions')
        .select('plan_id,status,current_period_end')
        .eq('manager_id', managerId)
        .order('created_at', {ascending:false})
        .limit(1)
        .maybeSingle();

      if (subResult.error || !subResult.data) return false;

      var sub = subResult.data;
      var valid = ['trialing','active'].indexOf(sub.status) !== -1 &&
        sub.current_period_end &&
        new Date(sub.current_period_end) >= new Date();

      if (!valid) return false;

      var planResult = await window.db.from('plans')
        .select('id,max_venues')
        .eq('id', sub.plan_id)
        .maybeSingle();

      if (planResult.error || !planResult.data) return false;

      var maxVenues = Number(planResult.data.max_venues || 0);
      var currentVenues = Array.isArray(vm.myVenues) ? vm.myVenues.length : 0;
      return currentVenues < maxVenues;
    }catch(e){
      console.warn('[Venue create guard]', e);
      return false;
    }
  }

  function installVenueCreateGuard(){
    var vm = getVm();
    if (!vm) {
      setTimeout(installVenueCreateGuard, 250);
      return;
    }

    async function sync(){
      var allowed = await getVenueCreateAllowance(vm);
      var buttons = document.querySelectorAll('button');
      buttons.forEach(function(btn){
        var text = (btn.textContent || '').trim();
        if (text === '+ Создать' || text === 'Создать') {
          if (allowed) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
          }
        }
      });
    }

    sync();
    setInterval(sync, 1500);

    var observer = new MutationObserver(function(){ sync(); });
    observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['disabled']});
  }

  function install(){
    var vm = getVm();
    var tabs = document.querySelector('.tabs');
    if (!vm || !tabs || !vm.venue) {
      setTimeout(install, 250);
      return;
    }
    if (document.getElementById('manager-staff-quick-actions')) return;

    var wrap = document.createElement('div');
    wrap.id = 'manager-staff-quick-actions';
    wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);align-items:center;';

    var title = document.createElement('span');
    title.textContent = 'Персонал:';
    title.style.cssText = 'font-weight:800;margin-right:4px;color:#e5e7eb;';
    wrap.appendChild(title);

    function addButton(type, text, color){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-green btn-sm';
      b.textContent = text;
      b.style.background = color;
      b.onclick = function(){
        if (vm && typeof vm.openCreateStaff === 'function') vm.openCreateStaff(type);
      };
      wrap.appendChild(b);
    }

    addButton('cook', '👨‍🍳 Добавить повара', '#047857');
    addButton('waiter', '🤵 Добавить официанта', '#0e7490');
    addButton('courier', '🚗 Добавить курьера', '#b45309');

    tabs.parentNode.insertBefore(wrap, tabs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
    document.addEventListener('DOMContentLoaded', installVenueCreateGuard);
  } else {
    install();
    installVenueCreateGuard();
  }
})();
