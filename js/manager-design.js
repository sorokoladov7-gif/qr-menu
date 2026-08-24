(function () {
  'use strict';

  if (!/\/manager\.html$/i.test(location.pathname)) return;

  /*
   * ВАЖНО:
   * Не используем:
   *   app.__vue_app__._instance
   *
   * В вашем Vue 3 приложение имеет _instance === null.
   * Получаем proxy через __vueParentComponent.proxy.
   */

  if (window.__managerDesignLoaded) return;
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
   * Надёжное получение Vue component proxy.
   *
   * В вашем приложении:
   *   #app.__vue_app__._instance === null
   *
   * Но:
   *   #app.__vueParentComponent.proxy
   * работает после монтирования Vue.
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

    /*
     * Дополнительный fallback.
     */
    try {
      var app = root.__vue_app__;

      if (
        app &&
        app._container &&
        app._container.__vueParentComponent &&
        app._container.__vueParentComponent.proxy
      ) {
        return app._container.__vueParentComponent.proxy;
      }
    } catch (e) {}

    return null;
  }

  var permissionVenueId = null;
  var permissionLoadingVenueId = null;

  /*
   * Удаляем старое состояние, если управляющий вернулся
   * к списку заведений.
   */
  function resetPermissionState() {
    permissionVenueId = null;
    permissionLoadingVenueId = null;
  }

  function setPermission(target, source, key, legacyKey) {
    if (
      source &&
      Object.prototype.hasOwnProperty.call(source, key)
    ) {
      target[legacyKey] = source[key] === true;
      target[key] = source[key] === true;
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

    /*
     * Сохраняем оба варианта:
     *
     * design
     * can_edit_design
     *
     * чтобы не ломать существующий код.
     */
    p.venue.manager_permissions = current;
  }

  function loadPermissions(p, done) {
    if (
      !p ||
      !p.venue ||
      !p.venue.id
    ) {
      resetPermissionState();

      if (done) done();

      return;
    }

    var venueId = p.venue.id;

    /*
     * Администратор получает полный доступ.
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
      permissionLoadingVenueId = null;

      if (done) done();

      return;
    }

    /*
     * Если права уже загружены именно для ЭТОГО venue,
     * повторный запрос не нужен.
     */
    if (permissionVenueId === venueId) {
      if (done) done();
      return;
    }

    /*
     * Не допускаем параллельных запросов для одного venue.
     */
    if (permissionLoadingVenueId === venueId) {
      return;
    }

    permissionLoadingVenueId = venueId;

    var managerId =
      p.profile && p.profile.id
        ? p.profile.id
        : null;

    if (!managerId) {
      permissionLoadingVenueId = null;

      if (done) done();

      return;
    }

    if (
      typeof db === 'undefined' ||
      !db ||
      !db.from
    ) {
      console.warn(
        '[Manager Design] Supabase db is not available'
      );

      permissionLoadingVenueId = null;

      if (done) done();

      return;
    }

    db
      .from('manager_venue_permissions')
      .select(
        'can_edit_menu,can_edit_prices,can_edit_delivery,can_edit_design,can_edit_branding,can_edit_venue'
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

        } else if (r.data) {

          applyPermissions(p, r.data);

        } else {

          /*
           * Если строки прав нет — очищаем только права,
           * полученные этим bridge.
           *
           * Не удаляем остальные свойства venue.
           */
          var current = Object.assign(
            {},
            p.venue.manager_permissions || {}
          );

          delete current.design;
          delete current.branding;
          delete current.products;
          delete current.prices;
          delete current.delivery;
          delete current.venue;

          delete current.can_edit_menu;
          delete current.can_edit_prices;
          delete current.can_edit_delivery;
          delete current.can_edit_design;
          delete current.can_edit_branding;
          delete current.can_edit_venue;

          p.venue.manager_permissions = current;
        }

        /*
         * Помечаем права загруженными только ПОСЛЕ запроса.
         */
        permissionVenueId = venueId;
        permissionLoadingVenueId = null;

        if (done) done();

      })

      .catch(function (e) {

        permissionLoadingVenueId = null;

        console.warn(
          '[Manager Design] permission bridge exception:',
          e
        );

        if (done) done();

      });
  }

  function allowed(p) {
    return !!(
      p &&
      p.venue &&
      p.venue.manager_permissions &&
      (
        p.venue.manager_permissions.design === true ||
        p.venue.manager_permissions.can_edit_design === true
      )
    );
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
        padding:16px
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

  function getTabs() {
    return document.querySelector('.tabs');
  }

  function removeDesignUI() {

    var tab =
      document.getElementById(
        'manager-design-tab'
      );

    if (tab) {
      tab.remove();
    }

    var host =
      document.getElementById(
        'manager-design-host'
      );

    if (host) {
      host.remove();
    }
  }

  function build() {

    var p = getProxy();

    /*
     * Очень важно:
     * если мы сейчас на странице списка заведений,
     * полностью сбрасываем состояние.
     */
    if (!p || !p.venue) {

      resetPermissionState();
      removeDesignUI();

      return;
    }

    var tabs = getTabs();

    if (!tabs) return;

    /*
     * Если права ещё не были загружены —
     * build будет вызван повторно callback'ом.
     */
    if (!allowed(p)) {

      var oldTab =
        document.getElementById(
          'manager-design-tab'
        );

      if (oldTab) {
        oldTab.remove();
      }

      var oldHost =
        document.getElementById(
          'manager-design-host'
        );

      if (oldHost) {
        oldHost.style.display = 'none';
      }

      return;
    }

    var tab =
      document.getElementById(
        'manager-design-tab'
      );

    /*
     * После "К списку" Vue может пересоздать .tabs.
     * Поэтому проверяем кнопку каждый раз.
     */
    if (!tab) {

      tab = document.createElement('button');

      tab.id =
        'manager-design-tab';

      tab.type = 'button';

      tab.textContent =
        '🎨 Дизайн';

      tab.onclick = function () {

        var current =
          getProxy();

        if (!current) return;

        current.tab = 'design';

        sync();
      };

      tabs.appendChild(tab);
    }

    var host =
      document.getElementById(
        'manager-design-host'
      );

    if (!host) {

      host =
        document.createElement('div');

      host.id =
        'manager-design-host';

      tabs.parentNode.insertBefore(
        host,
        tabs.nextSibling
      );
    }

    /*
     * Новый venue = новый DOM/render.
     */
    if (
      host.dataset.venueId !==
      p.venue.id
    ) {

      host.dataset.venueId =
        p.venue.id;

      render(host, p);
    }

    sync();
  }

  function currentSettings(p) {

    var d =
      p.venue.design_settings || {};

    return Object.assign(
      {
        template: 'default',

        brand_color:
          p.venue.brand_color ||
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

  function render(host, p) {

    ensureStyle();

    var d =
      currentSettings(p);

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

      var t =
        templates[k];

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
                      <option>
                        Plus+Jakarta+Sans
                      </option>
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
                      <option value="glass">
                        Glass
                      </option>
                      <option value="soft">
                        Мягкие
                      </option>
                      <option value="bold">
                        Акцентные
                      </option>
                      <option value="flat">
                        Плоские
                      </option>
                    </select>

                  </label>

                  <label class="md-field">
                    Главный экран

                    <select id="md-hero">
                      <option value="gradient">
                        Градиент
                      </option>
                      <option value="warm">
                        Тёплый
                      </option>
                      <option value="dark">
                        Dark
                      </option>
                      <option value="minimal">
                        Minimal
                      </option>
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
                      <option value="gradient">
                        Градиент
                      </option>
                      <option value="solid">
                        Сплошные
                      </option>
                      <option value="outline">
                        Контур
                      </option>
                    </select>

                  </label>

                  <label class="md-field">
                    Фото

                    <select id="md-ratio">
                      <option value="4:3">
                        4:3
                      </option>
                      <option value="1:1">
                        1:1
                      </option>
                      <option value="16:9">
                        16:9
                      </option>
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
                  type="button"
                >
                  Сохранить дизайн
                </button>

                <button
                  id="md-reset"
                  class="btn btn-ghost"
                  type="button"
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
              Предпросмотр использует реальное
              клиентское меню заведения.
            </div>

          </div>

        </div>

      </div>
    `;

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
          '[data-template="' +
          k +
          '"]'
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
      host.querySelector('#md-frame');

    if (frame) {

      frame.src =
        '/menu.html?venue=' +
        encodeURIComponent(
          p.venue.slug
        ) +
        '&designPreview=1';

    }
  }

  function applyTemplate(host, k) {

    var t =
      templates[k];

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
        host.querySelector(
          map[key]
        );

      if (!el) return;

      el.value =
        t[key] != null
          ? t[key]
          : el.value;

    });

    host
      .querySelectorAll(
        '.md-template'
      )
      .forEach(function (x) {

        x.classList.toggle(
          'on',
          x.dataset.template === k
        );

      });
  }

  function saveDesign(host, p) {

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
          p_venue_id:
            p.venue.id,

          p_design_settings:
            settings
        }
      )

      .then(function (r) {

        if (r.error) {
          throw r.error;
        }

        /*
         * RPC может вернуть JSONB или null.
         */
        if (r.data != null) {
          p.venue.design_settings =
            r.data;
        } else {
          p.venue.design_settings =
            settings;
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
              p.venue.slug
            ) +
            '&designPreview=1&t=' +
            Date.now();

        }

      })

      .catch(function (e) {

        if (msg) {

          msg.textContent =
            'Ошибка: ' +
            (
              e &&
              e.message
                ? e.message
                : e
            );

        }

        console.error(
          '[Manager Design] save:',
          e
        );

      });
  }

  function sync() {

    var p =
      getProxy();

    var tab =
      document.getElementById(
        'manager-design-tab'
      );

    var host =
      document.getElementById(
        'manager-design-host'
      );

    /*
     * Нет venue = список заведений.
     */
    if (
      !p ||
      !p.venue
    ) {

      resetPermissionState();

      if (tab) {
        tab.remove();
      }

      if (host) {
        host.remove();
      }

      return;
    }

    /*
     * Vue мог пересоздать .tabs.
     * Если кнопки больше нет — build её создаст.
     */
    if (!tab) {

      build();

      return;
    }

    var ok =
      allowed(p);

    tab.style.display =
      ok ? '' : 'none';

    if (host) {

      host.style.display =
        ok &&
        p.tab === 'design'
          ? 'block'
          : 'none';

      /*
       * Если Vue заменил venue,
       * полностью перерисовываем дизайн.
       */
      if (
        ok &&
        host.dataset.venueId !==
        p.venue.id
      ) {

        host.dataset.venueId =
          p.venue.id;

        render(host, p);
      }

    }
  }

  /*
   * Основной цикл.
   *
   * Почему interval оставляем:
   *
   * manager.html — Vue SPA.
   * При "К списку" DOM Vue перестраивается без
   * полной перезагрузки страницы.
   *
   * Поэтому модуль должен повторно находить:
   *   .tabs
   *   venue
   *   permissions
   *   кнопку Design
   */
  function boot() {

    ensureStyle();

    var n = 0;

    var timer =
      setInterval(function () {

        var p =
          getProxy();

        /*
         * Пока Vue ещё не смонтирован.
         */
        if (!p) {

          if (++n > 120) {
            clearInterval(timer);
          }

          return;
        }

        /*
         * Пользователь вышел к списку.
         */
        if (!p.venue) {

          resetPermissionState();
          removeDesignUI();

          if (++n > 120) {
            /*
             * Не останавливаем навсегда:
             * пользователь может снова открыть venue.
             *
             * Поэтому после 120 циклов просто
             * переходим на более редкую проверку.
             */
          }

          return;
        }

        var venueId =
          p.venue.id;

        /*
         * Новый venue.
         *
         * Это ключевой фикс:
         * даже если это то же заведение,
         * после выхода к списку объект Vue может
         * быть создан заново.
         */
        if (
          permissionVenueId !== venueId &&
          permissionLoadingVenueId !== venueId
        ) {

          loadPermissions(
            p,
            function () {

              build();
              sync();

            }
          );

        } else {

          build();
          sync();

        }

      }, 250);
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
