/* QR-Menu — рецептуры (вынесенный inline-скрипт) */
(function(){
  'use strict';
  if (window.__QR_MANAGER_RECIPES__) return;
  window.__QR_MANAGER_RECIPES__ = true;

  var recipeRoot = null;
  function startRecipes() {
    var root = document.querySelector('.recipe-tab-container .recipe-wrap');
    if (!root) return;
    if (recipeRoot === root) return;
    recipeRoot = root;

    var db = window.db;
    var venueId = localStorage.getItem('manager_venue_id') || localStorage.getItem('selectedVenueId');
    var products = [], ingredients = [], selected = null, rows = [], catalog = [], catalogItems = [], globalIngredients = [], techCards = [], ocrParsed = [], catalogIndex = {};
    var $ = function(id) { return document.getElementById(id); };

    /* ===== ВСТРОЕННАЯ БАЗА ТЕХКАРТ (используется, если общая база пуста) ===== */
    var BASE_UNIT = {'г':'g','кг':'kg','мл':'ml','л':'l','шт':'pcs'};
    var BASE_TECHCARDS = [
      {id:'sh-veal',name:'Шашлык из телятины',cat:'Гриль',diff:'medium',cuisine:'Кавказская',portion:100,unit:'г',prep:20,cook:15,nutr:{kcal:210,p:26,f:11,c:1},tech:'Мясо нарезать кубиками 30–40 г, замариновать с луком, солью и перцем 2–4 ч при 4 °C. Насадить на шампуры, жарить над углями 10–15 мин, переворачивая. Подавать с зеленью и маринованным луком.',ing:[['Телятина',120,'г','мякоть, кубик 30–40 г'],['Лук репчатый',30,'г','в маринад'],['Соль',2,'г',''],['Перец чёрный',0.5,'г','молотый'],['Зелень',5,'г','петрушка/кинза, при подаче'],['Лимонный сок',5,'мл','или уксус 9% — 3 мл']]},
      {id:'sh-pork',name:'Шашлык из свиного края',cat:'Гриль',diff:'medium',cuisine:'Кавказская',portion:100,unit:'г',prep:20,cook:15,nutr:{kcal:260,p:19,f:20,c:0},tech:'Мясо нарезать, замариновать с луком, солью и перцем 2–4 ч. Жарить над углями 12–15 мин, переворачивая. Подавать с зеленью и луком.',ing:[['Свиной край',120,'г',''],['Лук репчатый',30,'г',''],['Соль',2,'г',''],['Перец чёрный',0.5,'г',''],['Зелень',5,'г','при подаче']]},
      {id:'sh-lamb',name:'Шашлык из баранины',cat:'Гриль',diff:'medium',cuisine:'Кавказская',portion:100,unit:'г',prep:25,cook:15,nutr:{kcal:250,p:22,f:17,c:0},tech:'Мясо нарезать, замариновать с луком, солью, перцем и зирой 3–4 ч. Жарить над углями 12–15 мин. Подавать с зеленью и лимоном.',ing:[['Баранина',120,'г','шея/корейка'],['Лук репчатый',30,'г',''],['Соль',2,'г',''],['Перец чёрный',0.5,'г',''],['Зира',0.3,'г','по желанию'],['Зелень',5,'г','при подаче']]},
      {id:'lyulya-chick',name:'Люля-кебаб из курицы',cat:'Гриль',diff:'medium',cuisine:'Кавказская',portion:100,unit:'г',prep:70,cook:10,nutr:{kcal:180,p:20,f:10,c:1},tech:'Фарш с луком, солью и перцем отбить, охладить 1 ч, формовать на шампур, жарить 8–10 мин. Подавать с лавашом и зеленью.',ing:[['Куриный фарш',110,'г','филе'],['Лук репчатый',20,'г',''],['Соль',2,'г',''],['Перец чёрный',0.5,'г',''],['Лаваш',30,'г','при подаче']]},
      {id:'lyulya-veal',name:'Люля-кебаб из телятины',cat:'Гриль',diff:'medium',cuisine:'Кавказская',portion:100,unit:'г',prep:70,cook:12,nutr:{kcal:200,p:22,f:12,c:1},tech:'Фарш с луком, солью и перцем отбить, охладить 1 ч, формовать на шампур, жарить 10–12 мин. Подавать с лавашом и зеленью.',ing:[['Фарш из телятины',110,'г',''],['Лук репчатый',20,'г',''],['Соль',2,'г',''],['Перец чёрный',0.5,'г',''],['Лаваш',30,'г','при подаче']]},
      {id:'mignon',name:'Филе Миньон',cat:'Гриль',diff:'hard',cuisine:'Европейская',portion:100,unit:'г',prep:10,cook:12,nutr:{kcal:230,p:28,f:13,c:0},tech:'Вырезку обжарить на масле 2–3 мин с каждой стороны, довести в печи при 200 °C 6–8 мин до medium rare, отдохнуть 5 мин. Подавать с соусом демиглас и томатами гриль.',ing:[['Говяжья вырезка',130,'г',''],['Масло оливковое',5,'мл',''],['Соль морская',2,'г',''],['Перец чёрный',0.5,'г',''],['Тимьян',1,'г',''],['Соус демиглас',30,'мл',''],['Томаты черри',40,'г','гриль']]},
      {id:'turkey',name:'Стейк индейки',cat:'Гриль',diff:'medium',cuisine:'Европейская',portion:100,unit:'г',prep:30,cook:16,nutr:{kcal:160,p:29,f:4,c:1},tech:'Филе мариновать 30 мин (масло, чеснок, розмарин, лимон), жарить на гриле 6–8 мин с каждой стороны. Подавать с цукини и томатами гриль.',ing:[['Филе индейки',130,'г',''],['Масло оливковое',5,'мл',''],['Чеснок',2,'г',''],['Розмарин',1,'г',''],['Лимон',10,'г',''],['Цукини',40,'г','гриль'],['Томаты черри',30,'г','гриль']]},
      {id:'tea-classic',name:'Чай классический',cat:'Чай',diff:'easy',cuisine:'Авторская',portion:200,unit:'мл',prep:2,cook:7,nutr:{kcal:1,p:0,f:0,c:0},tech:'Прогреть чайник, заварить чёрный чай водой 95 °C, настоять 5–7 мин.',ing:[['Чай чёрный',3,'г','крупнолистовой'],['Вода',200,'мл','95 °C']]},
      {id:'tea-assam',name:'Чай Ассам',cat:'Чай',diff:'easy',cuisine:'Авторская',portion:500,unit:'мл',prep:2,cook:7,nutr:{kcal:2,p:0,f:0,c:0},tech:'Заварить Ассам водой 95 °C, настоять 5–7 мин.',ing:[['Чай Ассам',6,'г',''],['Вода',500,'мл','95 °C']]},
      {id:'tea-sencha',name:'Чай Сенча',cat:'Чай',diff:'easy',cuisine:'Японская',portion:500,unit:'мл',prep:2,cook:3,nutr:{kcal:2,p:0,f:0,c:0},tech:'Заварить сенчу водой 80 °C, настоять 2–3 мин, не кипяток.',ing:[['Чай сенча',6,'г',''],['Вода',500,'мл','80 °C']]},
      {id:'tea-oolong',name:'Чай Молочный улун',cat:'Чай',diff:'easy',cuisine:'Японская',portion:500,unit:'мл',prep:2,cook:4,nutr:{kcal:2,p:0,f:0,c:0},tech:'Заварить улун водой 90 °C, настоять 3–4 мин, выдерживает 2–3 пролива.',ing:[['Улун молочный',7,'г',''],['Вода',500,'мл','90 °C']]},
      {id:'tea-earl',name:'Чай Эрл Грей',cat:'Чай',diff:'easy',cuisine:'Европейская',portion:500,unit:'мл',prep:2,cook:7,nutr:{kcal:2,p:0,f:0,c:0},tech:'Заварить Эрл Грей водой 95 °C, настоять 5–7 мин.',ing:[['Чай Эрл Грей',6,'г','с бергамотом'],['Вода',500,'мл','95 °C']]},
      {id:'tea-fruit',name:'Чай Наглый фрукт',cat:'Чай',diff:'easy',cuisine:'Авторская',portion:500,unit:'мл',prep:3,cook:10,nutr:{kcal:15,p:0,f:0,c:3},tech:'Смешать каркаде, яблоко, шиповник, малину и цукаты, заварить водой 95 °C, настоять 7–10 мин.',ing:[['Каркаде',5,'г',''],['Яблоко сушёное',5,'г',''],['Шиповник',4,'г',''],['Малина сушёная',3,'г',''],['Цукаты ананаса',3,'г',''],['Изюм',2,'г',''],['Вода',500,'мл','95 °C']]},
      {id:'espresso',name:'Эспрессо',cat:'Кофе',diff:'easy',cuisine:'Европейская',portion:30,unit:'мл',prep:1,cook:1,nutr:{kcal:2,p:0,f:0,c:0},tech:'Экстракция 25–30 сек при 9 бар, вода 92 °C.',ing:[['Кофе в зёрнах',9,'г','помол мелкий'],['Вода',30,'мл','92 °C']]},
      {id:'latte',name:'Латте',cat:'Кофе',diff:'easy',cuisine:'Европейская',portion:300,unit:'мл',prep:2,cook:3,nutr:{kcal:120,p:6,f:6,c:8},tech:'Приготовить эспрессо, взбить молоко паром, влить в кофе, пена 1 см.',ing:[['Кофе в зёрнах',9,'г','эспрессо 30 мл'],['Молоко',250,'мл','паровое + пена']]},
      {id:'americano',name:'Американо',cat:'Кофе',diff:'easy',cuisine:'Европейская',portion:150,unit:'мл',prep:1,cook:2,nutr:{kcal:2,p:0,f:0,c:0},tech:'Приготовить эспрессо и долить горячую воду.',ing:[['Кофе в зёрнах',9,'г','эспрессо 30 мл'],['Вода',120,'мл','горячая']]},
      {id:'cappuccino',name:'Капучино',cat:'Кофе',diff:'easy',cuisine:'Европейская',portion:200,unit:'мл',prep:2,cook:3,nutr:{kcal:100,p:5,f:5,c:7},tech:'Приготовить эспрессо, взбить молоко до плотной пены 1,5–2 см, посыпать какао.',ing:[['Кофе в зёрнах',9,'г','эспрессо 30 мл'],['Молоко',170,'мл','плотная пена'],['Какао',1,'г','посыпка']]},
      {id:'raf',name:'Кофе Раф',cat:'Кофе',diff:'easy',cuisine:'Европейская',portion:300,unit:'мл',prep:2,cook:4,nutr:{kcal:220,p:5,f:20,c:10},tech:'Эспрессо + сливки + ванильный сахар, взбить паром до однородной пены.',ing:[['Кофе в зёрнах',9,'г','эспрессо 30 мл'],['Сливки 10%',250,'мл',''],['Ванильный сахар',5,'г','']]}
    ];

    function baseToCatalog() {
      catalog = BASE_TECHCARDS.map(function(c) {
        return {
          id: 'base-'+c.id,
          name: c.name,
          category: c.cat,
          description: c.tech.slice(0,140),
          cuisine: c.cuisine,
          difficulty: c.diff,
          yield_quantity: c.portion,
          yield_unit: BASE_UNIT[c.unit] || 'g',
          base_servings: 1,
          prep_minutes: c.prep || 5,
          cook_minutes: c.cook || 10,
          nutrition_per_serving: { calories: c.nutr.kcal, protein: c.nutr.p, fat: c.nutr.f, carbs: c.nutr.c },
          steps: [c.tech],
          source: 'Встроенная база QR-меню',
          source_license: 'внутренняя',
          source_attribution: '—',
          photo: null,
          is_base: true
        };
      });
      catalogItems = [];
      BASE_TECHCARDS.forEach(function(c) {
        c.ing.forEach(function(it, ii) {
          catalogItems.push({
            recipe_id: 'base-'+c.id,
            sort_order: ii,
            quantity: it[1],
            unit: BASE_UNIT[it[2]] || 'g',
            note: it[3] || '',
            ingredient: { name: it[0], unit: BASE_UNIT[it[2]] || 'g' }
          });
        });
      });
      buildCatalogIndex();
    }

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    }

    function msg(t, e) {
      $('msg').innerHTML = t ? '<div class="msg ' + (e ? 'err' : 'ok') + '">' + esc(t) + '</div>' : '';
    }

    function rpc(name, args) {
      return db.rpc(name, args).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    }

    function norm(s) {
      return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
    }

    function similarity(a, b) {
      a = norm(a); b = norm(b);
      if (!a || !b) return 0;
      if (a === b) return 1;
      if (a.includes(b) || b.includes(a)) return .92;
      var A = a.split(' '), B = b.split(' '), SA = new Set(A), SB = new Set(B), inter = 0;
      A.forEach(function(x) { if (SB.has(x)) inter++; });
      var score = inter / (SA.size + SB.size - inter || 1);
      var stop = { с:1, сборка:1, классический:1, классическая:1, домашний:1, домашняя:1, фирменный:1, фирменная:1, порция:1, большой:1, большая:1, мини:1, pro:1, демо:1 };
      var coreA = A.filter(function(x) { return x.length > 3 && !stop[x]; })[0];
      var coreB = B.filter(function(x) { return x.length > 3 && !stop[x]; })[0];
      if (coreA && coreB && coreA === coreB) score = Math.max(score, .78);
      return score;
    }

    function unitLabel(u) {
      return ({'g':'г','kg':'кг','ml':'мл','l':'л','pcs':'шт'})[u] || u || '';
    }

    function loadAll() {
      if (!venueId) {
        msg('Не найдено выбранное заведение. Откройте кабинет управляющего и выберите заведение.', true);
        return;
      }
      Promise.all([
        db.from('products').select('id,name,description,category,price').eq('venue_id', venueId).order('name'),
        rpc('manager_ingredient_list', { p_venue_id: venueId }),
        db.from('global_recipe_catalog').select('id,name,category,description,yield_quantity,yield_unit,cuisine,difficulty,base_servings,prep_minutes,cook_minutes,nutrition_per_serving,steps,source,source_license,source_attribution,photo').eq('is_active', true).order('name'),
        db.from('global_ingredient_catalog').select('id,name,unit,category,aliases').eq('is_active', true).order('name'),
        db.from('manager_tech_cards').select('id,product_id,file_name,file_path,file_url,ocr_text,status,created_at').eq('venue_id', venueId).order('created_at', {ascending:false})
      ]).then(function(r) {
        if (r[0].error) throw r[0].error;
        if (r[2].error) throw r[2].error;
        if (r[3].error) throw r[3].error;
        if (r[4].error) throw r[4].error;
        products = r[0].data || [];
        ingredients = Array.isArray(r[1]) ? r[1] : [];
        catalog = r[2].data || [];
        globalIngredients = r[3].data || [];
        techCards = r[4].data || [];
        var loadItems = catalog.length ? db.from('global_recipe_catalog_items').select('recipe_id,sort_order,quantity,unit,note,ingredient:global_ingredient_catalog(id,name,unit)').then(function(x) { catalogItems = x.data || []; }) : Promise.resolve();
        return loadItems.then(function() {
          if (!catalog.length) { baseToCatalog(); } else { buildCatalogIndex(); }
          return Promise.all(techCards.map(function(t) {
            return t.file_path ? db.storage.from('tech-cards').createSignedUrl(t.file_path, 3600).then(function(x) {
              if (!x.error && x.data) t.file_url = x.data.signedUrl;
            }) : Promise.resolve();
          })).then(function() {
            renderProducts();
            renderIngredients();
            renderTechCards();
            renderCatalog();
            renderGlobalIngredients();
            autoFillOnOpen();
          });
        });
      }).catch(function(e) {
        console.error(e);
        msg('Ошибка загрузки: ' + (e.message || e), true);
      });
    }

    function renderProducts() {
      var q = norm($('productSearch').value);
      var arr = products.filter(function(p) { return !q || norm(p.name).includes(q); });
      $('productCount').textContent = products.length;
      $('products').innerHTML = arr.length ? arr.map(function(p) {
        return '<button type="button" class="btn ' + (selected === p.id ? 'product-active' : 'btn-ghost') + '" data-p="' + esc(p.id) + '">' + esc(p.name) + ' <span class="muted">' + (p.category ? ' · ' + esc(p.category) : '') + ' · ' + Number(p.price || 0).toFixed(2) + ' ₽</span></button>';
      }).join('') : '<p class="muted">Нет товаров.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-p]'), function(b) {
        b.onclick = function() { pick(b.getAttribute('data-p')); };
      });
    }

    $('productSearch').addEventListener('input', renderProducts);

    function descriptionIngredientCandidates(description) {
      var text = String(description || '').replace(/\r/g, ' ').replace(/\n+/g, ' ');
      if (!text.trim()) return [];
      var found = [], seen = {};
      var aliases = [];
      (Array.isArray(globalIngredients) ? globalIngredients : []).forEach(function(g) {
        aliases.push({ name: g.name, unit: g.unit, alias: g.name, source: g });
        if (Array.isArray(g.aliases)) g.aliases.forEach(function(a) { if (a) aliases.push({ name: g.name, unit: g.unit, alias: a, source: g }); });
      });
      (Array.isArray(ingredients) ? ingredients : []).forEach(function(g) {
        aliases.push({ name: g.name, unit: g.unit, alias: g.name, source: null, local: g });
      });
      aliases.sort(function(a, b) { return norm(b.alias).length - norm(a.alias).length; });
      aliases.forEach(function(a) {
        var raw = String(a.alias || '').trim();
        if (raw.length < 2) return;
        var re = new RegExp('(?:^|[^а-яa-z0-9])' + raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[^а-яa-z0-9]|$)', 'i');
        var m = re.exec(text);
        if (!m) return;
        var before = text.slice(Math.max(0, m.index - 12), m.index);
        var after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
        var q = 0, unit = a.unit || 'g';
        var qm = after.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs)?/i) || before.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs)?\s*$/i);
        if (qm) { q = Number(String(qm[1]).replace(',', '.')) || 0; unit = canonUnitForDescription(qm[2]) || unit; }
        if (!(q > 0)) q = 1;
        var key = norm(a.name);
        if (seen[key]) return;
        seen[key] = 1;
        found.push({ name: a.name, unit: unit, quantity: q, source: a.source, local: a.local, note: 'Из описания блюда' });
      });
      return found;
    }

    function canonUnitForDescription(u) {
      u = String(u || '').toLowerCase().replace(/ё/g, 'е').replace(/^гр?\.?$/, 'g').replace(/^кг$/, 'kg').replace(/^мл$/, 'ml').replace(/^л$/, 'l').replace(/^шт$/, 'pcs');
      return ['g','kg','ml','l','pcs'].indexOf(u) >= 0 ? u : null;
    }

    async function buildRowsFromDescription(p) {
      var candidates = descriptionIngredientCandidates(p && p.description);
      if (!candidates.length) return [];
      var result = [];
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i], local = c.local;
        if (!local) {
          var ranked = ingredients.map(function(x) { return { x: x, s: similarity(x.name, c.name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
          if (ranked && ranked.s >= .86) local = ranked.x;
        }
        if (!local && c.source) {
          try { local = await ensureLocalIngredient({ ingredient: c.source, unit: c.unit }); } catch(e) { console.warn('[Description] local ingredient:', c.name, e); }
        }
        if (local) result.push({ ingredient_id: local.id, quantity: convertQuantity(c.quantity, c.unit, local.unit), note: c.note });
      }
      return result;
    }

    function pick(id) {
      selected = id;
      var p = products.find(function(x) { return x.id === id; });
      if (!p) return;
      $('title').textContent = 'Рецептура: ' + p.name;
      $('save').hidden = false;
      var cat = catalog.map(function(c) { return { c: c, s: similarity(p.name, c.name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
      $('matchInfo').textContent = cat && cat.s >= .55 ? 'Ближайшая техкарта в базе: ' + cat.c.name + ' · совпадение ' + Math.round(cat.s * 100) + '%' : 'В базе подходящая техкарта не найдена';
      rows = [];
      rpc('manager_recipe_list', { p_venue_id: venueId, p_product_id: id }).then(async function(data) {
        rows = (Array.isArray(data) ? data : []).map(function(r) {
          return { ingredient_id: r.ingredient_id, quantity: Number(r.quantity) || 0, note: r.note || '' };
        });
        if (!rows.length && p.description) {
          try {
            var autoRows = await buildRowsFromDescription(p);
            if (autoRows.length) rows = autoRows;
          } catch(e) { console.warn('[Description] auto recipe:', e); }
        }
        renderRecipe();
        renderProducts();
        return loadCost();
      }).catch(function(e) { msg('Ошибка загрузки рецептуры: ' + e.message, true); });
    }

    function loadCost() {
      if (!selected) { $('cost').innerHTML = ''; return; }
      return rpc('manager_recipe_cost', { p_venue_id: venueId, p_product_id: selected }).then(function(c) {
        c = c || {};
        $('cost').innerHTML = '<div class="cost-grid"><div class="cost-card"><div class="n">' + Number(c.cost || 0).toFixed(2) + ' ₽</div><div class="l">Себестоимость</div></div><div class="cost-card"><div class="n">' + Number(c.price || 0).toFixed(2) + ' ₽</div><div class="l">Цена продажи</div></div><div class="cost-card"><div class="n">' + Number(c.gross_profit || 0).toFixed(2) + ' ₽</div><div class="l">Валовая прибыль</div></div><div class="cost-card"><div class="n">' + Number(c.margin_percent || 0).toFixed(1) + '%</div><div class="l">Маржа</div></div></div>';
      }).catch(function(e) { $('cost').innerHTML = '<div class="msg err">Ошибка себестоимости: ' + esc(e.message) + '</div>'; });
    }

    function renderRecipe() {
      var c = $('recipe');
      if (!selected) { c.innerHTML = '<p class="muted">Выберите товар.</p>'; return; }
      if (!rows.length) {
        c.innerHTML = '<div class="muted" style="padding:12px 0">Рецептура пустая. Можно добавить ингредиент вручную или сгенерировать её из базы/техкарты.</div><button class="btn btn-ghost" id="addRow">+ Ингредиент</button>';
        var a = $('addRow');
        if (a) a.onclick = addRow;
        return;
      }
      c.innerHTML = rows.map(function(r, i) {
        var ing = ingredients.find(function(x) { return x.id === r.ingredient_id; });
        var unit = ing ? ing.unit : 'g';
        return '<div class="recipe-row"><select data-ri="' + i + '">' + ingredients.map(function(x) {
          return '<option value="' + esc(x.id) + '" ' + (x.id === r.ingredient_id ? 'selected' : '') + '>' + esc(x.name) + ' (' + esc(unitLabel(x.unit)) + ')</option>';
        }).join('') + '</select><input data-rq="' + i + '" type="number" min=".001" step=".001" value="' + esc(r.quantity) + '"><span class="muted">' + esc(unitLabel(unit)) + '</span><input data-rn="' + i + '" placeholder="Примечание" value="' + esc(r.note) + '"><button class="btn btn-danger" data-rd="' + i + '">×</button></div>';
      }).join('') + '<button class="btn btn-ghost" id="addRow">+ Ингредиент</button>';
      Array.prototype.forEach.call(c.querySelectorAll('[data-ri]'), function(e) {
        e.onchange = function() { var i = +e.dataset.ri; rows[i].ingredient_id = e.value; renderRecipe(); };
      });
      Array.prototype.forEach.call(c.querySelectorAll('[data-rq]'), function(e) {
        e.oninput = function() { rows[+e.dataset.rq].quantity = Number(e.value) || 0; };
      });
      Array.prototype.forEach.call(c.querySelectorAll('[data-rn]'), function(e) {
        e.oninput = function() { rows[+e.dataset.rn].note = e.value; };
      });
      Array.prototype.forEach.call(c.querySelectorAll('[data-rd]'), function(e) {
        e.onclick = function() { rows.splice(+e.dataset.rd, 1); renderRecipe(); };
      });
      $('addRow').onclick = addRow;
    }

    function addRow() {
      if (!ingredients.length) { msg('Сначала добавьте ингредиент.', true); return; }
      rows.push({ ingredient_id: ingredients[0].id, quantity: 1, note: '' });
      renderRecipe();
    }

    $('save').onclick = function() {
      if (!selected) return;
      if (rows.some(function(r) { return !(r.quantity > 0); })) {
        msg('Количество каждого ингредиента должно быть больше нуля.', true);
        return;
      }
      rpc('manager_product_recipe_save', { p_venue_id: venueId, p_product_id: selected, p_rows: rows }).then(function() {
        msg('Рецептура сохранена.');
        return loadCost();
      }).catch(function(e) { msg('Ошибка сохранения: ' + e.message, true); });
    };

    $('addIng').onclick = function() {
      var n = $('iname').value.trim(), q = Number($('iqty').value), price = Number($('iprice').value);
      if (!n) { msg('Введите название ингредиента.', true); return; }
      if (!(q > 0)) { msg('Закупочное количество должно быть больше нуля.', true); return; }
      if (price < 0 || !Number.isFinite(price)) { msg('Некорректная закупочная цена.', true); return; }
      rpc('manager_ingredient_upsert', {
        p_venue_id: venueId,
        p_name: n,
        p_unit: $('iunit').value,
        p_purchase_quantity: q,
        p_purchase_price: price,
        p_id: null
      }).then(function() {
        msg('Ингредиент добавлен.');
        $('iname').value = '';
        $('iqty').value = '1';
        $('iprice').value = '0';
        return reloadIngredients();
      }).catch(function(e) { msg('Ошибка: ' + e.message, true); });
    };

    function reloadIngredients() {
      return rpc('manager_ingredient_list', { p_venue_id: venueId }).then(function(d) {
        ingredients = Array.isArray(d) ? d : [];
        renderIngredients();
        renderRecipe();
        if (selected) return loadCost();
      });
    }

    $('refreshIngredients').onclick = function() {
      reloadIngredients().then(function() { msg('Ингредиенты обновлены'); }).catch(function(e) { msg('Ошибка: ' + e.message, true); });
    };

    function openLocalIngredientEditor(item) {
      var back = document.createElement('div');
      back.className = 'qr-local-ingredient-editor';
      back.innerHTML = '<div class="glass card" style="width:min(440px,calc(100vw - 30px));padding:20px">' +
        '<h3 style="margin-top:0">Изменить ингредиент</h3>' +
        '<label>Название</label><input id="localIngName" value="' + esc(item.name) + '" style="width:100%;margin:6px 0 10px">' +
        '<label>Единица измерения</label><select id="localIngUnit" style="width:100%;margin:6px 0 10px">' +
        '<option value="g" ' + (item.unit === 'g' ? 'selected' : '') + '>г</option>' +
        '<option value="kg" ' + (item.unit === 'kg' ? 'selected' : '') + '>кг</option>' +
        '<option value="ml" ' + (item.unit === 'ml' ? 'selected' : '') + '>мл</option>' +
        '<option value="l" ' + (item.unit === 'l' ? 'selected' : '') + '>л</option>' +
        '<option value="pcs" ' + (item.unit === 'pcs' ? 'selected' : '') + '>шт</option>' +
        '</select>' +
        '<label>Закупочное количество</label><input id="localIngQty" type="number" min="0.001" step="0.001" value="' + Number(item.purchase_quantity || 1) + '" style="width:100%;margin:6px 0 10px">' +
        '<label>Закупочная цена</label><input id="localIngPrice" type="number" min="0" step="0.01" value="' + Number(item.purchase_price || 0) + '" style="width:100%;margin:6px 0 14px">' +
        '<div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" id="localIngCancel">Отмена</button><button type="button" class="btn btn-primary" id="localIngSave">Сохранить</button></div>' +
        '</div>';
      back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:200000;display:flex;align-items:center;justify-content:center;padding:15px';
      document.body.appendChild(back);
      back.querySelector('#localIngCancel').onclick = function() { back.remove(); };
      back.onclick = function(e) { if (e.target === back) back.remove(); };
      back.querySelector('#localIngSave').onclick = function() {
        var name = back.querySelector('#localIngName').value.trim();
        var unit = back.querySelector('#localIngUnit').value;
        var qty = Number(back.querySelector('#localIngQty').value);
        var price = Number(back.querySelector('#localIngPrice').value);
        if (!name) { msg('Введите название ингредиента.', true); return; }
        if (!(qty > 0)) { msg('Закупочное количество должно быть больше нуля.', true); return; }
        if (!Number.isFinite(price) || price < 0) { msg('Некорректная цена закупки.', true); return; }
        var btn = this;
        btn.disabled = true;
        rpc('manager_ingredient_upsert', {
          p_venue_id: venueId,
          p_name: name,
          p_unit: unit,
          p_purchase_quantity: qty,
          p_purchase_price: price,
          p_id: item.id
        }).then(function() {
          back.remove();
          msg('Ингредиент изменён.');
          return reloadIngredients();
        }).catch(function(e) {
          btn.disabled = false;
          msg('Ошибка изменения: ' + (e.message || e), true);
        });
      };
    }

    function deleteLocalIngredient(item) {
      if (!confirm('Удалить ингредиент «' + item.name + '»?')) return;
      rpc('manager_ingredient_delete', { p_venue_id: venueId, p_ingredient_id: item.id })
        .then(function() { msg('Ингредиент удалён.'); return reloadIngredients(); })
        .catch(function(e) { msg('Не удалось удалить ингредиент: ' + (e.message || e), true); });
    }

    function renderIngredients() {
      $('ingredients').innerHTML = ingredients.length ? ingredients.map(function(i) {
        return '<div class="ingredient-row" style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<div style="flex:1;min-width:0"><b>' + esc(i.name) + '</b><div class="muted" style="font-size:11px">' + esc(unitLabel(i.unit)) + ' · закупка ' + Number(i.purchase_price || 0).toFixed(2) + ' ₽ / ' + esc(i.purchase_quantity) + ' ' + esc(unitLabel(i.unit)) + '</div></div>' +
          '<div class="ingredient-actions" style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-local-edit="' + esc(i.id) + '">Изменить</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-local-delete="' + esc(i.id) + '">Удалить</button>' +
          '</div>' +
          '</div>';
      }).join('') : '<span class="muted">Пока нет ингредиентов.</span>';
      Array.prototype.forEach.call($('ingredients').querySelectorAll('[data-local-edit]'), function(b) {
        b.onclick = function() {
          var item = ingredients.find(function(x) { return x.id === b.dataset.localEdit; });
          if (item) openLocalIngredientEditor(item);
        };
      });
      Array.prototype.forEach.call($('ingredients').querySelectorAll('[data-local-delete]'), function(b) {
        b.onclick = function() {
          var item = ingredients.find(function(x) { return x.id === b.dataset.localDelete; });
          if (item) deleteLocalIngredient(item);
        };
      });
    }

    function renderTechCards() {
      var c = $('techList');
      c.innerHTML = techCards.length ? techCards.map(function(t) {
        return '<div class="tech-card">' + (t.file_url ? '<img src="' + esc(t.file_url) + '" alt="">' : '') + '<b>' + esc(t.file_name || 'Техкарта') + '</b><div class="muted" style="font-size:11px;margin:5px 0">' + (t.status === 'processed' ? 'Распознано' : 'Загружено') + '</div><button class="btn btn-ghost btn-sm" data-tech="' + esc(t.id) + '">Открыть / распознать</button></div>';
      }).join('') : '<div class="muted">Техкарт пока нет. Добавьте изображения — система распознает их локально.</div>';
      Array.prototype.forEach.call(c.querySelectorAll('[data-tech]'), function(b) {
        b.onclick = function() {
          var t = techCards.find(function(x) { return x.id === b.dataset.tech; });
          if (t) showOcr(t.ocr_text || '', t);
        };
      });
    }

    $('uploadTechBtn').onclick = function() {
      $('techModal').hidden = false;
      $('techFiles').click();
    };
    $('techFiles').onchange = function() {
      var fs = Array.from(this.files || []);
      if (!fs.length) return;
      fs.reduce(function(pr, f) {
        return pr.then(function() { return processImage(f); });
      }, Promise.resolve()).then(function() {
        msg('Техкарты обработаны. Проверяйте сопоставление блюда перед сохранением.');
      }).catch(function(e) {
        msg('Ошибка OCR: ' + (e.message || e), true);
      }).finally(function() {
        $('techFiles').value = '';
      });
    };

    function ocrPrepareImage(file) {
      return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() {
          try {
            var scale = Math.max(2, Math.min(3, 1800 / Math.max(img.width, img.height)));
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var data = ctx.getImageData(0, 0, canvas.width, canvas.height), d = data.data;
            for (var i = 0; i < d.length; i += 4) {
              var y = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
              y = (y - 128) * 1.25 + 128;
              y = Math.max(0, Math.min(255, y));
              d[i] = d[i+1] = d[i+2] = y;
            }
            ctx.putImageData(data, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch(e) { reject(e); }
          URL.revokeObjectURL(img.__qrObjectUrl || '');
        };
        img.onerror = function() {
          URL.revokeObjectURL(img.__qrObjectUrl || '');
          reject(new Error('Не удалось открыть изображение техкарты'));
        };
        try { img.__qrObjectUrl = URL.createObjectURL(file); img.src = img.__qrObjectUrl; } catch(e) { reject(e); }
      });
    }

    async function processImage(file) {
      $('techModal').hidden = false;
      $('ocrPanel').hidden = false;
      $('ocrText').textContent = '';
      $('ocrRecipeRows').innerHTML = '';
      $('ocrProgress').style.width = '0%';
      $('ocrStatus').textContent = 'Подготовка ' + file.name + '...';
      if (!window.Tesseract) throw new Error('OCR-библиотека не загрузилась');
      var source = file;
      try { source = await ocrPrepareImage(file); } catch(e) { console.warn('[OCR] preprocessing failed, original used', e); }
      $('ocrStatus').textContent = 'Распознавание ' + file.name + '...';
      var result = await Tesseract.recognize(source, 'rus+eng', {
        logger: function(x) {
          if (x.progress != null) $('ocrProgress').style.width = Math.round(x.progress * 100) + '%';
          if (x.status) $('ocrStatus').textContent = x.status;
        }
      });
      var text = (result.data && result.data.text || '').trim();
      if (!text || !parseTechText(text).length) {
        $('ocrStatus').textContent = 'Повторное распознавание исходного изображения...';
        var fallback = await Tesseract.recognize(file, 'rus+eng', {
          logger: function(x) {
            if (x.progress != null) $('ocrProgress').style.width = Math.round(x.progress * 100) + '%';
            if (x.status) $('ocrStatus').textContent = x.status;
          }
        });
        var fallbackText = (fallback.data && fallback.data.text || '').trim();
        if (fallbackText) text = fallbackText;
      }
      showOcr(text, { file: file, name: file.name });
    }

    function showOcr(text, meta) {
      $('ocrPanel').hidden = false;
      $('ocrText').textContent = text || 'Текст не распознан';
      ocrParsed = parseTechText(text);
      $('ocrRecipeRows').innerHTML = ocrParsed.length ?
        '<h4>Найденные ингредиенты</h4>' + ocrParsed.map(function(r, i) {
          return '<div class="gen-row"><input data-oi="' + i + '" value="' + esc(r.name) + '"><input data-oq="' + i + '" type="number" step=".001" value="' + esc(r.quantity) + '"><select data-ou="' + i + '"><option value="g" ' + (r.unit === 'g' ? 'selected' : '') + '>г</option><option value="kg" ' + (r.unit === 'kg' ? 'selected' : '') + '>кг</option><option value="ml" ' + (r.unit === 'ml' ? 'selected' : '') + '>мл</option><option value="l" ' + (r.unit === 'l' ? 'selected' : '') + '>л</option><option value="pcs" ' + (r.unit === 'pcs' ? 'selected' : '') + '>шт</option></select><input data-on="' + i + '" placeholder="Примечание" value="' + esc(r.note || '') + '"></div>';
        }).join('') :
        '<div class="muted">Не удалось выделить строки ингредиентов автоматически. Текст OCR можно использовать для ручного ввода.</div>';
      var best = products.map(function(p) {
        return { p: p, s: similarity(text.split('\n')[0] || '', p.name) };
      }).sort(function(a, b) { return b.s - a.s; });
      $('ocrProduct').innerHTML = products.map(function(p) {
        var b = best.find(function(x) { return x.p.id === p.id; });
        return '<option value="' + esc(p.id) + '" ' + (b && b.s >= .45 ? 'selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      $('ocrStatus').textContent = 'Распознано. Найдено строк ингредиентов: ' + ocrParsed.length;
      meta = meta || {};
      meta.ocrText = text;
      meta.parsed = ocrParsed;
      window.__ocrMeta = meta;
    }

    function parseTechText(text) {
      var out = [], seen = {};
      var source = String(text || '').replace(/\r/g, '');
      var aliases = [];
      (Array.isArray(globalIngredients) ? globalIngredients : []).forEach(function(g) {
        aliases.push({ name: g.name, unit: g.unit, alias: g.name });
        if (Array.isArray(g.aliases)) g.aliases.forEach(function(a) { if (a) aliases.push({ name: g.name, unit: g.unit, alias: a }); });
      });
      (Array.isArray(ingredients) ? ingredients : []).forEach(function(g) { aliases.push({ name: g.name, unit: g.unit, alias: g.name }); });
      aliases.sort(function(a, b) { return norm(b.alias).length - norm(a.alias).length; });

      function canonUnit(u) {
        u = String(u || '').toLowerCase().replace(/ё/g, 'е').replace(/^гр?\.?$/, 'g').replace(/^кг$/, 'kg').replace(/^мл$/, 'ml').replace(/^л$/, 'l').replace(/^шт$/, 'pcs');
        if (u === 'kg' || u === 'ml' || u === 'l' || u === 'pcs' || u === 'g') return u;
        return null;
      }

      function cleanLine(line) {
        return line.replace(/\s+/g, ' ').replace(/[|¦]+/g, ' ').replace(/[—–−]+/g, '-').trim();
      }

      function numberTokens(line) {
        var a = [], re = /(\d+(?:[.,]\d+)?)(?:\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs))?/gi, m;
        while ((m = re.exec(line))) a.push({ value: Number(String(m[1]).replace(',', '.')), unit: canonUnit(m[2]), index: m.index, end: re.lastIndex, raw: m[0] });
        return a.filter(function(x) { return Number.isFinite(x.value) && x.value > 0 && x.value < 100000; });
      }

      source.split(/\n+/).map(cleanLine).filter(Boolean).forEach(function(line) {
        if (line.length < 3) return;
        var ln = norm(line);
        var best = null;
        aliases.forEach(function(a) {
          var an = norm(a.alias);
          if (!an) return;
          var pos = ln.indexOf(an);
          if (pos >= 0) {
            var score = an.length / Math.max(ln.length, 1) + 0.5;
            if (!best || score > best.score) best = { a: a, pos: pos, score: score };
          } else {
            var sim = similarity(line, a.alias);
            if (sim >= 0.62 && (!best || sim > best.score)) best = { a: a, pos: -1, score: sim };
          }
        });
        var nums = numberTokens(line);
        if (!best) {
          if (!nums.length) return;
          var generic = line.replace(/(\d+(?:[.,]\d+)?)(?:\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs))?/gi, ' ')
            .replace(/\s+/g, ' ').replace(/^[•·\-–—\d.)\s]+/, '').trim();
          generic = generic.replace(/^(ингредиент|наименование|брутто|нетто|выход|масса|количество|ед\.?\s*изм\.?)\s*/i, '').trim();
          var unitNum = nums.filter(function(n) { return !!n.unit; });
          var pick = unitNum.length ? unitNum[unitNum.length - 1] : nums[nums.length - 1];
          if (generic.length >= 2 && pick && pick.value > 0 && generic.length < 100) {
            var gkey = norm(generic) + '|' + pick.value + '|' + (pick.unit || 'g');
            if (!seen[gkey]) { seen[gkey] = 1; out.push({ name: generic, quantity: pick.value, unit: pick.unit || 'g', note: 'OCR' }); }
          }
          return;
        }
        if (!nums.length) return;
        var qty = null, unit = null;
        var after = best.pos >= 0 ? nums.filter(function(n) { return n.index >= best.pos; }) : nums;
        var candidates = after.length ? after : nums;
        var withUnit = candidates.filter(function(n) { return !!n.unit; });
        if (withUnit.length) {
          qty = withUnit[withUnit.length - 1].value;
          unit = withUnit[withUnit.length - 1].unit;
        } else {
          qty = candidates[candidates.length - 1].value;
          unit = best.a.unit || 'g';
        }
        if (!(qty > 0)) return;
        var key = norm(best.a.name) + '|' + qty + '|' + unit;
        if (seen[key]) return;
        seen[key] = 1;
        var note = 'OCR';
        out.push({ name: best.a.name, quantity: qty, unit: unit, note: note });
      });
      return out;
    }

    $('applyOcr').onclick = async function() {
      var pid = $('ocrProduct').value;
      if (!pid) { msg('Выберите блюдо.', true); return; }
      var arr = ocrParsed.map(function(r, i) {
        return {
          name: $('[data-oi="' + i + '"]').value.trim(),
          quantity: Number($('[data-oq="' + i + '"]').value),
          unit: $('[data-ou="' + i + '"]').value,
          note: $('[data-on="' + i + '"]').value.trim()
        };
      }).filter(function(r) { return r.name && r.quantity > 0; });
      if (!arr.length) { msg('В техкарте не найдены ингредиенты. Проверьте OCR.', true); return; }
      try {
        for (var i = 0; i < arr.length; i++) {
          var existing = ingredients.map(function(x) { return { x: x, s: similarity(x.name, arr[i].name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
          var iid = existing && existing.s >= .78 ? existing.x.id : null;
          if (!iid) {
            var g = globalIngredients.map(function(x) { return { x: x, s: similarity(x.name, arr[i].name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
            var name = g && g.s >= .78 ? g.x.name : arr[i].name;
            var rr = await rpc('manager_ingredient_upsert', {
              p_venue_id: venueId,
              p_name: name,
              p_unit: arr[i].unit,
              p_purchase_quantity: 1,
              p_purchase_price: 0,
              p_id: null
            });
            iid = rr && rr.id ? rr.id : (rr && rr[0] ? rr[0].id : null);
            if (!iid) {
              await reloadIngredients();
              var ni = ingredients.find(function(x) { return similarity(x.name, name) >= .95; });
              if (ni) iid = ni.id;
            }
          }
          if (iid) arr[i].ingredient_id = iid;
        }
        await reloadIngredients();
        var recipeRows = arr.filter(function(x) { return x.ingredient_id; }).map(function(x) {
          return { ingredient_id: x.ingredient_id, quantity: x.quantity, note: x.note || '' };
        });
        await rpc('manager_product_recipe_save', {
          p_venue_id: venueId,
          p_product_id: pid,
          p_rows: recipeRows
        });
        var p = products.find(function(x) { return x.id === pid; });
        if (p) selected = pid;
        pick(pid);
        await saveTechCardRecord(window.__ocrMeta || { ocrText: $('ocrText').textContent, name: 'Техкарта' });
        msg('Техкарта распознана и рецептура создана.');
        $('techModal').hidden = true;
      } catch(e) {
        console.error(e);
        msg('Ошибка создания рецептуры: ' + (e.message || e), true);
      }
    };

    async function saveTechCardRecord(meta) {
      if (!meta || !meta.file) return;
      var file = meta.file;
      var path = venueId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var up = await db.storage.from('tech-cards').upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      var ins = await db.from('manager_tech_cards').insert({
        venue_id: venueId,
        product_id: $('ocrProduct').value,
        file_name: file.name,
        file_path: path,
        file_url: null,
        ocr_text: meta.ocrText || '',
        status: 'processed'
      });
      if (ins.error) throw ins.error;
      return reloadTechCards();
    }

    async function reloadTechCards() {
      var r = await db.from('manager_tech_cards').select('id,product_id,file_name,file_path,file_url,ocr_text,status,created_at').eq('venue_id', venueId).order('created_at', {ascending:false});
      if (r.error) throw r.error;
      techCards = r.data || [];
      for (var i = 0; i < techCards.length; i++) {
        if (techCards[i].file_path) {
          var su = await db.storage.from('tech-cards').createSignedUrl(techCards[i].file_path, 3600);
          if (!su.error && su.data) techCards[i].file_url = su.data.signedUrl;
        }
      }
      renderTechCards();
    }

    async function ensureLocalIngredient(globalItem) {
      var gi = globalItem.ingredient;
      if (!gi) return null;
      var ranked = ingredients.map(function(x) { return { x: x, s: similarity(x.name, gi.name) }; }).sort(function(a, b) { return b.s - a.s; });
      if (ranked[0] && ranked[0].s >= .86) return ranked[0].x;
      var up = await rpc('manager_ingredient_upsert', {
        p_venue_id: venueId,
        p_name: gi.name,
        p_unit: gi.unit || globalItem.unit || 'g',
        p_purchase_quantity: 1,
        p_purchase_price: 0,
        p_id: null
      });
      var iid = up && up.id ? up.id : (Array.isArray(up) && up[0] ? up[0].id : null);
      await reloadIngredients();
      if (iid) {
        var found = ingredients.find(function(x) { return x.id === iid; });
        if (found) return found;
      }
      var fallback = ingredients.map(function(x) { return { x: x, s: similarity(x.name, gi.name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
      return fallback ? fallback.x : null;
    }

    async function ensureIngByName(name, unit) {
      var ranked = ingredients.map(function(x) { return { x: x, s: similarity(x.name, name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
      if (ranked && ranked.s >= .86) return ranked.x;
      var up = await rpc('manager_ingredient_upsert', {
        p_venue_id: venueId,
        p_name: name,
        p_unit: unit || 'g',
        p_purchase_quantity: 1,
        p_purchase_price: 0,
        p_id: null
      });
      var iid = up && up.id ? up.id : (Array.isArray(up) && up[0] ? up[0].id : null);
      await reloadIngredients();
      if (iid) {
        var f = ingredients.find(function(x) { return x.id === iid; });
        if (f) return f;
      }
      var fb = ingredients.map(function(x) { return { x: x, s: similarity(x.name, name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
      return fb ? fb.x : null;
    }

    function convertQuantity(q, from, to) {
      q = Number(q) || 0;
      if (!from || !to || from === to) return q;
      var mass = { g: 1, kg: 1000 };
      var vol = { ml: 1, l: 1000 };
      if (mass[from] && mass[to]) return q * mass[from] / mass[to];
      if (vol[from] && vol[to]) return q * vol[from] / vol[to];
      return q;
    }

    async function rowsFromCatalogCard(c) {
      var items = catalogItems.filter(function(x) { return x.recipe_id === c.id; }).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
      var rr = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i], gi = it.ingredient;
        if (!gi) continue;
        var local = await ensureIngByName(gi.name, it.unit || gi.unit);
        if (local) rr.push({ ingredient_id: local.id, quantity: convertQuantity(it.quantity, it.unit || gi.unit, local.unit), note: it.note || 'Автотехкарта из базы' });
      }
      return rr;
    }

    async function fillOne(p) {
      var existing = await rpc('manager_recipe_list', { p_venue_id: venueId, p_product_id: p.id });
      if (Array.isArray(existing) && existing.length) return false;
      var rowsNew = [];
      try { rowsNew = await buildRowsFromDescription(p); } catch(e) {}
      if (!rowsNew.length) {
        var best = catalog.map(function(c) { return { c: c, s: similarity(p.name, c.name) }; }).sort(function(a, b) { return b.s - a.s; })[0];
        if (best && best.s >= .6) { rowsNew = await rowsFromCatalogCard(best.c); }
      }
      if (!rowsNew.length) return false;
      await rpc('manager_product_recipe_save', { p_venue_id: venueId, p_product_id: p.id, p_rows: rowsNew });
      if (selected === p.id) { pick(p.id); }
      return true;
    }

    function autoFillOnOpen() {
      (async function() {
        if (!catalog.length) { baseToCatalog(); }
        var made = 0;
        for (var i = 0; i < products.length; i++) {
          try { if (await fillOne(products[i])) made++; } catch(e) { console.warn('[autoFill]', products[i].name, e); }
        }
        if (made) {
          await reloadIngredients();
          $('generationSummary').textContent = '⚡ Автозаполнение при открытии вкладки: ингредиенты добавлены к ' + made + ' блюдам (из описаний меню и базы техкарт).';
        }
      })();
    }

    async function generateAll() {
      if (!catalog.length) { baseToCatalog(); }
      var made = 0, skipped = 0, errors = 0;
      $('generationSummary').textContent = 'Сопоставление меню с базой техкарт…';
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        try {
          if (await fillOne(p)) made++; else skipped++;
        } catch(e) { console.error('[generateAll]', p.name, e); errors++; }
      }
      await reloadIngredients();
      $('generationSummary').textContent = 'Готово: создано ' + made + '; пропущено ' + skipped + '; ошибок ' + errors + '. Существующие рецептуры не перезаписывались.';
      msg(made ? 'Автозаполнение завершено.' : 'Новых рецептур не создано. Проверьте названия блюд и базу техкарт.', !made);
    }

    $('generateAllBtn').onclick = function() {
      if (confirm('Автозаполнить только пустые рецептуры подходящих позиций меню из базы стандартных техкарт и описаний? Существующие рецептуры не будут изменены.')) {
        generateAll().catch(function(e) { msg('Ошибка генерации: ' + e.message, true); });
      }
    };

    function buildCatalogIndex() {
      catalogIndex = {};
      catalogItems.forEach(function(it) {
        if (!catalogIndex[it.recipe_id]) catalogIndex[it.recipe_id] = [];
        if (it.ingredient) catalogIndex[it.recipe_id].push(it.ingredient.name);
      });
      var cats = [...new Set(catalog.map(function(x) { return x.category; }).filter(Boolean))].sort();
      var cuisines = [...new Set(catalog.map(function(x) { return x.cuisine; }).filter(Boolean))].sort();
      $('catalogCategory').innerHTML = '<option value="">Все категории</option>' + cats.map(function(x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
      $('catalogCuisine').innerHTML = '<option value="">Все кухни</option>' + cuisines.map(function(x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
    }

    function difficultyLabel(x) { return ({ easy: 'Легко', medium: 'Средне', hard: 'Сложно' })[x] || x || '—'; }

    function renderCatalog() {
      var q = norm($('catalogSearch').value), cat = $('catalogCategory').value, diff = $('catalogDifficulty').value, cuisine = $('catalogCuisine').value;
      var arr = catalog.filter(function(c) {
        var hay = norm([c.name, c.description, c.cuisine, c.native_name].concat(catalogIndex[c.id] || []).join(' '));
        return (!q || hay.includes(q)) && (!cat || c.category === cat) && (!diff || c.difficulty === diff) && (!cuisine || c.cuisine === cuisine);
      });
      $('catalogStats').textContent = 'Показано ' + arr.length + ' из ' + catalog.length + ' рецептур';
      $('catalogList').innerHTML = arr.length ? arr.map(function(c) {
        var photo = c.photo && c.photo.url ? c.photo.url : '';
        var nutrition = c.nutrition_per_serving || {};
        return '<div class="catalog-card">' + (photo ? '<img class="catalog-photo" src="' + esc(photo) + '" alt="">' : '') + '<div class="badge2">' + esc(c.category || 'Блюдо') + '</div><h4 style="margin:8px 0 4px">' + esc(c.name) + '</h4><div class="catalog-meta">' + (c.cuisine ? '<span class="badge2">' + esc(c.cuisine) + '</span>' : '') + (c.difficulty ? '<span class="badge2">' + esc(difficultyLabel(c.difficulty)) + '</span>' : '') + (c.base_servings ? '<span class="badge2">' + esc(c.base_servings) + ' порц.</span>' : '') + '</div><div class="muted" style="font-size:12px">' + esc(c.description || 'Стандартная техкарта') + '</div><div class="muted" style="font-size:11px;margin-top:8px">Выход: ' + esc(c.yield_quantity) + ' ' + esc(unitLabel(c.yield_unit)) + (c.prep_minutes || c.cook_minutes ? ' · ' + esc((Number(c.prep_minutes) || 0) + (Number(c.cook_minutes) || 0)) + ' мин' : '') + '</div><div class="muted" style="font-size:11px;margin-top:5px">Состав: ' + esc((catalogIndex[c.id] || []).length) + ' ингредиентов' + (nutrition.calories ? ' · ' + esc(nutrition.calories) + ' ккал/порц.' : '') + '</div><button class="btn btn-primary btn-sm" style="margin-top:10px" data-detail="' + esc(c.id) + '">Открыть техкарту</button></div>';
      }).join('') : '<p class="muted">Ничего не найдено.</p>';
      Array.prototype.forEach.call($('catalogList').querySelectorAll('[data-detail]'), function(b) {
        b.onclick = function() {
          var c = catalog.find(function(x) { return x.id === b.dataset.detail; });
          if (c) openCatalogDetail(c);
        };
      });
    }

    $('catalogSearch').addEventListener('input', renderCatalog);
    $('catalogCategory').addEventListener('change', renderCatalog);
    $('catalogDifficulty').addEventListener('change', renderCatalog);
    $('catalogCuisine').addEventListener('change', renderCatalog);

    function openCatalogDetail(c) {
      $('catalogDetailModal').hidden = false;
      $('catalogDetailTitle').textContent = c.name;
      $('catalogDetailSub').textContent = [c.cuisine, c.difficulty ? difficultyLabel(c.difficulty) : '', c.native_name].filter(Boolean).join(' · ');
      var items = (catalogItems.filter(function(x) { return x.recipe_id === c.id; })).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
      var n = c.nutrition_per_serving || {}, photo = c.photo && c.photo.url ? c.photo.url : '';
      var steps = Array.isArray(c.steps) ? c.steps : [];
      var source = '<div class="source-box"><b>Источник:</b> ' + esc(c.source || '—') + '<br><b>Лицензия:</b> ' + esc(c.source_license || '—') + '<br><b>Атрибуция:</b> ' + esc(c.source_attribution || '—') + (c.source_url ? '<br><b>Страница:</b> <a href="' + esc(c.source_url) + '" target="_blank" rel="noopener">Открыть источник</a>' : '') + '</div>';
      $('catalogDetailBody').innerHTML = '<div class="catalog-detail-grid"><div>' + (photo ? '<img class="catalog-detail-photo" src="' + esc(photo) + '" alt="">' : '<div class="catalog-detail-photo"></div>') + '<div class="detail-section"><b>Основные параметры</b><div class="catalog-meta">' + (c.base_servings ? '<span class="badge2">Базовый выход: ' + esc(c.base_servings) + ' порц.</span>' : '') + (c.yield_quantity ? '<span class="badge2">Выход: ' + esc(c.yield_quantity) + ' ' + esc(unitLabel(c.yield_unit)) + '</span>' : '') + '<span class="badge2">Подготовка: ' + esc(c.prep_minutes || 0) + ' мин</span><span class="badge2">Готовка: ' + esc(c.cook_minutes || 0) + ' мин</span></div></div><div class="detail-section">' + source + '</div></div><div><div class="detail-section" style="margin-top:0;padding-top:0;border-top:0"><h4 style="margin-top:0">Ингредиенты</h4><table class="detail-table"><tr><th>Ингредиент</th><th>Количество</th><th>Примечание</th></tr>' + items.map(function(it) { return '<tr><td>' + esc(it.ingredient ? it.ingredient.name : 'Ингредиент') + '</td><td>' + esc(it.quantity) + ' ' + esc(unitLabel(it.unit || (it.ingredient && it.ingredient.unit))) + '</td><td class="muted">' + esc(it.note || '') + '</td></tr>'; }).join('') + '</table></div><div class="detail-section"><h4>Технология приготовления</h4>' + (steps.length ? steps.map(function(st, i) { var text = typeof st === 'string' ? st : (st.text && st.text.ru) || st.text || ''; var mins = typeof st === 'object' ? st.minutes : ''; return '<div class="step-item"><div class="step-num">' + (i+1) + '</div><div>' + esc(text) + '</div><div class="muted" style="font-size:11px">' + (mins ? esc(mins) + ' мин' : '') + '</div></div>'; }).join('') : '<div class="muted">Технология не указана.</div>') + '</div><div class="detail-section"><h4>Пищевая ценность на порцию</h4><div class="catalog-meta"><span class="badge2">Калории: ' + esc(n.calories || 0) + ' ккал</span><span class="badge2">Белки: ' + esc(n.protein || 0) + ' г</span><span class="badge2">Жиры: ' + esc(n.fat || 0) + ' г</span><span class="badge2">Углеводы: ' + esc(n.carbs || 0) + ' г</span></div></div><div class="import-bar"><select id="catalogImportProduct">' + products.map(function(p) { return '<option value="' + esc(p.id) + '" ' + (selected === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select><button class="btn btn-green" id="catalogImportBtn">Импортировать в меню</button></div></div></div>';
      $('catalogImportBtn').onclick = function() { var pid = $('catalogImportProduct').value; importCatalogToProduct(c, pid); };
    }

    async function importCatalogToProduct(c, pid) {
      if (!pid) { msg('В меню нет выбранной позиции.', true); return; }
      var target = products.find(function(p) { return p.id === pid; });
      if (!target) return;
      if (!confirm('Импортировать техкарту «' + c.name + '» в «' + target.name + '»? Существующая рецептура будет заменена.')) return;
      try {
        var ir = catalogItems.filter(function(x) { return x.recipe_id === c.id; }).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
        if (!ir.length) throw new Error('У рецептуры нет ингредиентов');
        var rr = [];
        for (var i = 0; i < ir.length; i++) {
          var it = ir[i], gi = it.ingredient;
          if (!gi) continue;
          var local = await ensureIngByName(gi.name, it.unit || gi.unit);
          if (local) rr.push({ ingredient_id: local.id, quantity: convertQuantity(it.quantity, it.unit || gi.unit, local.unit), note: it.note || '' });
        }
        if (!rr.length) throw new Error('Не удалось сопоставить ингредиенты');
        await rpc('manager_product_recipe_save', { p_venue_id: venueId, p_product_id: pid, p_rows: rr });
        selected = pid;
        $('catalogDetailModal').hidden = true;
        $('catalogModal').hidden = true;
        pick(pid);
        msg('Техкарта «' + c.name + '» импортирована в «' + target.name + '».');
      } catch(e) {
        msg('Ошибка импорта: ' + (e.message || e), true);
      }
    }

    function renderGlobalIngredients() {
      var q = norm($('ingredientsSearch').value);
      var arr = globalIngredients.filter(function(x) { return !q || norm(x.name).includes(q); });
      $('ingredientsDbList').innerHTML = arr.map(function(x) {
        return '<div class="ingredient-row"><div style="flex:1"><b>' + esc(x.name) + '</b><span class="muted"> · ' + esc(unitLabel(x.unit)) + '</span></div><span class="badge2">' + esc(x.category || 'Ингредиент') + '</span></div>';
      }).join('') || '<p class="muted">Ничего не найдено.</p>';
    }

    $('ingredientsSearch').addEventListener('input', renderGlobalIngredients);
    $('catalogBtn').onclick = function() { $('catalogModal').hidden = false; renderCatalog(); };
    $('ingredientsDbBtn').onclick = function() { $('ingredientsModal').hidden = false; renderGlobalIngredients(); };

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function(b) {
      b.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var m = $(b.dataset.close);
        if (m) { m.hidden = true; m.setAttribute('hidden', ''); }
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('.modalx'), function(m) {
      m.addEventListener('click', function(e) {
        if (e.target === m) { m.hidden = true; m.setAttribute('hidden', ''); }
      });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        Array.prototype.forEach.call(document.querySelectorAll('.modalx'), function(m) {
          m.hidden = true;
          m.setAttribute('hidden', '');
        });
      }
    });

    window.addEventListener('manager-venue-selected', function(e) {
      if (e.detail && e.detail.id) {
        venueId = e.detail.id;
        try { localStorage.setItem('manager_venue_id', String(venueId)); } catch(_e) {}
        loadAll();
      }
    });
    loadAll();
  }

  function observeRecipes() {
    var app = document.getElementById('app') || document.body;
    var obs = new MutationObserver(function() { startRecipes(); });
    obs.observe(app, { childList: true, subtree: true });
    startRecipes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeRecipes, { once: true });
  } else {
    observeRecipes();
  }

  window.__QR_MANAGER_RECIPES__ = true;
})();
