/* QR Menu — safe table creation bridge */
(function () {
  'use strict';
  if (window.__QR_MANAGER_HALL_CREATE_FIX__) return;
  window.__QR_MANAGER_HALL_CREATE_FIX__ = true;

  function getDb() {
    return window.db || null;
  }

  function getVenue() {
    try {
      if (window.__managerVue && window.__managerVue.venue && window.__managerVue.venue.id) {
        return window.__managerVue.venue;
      }
      if (window.__managerSelectedVenue && window.__managerSelectedVenue.id) {
        return window.__managerSelectedVenue;
      }
      if (window.QRManagerHall && window.QRManagerHall.resolveVenue) {
        return window.QRManagerHall.resolveVenue();
      }
    } catch (e) {}
    return null;
  }

  function showError(modal, message) {
    var box = modal && modal.querySelector ? modal.querySelector('#qme') : null;
    if (!box) return;
    box.textContent = message || 'Ошибка создания стола';
    box.style.display = 'block';
  }

  async function createFromModal(modal) {
    var db = getDb();
    if (!db || !db.rpc) throw new Error('Supabase client не найден');

    var venue = await getVenue();
    if (venue && typeof venue.then === 'function') venue = await venue;
    if (!venue || !venue.id) throw new Error('Не удалось определить выбранное заведение');

    var numberInput = modal.querySelector('#qmn');
    var nameInput = modal.querySelector('#qmx');
    var shapeInput = modal.querySelector('#qms');
    var seatsInput = modal.querySelector('#qmt');

    var seats = Number(seatsInput && seatsInput.value);
    if (!Number.isInteger(seats) || seats < 1) throw new Error('Количество мест должно быть целым числом больше нуля');

    var next = await db.rpc('manager_next_table_number', { p_venue_id: venue.id });
    if (next.error) throw new Error(next.error.message || 'Не удалось получить следующий номер стола');

    var number = Number(next.data);
    if (!Number.isInteger(number) || number < 1) throw new Error('Сервер вернул некорректный номер стола');

    if (numberInput) numberInput.value = String(number);
    if (nameInput && !String(nameInput.value || '').trim() || /^Стол\s+\d+$/i.test(String(nameInput && nameInput.value || '').trim())) {
      if (nameInput) nameInput.value = 'Стол ' + number;
    }

    var result = await db.rpc('manager_create_table', {
      p_venue_id: venue.id,
      p_number: number,
      p_name: nameInput ? (String(nameInput.value || '').trim() || null) : null,
      p_shape: shapeInput ? shapeInput.value : 'round',
      p_seats: seats,
      p_x: 100,
      p_y: 100
    });

    if (result.error) throw new Error(result.error.message || 'Ошибка создания стола');

    modal.remove();

    if (window.QRManagerHall && window.QRManagerHall.open) {
      window.QRManagerHall.open(venue);
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var button = target.closest('#qmo');
    if (!button) return;

    var modal = button.closest('.qmh-modal');
    if (!modal) return;

    var title = modal.querySelector('h2');
    var isCreate = title && String(title.textContent || '').indexOf('Добавить стол') >= 0;
    if (!isCreate) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    if (button.dataset.busy === '1') return;
    button.dataset.busy = '1';
    button.disabled = true;

    createFromModal(modal).catch(function (error) {
      showError(modal, error && error.message ? error.message : 'Ошибка создания стола');
      button.dataset.busy = '0';
      button.disabled = false;
    });
  }, true);
})();
