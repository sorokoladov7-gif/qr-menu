(function(){
  'use strict';
  var path = location.pathname.toLowerCase();
  if (!/\/manager\.html$/i.test(path)) return;

  function getVm(){
    var app = document.getElementById('app');
    return app && app.__vueParentComponent && app.__vueParentComponent.proxy;
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
