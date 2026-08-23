/* Manager personnel tab: stable UI bridge for the existing Vue analytics. */
(function () {
  'use strict';
  if (!/\/manager\.html$/i.test(location.pathname)) return;

  var installed = false;
  var personnelActive = false;

  function getVm() {
    var app = document.getElementById('app');
    return app && app.__vueParentComponent && app.__vueParentComponent.proxy;
  }

  function findTabButton(text) {
    var tabs = document.querySelector('.tabs');
    if (!tabs) return null;
    var buttons = tabs.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var t = (buttons[i].textContent || '').trim();
      if (t === text || t.indexOf(text) !== -1) return buttons[i];
    }
    return null;
  }

  function ensurePersonnelTab(vm) {
    var tabs = document.querySelector('.tabs');
    if (!tabs || !vm || !vm.venue) return false;
    if (tabs.querySelector('[data-manager-personnel-tab]')) return true;

    var cooksButton = findTabButton('Повара');
    if (!cooksButton) return false;

    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-manager-personnel-tab', '1');
    button.textContent = '👥 Персонал';
    button.style.cssText = 'font-weight:800;';

    button.addEventListener('click', function () {
      var current = getVm();
      if (!current || !current.venue) return;

      personnelActive = true;
      current.tab = 'analytics';
      if (typeof current.loadStaffAnalytics === 'function') {
        current.loadStaffAnalytics();
      }

      waitForPersonnelAnalytics(0);
    });

    tabs.insertBefore(button, cooksButton);
    updatePersonnelState(vm);
    return true;
  }

  function waitForPersonnelAnalytics(attempt) {
    var vm = getVm();
    var heading = findPersonnelHeading();

    if (heading) {
      var card = heading.closest('.glass.card');
      if (card) {
        card.style.borderColor = '#6366f1';
        card.style.boxShadow = '0 0 0 1px rgba(99,102,241,.2), 0 12px 35px rgba(0,0,0,.18)';
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      updatePersonnelState(vm);
      return;
    }

    if (attempt < 40) {
      setTimeout(function () { waitForPersonnelAnalytics(attempt + 1); }, 150);
    }
  }

  function findPersonnelHeading() {
    var nodes = document.querySelectorAll('h3,h4,h5,div');
    for (var i = 0; i < nodes.length; i++) {
      var text = (nodes[i].textContent || '').trim();
      if (text.indexOf('Производительность персонала') !== -1) return nodes[i];
    }
    return null;
  }

  function updatePersonnelState(vm) {
    var button = document.querySelector('[data-manager-personnel-tab]');
    if (!button) return;
    var active = personnelActive && vm && vm.tab === 'analytics';
    button.classList.toggle('on', !!active);
  }

  function maintain() {
    var vm = getVm();
    if (!vm || !vm.venue) {
      setTimeout(maintain, 300);
      return;
    }

    ensurePersonnelTab(vm);
    updatePersonnelState(vm);

    var tabs = document.querySelector('.tabs');
    if (tabs) {
      var buttons = tabs.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].getAttribute('data-manager-personnel-tab') === '1') continue;
        if (!buttons[i].__qrPersonnelBound) {
          buttons[i].__qrPersonnelBound = true;
          buttons[i].addEventListener('click', function () {
            personnelActive = false;
            setTimeout(function () { updatePersonnelState(getVm()); }, 0);
          });
        }
      }
    }

    setTimeout(maintain, 500);
  }

  function boot() {
    maintain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
