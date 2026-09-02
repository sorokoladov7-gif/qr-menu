/* QR-Menu — импорт меню с сайта при создании заведения */
(function(){
  'use strict';
  if (window.__QR_MANAGER_SITE_IMPORT__) return;
  window.__QR_MANAGER_SITE_IMPORT__ = true;

  var API_URL = '/api/import-site';
  var IMPORT_TEMPLATE_ID = '__site_import__';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function getVm(modal) {
    var app = document.getElementById('app');
    if (!app && modal) app = modal.closest('#app');
    try {
      return app && (app.__vueParentComponent && app.__vueParentComponent.proxy || app.vue_app && app.vue_app._instance && app.vue_app._instance.proxy);
    } catch (_) { return null; }
  }

  function normalizeProduct(item) {
    if (!item || typeof item !== 'object') return null;
    var name = String(item.name || item.title || item.product_name || '').replace(/\s+/g,' ').trim().slice(0,220);
    if (!name) return null;
    var rawPrice = item.price != null ? item.price : item.cost;
    var price = Number(String(rawPrice == null ? '' : rawPrice).replace(/[^0-9.,-]/g,'').replace(',','.'));
    if (!isFinite(price) || price < 0) price = 0;
    return {
      name: name,
      description: item.description || item.desc || null,
      price: price,
      category: item.category || item.category_name || 'main',
      image_url: item.image_url || item.image || item.photo || null,
      is_available: true,
      applies_to: 'all'
    };
  }

  function extractProducts(payload) {
    var candidates = [];
    function add(value) {
      if (!Array.isArray(value)) return;
      value.forEach(function(item){ var p = normalizeProduct(item); if (p) candidates.push(p); });
    }
    add(payload && payload.products);
    add(payload && payload.data && payload.data.products);
    add(payload && payload.result && payload.result.products);
    add(payload && payload.menu && payload.menu.products);
    add(payload && payload.data && payload.data.menu && payload.data.menu.products);
    var seen = Object.create(null), out = [];
    candidates.forEach(function(p){
      var key = p.name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(p);
    });
    return out;
  }

  function setBusy(ui, busy) {
    ui.button.disabled = !!busy;
    ui.button.textContent = busy ? 'Импортирую меню…' : 'Импортировать меню';
    ui.input.disabled = !!busy;
  }

  function showMessage(ui, text, type) {
    ui.message.textContent = text || '';
    ui.message.style.display = text ? 'block' : 'none';
    ui.message.style.color = type === 'error' ? '#fca5a5' : '#86efac';
  }

  function mount(modal) {
    if (!modal || modal.getAttribute('data-site-import-mounted') === '1') return;
    var box = modal.firstElementChild || modal;
    if (!box) return;
    modal.setAttribute('data-site-import-mounted','1');

    var wrap = document.createElement('div');
    wrap.className = 'qr-site-import';
    wrap.style.cssText = 'margin:0 0 18px;padding:16px;border:1px solid rgba(99,102,241,.35);border-radius:16px;background:rgba(99,102,241,.07);';
    wrap.innerHTML =
      '<div style="font-weight:800;font-size:15px;margin-bottom:5px">Импорт меню с сайта</div>' +
      '<div class="muted" style="font-size:12px;margin-bottom:10px">Укажите сайт заведения — QR-Menu попробует найти меню, блюда, цены и изображения.</div>' +
      '<div style="display:flex;gap:8px;align-items:stretch;flex-wrap:wrap">' +
        '<input type="url" class="qr-site-import-input" placeholder="https://example.ru" autocomplete="url" style="flex:1;min-width:240px">' +
        '<button type="button" class="btn btn-primary qr-site-import-button">Импортировать меню</button>' +
      '</div>' +
      '<div class="qr-site-import-message" style="display:none;font-size:12px;margin-top:9px"></div>' +
      '<div class="qr-site-import-result" style="display:none;font-size:12px;margin-top:8px"></div>';

    var anchor = box.querySelector('.template-grid') || box.querySelector('.manager-template-catalog') || box.querySelector('.field');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor);
    else box.insertBefore(wrap, box.firstChild);

    var ui = {
      input: wrap.querySelector('.qr-site-import-input'),
      button: wrap.querySelector('.qr-site-import-button'),
      message: wrap.querySelector('.qr-site-import-message'),
      result: wrap.querySelector('.qr-site-import-result')
    };

    ui.button.addEventListener('click', function(){
      var url = String(ui.input.value || '').trim();
      if (!url) { showMessage(ui,'Введите адрес сайта.','error'); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try { new URL(url); } catch (_) { showMessage(ui,'Некорректный адрес сайта.','error'); return; }

      var vm = getVm(modal);
      showMessage(ui,'Сайт анализируется. Это может занять до минуты.','ok');
      ui.result.style.display = 'none';
      setBusy(ui,true);

      fetch(API_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        credentials:'same-origin',
        body:JSON.stringify({url:url})
      }).then(function(response){
        return response.text().then(function(text){
          var data = null;
          try { data = JSON.parse(text); } catch (_) {}
          if (!response.ok || !data || data.ok === false) {
            var error = data && data.error;
            throw new Error(error && error.message || 'Не удалось импортировать меню с сайта.');
          }
          return data;
        });
      }).then(function(data){
        var products = extractProducts(data);
        if (!products.length) throw new Error('На сайте не удалось найти позиции меню с названиями.');
        if (!vm) throw new Error('Не удалось получить состояние формы создания заведения.');

        var venue = data.venue || data.data && data.data.venue || {};
        var importedName = String(venue.name || '').trim();
        var importedSlug = String(venue.slug || '').trim();
        if (importedName && !String(vm.newVenueForm.name || '').trim()) vm.newVenueForm.name = importedName;
        if (importedSlug && !String(vm.newVenueForm.slug || '').trim()) vm.newVenueForm.slug = importedSlug;
        if (!String(vm.newVenueForm.name || '').trim() && importedName) vm.newVenueForm.name = importedName;

        var template = {
          id: IMPORT_TEMPLATE_ID,
          name: importedName ? 'Импорт с сайта: ' + importedName : 'Импорт с сайта',
          slug: importedSlug,
          emoji: '🌐',
          description: 'Меню, импортированное с сайта ' + url,
          niche: 'other',
          scale_code: 'M',
          target_product_count: products.length,
          products: products
        };
        var list = Array.isArray(vm.venueTemplates) ? vm.venueTemplates : [];
        var replaced = false;
        vm.venueTemplates = list.map(function(t){
          if (t && String(t.id) === IMPORT_TEMPLATE_ID) { replaced = true; return template; }
          return t;
        });
        if (!replaced) vm.venueTemplates.push(template);
        vm.newVenueForm.template = IMPORT_TEMPLATE_ID;

        var meta = data.meta || data.data && data.data.meta || {};
        var count = Number(meta.products_found || products.length);
        ui.result.innerHTML = '<b>Готово:</b> найдено ' + count + ' позиций. Импортированное меню выбрано автоматически — можно нажимать «Создать заведение».';
        ui.result.style.display = 'block';
        showMessage(ui,'Меню успешно импортировано.','ok');
        setBusy(ui,false);
        if (typeof vm.decorateVenueTemplateCards === 'function') vm.$nextTick(function(){ vm.decorateVenueTemplateCards(); });
      }).catch(function(error){
        showMessage(ui,error && error.message || 'Ошибка импорта сайта.','error');
        setBusy(ui,false);
      });
    });
  }

  window.QRManagerSiteImport = { mount: mount };
})();
