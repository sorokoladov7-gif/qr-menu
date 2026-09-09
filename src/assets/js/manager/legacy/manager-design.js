(function () {
  'use strict';

  if (!/\/manager\.html$/i.test(location.pathname)) return;

  /*
   * ВАЖНО:
   * Не используем:
   *   app.__vue_app__._instance.proxy
   *
   * В данном проекте Vue 3 создаётся таким образом, что
   * _instance остаётся null.
   *
   * manager.html после выбора заведения сохраняет настоящий Vue VM:
   *   window.__managerVue = this;
   */

  if (window.__managerDesignLoaded) {
    window.__managerDesignReload = true;
    return;
  }

  window.__managerDesignLoaded = true;

  var templates = {
    coffee: {
      name: 'Кофейня',
      emoji: '☕',
      brand_color: '#8b5e3c',
      button_color: '#c47f45',
      header_color: '#fff7ed',
      font_family: 'Plus+Jakarta+Sans',
      card_style: 'soft',
      hero_style: 'warm',
      card_radius: 18,
      button_radius: 12
    },

    shawarma: {
      name: 'Шаурма',
      emoji: '🌯',
      brand_color: '#f97316',
      button_color: '#ea580c',
      header_color: '#fff7ed',
      font_family: 'Montserrat',
      card_style: 'bold',
      hero_style: 'gradient',
      card_radius: 16,
      button_radius: 12
    },

    bakery: {
      name: 'Пекарня',
      emoji: '🥐',
      brand_color: '#d97706',
      button_color: '#b45309',
      header_color: '#fffbeb',
      font_family: 'Montserrat',
      card_style: 'soft',
      hero_style: 'warm',
      card_radius: 20,
      button_radius: 14
    },

    cafe: {
      name: 'Кафе',
      emoji: '🍽️',
      brand_color: '#6366f1',
      button_color: '#4f46e5',
      header_color: '#f8fafc',
      font_family: 'Plus+Jakarta+Sans',
      card_style: 'glass',
      hero_style: 'gradient',
      card_radius: 18,
      button_radius: 12
    },

    streetfood: {
      name: 'Стритфуд',
      emoji: '🍔',
      brand_color: '#ef4444',
      button_color: '#dc2626',
      header_color: '#fff7ed',
      font_family: 'Oswald',
      card_style: 'bold',
      hero_style: 'gradient',
      card_radius: 14,
      button_radius: 10
    },

    premium: {
      name: 'Premium',
      emoji: '✨',
      brand_color: '#a78bfa',
      button_color: '#7c3aed',
      header_color: '#0f172a',
      font_family: 'Plus+Jakarta+Sans',
      card_style: 'glass',
      hero_style: 'dark',
      card_radius: 22,
      button_radius: 14
    },

    dark: {
      name: 'Dark',
      emoji: '🌙',
      brand_color: '#6366f1',
      button_color: '#4f46e5',
      header_color: '#020617',
      font_family: 'Inter',
      card_style: 'glass',
      hero_style: 'dark',
      card_radius: 18,
      button_radius: 12
    },

    minimal: {
      name: 'Minimal',
      emoji: '🤍',
      brand_color: '#111827',
      button_color: '#111827',
      header_color: '#ffffff',
      font_family: 'Inter',
      card_style: 'flat',
      hero_style: 'minimal',
      card_radius: 12,
      button_radius: 10
    }
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  /*
   * Получаем настоящий Vue instance проекта.
   *
   * manager.html делает:
   *
   *   window.__managerVue = this;
   *
   * в selectVenue().
   */
  function getVM() {
    if (
      window.__managerVue &&
      typeof window.__managerVue === 'object'
    ) {
      return window.__managerVue;
    }

    return null;
  }

  function getVenue() {
    var vm = getVM();

    if (vm && vm.venue) {
      return vm.venue;
    }

    if (
      window.__managerSelectedVenue &&
      window.__managerSelectedVenue.id
    ) {
      return window.__managerSelectedVenue;
    }

    return null;
  }

  function getPermissions(venue) {
    if (!venue) return {};

    var p = venue.manager_permissions || {};

    /*
     * Используем и старые, и новые названия.
     */
    return {
      design:
        p.design === true ||
        p.can_edit_design === true,

      branding:
        p.branding === true ||
        p.can_edit_branding === true,

      venue:
        p.venue === true ||
        p.can_edit_venue === true
    };
  }

  function canEditDesign(venue) {
    var vm = getVM();

    /*
     * Администратор имеет полный доступ.
     */
    if (
      vm &&
      vm.profile &&
      vm.profile.role === 'admin'
    ) {
      return true;
    }

    var p = getPermissions(venue);

    return p.design === true;
  }

  /*
   * Получение прав напрямую из Supabase.
   *
   * Это резервный механизм.
   *
   * Он особенно нужен после:
   *
   *   К списку
   *   -> выбрать то же заведение
   *
   * потому что объект venue может быть старым объектом
   * из myVenues.
   */
  var permissionCache = {};
  var permissionRequest = {};

  function loadPermissions(venue, callback) {

    if (!venue || !venue.id) {
      if (callback) callback(venue);
      return;
    }

    var vm = getVM();

    if (
      vm &&
      vm.profile &&
      vm.profile.role === 'admin'
    ) {
      venue.manager_permissions =
        venue.manager_permissions || {};

      venue.manager_permissions.design = true;
      venue.manager_permissions.can_edit_design = true;
      venue.manager_permissions.branding = true;
      venue.manager_permissions.can_edit_branding = true;
      venue.manager_permissions.venue = true;
      venue.manager_permissions.can_edit_venue = true;

      if (callback) callback(venue);
      return;
    }

    if (permissionCache[venue.id]) {

      venue.manager_permissions = Object.assign(
        {},
        venue.manager_permissions || {},
        permissionCache[venue.id]
      );

      if (callback) callback(venue);
      return;
    }

    if (permissionRequest[venue.id]) {

      permissionRequest[venue.id].push(callback);

      return;
    }

    permissionRequest[venue.id] = [callback];

    if (
      typeof db === 'undefined' ||
      !db ||
      !vm ||
      !vm.profile ||
      !vm.profile.id
    ) {
      finishPermissionRequest(
        venue.id,
        venue
      );

      return;
    }

    db
      .from('manager_venue_permissions')
      .select(
        'can_edit_menu,' +
        'can_edit_prices,' +
        'can_edit_delivery,' +
        'can_edit_design,' +
        'can_edit_branding,' +
        'can_edit_venue'
      )
      .eq('manager_id', vm.profile.id)
      .eq('venue_id', venue.id)
      .maybeSingle()

      .then(function (r) {

        if (r.error) {
          console.warn(
            '[Manager Design] permission:',
            r.error.message || r.error
          );

          finishPermissionRequest(
            venue.id,
            venue
          );

          return;
        }

        if (r.data) {

          var permissions = {
            can_edit_menu:
              r.data.can_edit_menu === true,

            can_edit_prices:
              r.data.can_edit_prices === true,

            can_edit_delivery:
              r.data.can_edit_delivery === true,

            can_edit_design:
              r.data.can_edit_design === true,

            can_edit_branding:
              r.data.can_edit_branding === true,

            can_edit_venue:
              r.data.can_edit_venue === true,

            products:
              r.data.can_edit_menu === true,

            prices:
              r.data.can_edit_prices === true,

            delivery:
              r.data.can_edit_delivery === true,

            design:
              r.data.can_edit_design === true,

            branding:
              r.data.can_edit_branding === true,

            venue:
              r.data.can_edit_venue === true
          };

          permissionCache[venue.id] = permissions;

          venue.manager_permissions = Object.assign(
            {},
            venue.manager_permissions || {},
            permissions
          );
        }

        finishPermissionRequest(
          venue.id,
          venue
        );
      })

      .catch(function (e) {

        console.warn(
          '[Manager Design] permission exception:',
          e
        );

        finishPermissionRequest(
          venue.id,
          venue
        );
      });
  }

  function finishPermissionRequest(venueId, venue) {

    var list =
      permissionRequest[venueId] || [];

    delete permissionRequest[venueId];

    list.forEach(function (callback) {

      if (typeof callback === 'function') {
        callback(venue);
      }

    });
  }

  function ensureStyle() {

    if (
      document.getElementById(
        'manager-design-style'
      )
    ) {
      return;
    }

    var s = document.createElement('style');

    s.id = 'manager-design-style';

    s.textContent = `
      #manager-design-tab {
        position: relative;
      }

      #manager-design-tab.md-active {
        color: #fff;
        border-color: #8b5cf6;
        background: rgba(99,102,241,.16);
      }

      #manager-design-host {
        width: 100%;
      }

      .md-wrap {
        padding: 4px 0 30px;
      }

      .md-grid {
        display: grid;
        grid-template-columns:
          minmax(0,1fr) 420px;
        gap: 14px;
      }

      .md-card {
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        background: rgba(255,255,255,.035);
        padding: 16px;
        margin-bottom: 14px;
      }

      .md-templates {
        display: grid;
        grid-template-columns:
          repeat(4,1fr);
        gap: 8px;
      }

      .md-template {
        padding: 11px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        cursor: pointer;
        background: rgba(255,255,255,.02);
        transition: .15s;
      }

      .md-template:hover,
      .md-template.on {
        border-color: #8b5cf6;
        background: rgba(99,102,241,.12);
      }

      .md-template b {
        display: block;
      }

      .md-template span {
        font-size: 22px;
      }

      .md-fields {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .md-field {
        display: grid;
        gap: 5px;
        font-size: 12px;
        color: #94a3b8;
      }

      .md-field input,
      .md-field select {
        width: 100%;
        box-sizing: border-box;
        padding: 9px;
        border-radius: 9px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.04);
        color: inherit;
      }

      .md-field input[type="color"] {
        min-height: 42px;
        padding: 3px;
      }

      .md-two {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .md-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .md-preview {
        background: #0b1020;
        border-radius: 18px;
        padding: 12px;
        min-height: 650px;
      }

      .md-preview iframe {
        width: 100%;
        height: 620px;
        border: 0;
        border-radius: 14px;
        background: #fff;
      }

      .md-note {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 8px;
      }

      .md-badge {
        display: inline-block;
        padding: 5px 9px;
        border-radius: 999px;
        background: rgba(52,211,153,.12);
        color: #6ee7b7;
        font-size: 11px;
      }

      @media(max-width:1050px) {
        .md-grid {
          grid-template-columns: 1fr;
        }

        .md-templates {
          grid-template-columns:
            repeat(2,1fr);
        }
      }
    `;

    document.head.appendChild(s);
  }

  /*
   * Находим именно Vue-шаблонную вкладку.
   */
  function getTabs() {

    var tabs =
      document.querySelector('.tabs');

    if (!tabs) return null;

    /*
     * Не используем первый попавшийся .tabs,
     * если заведение не выбрано.
     */
    if (!getVenue()) return null;

    return tabs;
  }

  /*
   * Создание вкладки.
   *
   * В отличие от старой версии:
   *
   * - не используем _instance.proxy;
   * - используем window.__managerVue;
   * - кнопка восстанавливается после backToList;
   * - повторный render безопасен.
   */
  function ensureTab() {

    var vm = getVM();
    var venue = getVenue();

    if (!vm || !venue) {
      removeTab();
      return null;
    }

    if (!canEditDesign(venue)) {
      removeTab();
      return null;
    }

    var tabs = getTabs();

    if (!tabs) return null;

    var button =
      document.getElementById(
        'manager-design-tab'
      );

    /*
     * Vue может полностью пересоздать .tabs,
     * поэтому старая кнопка может исчезнуть.
     */
    if (
      !button ||
      button.parentNode !== tabs
    ) {

      button =
        document.createElement('button');

      button.id =
        'manager-design-tab';

      button.type = 'button';

      button.textContent =
        '🎨 Дизайн';

      button.onclick =
        function () {

          var currentVM = getVM();

          if (!currentVM) return;

          currentVM.tab = 'design';

          updateTabState();

          renderHost();

        };

      /*
       * Ставим вкладку перед «Настройки»,
       * если такая кнопка существует.
       */
      var settingsButton =
        Array.prototype.find.call(
          tabs.querySelectorAll('button'),
          function (b) {
            return (
              (b.textContent || '')
                .trim() === 'Настройки'
            );
          }
        );

      if (settingsButton) {
        tabs.insertBefore(
          button,
          settingsButton
        );
      } else {
        tabs.appendChild(button);
      }
    }

    updateTabState();

    return button;
  }

  function removeTab() {

    var button =
      document.getElementById(
        'manager-design-tab'
      );

    if (button) {
      button.remove();
    }

    var host =
      document.getElementById(
        'manager-design-host'
      );

    if (host) {
      host.remove();
    }
  }

  function updateTabState() {

    var button =
      document.getElementById(
        'manager-design-tab'
      );

    var vm = getVM();

    if (!button) return;

    button.classList.toggle(
      'md-active',
      !!(
        vm &&
        vm.tab === 'design'
      )
    );
  }

  function ensureHost() {

    var vm = getVM();
    var venue = getVenue();

    if (!vm || !venue) return null;

    var tabs = getTabs();

    if (!tabs) return null;

    var host =
      document.getElementById(
        'manager-design-host'
      );

    if (
      !host ||
      !host.parentNode
    ) {

      host =
        document.createElement('div');

      host.id =
        'manager-design-host';

      tabs.parentNode.insertBefore(
        host,
        tabs.nextSibling
      );
    }

    return host;
  }

  function currentSettings(venue) {

    var d =
      venue.design_settings || {};

    return Object.assign(
      {
        template: 'default',

        brand_color:
          venue.brand_color ||
          '#6366f1',

        button_color:
          '#8b5cf6',

        header_color:
          '#ffffff',

        font_family:
          'Plus+Jakarta+Sans',

        hero_enabled: true,

        hero_style:
          'gradient',

        card_style:
          'glass',

        card_radius: 18,

        button_radius: 12,

        button_style:
          'gradient',

        category_style:
          'chips',

        image_ratio:
          '4:3'
      },
      d
    );
  }

  function renderHost() {

    var vm = getVM();
    var venue = getVenue();

    if (!vm || !venue) {
      return;
    }

    if (!canEditDesign(venue)) {
      return;
    }

    var host = ensureHost();

    if (!host) return;

    if (host.dataset.venueId !== venue.id) {

      host.dataset.venueId =
        venue.id;

      host.innerHTML = '';

      render(host, vm, venue);
    }

    updateTabState();

    host.style.display =
      vm.tab === 'design'
        ? 'block'
        : 'none';
  }

  function render(host, vm, venue) {

    ensureStyle();

    var d =
      currentSettings(venue);

    var html = '';

    html +=
      '<div class="md-wrap">';

    html +=
      '<div class="spread" style="margin-bottom:14px">';

    html +=
      '<div>' +
      '<h3 style="margin:0 0 4px">' +
      '🎨 Дизайн заведения' +
      '</h3>' +
      '<div class="muted" style="font-size:12px">' +
      'Фирменный стиль, карточки, кнопки и главный экран' +
      '</div>' +
      '</div>';

    html +=
      '<span class="md-badge">' +
      'Доступ разрешён' +
      '</span>';

    html +=
      '</div>';

    html +=
      '<div class="md-grid">';

    html += '<div>';

    html +=
      '<div class="md-card">' +
      '<h4 style="margin-top:0">' +
      'Шаблоны' +
      '</h4>' +
      '<div class="md-templates">';

    Object.keys(templates).forEach(
      function (key) {

        var t =
          templates[key];

        html +=
          '<div class="md-template" ' +
          'data-template="' +
          esc(key) +
          '">' +
          '<span>' +
          t.emoji +
          '</span>' +
          '<b>' +
          esc(t.name) +
          '</b>' +
          '</div>';
      }
    );

    html +=
      '</div>' +
      '</div>';

    html +=
      '<div class="md-card">' +
      '<h4 style="margin-top:0">' +
      'Фирменный стиль' +
      '</h4>' +

      '<div class="md-fields">';

    html +=
      '<div class="md-two">' +

      '<label class="md-field">' +
      'Основной цвет' +
      '<input id="md-brand" type="color" value="' +
      esc(d.brand_color) +
      '">' +
      '</label>' +

      '<label class="md-field">' +
      'Цвет кнопок' +
      '<input id="md-button" type="color" value="' +
      esc(d.button_color) +
      '">' +
      '</label>' +

      '</div>';

    html +=
      '<div class="md-two">' +

      '<label class="md-field">' +
      'Цвет заголовка' +
      '<input id="md-header" type="color" value="' +
      esc(d.header_color) +
      '">' +
      '</label>' +

      '<label class="md-field">' +
      'Шрифт' +
      '<select id="md-font">' +
      '<option>Plus+Jakarta+Sans</option>' +
      '<option>Inter</option>' +
      '<option>Roboto</option>' +
      '<option>Montserrat</option>' +
      '<option>Oswald</option>' +
      '</select>' +
      '</label>' +

      '</div>';

    html +=
      '<div class="md-two">' +

      '<label class="md-field">' +
      'Карточки' +
      '<select id="md-card">' +
      '<option value="glass">Glass</option>' +
      '<option value="soft">Мягкие</option>' +
      '<option value="bold">Акцентные</option>' +
      '<option value="flat">Плоские</option>' +
      '</select>' +
      '</label>' +

      '<label class="md-field">' +
      'Главный экран' +
      '<select id="md-hero">' +
      '<option value="gradient">Градиент</option>' +
      '<option value="warm">Тёплый</option>' +
      '<option value="dark">Dark</option>' +
      '<option value="minimal">Minimal</option>' +
      '</select>' +
      '</label>' +

      '</div>';

    html +=
      '<div class="md-two">' +

      '<label class="md-field">' +
      'Радиус карточек' +
      '<input id="md-cr" type="number" min="0" max="40" value="' +
      Number(d.card_radius || 18) +
      '">' +
      '</label>' +

      '<label class="md-field">' +
      'Радиус кнопок' +
      '<input id="md-br" type="number" min="0" max="40" value="' +
      Number(d.button_radius || 12) +
      '">' +
      '</label>' +

      '</div>';

    html +=
      '<div class="md-two">' +

      '<label class="md-field">' +
      'Кнопки' +
      '<select id="md-bs">' +
      '<option value="gradient">Градиент</option>' +
      '<option value="solid">Сплошные</option>' +
      '<option value="outline">Контур</option>' +
      '</select>' +
      '</label>' +

      '<label class="md-field">' +
      'Фото' +
      '<select id="md-ratio">' +
      '<option value="4:3">4:3</option>' +
      '<option value="1:1">1:1</option>' +
      '<option value="16:9">16:9</option>' +
      '</select>' +
      '</label>' +

      '</div>';

    html +=
      '<label class="md-field">' +
      '<span>' +
      '<input id="md-hero-enabled" type="checkbox" ' +
      (d.hero_enabled !== false
        ? 'checked'
        : '') +
      '>' +
      ' Показывать главный экран' +
      '</span>' +
      '</label>';

    html +=
      '</div>' +

      '<div class="md-actions">' +

      '<button id="md-save" class="btn btn-primary">' +
      'Сохранить дизайн' +
      '</button>' +

      '<button id="md-reset" class="btn btn-ghost">' +
      'Восстановить стандартный' +
      '</button>' +

      '</div>' +

      '<div id="md-msg" class="md-note"></div>' +

      '</div>';

    html += '</div>';

    html +=
      '<div class="md-preview">' +
      '<h4 style="margin:0 0 10px">' +
      'Предпросмотр' +
      '</h4>' +

      '<iframe id="md-frame" ' +
      'title="Предпросмотр меню">' +
      '</iframe>' +

      '<div class="md-note">' +
      'Предпросмотр использует реальное клиентское меню заведения.' +
      '</div>' +

      '</div>';

    html +=
      '</div>' +
      '</div>';

    host.innerHTML = html;

    var font =
      host.querySelector('#md-font');

    if (font) {
      font.value =
        d.font_family ||
        'Plus+Jakarta+Sans';
    }

    var card =
      host.querySelector('#md-card');

    if (card) {
      card.value =
        d.card_style ||
        'glass';
    }

    var hero =
      host.querySelector('#md-hero');

    if (hero) {
      hero.value =
        d.hero_style ||
        'gradient';
    }

    var bs =
      host.querySelector('#md-bs');

    if (bs) {
      bs.value =
        d.button_style ||
        'gradient';
    }

    var ratio =
      host.querySelector('#md-ratio');

    if (ratio) {
      ratio.value =
        d.image_ratio ||
        '4:3';
    }

    Object.keys(templates)
      .forEach(function (key) {

        var el =
          host.querySelector(
            '[data-template="' +
            key +
            '"]'
          );

        if (el) {
          el.onclick =
            function () {
              applyTemplate(
                host,
                key
              );
            };
        }
      });

    var save =
      host.querySelector('#md-save');

    if (save) {
      save.onclick =
        function () {
          saveDesign(
            host,
            vm,
            venue
          );
        };
    }

    var reset =
      host.querySelector('#md-reset');

    if (reset) {
      reset.onclick =
        function () {

          applyTemplate(
            host,
            'cafe'
          );

          var msg =
            host.querySelector(
              '#md-msg'
            );

          if (msg) {
            msg.textContent =
              'Выбран стандартный стиль. Нажмите «Сохранить».';
          }
        };
    }

    var frame =
      host.querySelector(
        '#md-frame'
      );

    if (frame) {

      frame.src =
        '/menu.html?venue=' +
        encodeURIComponent(
          venue.slug
        ) +
        '&designPreview=1';
    }
  }

  function applyTemplate(host, key) {

    var t =
      templates[key];

    if (!t) return;

    var map = {
      brand_color: '#md-brand',
      button_color: '#md-button',
      header_color: '#md-header',
      font_family: '#md-font',
      card_style: '#md-card',
      hero_style: '#md-hero',
      card_radius: '#md-cr',
      button_radius: '#md-br'
    };

    Object.keys(map)
      .forEach(function (name) {

        var el =
          host.querySelector(
            map[name]
          );

        if (!el) return;

        if (
          t[name] !== undefined
        ) {
          el.value =
            t[name];
        }
      });

    host
      .querySelectorAll(
        '.md-template'
      )
      .forEach(function (el) {

        el.classList.toggle(
          'on',
          el.dataset.template === key
        );
      });
  }

  function saveDesign(
    host,
    vm,
    venue
  ) {

    if (
      typeof db === 'undefined'
    ) {
      return;
    }

    var msg =
      host.querySelector(
        '#md-msg'
      );

    if (msg) {
      msg.textContent =
        'Сохранение…';
    }

    var selected =
      host.querySelector(
        '.md-template.on'
      );

    var settings = {

      template:
        selected &&
        selected.dataset
          ? selected.dataset.template
          : 'custom',

      brand_color:
        host.querySelector(
          '#md-brand'
        ).value,

      button_color:
        host.querySelector(
          '#md-button'
        ).value,

      header_color:
        host.querySelector(
          '#md-header'
        ).value,

      font_family:
        host.querySelector(
          '#md-font'
        ).value,

      card_style:
        host.querySelector(
          '#md-card'
        ).value,

      hero_style:
        host.querySelector(
          '#md-hero'
        ).value,

      hero_enabled:
        host.querySelector(
          '#md-hero-enabled'
        ).checked,

      card_radius:
        Number(
          host.querySelector(
            '#md-cr'
          ).value
        ) || 18,

      button_radius:
        Number(
          host.querySelector(
            '#md-br'
          ).value
        ) || 12,

      button_style:
        host.querySelector(
          '#md-bs'
        ).value,

      image_ratio:
        host.querySelector(
          '#md-ratio'
        ).value
    };

    db
      .rpc(
        'manager_save_design',
        {
          p_venue_id:
            venue.id,

          p_design_settings:
            settings
        }
      )

      .then(function (r) {

        if (r.error) {
          throw r.error;
        }

        /*
         * Обновляем объект Vue.
         */
        if (vm.venue) {

          vm.venue.design_settings =
            r.data;

        }

        /*
         * Обновляем объект списка заведений,
         * чтобы при возврате к списку и повторном
         * выборе настройки не терялись локально.
         */
        if (
          Array.isArray(
            vm.myVenues
          )
        ) {

          var item =
            vm.myVenues.find(
              function (x) {
                return x.id === venue.id;
              }
            );

          if (item) {
            item.design_settings =
              r.data;
          }
        }

        if (msg) {
          msg.textContent =
            'Сохранено';
        }

        var frame =
          host.querySelector(
            '#md-frame'
          );

        if (frame) {

          frame.src =
            '/menu.html?venue=' +
            encodeURIComponent(
              venue.slug
            ) +
            '&designPreview=1&t=' +
            Date.now();
        }

      })

      .catch(function (e) {

        console.error(
          '[Manager Design] save:',
          e
        );

        if (msg) {
          msg.textContent =
            'Ошибка: ' +
            (
              e.message ||
              String(e)
            );
        }
      });
  }

  /*
   * Главный цикл.
   *
   * 1. Ждём Vue.
   * 2. Ждём выбор заведения.
   * 3. Загружаем права.
   * 4. Создаём вкладку.
   * 5. После backToList удаляем её.
   * 6. После повторного выбора создаём заново.
   */
  var lastVenueId = null;
  var lastVenueObject = null;

  function tick() {

    var vm = getVM();
    var venue = getVenue();

    /*
     * Нет Vue / нет заведения.
     */
    if (!vm || !venue) {

      lastVenueId = null;
      lastVenueObject = null;

      removeTab();

      return;
    }

    /*
     * Новое заведение.
     */
    if (
      lastVenueId !== venue.id ||
      lastVenueObject !== venue
    ) {

      lastVenueId =
        venue.id;

      lastVenueObject =
        venue;

      /*
       * Сначала показываем вкладку,
       * если право уже есть в объекте.
       */
      if (canEditDesign(venue)) {

        ensureTab();
        renderHost();

      }

      /*
       * Затем обязательно обновляем права из БД.
       */
      loadPermissions(
        venue,
        function (updatedVenue) {

          var currentVM =
            getVM();

          if (!currentVM) return;

          /*
           * Если Vue уже переключился
           * на другое заведение —
           * ничего не делаем.
           */
          if (
            !currentVM.venue ||
            currentVM.venue.id !==
              updatedVenue.id
          ) {
            return;
          }

          /*
           * Важно:
           * сохраняем обновлённые права
           * непосредственно в reactive-объект Vue.
           */
          currentVM.venue.manager_permissions =
            updatedVenue.manager_permissions;

          if (
            canEditDesign(
              currentVM.venue
            )
          ) {

            ensureTab();
            renderHost();

          } else {

            removeTab();

          }
        }
      );

      return;
    }

    /*
     * Vue мог пересоздать .tabs.
     * Проверяем наличие вкладки постоянно.
     */
    if (
      canEditDesign(venue)
    ) {

      ensureTab();
      renderHost();

    } else {

      removeTab();

    }

    updateTabState();

    var host =
      document.getElementById(
        'manager-design-host'
      );

    if (
      host &&
      vm.tab !== 'design'
    ) {
      host.style.display =
        'none';
    }

    if (
      host &&
      vm.tab === 'design'
    ) {
      host.style.display =
        'block';
    }
  }

  function boot() {

    ensureStyle();

    /*
     * Vue и manager.html могут загрузиться
     * в разное время.
     */
    setInterval(
      tick,
      300
    );

    tick();
  }

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      boot
    );

  } else {

    boot();

  }

})();
