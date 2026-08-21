/* QR Menu — manager hall renderer */
(function () {
  'use strict';
  if (window.__QR_MANAGER_HALL_FINAL__) return;
  window.__QR_MANAGER_HALL_FINAL__ = true;

  var state = { venue: null, tables: [], root: null, zoom: 1, busy: false };

  function db() { return window.db || null; }

  function esc(value) {
    var s = String(value == null ? '' : value);
    return s.replace(/[&<>"']/g, function (c) {
      if (c === '&') return '&amp;';
      if (c === '<') return '&lt;';
      if (c === '>') return '&gt;';
      if (c === '"') return '&quot;';
      return '&#39;';
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function rpc(name, args) {
    var client = db();
    if (!client || !client.rpc) return Promise.reject(new Error('Supabase client не найден'));
    return client.rpc(name, args);
  }

  function vueVenue() {
    try {
      if (window.__managerSelectedVenue && window.__managerSelectedVenue.id) return window.__managerSelectedVenue;
      if (window.__managerVue && window.__managerVue.venue && window.__managerVue.venue.id) return window.__managerVue.venue;
      var app = document.getElementById('app');
      var instance = app && app.__vue_app__ && app.__vue_app__._instance;
      var proxy = instance && instance.proxy;
      if (proxy && proxy.venue && proxy.venue.id) return proxy.venue;
    } catch (e) {}
    return null;
  }

  async function resolveVenue() {
    var selected = vueVenue();
    if (selected && selected.id) return selected;

    var client = db();
    if (!client) return null;

    var saved = null;
    try {
      saved = localStorage.getItem('manager_venue_id') || localStorage.getItem('selectedVenueId');
    } catch (e) {}

    if (!saved) return null;

    var query;
    if (isUuid(saved)) {
      query = await client.from('venues').select('id,name,slug,logo_url').eq('id', saved).maybeSingle();
    } else {
      query = await client.from('venues').select('id,name,slug,logo_url').eq('slug', saved).maybeSingle();
    }

    if (!query.error && query.data && query.data.id) return query.data;
    console.error('[QR Hall] venue lookup failed', query.error || 'not found');
    return null;
  }

  function addStyles() {
    if (document.getElementById('qr-manager-hall-final-css')) return;
    var style = document.createElement('style');
    style.id = 'qr-manager-hall-final-css';
    style.textContent = '#qr-manager-hall-final{position:fixed;inset:0;z-index:99990;background:#07101d;color:#fff;overflow:auto;font-family:Arial,sans-serif;padding:16px;box-sizing:border-box}.qmh-in{max-width:1500px;margin:auto}.qmh-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.qmh-actions{display:flex;gap:8px;flex-wrap:wrap}.qmh-btn{border:1px solid #ffffff18;background:#172236;color:#fff;border-radius:10px;padding:9px 13px;font-weight:700;cursor:pointer}.qmh-primary{background:#2563eb}.qmh-board-wrap{overflow:auto;border:1px solid #ffffff14;border-radius:16px;background:#050b14;margin-top:12px}.qmh-board{position:relative;width:1400px;height:720px;background:#0b1626;background-image:linear-gradient(#ffffff09 1px,transparent 1px),linear-gradient(90deg,#ffffff09 1px,transparent 1px);background-size:32px 32px;transform-origin:top left}.qmh-table{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;touch-action:none;border:2px solid #22c55e;background:#22c55e22;box-sizing:border-box;font-weight:800}.qmh-table.occupied{border-color:#ef4444;background:#ef444422}.qmh-table.reserved{border-color:#f59e0b;background:#f59e0b22}.qmh-round{width:90px;height:90px;border-radius:50%}.qmh-square{width:96px;height:96px;border-radius:14px}.qmh-rectangle{width:155px;height:82px;border-radius:14px}.qmh-small{font-size:11px;color:#94a3b8}.qmh-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.qmh-stat,.qmh-card{background:#111a2a;border:1px solid #ffffff12;border-radius:14px;padding:12px}.qmh-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:12px}.qmh-card button{margin-top:8px}.qmh-modal{position:fixed;inset:0;z-index:100000;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px}.qmh-box{width:min(480px,100%);background:#111827;border-radius:18px;padding:20px}.qmh-field{margin:10px 0}.qmh-field label{display:block;font-size:12px;color:#94a3b8;margin-bottom:5px}.qmh-field input,.qmh-field select{width:100%;box-sizing:border-box;padding:10px;background:#09111e;color:#fff;border:1px solid #ffffff18;border-radius:9px}.qmh-error{display:none;color:#fecaca;background:#7f1d1d55;padding:10px;border-radius:9px;margin:10px 0}';
    document.head.appendChild(style);
  }

  function closeHall() {
    if (state.root) {
      state.root.remove();
      state.root = null;
    }
  }

  function applyZoom() {
    var board = state.root && state.root.querySelector('#qmh-board');
    if (board) board.style.transform = 'scale(' + state.zoom + ')';
  }

  function openHall(venue) {
    if (!venue || !venue.id) return;
    state.venue = venue;
    state.zoom = 1;
    if (state.root) state.root.remove();
    addStyles();

    var root = document.createElement('div');
    root.id = 'qr-manager-hall-final';
    state.root = root;
    root.innerHTML = '<div class="qmh-in"><div class="qmh-head"><div><h2 style="margin:0">🪑 План зала</h2><div class="qmh-small">' + esc(venue.name || 'Заведение') + '</div></div><div class="qmh-actions"><button class="qmh-btn qmh-primary" id="qmh-add">＋ Добавить стол</button><button class="qmh-btn" id="qmh-refresh">↻ Обновить</button><button class="qmh-btn" id="qmh-minus">−</button><button class="qmh-btn" id="qmh-plus">＋</button><button class="qmh-btn" id="qmh-close">Закрыть</button></div></div><div class="qmh-stats" id="qmh-stats"></div><div class="qmh-board-wrap"><div class="qmh-board" id="qmh-board"></div></div><h3>Столы и QR-коды</h3><div class="qmh-cards" id="qmh-cards"></div></div>';
    document.body.appendChild(root);

    root.querySelector('#qmh-close').onclick = closeHall;
    root.querySelector('#qmh-add').onclick = function () { editForm(null); };
    root.querySelector('#qmh-refresh').onclick = loadTables;
    root.querySelector('#qmh-minus').onclick = function () { state.zoom = Math.max(0.6, state.zoom - 0.1); applyZoom(); };
    root.querySelector('#qmh-plus').onclick = function () { state.zoom = Math.min(1.5, state.zoom + 0.1); applyZoom(); };
    loadTables();
  }

  function normalizeTable(table) {
    return {
      id: table.id,
      number: table.table_number == null ? table.number : table.table_number,
      name: table.name || '',
      shape: ['round', 'square', 'rectangle'].indexOf(table.shape) >= 0 ? table.shape : 'round',
      seats: Number(table.seats || 4),
      x: Number(table.pos_x == null ? (table.x == null ? 80 : table.x) : table.pos_x),
      y: Number(table.pos_y == null ? (table.y == null ? 80 : table.y) : table.pos_y),
      qr: table.qr_token || '',
      status: table.occupancy_status || table.status || 'free',
      guests: Number(table.guest_count == null ? (table.session_guest_count || 0) : table.guest_count),
      orders: Number(table.open_order_count == null ? (table.order_count || 0) : table.order_count),
      total: Number(table.total_amount || 0)
    };
  }

  function tableStatus(table) {
    if (table.status === 'occupied') return ['Занят', 'occupied'];
    if (table.status === 'reserved') return ['Резерв', 'reserved'];
    return ['Свободен', 'free'];
  }

  async function loadTables() {
    if (!state.root || !state.venue) return;
    var result = await rpc('manager_table_board', { p_venue_id: state.venue.id });
    if (result.error) {
      renderError(result.error.message);
      return;
    }
    var rows = Array.isArray(result.data) ? result.data : ((result.data && result.data.tables) || []);
    state.tables = rows.map(normalizeTable);
    renderTables();
  }

  function renderError(message) {
    var board = state.root && state.root.querySelector('#qmh-board');
    if (board) board.innerHTML = '<div style="padding:40px;color:#fecaca"><b>Не удалось загрузить столы</b><div style="margin-top:8px">' + esc(message) + '</div></div>';
  }

  function renderTables() {
    var root = state.root;
    if (!root) return;
    var board = root.querySelector('#qmh-board');
    var cards = root.querySelector('#qmh-cards');
    var stats = root.querySelector('#qmh-stats');
    board.innerHTML = '';
    cards.innerHTML = '';

    var free = 0, occupied = 0, reserved = 0;
    state.tables.forEach(function (table) {
      var current = tableStatus(table)[1];
      if (current === 'free') free += 1;
      else if (current === 'occupied') occupied += 1;
      else reserved += 1;
    });

    stats.innerHTML = '<div class="qmh-stat"><b>' + state.tables.length + '</b><div class="qmh-small">Всего столов</div></div><div class="qmh-stat"><b>' + free + '</b><div class="qmh-small">Свободно</div></div><div class="qmh-stat"><b>' + occupied + '</b><div class="qmh-small">Занято</div></div><div class="qmh-stat"><b>' + reserved + '</b><div class="qmh-small">Резерв</div></div>';

    if (!state.tables.length) board.innerHTML = '<div style="padding:80px;text-align:center;color:#94a3b8">Столов пока нет.<br><br>Нажмите «＋ Добавить стол».</div>';

    state.tables.forEach(function (table) {
      var element = document.createElement('div');
      element.className = 'qmh-table qmh-' + table.shape + ' ' + tableStatus(table)[1];
      element.style.left = table.x + 'px';
      element.style.top = table.y + 'px';
      element.innerHTML = '<div>№' + esc(table.number) + '</div><div>' + esc(table.name || ('Стол ' + table.number)) + '</div><div class="qmh-small">' + table.guests + '/' + table.seats + ' мест</div>';
      dragTable(element, table);
      element.ondblclick = function () { editForm(table); };
      board.appendChild(element);

      var card = document.createElement('div');
      card.className = 'qmh-card';
      card.innerHTML = '<b>Стол №' + esc(table.number) + '</b><div style="margin:6px 0">' + tableStatus(table)[0] + ' · ' + table.seats + ' мест</div><div class="qmh-small">Гостей: ' + table.guests + ' · Заказов: ' + table.orders + ' · ' + table.total.toLocaleString('ru-RU') + ' ₽</div><button class="qmh-btn" data-edit>✏️ Редактировать</button><div class="qmh-small" style="margin-top:8px">' + (table.qr ? 'QR закреплён за столом' : 'QR ещё не создан') + '</div>';
      card.querySelector('[data-edit]').onclick = function () { editForm(table); };
      cards.appendChild(card);
    });
    applyZoom();
  }

  function dragTable(element, table) {
    element.onpointerdown = function (event) {
      var startX = event.clientX;
      var startY = event.clientY;
      var originalX = table.x;
      var originalY = table.y;
      var moved = false;
      element.setPointerCapture(event.pointerId);
      element.onpointermove = function (moveEvent) {
        var dx = (moveEvent.clientX - startX) / state.zoom;
        var dy = (moveEvent.clientY - startY) / state.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        table.x = Math.max(10, Math.min(1300, originalX + dx));
        table.y = Math.max(10, Math.min(650, originalY + dy));
        element.style.left = table.x + 'px';
        element.style.top = table.y + 'px';
      };
      element.onpointerup = function () {
        element.onpointermove = null;
        if (moved) rpc('manager_move_table', { p_venue_id: state.venue.id, p_table_id: table.id, p_x: Math.round(table.x), p_y: Math.round(table.y) });
      };
    };
  }

  function editForm(table) {
    var used = {};
    state.tables.forEach(function (item) { used[Number(item.number)] = true; });
    var nextNumber = 1;
    while (used[nextNumber]) nextNumber += 1;
    var data = table || { number: nextNumber, name: 'Стол ' + nextNumber, shape: 'round', seats: 4 };

    var modal = document.createElement('div');
    modal.className = 'qmh-modal';
    modal.innerHTML = '<div class="qmh-box"><h2 style="margin-top:0">' + (table ? 'Редактировать стол' : 'Добавить стол') + '</h2><div class="qmh-field"><label>Номер</label><input id="qmn" type="number" min="1" value="' + esc(data.number) + '"></div><div class="qmh-field"><label>Название</label><input id="qmx" value="' + esc(data.name) + '"></div><div class="qmh-field"><label>Форма</label><select id="qms"><option value="round">Круглый</option><option value="square">Квадратный</option><option value="rectangle">Прямоугольный</option></select></div><div class="qmh-field"><label>Мест</label><input id="qmt" type="number" min="1" value="' + esc(data.seats) + '"></div><div class="qmh-error" id="qme"></div><button class="qmh-btn" id="qmc">Отмена</button> <button class="qmh-btn qmh-primary" id="qmo">' + (table ? 'Сохранить' : 'Создать стол') + '</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('#qms').value = data.shape;
    modal.querySelector('#qmc').onclick = function () { modal.remove(); };
    modal.querySelector('#qmo').onclick = async function () {
      if (state.busy) return;
      state.busy = true;
      var args = {
        p_venue_id: state.venue.id,
        p_number: Number(modal.querySelector('#qmn').value),
        p_name: modal.querySelector('#qmx').value.trim() || null,
        p_shape: modal.querySelector('#qms').value,
        p_seats: Number(modal.querySelector('#qmt').value)
      };
      var result;
      if (table) {
        result = await rpc('manager_update_table', { p_table_id: table.id, p_venue_id: args.p_venue_id, p_number: args.p_number, p_name: args.p_name, p_shape: args.p_shape, p_seats: args.p_seats, p_active: true });
      } else {
        result = await rpc('manager_create_table', { p_venue_id: args.p_venue_id, p_number: args.p_number, p_name: args.p_name, p_shape: args.p_shape, p_seats: args.p_seats, p_x: 100 + (state.tables.length % 5) * 180, p_y: 100 + Math.floor(state.tables.length / 5) * 130 });
      }
      state.busy = false;
      if (result.error) {
        var errorBox = modal.querySelector('#qme');
        errorBox.textContent = result.error.message || 'Ошибка';
        errorBox.style.display = 'block';
        return;
      }
      modal.remove();
      loadTables();
    };
  }

  async function onHallClick() {
    var venue = await resolveVenue();
    if (!venue) {
      console.error('[QR Hall] cannot resolve selected venue');
      return;
    }
    openHall(venue);
  }

  function install() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('[data-manager-hall-tab]') : null;
      if (!button) return;
      setTimeout(onHallClick, 150);
    }, true);
  }

  install();
  window.QRManagerHall = { open: openHall, close: closeHall, resolveVenue: resolveVenue };
})();
