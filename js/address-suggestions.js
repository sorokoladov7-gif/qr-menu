(function () {
  'use strict';

  if (!/\/menu\.html$/i.test(location.pathname)) return;

  var state = {
    timer: null,
    request: null,
    input: null,
    box: null,
    selected: null,
    programmaticInput: false,
    venueDelivery: true
  };

  /* =========================
     VENUE
  ========================= */

  function rememberVenue(value) {
    try {
      window.__qrVenueDeliveryById =
        window.__qrVenueDeliveryById || {};

      if (Array.isArray(value)) {
        value.forEach(function (v) {
          if (!v || !v.id) return;

          window.__qrVenueDeliveryById[v.id] =
            v.delivery_enabled !== false;
        });
      } else if (value && value.id) {
        window.__qrVenueDeliveryById[value.id] =
          value.delivery_enabled !== false;

        state.venueDelivery =
          value.delivery_enabled !== false;
      }
    } catch (e) {
      console.warn('[QR address] venue state:', e);
    }
  }

  function patchVenueRpc() {
    if (
      !window.db ||
      !window.db.rpc ||
      window.__qrAddressRpcPatched
    ) {
      return;
    }

    var original = window.db.rpc;

    window.db.rpc = function (name, args, options) {
      var result = original.apply(this, arguments);

      if (
        name === 'public_venue_by_slug' ||
        name === 'public_venues_list'
      ) {
        return Promise.resolve(result).then(function (r) {
          rememberVenue(r && r.data);
          return r;
        });
      }

      return result;
    };

    window.__qrAddressRpcPatched = true;
  }

  /* =========================
     VUE
  ========================= */

  function getVm() {
    try {
      var root = document.getElementById('app');

      if (
        root &&
        root.__vue_app__ &&
        root.__vue_app__._instance
      ) {
        return root.__vue_app__._instance.proxy;
      }

      if (root && root.__vueParentComponent) {
        return root.__vueParentComponent.proxy;
      }
    } catch (e) {}

    return null;
  }

  function getSelectedVenueDelivery() {
    var vm = getVm();

    if (vm && vm.venue) {
      return vm.venue.delivery_enabled !== false;
    }

    return state.venueDelivery !== false;
  }

  /* =========================
     INPUT
  ========================= */

  function findAddressInput() {
    var inputs = Array.prototype.slice.call(
      document.querySelectorAll('input')
    );

    return inputs.find(function (el) {
      var placeholder =
        (el.getAttribute('placeholder') || '').toLowerCase();

      return (
        placeholder.indexOf('улица') !== -1 ||
        placeholder.indexOf('адрес') !== -1
      );
    }) || null;
  }

  function ensureBox(input) {
    if (!input) return null;

    if (
      state.input === input &&
      state.box
    ) {
      return state.box;
    }

    state.input = input;

    var parent = input.parentElement;
    if (!parent) return null;

    parent.style.position =
      parent.style.position || 'relative';

    var box = document.createElement('div');

    box.className = 'qr-address-suggestions';

    box.style.cssText = [
      'position:absolute',
      'left:0',
      'right:0',
      'top:calc(100% + 6px)',
      'z-index:100000',
      'background:#111827',
      'border:1px solid rgba(255,255,255,.14)',
      'border-radius:14px',
      'box-shadow:0 18px 45px rgba(0,0,0,.45)',
      'overflow:hidden',
      'display:none',
      'max-height:280px',
      'overflow-y:auto'
    ].join(';');

    parent.appendChild(box);

    state.box = box;

    input.setAttribute('autocomplete', 'off');

    input.addEventListener('input', onInput);

    input.addEventListener('focus', function () {
      if (
        input.value.trim().length >= 3 &&
        box.childElementCount
      ) {
        box.style.display = 'block';
      }
    });

    document.addEventListener('click', function (e) {
      if (
        e.target !== input &&
        !box.contains(e.target)
      ) {
        box.style.display = 'none';
      }
    });

    return box;
  }

  /* =========================
     SUGGESTIONS
  ========================= */

  function clearSuggestions() {
    if (!state.box) return;

    state.box.innerHTML = '';
    state.box.style.display = 'none';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/[&<>"']/g, function (c) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[c];
      });
  }

  function render(items) {
    var box = state.box;

    if (!box) return;

    box.innerHTML = '';

    if (!items.length) {
      box.style.display = 'none';
      return;
    }

    items.forEach(function (item) {
      var row = document.createElement('button');

      row.type = 'button';

      row.style.cssText = [
        'display:block',
        'width:100%',
        'text-align:left',
        'border:0',
        'border-bottom:1px solid rgba(255,255,255,.07)',
        'background:transparent',
        'color:#fff',
        'padding:12px 14px',
        'cursor:pointer',
        'font:inherit'
      ].join(';');

      var d = item.data || {};

      var sub = [
        d.city,
        d.street,
        d.house
      ]
        .filter(Boolean)
        .join(', ');

      row.innerHTML =
        '<div style="font-weight:700;font-size:13px">' +
        escapeHtml(
          item.value ||
          item.unrestricted_value ||
          ''
        ) +
        '</div>' +

        (
          sub
            ? '<div style="font-size:11px;color:#94a3b8;margin-top:3px">' +
              escapeHtml(sub) +
              '</div>'
            : ''
        );

      row.addEventListener('mouseenter', function () {
        row.style.background =
          'rgba(99,102,241,.16)';
      });

      row.addEventListener('mouseleave', function () {
        row.style.background = 'transparent';
      });

      row.addEventListener('click', function () {
        selectItem(item);
      });

      box.appendChild(row);
    });

    box.style.display = 'block';
  }

  /* =========================
     ADDRESS SEARCH
  ========================= */

  function onInput() {

    /*
     * Это ключевое исправление.
     *
     * Vue может генерировать input/change после
     * программной установки выбранного адреса.
     * В таком случае выбранный адрес не сбрасываем.
     */
    if (state.programmaticInput) {
      return;
    }

    /*
     * Пользователь реально изменил текст.
     * Старый выбранный адрес больше недействителен.
     */
    state.selected = null;
    window.__selectedDeliveryAddress = null;

    var input = state.input;

    if (!input) return;

    var q = String(input.value || '').trim();

    clearTimeout(state.timer);

    if (state.request) {
      try {
        state.request.abort();
      } catch (e) {}

      state.request = null;
    }

    if (q.length < 3) {
      clearSuggestions();
      return;
    }

    state.timer = setTimeout(function () {

      var controller = new AbortController();

      state.request = controller;

      fetch(
        '/api/address?q=' +
        encodeURIComponent(q),
        {
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        }
      )

        .then(function (r) {
          if (!r.ok) {
            throw new Error(
              'Не удалось получить подсказки адресов'
            );
          }

          return r.json();
        })

        .then(function (data) {

          if (
            data &&
            Array.isArray(data.suggestions)
          ) {
            render(data.suggestions);
          } else {
            clearSuggestions();
          }
        })

        .catch(function (e) {

          if (
            e &&
            e.name === 'AbortError'
          ) {
            return;
          }

          console.warn(
            '[QR address]',
            e
          );

          clearSuggestions();
        })

        .finally(function () {
          state.request = null;
        });

    }, 350);
  }

  /* =========================
     SELECT ADDRESS
  ========================= */

  function selectItem(item) {

    var input = state.input;

    if (!input) return;

    var d = item.data || {};

    var lat =
      d.geo_lat != null
        ? Number(d.geo_lat)
        : null;

    var lng =
      d.geo_lon != null
        ? Number(d.geo_lon)
        : null;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {

      console.warn(
        '[QR address] У выбранного адреса нет координат'
      );

      return;
    }

    var selected = {

      value:
        item.value ||
        item.unrestricted_value ||
        '',

      fias_id:
        d.fias_id || null,

      city:
        d.city ||
        d.settlement ||
        null,

      street:
        d.street ||
        null,

      house:
        d.house ||
        null,

      flat:
        d.flat ||
        null,

      lat: lat,
      lng: lng
    };

    /*
     * Сохраняем выбранный реальный адрес.
     */
    state.selected = selected;

    window.__selectedDeliveryAddress =
      selected;

    /*
     * Очень важно:
     * Vue получает новое значение,
     * но onInput НЕ должен считать это ручным вводом.
     */
    state.programmaticInput = true;

    input.value = selected.value;

    input.dispatchEvent(
      new Event('input', {
        bubbles: true
      })
    );

    input.dispatchEvent(
      new Event('change', {
        bubbles: true
      })
    );

    /*
     * Сбрасываем флаг после обработки события.
     */
    setTimeout(function () {
      state.programmaticInput = false;
    }, 0);

    clearSuggestions();

    /*
     * Сообщаем Vue координаты выбранного адреса.
     */
    var vm = getVm();

    if (vm) {
      vm.deliveryCalcError = '';
      vm.calculatedDeliveryFee = null;
      vm.deliveryDistance = 0;
    }

    console.log(
      '[QR address] selected:',
      selected
    );
  }

  /* =========================
     NOMINATIM BYPASS
  ========================= */

  if (!window.__qrNominatimPatch) {

    var nativeFetch =
      window.fetch.bind(window);

    window.fetch = function (input, init) {

      var url =
        typeof input === 'string'
          ? input
          : (
              input &&
              input.url
            ) || '';

      /*
       * Если адрес выбран через подсказку,
       * Nominatim вообще не должен искать его повторно.
       */
      if (
        window.__selectedDeliveryAddress &&
        /nominatim\.openstreetmap\.org\/search/i.test(url)
      ) {

        var s =
          window.__selectedDeliveryAddress;

        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                lat: String(s.lat),
                lon: String(s.lng)
              }
            ]),
            {
              status: 200,
              headers: {
                'Content-Type':
                  'application/json'
              }
            }
          )
        );
      }

      return nativeFetch(input, init);
    };

    window.__qrNominatimPatch = true;
  }

  /* =========================
     BUTTON VALIDATION
  ========================= */

  document.addEventListener(
    'click',
    function (e) {

      var target =
        e.target &&
        e.target.closest
          ? e.target.closest('button')
          : null;

      if (!target) return;

      if (
        getSelectedVenueDelivery() === false
      ) {
        return;
      }

      var text =
        (target.textContent || '').trim();

      var isDeliveryButton =
        text.indexOf('Рассчитать') !== -1;

      var isCheckoutButton =
        text.indexOf('Подтвердить заказ') !== -1;

      if (
        !isDeliveryButton &&
        !isCheckoutButton
      ) {
        return;
      }

      var vm = getVm();

      var isDelivery =
        vm &&
        vm.form &&
        vm.form.type === 'delivery';

      if (!isDelivery) return;

      if (
        !state.selected ||
        !window.__selectedDeliveryAddress
      ) {

        e.preventDefault();
        e.stopImmediatePropagation();

        var message =
          'Выберите адрес доставки из предложенных реальных адресов';

        if (vm) {
          vm.msg = message;
        } else {
          alert(message);
        }
      }

    },
    true
  );

  /* =========================
     DELIVERY VISIBILITY
  ========================= */

  function enforceDeliveryVisibility() {

    var enabled =
      getSelectedVenueDelivery();

    Array.prototype
      .slice.call(
        document.querySelectorAll('button')
      )
      .forEach(function (btn) {

        if (
          (btn.textContent || '')
            .indexOf('Доставка') !== -1
        ) {
          btn.style.display =
            enabled ? '' : 'none';
        }

      });

    if (!enabled) {
      clearSuggestions();
    }
  }

  /* =========================
     INIT
  ========================= */

  function init() {

    patchVenueRpc();

    var input =
      findAddressInput();

    if (input) {
      ensureBox(input);
    }

    enforceDeliveryVisibility();
  }

  var observer =
    new MutationObserver(function () {
      init();
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  var tries = 0;

  var timer =
    setInterval(function () {

      init();

      tries++;

      if (tries > 120) {
        clearInterval(timer);
      }

    }, 250);

})();
