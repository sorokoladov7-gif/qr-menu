(function () {
  'use strict';

  if (!/\/manager\.html$/i.test(location.pathname)) return;

  if (window.__managerDesignLoaded) return;
  window.__managerDesignLoaded = true;

  /* =========================================================
     DESIGN TEMPLATES
  ========================================================= */

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

  /* =========================================================
     HELPERS
  ========================================================= */

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
   * ВАЖНО:
   * В этом проекте __vue_app__._instance = null.
   * Рабочий proxy находится на __vueParentComponent.proxy.
   */

  function getProxy() {
    var root = document.getElementById('app');

    if (!root) return null;

    try {
      if (
        root.__vueParentComponent &&
        root.__vueParentComponent.proxy
      ) {
        return root.__vueParentComponent.proxy;
      }
    } catch (e) {}

    try {
      if (
        root.__vue_app__ &&
        root.__vue_app__._instance &&
        root.__vue_app__._instance.proxy
      ) {
        return root.__vue_app__._instance.proxy;
      }
    } catch (e) {}

    try {
      if (
        window.__QR_MANAGER_VUE_APP__ &&
        window.__QR_MANAGER_VUE_APP__._instance &&
        window.__QR_MANAGER_VUE_APP__._instance.proxy
      ) {
        return window.__QR_MANAGER_VUE_APP__._instance.proxy;
      }
    } catch (e) {}

    return null;
  }

  function getVenueId(p) {
    return p &&
      p.venue &&
      p.venue.id
      ? String(p.venue.id)
      : null;
  }

  /* =========================================================
     PERMISSIONS
  ========================================================= */

  var permissionVenueId = null;
  var permissionLoading = false;
  var permissionRequestVenueId = null;

  function setPermission(target, source, key, legacyKey) {
    if (!source) return;

    if (Object.prototype.hasOwnProperty.call(source, key)) {
      var value = source[key] === true;

      target[legacyKey] = value;
      target[key] = value;
    }
  }

  function applyPermissions(p, x) {
    if (!p || !p.venue) return;

    x = x || {};

    var current = Object.assign(
      {},
      p.venue.manager_permissions || {}
    );

    setPermission(current, x, 'can_edit_menu', 'products');
    setPermission(current, x, 'can_edit_prices', 'prices');
    setPermission(current, x, 'can_edit_delivery', 'delivery');
    setPermission(current, x, 'can_edit_design', 'design');
    setPermission(current, x, 'can_edit_branding', 'branding');
    setPermission(current, x, 'can_edit_venue', 'venue');

    p.venue.manager_permissions = current;
  }

  function clearPermissions(p) {
    if (!p || !p.venue) return;

    applyPermissions(p, {
      can_edit_menu: false,
      can_edit_prices: false,
      can_edit_delivery: false,
      can_edit_design: false,
      can_edit_branding: false,
      can_edit_venue: false
    });
  }

  function loadPermissions(p, done) {
    var venueId = getVenueId(p);

    if (!p || !p.venue || !venueId) {
      if (done) done();
      return;
    }

    /*
     * Администратор получает все права.
     */

    if (
      p.profile &&
      p.profile.role === 'admin'
    ) {
      applyPermissions(p, {
        can_edit_menu: true,
        can_edit_prices: true,
        can_edit_delivery: true,
        can_edit_design: true,
        can_edit_branding: true,
        can_edit_venue: true
      });

      permissionVenueId = venueId;
      permissionLoading = false;

      if (done) done();
      return;
    }

    /*
     * Уже загрузили права именно для этого заведения.
     */

    if (
      permissionVenueId === venueId &&
      !permissionLoading
    ) {
      if (done) done();
      return;
    }

    /*
     * Не блокируем новое заведение старым запросом.
     */

    if (
      permissionLoading &&
      permissionRequestVenueId === venueId
    ) {
      if (done) done();
      return;
    }

    permissionLoading = true;
    permissionRequestVenueId = venueId;

    /*
     * Сбрасываем старые права перед загрузкой нового заведения.
     */

    clearPermissions(p);

    if (
      typeof db === 'undefined' ||
      !db ||
      !db.from
    ) {
      console.warn(
        '[Manager Design] Supabase db недоступен'
      );

      permissionLoading = false;
      permissionVenueId = venueId;

      if (done) done();
      return;
    }

    var managerId =
      p.profile && p.profile.id
        ? p.profile.id
        : '';

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
      .eq('manager_id', managerId)
      .eq('venue_id', venueId)
      .maybeSingle()

      .then(function (r) {

        if (r.error) {
          console.warn(
            '[Manager Design] permission bridge:',
            r.error.message || r.error
          );
        }

        if (r.data) {
          applyPermissions(p, r.data);
        }

        permissionVenueId = venueId;
        permissionRequestVenueId = null;
        permissionLoading = false;

        if (done) done();
      })

      .catch(function (e) {

        permissionRequestVenueId = null;
        permissionLoading = false;
        permissionVenueId = venueId;

        console.warn(
          '[Manager Design] permission bridge exception:',
          e
        );

        if (done) done();
      });
  }

  function allowed(p) {
    if (
      !p ||
      !p.venue ||
      !p.venue.manager_permissions
    ) {
      return false;
    }

    var permissions =
      p.venue.manager_permissions;

    return (
      permissions.design === true ||
      permissions.can_edit_design === true
    );
  }

  /* =========================================================
     STYLE
  ========================================================= */

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
      .md-wrap{
        padding:4px 0 30px
      }

      .md-grid{
        display:grid;
        grid-template-columns:minmax(0,1fr) 420px;
        gap:14px
      }

      .md-card{
        border:1px solid rgba(255,255,255,.1);
        border-radius:16px;
        background:rgba(255,255,255,.035);
        padding:16px;
        margin-bottom:14px
      }

      .md-templates{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px
      }

      .md-template{
        padding:11px;
        border:1px solid rgba(255,255,255,.1);
        border-radius:12px;
        cursor:pointer;
        background:rgba(255,255,255,.02)
      }

      .md-template:hover,
      .md-template.on{
        border-color:#8b5cf6;
        background:rgba(99,102,241,.12)
      }

      .md-template b{
        display:block
      }

      .md-template span{
        font-size:22px
      }

      .md-fields{
        display:grid;
        gap:10px;
        margin-top:12px
      }

      .md-field{
        display:grid;
        gap:5px;
        font-size:12px;
        color:#94a3b8
      }

      .md-field input,
      .md-field select{
        width:100%;
        box-sizing:border-box;
        padding:9px;
        border-radius:9px;
        border:1px solid rgba(255,255,255,.1);
        background:rgba(255,255,255,.04);
        color:inherit
      }

      .md-two{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px
      }

      .md-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:14px
      }

      .md-preview{
        background:#0b1020;
        border-radius:18px;
        padding:12px;
        min-height:650px
      }

      .md-preview iframe{
        width:100%;
        height:620px;
        border:0;
        border-radius:14px;
        background:#fff
      }

      .md-note{
        font-size:11px;
        color:#94a3b8;
        margin-top:8px
      }

      .md-badge{
        display:inline-block;
        padding:5px 9px;
        border-radius:999px;
        background:rgba(52,211,153,.12);
        color:#6ee7b7;
        font-size:11px
      }

      @media(max-width:1050px){
        .md-grid{
          grid-template-columns:1fr
        }

        .md-templates{
          grid-template-columns:repeat(2,1fr)
        }
      }
    `;

    document.head.appendChild(s);
  }

  /* =========================================================
     SETTINGS
  ========================================================= */

  function currentSettings(p) {

    var d =
      p &&
      p.venue &&
      p.venue.design_settings
        ? p.venue.design_settings
        : {};

    return Object.assign(
      {
        template: 'default',
        brand_color:
          p.venue.brand_color ||
          '#6366f1',

        button_color: '#8b5cf6',
        header_color: '#ffffff',

        font_family:
          'Plus+Jakarta+Sans',

        hero_enabled: true,
        hero_style: 'gradient',
        card_style: 'glass',

        card_radius: 18,
        button_radius: 12,

        button_style: 'gradient',
        category_style: 'chips',
        image_ratio: '4:3'
      },
      d
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function render(host, p) {

    if (!host || !p || !p.venue) return;

    ensureStyle();

    var d = currentSettings(p);

    var html = `
      <div class="md-wrap">

        <div
          class="spread"
          style="margin-bottom:14px"
        >
          <div>
            <h3 style="margin:0 0 4px">
              🎨 Дизайн заведения
            </h3>

            <div
              class="muted"
              style="font-size:12px"
            >
              Фирменный стиль, карточки,
              кнопки и главный экран
            </div>
          </div>

          <span class="md-badge">
            Доступ выдан администратором
          </span>
        </div>

        <div class="md-grid">

          <div>

            <div class="md-card">

              <h4 style="margin-top:0">
                Шаблоны
              </h4>

              <div class="md-templates">
    `;

    Object.keys(templates).forEach(function (k) {

      var t = templates[k];

      html += `
        <div
          class="md-template"
          data-template="${esc(k)}"
        >
          <span>${t.emoji}</span>
          <b>${esc(t.name)}</b>
        </div>
      `;
    });

    html += `
              </div>
            </div>

            <div class="md-card">

              <h4 style="margin-top:0">
                Фирменный стиль
              </h4>

              <div class="md-fields">

                <div class="md-two">

                  <label class="md-field">
                    Основной цвет
                    <input
                      id="md-brand"
                      type="color"
                      value="${esc(d.brand_color)}"
                    >
                  </label>

                  <label class="md-field">
                    Цвет кнопок
                    <input
                      id="md-button"
                      type="color"
                      value="${esc(d.button_color)}"
                    >
                  </label>

                </div>

                <div class="md-two">

                  <label class="md-field">
                    Цвет заголовка
                    <input
                      id="md-header"
                      type="color"
                      value="${esc(d.header_color)}"
                    >
                  </label>

                  <label class="md-field">
                    Шрифт

                    <select id="md-font">
                      <option>Plus+Jakarta+Sans</option>
                      <option>Inter</option>
                      <option>Roboto</option>
                      <option>Montserrat</option>
                      <option>Oswald</option>
                    </select>

                  </label>

                </div>

                <div class="md-two">

                  <label class="md-field">
                    Карточки

                    <select id="md-card">
                      <option value="glass">Glass</option>
                      <option value="soft">Мягкие</option>
                      <option value="bold">Акцентные</option>
                      <option value="flat">Плоские</option>
                    </select>

                  </label>

                  <label class="md-field">
                    Главный экран

                    <select id="md-hero">
                      <option value="gradient">Градиент</option>
                      <option value="warm">Тёплый</option>
                      <option value="dark">Dark</option>
                      <option value="minimal">Minimal</option>
                    </select>

                  </label>

                </div>

                <div class="md-two">

                  <label class="md-field">
                    Радиус карточек

                    <input
                      id="md-cr"
                      type="number"
                      min="0"
                      max="40"
                      value="${Number(d.card_radius || 18)}"
                    >
                  </label>

                  <label class="md-field">
                    Радиус кнопок

                    <input
                      id="md-br"
                      type="number"
                      min="0"
                      max="40"
                      value="${Number(d.button_radius || 12)}"
                    >
                  </label>

                </div>

                <div class="md-two">

                  <label class="md-field">
                    Кнопки

                    <select id="md-bs">
                      <option value="gradient">Градиент</option>
                      <option value="solid">Сплошные</option>
                      <option value="outline">Контур</option>
                    </select>

                  </label>

                  <label class="md-field">
                    Фото

                    <select id="md-ratio">
                      <option value="4:3">4:3</option>
                      <option value="1:1">1:1</option>
                      <option value="16:9">16:9</option>
                    </select>

                  </label>

                </div>

                <label class="md-field">

                  <span>
                    <input
                      id="md-hero-enabled"
                      type="checkbox"
                      ${d.hero_enabled !== false ? 'checked' : ''}
                    >

                    Показывать главный экран
                  </span>

                </label>

              </div>

              <div class="md-actions">

                <button
                  id="md-save"
                  class="btn btn-primary"
                >
                  Сохранить дизайн
                </button>

                <button
                  id="md-reset"
                  class="btn btn-ghost"
                >
                  Восстановить стандартный
                </button>

              </div>

              <div
                id="md-msg"
                class="md-note"
              ></div>

            </div>

          </div>

          <div class="md-preview">

            <h4 style="margin:0 0 10px">
              Предпросмотр
            </h4>

            <iframe
              id="md-frame"
              title="Предпросмотр меню"
            ></iframe>

            <div class="md-note">
              Предпросмотр использует
              реальное клиентское меню заведения.
            </div>

          </div>

        </div>

      </div>
    `;

    host.innerHTML = html;

    var font = host.querySelector('#md-font');

    if (font) {
      font.value =
        d.font_family ||
        'Plus+Jakarta+Sans';
    }

    var card =
      host.querySelector('#md-card');

    if (card) {
      card.value =
        d.card_style || 'glass';
    }

    var hero =
      host.querySelector('#md-hero');

    if (hero) {
      hero.value =
        d.hero_style || 'gradient';
    }

    var bs =
      host.querySelector('#md-bs');

    if (bs) {
      bs.value =
        d.button_style || 'gradient';
    }

    var ratio =
      host.querySelector('#md-ratio');

    if (ratio) {
      ratio.value =
        d.image_ratio || '4:3';
    }

    Object.keys(templates).forEach(function (k) {

      var el =
        host.querySelector(
          '[data-template="' + k + '"]'
        );

      if (el) {
        el.onclick = function () {
          applyTemplate(host, k);
        };
      }
    });

    var save =
      host.querySelector('#md-save');

    if (save) {
      save.onclick = function () {
        saveDesign(host, p);
      };
    }

    var reset =
      host.querySelector('#md-reset');

    if (reset) {
      reset.onclick = function () {

        applyTemplate(
          host,
          'cafe'
        );

        var msg =
          host.querySelector('#md-msg');

        if (msg) {
          msg.textContent =
            'Выбран стандартный стиль. Нажмите «Сохранить».';
        }
      };
    }

    var frame =
      host.querySelector('#md-frame');

    if (frame) {
      frame.src =
        '/menu.html?venue=' +
        encodeURIComponent(p.venue.slug) +
        '&designPreview=1';
    }
  }

  /* =========================================================
     APPLY TEMPLATE
  ========================================================= */

  function applyTemplate(host, k) {

    var t = templates[k];

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

    Object.keys(map).forEach(function (key) {

      var el =
        host.querySelector(map[key]);

      if (!el) return;

      if (
        el.type === 'color' ||
        el.type === 'text'
      ) {
        if (t[key]) {
          el.value = t[key];
        }
      } else {
        if (t[key]) {
          el.value = t[key];
        }
      }
    });

    host
      .querySelectorAll('.md-template')
      .forEach(function (x) {

        x.classList.toggle(
          'on',
          x.dataset.template === k
        );

      });
  }

  /* =========================================================
     SAVE
  ========================================================= */

  function saveDesign(host, p) {

    var msg =
      host.querySelector('#md-msg');

    if (msg) {
      msg.textContent = 'Сохранение…';
    }

    var selected =
      host.querySelector('.md-template.on');

    var settings = {

      template:
        selected &&
        selected.dataset
          ? selected.dataset.template
          : 'custom',

      brand_color:
        host.querySelector('#md-brand').value,

      button_color:
        host.querySelector('#md-button').value,

      header_color:
        host.querySelector('#md-header').value,

      font_family:
        host.querySelector('#md-font').value,

      card_style:
        host.querySelector('#md-card').value,

      hero_style:
        host.querySelector('#md-hero').value,

      hero_enabled:
        host.querySelector('#md-hero-enabled').checked,

      card_radius:
        Number(
          host.querySelector('#md-cr').value
        ) || 18,

      button_radius:
        Number(
          host.querySelector('#md-br').value
        ) || 12,

      button_style:
        host.querySelector('#md-bs').value,

      image_ratio:
        host.querySelector('#md-ratio').value
    };

    if (
      typeof db === 'undefined' ||
      !db ||
      !db.rpc
    ) {
      if (msg) {
        msg.textContent =
          'Ошибка: Supabase недоступен';
      }

      return;
    }

    db
      .rpc(
        'manager_save_design',
        {
          p_venue_id: p.venue.id,
          p_design_settings: settings
        }
      )

      .then(function (r) {

        if (r.error) {
          throw r.error;
        }

        p.venue.design_settings =
          r.data;

        if (msg) {
          msg.textContent =
            'Сохранено';
        }

        var frame =
          host.querySelector('#md-frame');

        if (frame) {
          frame.src =
            '/menu.html?venue=' +
            encodeURIComponent(
              p.venue.slug
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
            (e.message || e);
        }
      });
  }

  /* =========================================================
     BUILD
  ========================================================= */

  function build() {

    var p = getProxy();

    if (!p || !p.venue) {
      return;
    }

    var tabs =
      document.querySelector('.tabs');

    if (!tabs) {
      return;
    }

    var venueId =
      getVenueId(p);

    if (!venueId) {
      return;
    }

    var old =
      document.getElementById(
        'manager-design-host'
      );

    /*
     * Если право пропало — убираем вкладку.
     */

    if (!allowed(p)) {

      if (old) {
        old.style.display = 'none';
      }

      var deniedTab =
        document.getElementById(
          'manager-design-tab'
        );

      if (deniedTab) {
        deniedTab.remove();
      }

      return;
    }

    /*
     * Создаём вкладку.
     */

    var tab =
      document.getElementById(
        'manager-design-tab'
      );

    if (!tab) {

      tab =
        document.createElement('button');

      tab.id =
        'manager-design-tab';

      tab.type =
        'button';

      tab.textContent =
        '🎨 Дизайн';

      tab.onclick =
        function () {

          try {
            p.tab = 'design';
          } catch (e) {}

          sync();
        };

      tabs.appendChild(tab);
    }

    /*
     * Создаём контейнер.
     */

    if (!old) {

      old =
        document.createElement('div');

      old.id =
        'manager-design-host';

      old.style.display =
        'none';

      tabs.parentNode.insertBefore(
        old,
        tabs.nextSibling
      );
    }

    /*
     * Если пользователь вернулся из списка
     * заведений и выбрал другое заведение —
     * полностью перерисовываем редактор.
     */

    if (
      old.dataset.venueId !== venueId
    ) {

      old.dataset.venueId =
        venueId;

      render(old, p);
    }

    sync();
  }

  /* =========================================================
     SYNC
  ========================================================= */

  function sync() {

    var p = getProxy();

    if (!p || !p.venue) {
      return;
    }

    var host =
      document.getElementById(
        'manager-design-host'
      );

    var tab =
      document.getElementById(
        'manager-design-tab'
      );

    /*
     * Vue мог полностью заменить DOM.
     * В этом случае build() создаст элементы заново.
     */

    if (!host || !tab) {
      return;
    }

    var ok =
      allowed(p);

    tab.style.display =
      ok ? '' : 'none';

    host.style.display =
      ok &&
      p.tab === 'design'
        ? 'block'
        : 'none';

    if (
      ok &&
      p.tab === 'design' &&
      host.dataset.venueId !==
        getVenueId(p)
    ) {

      host.dataset.venueId =
        getVenueId(p);

      render(host, p);
    }
  }

  /* =========================================================
     PERMISSION + BUILD LOOP
  ========================================================= */

  function tick() {

    var p = getProxy();

    if (!p || !p.venue) {
      return;
    }

    var venueId =
      getVenueId(p);

    if (!venueId) {
      return;
    }

    /*
     * Если пользователь вышел в список,
     * venue может исчезнуть.
     *
     * При возвращении в заведение
     * здесь снова загружаются права.
     */

    if (
      permissionVenueId !== venueId &&
      !permissionLoading
    ) {

      loadPermissions(
        p,
        function () {
          build();
          sync();
        }
      );

      return;
    }

    build();
    sync();
  }

  /* =========================================================
     DOM OBSERVER
  ========================================================= */

  var observerStarted = false;

  function startObserver() {

    if (observerStarted) {
      return;
    }

    observerStarted = true;

    if (!window.MutationObserver) {
      return;
    }

    var root =
      document.getElementById('app');

    if (!root) return;

    var observer =
      new MutationObserver(
        function () {

          /*
           * Не выполняем тяжёлую работу
           * прямо внутри MutationObserver.
           */

          clearTimeout(
            window.__managerDesignObserverTimer
          );

          window.__managerDesignObserverTimer =
            setTimeout(function () {

              tick();

            }, 50);
        }
      );

    observer.observe(
      root,
      {
        childList: true,
        subtree: true
      }
    );

    window.__managerDesignObserver =
      observer;
  }

  /* =========================================================
     BOOT
  ========================================================= */

  function boot() {

    ensureStyle();
    startObserver();

    var attempts = 0;

    var timer =
      setInterval(function () {

        tick();

        attempts++;

        /*
         * Оставляем небольшой постоянный контроль,
         * потому что Vue меняет venue/tab без
         * перезагрузки страницы.
         */

        if (attempts > 120) {
          clearInterval(timer);

          /*
           * После первоначальной инициализации
           * продолжаем проверять реже.
           */

          if (
            !window.__managerDesignSlowTimer
          ) {

            window.__managerDesignSlowTimer =
              setInterval(
                tick,
                1000
              );
          }
        }

      }, 250);

    window.__managerDesignBootTimer =
      timer;
  }

  /* =========================================================
     START
  ========================================================= */

  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      boot
    );

  } else {

    boot();
  }

})();
