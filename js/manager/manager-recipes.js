/* QR-Menu — Рецептуры. Единая компактная реализация. */
(function () {
  'use strict';

  if (window.__QR_MANAGER_RECIPES__) return;
  window.__QR_MANAGER_RECIPES__ = true;

  var state = {
    venueId: null,
    products: [],
    ingredients: [],
    recipes: [],
    selected: null,
    rows: [],
    catalog: [],
    catalogItems: [],
    globalIngredients: [],
    techCards: [],
    ocrParsed: []
  };
  window.__QR_MANAGER_RECIPES_STATE__ = state;

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function norm(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
  }

  function unitLabel(unit) {
    return { g:'г', kg:'кг', ml:'мл', l:'л', pcs:'шт' }[unit] || unit || '';
  }

  function canonicalUnit(unit) {
    var u = String(unit || '').toLowerCase().replace(/ё/g, 'е').trim();
    if (/^гр?\.?$/.test(u)) return 'g';
    if (u === 'кг') return 'kg';
    if (u === 'мл') return 'ml';
    if (u === 'л') return 'l';
    if (u === 'шт') return 'pcs';
    return ['g','kg','ml','l','pcs'].indexOf(u) >= 0 ? u : null;
  }

  function rpc(name, args) {
    if (!window.db) return Promise.reject(new Error('window.db отсутствует'));
    return window.db.rpc(name, args).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  function message(text, error) {
    var el = $('msg');
    if (!el) return;
    el.innerHTML = text ? '<div class="msg ' + (error ? 'err' : 'ok') + '">' + esc(text) + '</div>' : '';
  }

  function compactLayout() {
    if ($('qrRecipesCompactStyle')) return;
    var style = document.createElement('style');
    style.id = 'qrRecipesCompactStyle';
    style.textContent = [
      '.recipe-tab-container{height:calc(100vh - 150px);max-height:calc(100vh - 150px);overflow:auto!important;overscroll-behavior:contain}',
      '.recipe-tab-container .recipe-wrap{min-height:0!important;height:auto!important}',
      '.recipe-tab-container .recipe-grid{align-items:start}',
      '.recipe-tab-container .recipe-grid>.card{min-height:0}',
      '.recipe-tab-container .list{max-height:calc(100vh - 310px);overflow:auto}',
      '.recipe-tab-container #ingredients{max-height:260px;overflow:auto}',
      '.recipe-row{display:grid;grid-template-columns:minmax(180px,1fr) 100px 45px minmax(150px,1fr) auto;gap:8px;align-items:center}',
      '.recipe-tab-container img{max-width:100%;height:auto}',
      '.modalx{overscroll-behavior:contain}',
      '@media(max-width:800px){.recipe-tab-container{height:auto;max-height:none}.recipe-row{grid-template-columns:1fr 90px 40px 1fr auto}}'
    ].join('');
    document.head.appendChild(style);
  }

  function loadData() {
    state.venueId = localStorage.getItem('manager_venue_id') || localStorage.getItem('selectedVenueId');
    if (!state.venueId) {
      message('Не найдено выбранное заведение. Выберите заведение в кабинете.', true);
      return Promise.resolve();
    }

    return Promise.all([
      dbQuery('products', 'id,name,description,category,price'),
      rpc('manager_ingredient_list', { p_venue_id: state.venueId }),
      dbQuery('global_recipe_catalog', 'id,name,category,description,yield_quantity,yield_unit,cuisine,difficulty,base_servings,prep_minutes,cook_minutes,nutrition_per_serving,steps,source,source_license,source_attribution,photo', true),
      dbQuery('global_ingredient_catalog', 'id,name,unit,category,aliases', true),
      dbQuery('manager_tech_cards', 'id,product_id,file_name,file_path,file_url,ocr_text,status,created_at', false, 'created_at')
    ]).then(function (r) {
      state.products = r[0] || [];
      state.ingredients = Array.isArray(r[1]) ? r[1] : [];
      state.catalog = r[2] || [];
      state.globalIngredients = r[3] || [];
      state.techCards = r[4] || [];
      return loadCatalogItems();
    }).then(function () {
      renderAll();
    }).catch(function (e) {
      console.error('[Recipes] load:', e);
      message('Ошибка загрузки рецептур: ' + (e.message || e), true);
    });
  }

  function dbQuery(table, columns, global, order) {
    var q = window.db.from(table).select(columns);
    if (!global) q = q.eq('venue_id', state.venueId);
    if (order) q = q.order(order, { ascending: false });
    else q = q.order('name');
    return q.then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    });
  }

  function loadCatalogItems() {
    if (!state.catalog.length) return Promise.resolve();
    return window.db.from('global_recipe_catalog_items')
      .select('recipe_id,sort_order,quantity,unit,note,ingredient:global_ingredient_catalog(id,name,unit)')
      .then(function (r) {
        if (r.error) throw r.error;
        state.catalogItems = r.data || [];
      });
  }

  function renderAll() { renderProducts(); renderIngredients(); renderTechCards(); bindButtons(); }

  function renderProducts() {
    var box = $('products'); if (!box) return;
    var q = norm($('productSearch') ? $('productSearch').value : '');
    var list = state.products.filter(function (p) { return !q || norm(p.name).indexOf(q) >= 0; });
    if ($('productCount')) $('productCount').textContent = state.products.length;
    box.innerHTML = list.length ? list.map(function (p) { return '<button type="button" class="btn ' + (state.selected === p.id ? 'product-active' : 'btn-ghost') + '" data-product="' + esc(p.id) + '">' + esc(p.name) + (p.category ? ' <span class="muted">· ' + esc(p.category) + '</span>' : '') + '</button>'; }).join('') : '<p class="muted">Нет товаров.</p>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-product]'), function (b) { b.onclick = function () { selectProduct(b.dataset.product); }; });
  }

  function renderIngredients() {
    var box = $('ingredients'); if (!box) return;
    box.innerHTML = state.ingredients.length ? state.ingredients.map(function (i) { return '<div class="ingredient-row" style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="flex:1"><b>' + esc(i.name) + '</b><div class="muted" style="font-size:11px">' + esc(unitLabel(i.unit)) + ' · ' + Number(i.purchase_price || 0).toFixed(2) + ' ₽ / ' + esc(i.purchase_quantity || 1) + ' ' + esc(unitLabel(i.unit)) + '</div></div><div style="display:flex;gap:6px"><button type="button" class="btn btn-ghost btn-sm" data-edit-ing="' + esc(i.id) + '">Изменить</button><button type="button" class="btn btn-danger btn-sm" data-delete-ing="' + esc(i.id) + '">Удалить</button></div></div>'; }).join('') : '<span class="muted">Пока нет ингредиентов.</span>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-edit-ing]'), function (b) { b.onclick = function () { editIngredient(b.dataset.editIng); }; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-delete-ing]'), function (b) { b.onclick = function () { deleteIngredient(b.dataset.deleteIng); }; });
  }

  function selectProduct(id) {
    state.selected = id;
    var p = state.products.find(function (x) { return x.id === id; }); if (!p) return;
    if ($('title')) $('title').textContent = 'Рецептура: ' + p.name;
    if ($('save')) $('save').hidden = false;
    rpc('manager_recipe_list', { p_venue_id: state.venueId, p_product_id: id }).then(function (data) {
      state.rows = (Array.isArray(data) ? data : []).map(function (r) { return { ingredient_id:r.ingredient_id, quantity:Number(r.quantity) || 0, note:r.note || '' }; });
      renderRecipe(); renderProducts(); return loadCost();
    }).catch(function (e) { message('Ошибка загрузки рецептуры: ' + (e.message || e), true); });
  }

  function renderRecipe() {
    var box = $('recipe'); if (!box) return;
    if (!state.selected) { box.innerHTML = '<p class="muted">Выберите товар.</p>'; return; }
    box.innerHTML = (state.rows.length ? state.rows.map(function (row, i) {
      var ing = state.ingredients.find(function (x) { return x.id === row.ingredient_id; });
      return '<div class="recipe-row"><select data-ri="' + i + '">' + state.ingredients.map(function (x) { return '<option value="' + esc(x.id) + '" ' + (x.id === row.ingredient_id ? 'selected' : '') + '>' + esc(x.name) + ' (' + esc(unitLabel(x.unit)) + ')</option>'; }).join('') + '</select><input data-rq="' + i + '" type="number" min=".001" step=".001" value="' + esc(row.quantity) + '"><span class="muted">' + esc(unitLabel(ing ? ing.unit : 'g')) + '</span><input data-rn="' + i + '" placeholder="Примечание" value="' + esc(row.note) + '"><button type="button" class="btn btn-danger" data-rd="' + i + '">×</button></div>';
    }).join('') : '<div class="muted" style="padding:12px 0">Рецептура пустая.</div>') + '<button type="button" class="btn btn-ghost" id="addRow">+ Ингредиент</button>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-ri]'), function (e) { e.onchange = function () { state.rows[+e.dataset.ri].ingredient_id = e.value; renderRecipe(); }; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-rq]'), function (e) { e.oninput = function () { state.rows[+e.dataset.rq].quantity = Number(e.value) || 0; }; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-rn]'), function (e) { e.oninput = function () { state.rows[+e.dataset.rn].note = e.value; }; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-rd]'), function (e) { e.onclick = function () { state.rows.splice(+e.dataset.rd, 1); renderRecipe(); }; });
    if ($('addRow')) $('addRow').onclick = function () { addRecipeRow(); };
  }

  function addRecipeRow() { if (!state.ingredients.length) { message('Сначала добавьте ингредиент.', true); return; } state.rows.push({ ingredient_id:state.ingredients[0].id, quantity:1, note:'' }); renderRecipe(); }

  function saveRecipe() {
    if (!state.selected) return;
    if (state.rows.some(function (r) { return !(r.quantity > 0); })) { message('Количество каждого ингредиента должно быть больше нуля.', true); return; }
    rpc('manager_product_recipe_save', { p_venue_id:state.venueId, p_product_id:state.selected, p_rows:state.rows }).then(function () { message('Рецептура сохранена.'); return loadCost(); }).catch(function (e) { message('Ошибка сохранения: ' + (e.message || e), true); });
  }

  function loadCost() {
    if (!state.selected) return Promise.resolve();
    return rpc('manager_recipe_cost', { p_venue_id:state.venueId, p_product_id:state.selected }).then(function (c) {
      c = c || {};
      if ($('cost')) $('cost').innerHTML = '<div class="cost-grid"><div class="cost-card"><div class="n">' + Number(c.cost || 0).toFixed(2) + ' ₽</div><div class="l">Себестоимость</div></div><div class="cost-card"><div class="n">' + Number(c.price || 0).toFixed(2) + ' ₽</div><div class="l">Цена продажи</div></div><div class="cost-card"><div class="n">' + Number(c.gross_profit || 0).toFixed(2) + ' ₽</div><div class="l">Валовая прибыль</div></div><div class="cost-card"><div class="n">' + Number(c.margin_percent || 0).toFixed(1) + '%</div><div class="l">Маржа</div></div></div>';
    });
  }

  function reloadIngredients() { return rpc('manager_ingredient_list', { p_venue_id:state.venueId }).then(function (d) { state.ingredients = Array.isArray(d) ? d : []; renderIngredients(); renderRecipe(); return loadCost(); }); }

  function addIngredient() {
    var name = $('iname') ? $('iname').value.trim() : '', qty = Number($('iqty') ? $('iqty').value : 0), price = Number($('iprice') ? $('iprice').value : 0);
    if (!name) { message('Введите название ингредиента.', true); return; }
    if (!(qty > 0)) { message('Закупочное количество должно быть больше нуля.', true); return; }
    if (!Number.isFinite(price) || price < 0) { message('Некорректная закупочная цена.', true); return; }
    rpc('manager_ingredient_upsert', { p_venue_id:state.venueId, p_name:name, p_unit:$('iunit').value, p_purchase_quantity:qty, p_purchase_price:price, p_id:null }).then(function () { message('Ингредиент добавлен.'); $('iname').value=''; $('iqty').value='1'; $('iprice').value='0'; return reloadIngredients(); }).catch(function (e) { message('Ошибка: ' + (e.message || e), true); });
  }

  function editIngredient(id) {
    var item = state.ingredients.find(function (x) { return x.id === id; }); if (!item) return;
    var name = prompt('Название ингредиента:', item.name); if (name === null) return; name = name.trim(); if (!name) return;
    var price = Number(prompt('Закупочная цена:', item.purchase_price || 0)); if (!Number.isFinite(price) || price < 0) return;
    rpc('manager_ingredient_upsert', { p_venue_id:state.venueId, p_name:name, p_unit:item.unit, p_purchase_quantity:Number(item.purchase_quantity || 1), p_purchase_price:price, p_id:id }).then(function () { message('Ингредиент изменён.'); return reloadIngredients(); }).catch(function (e) { message('Ошибка изменения: ' + (e.message || e), true); });
  }

  function deleteIngredient(id) {
    var item = state.ingredients.find(function (x) { return x.id === id; }); if (!item || !confirm('Удалить ингредиент «' + item.name + '»?')) return;
    rpc('manager_ingredient_delete', { p_venue_id:state.venueId, p_ingredient_id:id }).then(function () { message('Ингредиент удалён.'); return reloadIngredients(); }).catch(function (e) { message('Не удалось удалить: ' + (e.message || e), true); });
  }

  function renderTechCards() {
    var box = $('techList'); if (!box) return;
    box.innerHTML = state.techCards.length ? state.techCards.map(function (t) { return '<div class="tech-card">' + (t.file_url ? '<img src="' + esc(t.file_url) + '" alt="">' : '') + '<b>' + esc(t.file_name || 'Техкарта') + '</b><div class="muted">' + esc(t.status === 'processed' ? 'Распознано' : 'Загружено') + '</div><button type="button" class="btn btn-ghost btn-sm" data-tech="' + esc(t.id) + '">Открыть</button></div>'; }).join('') : '<div class="muted">Техкарт пока нет.</div>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-tech]'), function (b) { b.onclick = function () { var t = state.techCards.find(function (x) { return x.id === b.dataset.tech; }); if (t) showOcr(t.ocr_text || '', t); }; });
  }

  function renderCatalog() {
    var box = $('catalogList'); if (!box) return;
    var q = norm($('catalogSearch') ? $('catalogSearch').value : '');
    var list = state.catalog.filter(function (c) { return !q || norm([c.name,c.description,c.cuisine].join(' ')).indexOf(q) >= 0; });
    if ($('catalogStats')) $('catalogStats').textContent = 'Показано ' + list.length + ' из ' + state.catalog.length + ' рецептур';
    box.innerHTML = list.length ? list.map(function (c) { return '<div class="catalog-card"><div class="badge2">' + esc(c.category || 'Блюдо') + '</div><h4>' + esc(c.name) + '</h4><div class="muted">' + esc(c.description || '') + '</div><button type="button" class="btn btn-primary btn-sm" data-detail="' + esc(c.id) + '">Открыть техкарту</button></div>'; }).join('') : '<p class="muted">Ничего не найдено.</p>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-detail]'), function (b) { b.onclick = function () { openCatalogDetail(b.dataset.detail); }; });
  }

  function openCatalogDetail(id) {
    var c = state.catalog.find(function (x) { return x.id === id; }); if (!c || !$('catalogDetailModal')) return;
    $('catalogDetailModal').hidden = false;
    if ($('catalogDetailTitle')) $('catalogDetailTitle').textContent = c.name;
    var items = state.catalogItems.filter(function (x) { return x.recipe_id === c.id; }).sort(function (a,b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    if ($('catalogDetailBody')) $('catalogDetailBody').innerHTML = '<div class="detail-section"><b>Ингредиенты</b><table class="detail-table"><tr><th>Ингредиент</th><th>Количество</th></tr>' + items.map(function (x) { return '<tr><td>' + esc(x.ingredient ? x.ingredient.name : 'Ингредиент') + '</td><td>' + esc(x.quantity) + ' ' + esc(unitLabel(x.unit || (x.ingredient && x.ingredient.unit))) + '</td></tr>'; }).join('') + '</table></div><div class="detail-section"><h4>Технология приготовления</h4><div>' + esc(Array.isArray(c.steps) ? c.steps.map(function (s) { return typeof s === 'string' ? s : (s.text || ''); }).join('\n') : c.description || '—') + '</div></div>';
  }

  function renderGlobalIngredients() {
    var box = $('ingredientsDbList'); if (!box) return;
    var q = norm($('ingredientsSearch') ? $('ingredientsSearch').value : '');
    var list = state.globalIngredients.filter(function (x) { return !q || norm(x.name).indexOf(q) >= 0; });
    box.innerHTML = list.length ? list.map(function (x) { return '<div class="ingredient-row"><b>' + esc(x.name) + '</b><span class="muted"> · ' + esc(unitLabel(x.unit)) + '</span></div>'; }).join('') : '<p class="muted">Ничего не найдено.</p>';
  }

  function showOcr(text, meta) {
    if ($('ocrPanel')) $('ocrPanel').hidden = false;
    if ($('ocrText')) $('ocrText').textContent = text || 'Текст не распознан';
    state.ocrParsed = parseOcr(text);
    if ($('ocrStatus')) $('ocrStatus').textContent = 'Распознано. Найдено строк: ' + state.ocrParsed.length;
    if ($('ocrProduct')) $('ocrProduct').innerHTML = state.products.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    window.__ocrMeta = meta || {};
    window.__ocrMeta.ocrText = text || '';
  }

  function parseOcr(text) {
    var out = [];
    String(text || '').split(/\n+/).forEach(function (line) {
      var m = line.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs)?/i); if (!m) return;
      var name = line.slice(0, m.index).replace(/[,:;\-]+\s*$/, '').trim(); if (!name) return;
      out.push({ name:name, quantity:Number(String(m[1]).replace(',', '.')), unit:canonicalUnit(m[2]) || 'g', note:'OCR' });
    });
    return out;
  }

  function processFiles(files) {
    if (!window.Tesseract) { message('OCR-библиотека не загрузилась.', true); return; }
    Array.prototype.slice.call(files || []).reduce(function (p, file) { return p.then(function () { return Tesseract.recognize(file, 'rus+eng').then(function (r) { showOcr(r.data && r.data.text || '', { file:file, name:file.name }); }); }); }, Promise.resolve()).then(function () { message('Техкарта обработана. Проверьте результат.'); }).catch(function (e) { message('Ошибка OCR: ' + (e.message || e), true); });
  }

  function bindButtons() {
    if ($('productSearch')) $('productSearch').oninput = renderProducts;
    if ($('save')) $('save').onclick = saveRecipe;
    if ($('addIng')) $('addIng').onclick = addIngredient;
    if ($('refreshIngredients')) $('refreshIngredients').onclick = function () { reloadIngredients().then(function () { message('Ингредиенты обновлены.'); }); };
    if ($('catalogBtn')) $('catalogBtn').onclick = function () { $('catalogModal').hidden = false; renderCatalog(); };
    if ($('catalogSearch')) $('catalogSearch').oninput = renderCatalog;
    if ($('ingredientsDbBtn')) $('ingredientsDbBtn').onclick = function () { $('ingredientsModal').hidden = false; renderGlobalIngredients(); };
    if ($('ingredientsSearch')) $('ingredientsSearch').oninput = renderGlobalIngredients;
    if ($('uploadTechBtn')) $('uploadTechBtn').onclick = function () { if ($('techModal')) $('techModal').hidden = false; if ($('techFiles')) $('techFiles').click(); };
    if ($('techFiles')) $('techFiles').onchange = function () { processFiles(this.files); this.value = ''; };
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) { b.onclick = function (e) { e.preventDefault(); var m = $(b.dataset.close); if (m) m.hidden = true; }; });
    Array.prototype.forEach.call(document.querySelectorAll('.modalx'), function (m) { if (m.__qrCloseBound) return; m.__qrCloseBound = true; m.onclick = function (e) { if (e.target === m) m.hidden = true; }; });
    if ($('generateAllBtn')) $('generateAllBtn').onclick = function () { message('Автозаполнение доступно через текущие рецептуры и базу блюд.'); renderCatalog(); };
    if (!window.__QR_RECIPES_VENUE_HANDLER__) {
      window.__QR_RECIPES_VENUE_HANDLER__ = true;
      window.addEventListener('manager-venue-selected', function (e) {
        if (!e.detail || !e.detail.id) return;
        state.venueId = e.detail.id;
        localStorage.setItem('manager_venue_id', String(state.venueId));
        loadData();
      });
    }
  }

  function init() {
    compactLayout();
    if (!window.db) { console.error('[Recipes] window.db отсутствует'); return; }
    loadData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();