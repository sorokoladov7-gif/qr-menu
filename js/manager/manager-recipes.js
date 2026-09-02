```javascript
/* QR-Menu — рецептуры */
(function () {
  'use strict';

  if (window.__QR_MANAGER_RECIPES__) return;
  window.__QR_MANAGER_RECIPES__ = true;

  var recipeRoot = null;
  var observer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^а-яa-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function unitLabel(u) {
    return {
      g: 'г',
      kg: 'кг',
      ml: 'мл',
      l: 'л',
      pcs: 'шт'
    }[u] || u || '';
  }

  function canonUnit(u) {
    u = String(u || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/^гр?\.?$/, 'g')
      .replace(/^кг$/, 'kg')
      .replace(/^мл$/, 'ml')
      .replace(/^л$/, 'l')
      .replace(/^шт$/, 'pcs');

    return ['g', 'kg', 'ml', 'l', 'pcs'].indexOf(u) >= 0 ? u : null;
  }

  function similarity(a, b) {
    a = norm(a);
    b = norm(b);

    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.92;

    var A = a.split(' ');
    var B = b.split(' ');
    var SB = new Set(B);
    var inter = 0;

    A.forEach(function (x) {
      if (SB.has(x)) inter++;
    });

    var score = inter / (new Set(A).size + new Set(B).size - inter || 1);

    var stop = {
      с: 1,
      сборка: 1,
      классический: 1,
      классическая: 1,
      домашний: 1,
      домашняя: 1,
      фирменный: 1,
      фирменная: 1,
      порция: 1,
      большой: 1,
      большая: 1,
      мини: 1,
      pro: 1,
      демо: 1
    };

    var coreA = A.filter(function (x) {
      return x.length > 3 && !stop[x];
    })[0];

    var coreB = B.filter(function (x) {
      return x.length > 3 && !stop[x];
    })[0];

    if (coreA && coreB && coreA === coreB) {
      score = Math.max(score, 0.78);
    }

    return score;
  }

  function startRecipes() {
    var root = document.querySelector(
      '.recipe-tab-container .recipe-wrap'
    );

    if (!root || recipeRoot === root) return;

    recipeRoot = root;

    /* ---------------------------------------------------------
       ВАЖНО:
       Рецептуры больше не растягивают всю страницу.
       Основная прокрутка происходит внутри блока.
       --------------------------------------------------------- */
    if (!document.getElementById('qrRecipesCompactStyle')) {
      var style = document.createElement('style');
      style.id = 'qrRecipesCompactStyle';
      style.textContent = [
        '.recipe-tab-container{',
        '  max-height:calc(100vh - 120px);',
        '  overflow:auto;',
        '  overscroll-behavior:contain;',
        '  scroll-behavior:smooth;',
        '}',
        '.recipe-tab-container .recipe-wrap{',
        '  min-height:0 !important;',
        '  height:auto !important;',
        '}',
        '.recipe-tab-container .modalx{',
        '  max-height:100vh;',
        '}',
        '.recipe-tab-container img{',
        '  max-width:100%;',
        '  height:auto;',
        '}',
        '.recipe-row{',
        '  display:grid;',
        '  grid-template-columns:minmax(180px,1fr) 100px 45px minmax(150px,1fr) auto;',
        '  gap:8px;',
        '  align-items:center;',
        '}',
        '@media(max-width:800px){',
        '  .recipe-tab-container{max-height:none;overflow:visible;}',
        '  .recipe-row{grid-template-columns:1fr 90px 40px 1fr auto;}',
        '}'
      ].join('');
      document.head.appendChild(style);
    }

    /* При открытии рецептур возвращаем пользователя к началу блока. */
    setTimeout(function () {
      try {
        var container = root.closest('.recipe-tab-container');
        if (container) container.scrollTop = 0;
        root.scrollIntoView({
          block: 'start',
          behavior: 'auto'
        });
      } catch (e) {}
    }, 0);

    var db = window.db;
    if (!db) {
      console.error('[Recipes] window.db отсутствует');
      return;
    }

    var venueId =
      localStorage.getItem('manager_venue_id') ||
      localStorage.getItem('selectedVenueId');

    var products = [];
    var ingredients = [];
    var selected = null;
    var rows = [];
    var catalog = [];
    var catalogItems = [];
    var globalIngredients = [];
    var techCards = [];
    var ocrParsed = [];
    var catalogIndex = {};

    var $ = function (id) {
      return document.getElementById(id);
    };

    function msg(text, error) {
      var el = $('msg');
      if (!el) return;

      el.innerHTML = text
        ? '<div class="msg ' +
          (error ? 'err' : 'ok') +
          '">' +
          esc(text) +
          '</div>'
        : '';
    }

    function rpc(name, args) {
      return db.rpc(name, args).then(function (r) {
        if (r.error) throw r.error;
        return r.data;
      });
    }

    /* ---------------------------------------------------------
       Компактная встроенная база техкарт.
       Используется только если глобальный каталог пуст.
       --------------------------------------------------------- */
    var BASE_UNIT = {
      'г': 'g',
      'кг': 'kg',
      'мл': 'ml',
      'л': 'l',
      'шт': 'pcs'
    };

    var BASE_TECHCARDS = [
      {
        id: 'sh-veal',
        name: 'Шашлык из телятины',
        cat: 'Гриль',
        cuisine: 'Кавказская',
        portion: 100,
        unit: 'г',
        prep: 20,
        cook: 15,
        tech: 'Мясо нарезать кубиками, замариновать с луком, солью и перцем. Жарить над углями 10–15 минут.',
        ing: [
          ['Телятина', 120, 'г'],
          ['Лук репчатый', 30, 'г'],
          ['Соль', 2, 'г'],
          ['Перец чёрный', 0.5, 'г']
        ]
      },
      {
        id: 'sh-pork',
        name: 'Шашлык из свиного края',
        cat: 'Гриль',
        cuisine: 'Кавказская',
        portion: 100,
        unit: 'г',
        prep: 20,
        cook: 15,
        tech: 'Мясо нарезать, замариновать с луком и специями. Жарить над углями 12–15 минут.',
        ing: [
          ['Свиной край', 120, 'г'],
          ['Лук репчатый', 30, 'г'],
          ['Соль', 2, 'г'],
          ['Перец чёрный', 0.5, 'г']
        ]
      },
      {
        id: 'sh-lamb',
        name: 'Шашлык из баранины',
        cat: 'Гриль',
        cuisine: 'Кавказская',
        portion: 100,
        unit: 'г',
        prep: 25,
        cook: 15,
        tech: 'Баранину замариновать с луком, солью, перцем и зирой. Жарить 12–15 минут.',
        ing: [
          ['Баранина', 120, 'г'],
          ['Лук репчатый', 30, 'г'],
          ['Соль', 2, 'г'],
          ['Перец чёрный', 0.5, 'г'],
          ['Зира', 0.3, 'г']
        ]
      },
      {
        id: 'espresso',
        name: 'Эспрессо',
        cat: 'Кофе',
        cuisine: 'Европейская',
        portion: 30,
        unit: 'мл',
        prep: 1,
        cook: 1,
        tech: 'Экстракция 25–30 секунд при давлении 9 бар и температуре воды около 92 °C.',
        ing: [
          ['Кофе в зёрнах', 9, 'г'],
          ['Вода', 30, 'мл']
        ]
      },
      {
        id: 'latte',
        name: 'Латте',
        cat: 'Кофе',
        cuisine: 'Европейская',
        portion: 300,
        unit: 'мл',
        prep: 2,
        cook: 3,
        tech: 'Приготовить эспрессо, взбить молоко паром и соединить.',
        ing: [
          ['Кофе в зёрнах', 9, 'г'],
          ['Молоко', 250, 'мл']
        ]
      },
      {
        id: 'cappuccino',
        name: 'Капучино',
        cat: 'Кофе',
        cuisine: 'Европейская',
        portion: 200,
        unit: 'мл',
        prep: 2,
        cook: 3,
        tech: 'Приготовить эспрессо, взбить молоко до плотной пены и соединить.',
        ing: [
          ['Кофе в зёрнах', 9, 'г'],
          ['Молоко', 170, 'мл'],
          ['Какао', 1, 'г']
        ]
      },
      {
        id: 'tea-classic',
        name: 'Чай классический',
        cat: 'Чай',
        cuisine: 'Авторская',
        portion: 200,
        unit: 'мл',
        prep: 2,
        cook: 7,
        tech: 'Заварить чёрный чай водой около 95 °C и настоять 5–7 минут.',
        ing: [
          ['Чай чёрный', 3, 'г'],
          ['Вода', 200, 'мл']
        ]
      }
    ];

    function baseToCatalog() {
      catalog = BASE_TECHCARDS.map(function (c) {
        return {
          id: 'base-' + c.id,
          name: c.name,
          category: c.cat,
          description: c.tech,
          cuisine: c.cuisine,
          difficulty: 'medium',
          yield_quantity: c.portion,
          yield_unit: BASE_UNIT[c.unit] || 'g',
          base_servings: 1,
          prep_minutes: c.prep,
          cook_minutes: c.cook,
          nutrition_per_serving: {},
          steps: [c.tech],
          source: 'Встроенная база QR-Menu',
          source_license: 'внутренняя',
          source_attribution: '—',
          photo: null,
          is_base: true
        };
      });

      catalogItems = [];

      BASE_TECHCARDS.forEach(function (c) {
        c.ing.forEach(function (it, i) {
          catalogItems.push({
            recipe_id: 'base-' + c.id,
            sort_order: i,
            quantity: it[1],
            unit: BASE_UNIT[it[2]] || 'g',
            note: '',
            ingredient: {
              name: it[0],
              unit: BASE_UNIT[it[2]] || 'g'
            }
          });
        });
      });

      buildCatalogIndex();
    }

    function loadAll() {
      if (!venueId) {
        msg(
          'Не найдено выбранное заведение. Откройте кабинет управляющего и выберите заведение.',
          true
        );
        return;
      }

      Promise.all([
        db
          .from('products')
          .select('id,name,description,category,price')
          .eq('venue_id', venueId)
          .order('name'),

        rpc('manager_ingredient_list', {
          p_venue_id: venueId
        }),

        db
          .from('global_recipe_catalog')
          .select(
            'id,name,category,description,yield_quantity,yield_unit,cuisine,difficulty,base_servings,prep_minutes,cook_minutes,nutrition_per_serving,steps,source,source_license,source_attribution,photo'
          )
          .eq('is_active', true)
          .order('name'),

        db
          .from('global_ingredient_catalog')
          .select('id,name,unit,category,aliases')
          .eq('is_active', true)
          .order('name'),

        db
          .from('manager_tech_cards')
          .select(
            'id,product_id,file_name,file_path,file_url,ocr_text,status,created_at'
          )
          .eq('venue_id', venueId)
          .order('created_at', {
            ascending: false
          })
      ])
        .then(function (r) {
          if (r[0].error) throw r[0].error;
          if (r[2].error) throw r[2].error;
          if (r[3].error) throw r[3].error;
          if (r[4].error) throw r[4].error;

          products = r[0].data || [];
          ingredients = Array.isArray(r[1]) ? r[1] : [];
          catalog = r[2].data || [];
          globalIngredients = r[3].data || [];
          techCards = r[4].data || [];

          var itemsPromise = catalog.length
            ? db
                .from('global_recipe_catalog_items')
                .select(
                  'recipe_id,sort_order,quantity,unit,note,ingredient:global_ingredient_catalog(id,name,unit)'
                )
                .then(function (x) {
                  if (x.error) throw x.error;
                  catalogItems = x.data || [];
                })
            : Promise.resolve();

          return itemsPromise;
        })
        .then(function () {
          if (!catalog.length) {
            baseToCatalog();
          } else {
            buildCatalogIndex();
          }

          return Promise.all(
            techCards.map(function (t) {
              if (!t.file_path) return Promise.resolve();

              return db.storage
                .from('tech-cards')
                .createSignedUrl(t.file_path, 3600)
                .then(function (x) {
                  if (!x.error && x.data) {
                    t.file_url = x.data.signedUrl;
                  }
                });
            })
          );
        })
        .then(function () {
          renderProducts();
          renderIngredients();
          renderTechCards();
          renderCatalog();
          renderGlobalIngredients();
          autoFillOnOpen();
        })
        .catch(function (e) {
          console.error('[Recipes] loadAll:', e);
          msg('Ошибка загрузки: ' + (e.message || e), true);
        });
    }

    function renderProducts() {
      var input = $('productSearch');
      var box = $('products');

      if (!input || !box) return;

      var q = norm(input.value);

      var arr = products.filter(function (p) {
        return !q || norm(p.name).includes(q);
      });

      if ($('productCount')) {
        $('productCount').textContent = products.length;
      }

      box.innerHTML = arr.length
        ? arr
            .map(function (p) {
              return (
                '<button type="button" class="btn ' +
                (selected === p.id ? 'product-active' : 'btn-ghost') +
                '" data-p="' +
                esc(p.id) +
                '">' +
                esc(p.name) +
                ' <span class="muted">' +
                (p.category ? ' · ' + esc(p.category) : '') +
                ' · ' +
                Number(p.price || 0).toFixed(2) +
                ' ₽</span></button>'
              );
            })
            .join('')
        : '<p class="muted">Нет товаров.</p>';

      Array.prototype.forEach.call(
        box.querySelectorAll('[data-p]'),
        function (b) {
          b.onclick = function () {
            pick(b.getAttribute('data-p'));
          };
        }
      );
    }

    function renderIngredients() {
      var box = $('ingredients');
      if (!box) return;

      box.innerHTML = ingredients.length
        ? ingredients
            .map(function (i) {
              return (
                '<div class="ingredient-row" style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
                '<div style="flex:1;min-width:0">' +
                '<b>' +
                esc(i.name) +
                '</b>' +
                '<div class="muted" style="font-size:11px">' +
                esc(unitLabel(i.unit)) +
                ' · закупка ' +
                Number(i.purchase_price || 0).toFixed(2) +
                ' ₽ / ' +
                esc(i.purchase_quantity) +
                ' ' +
                esc(unitLabel(i.unit)) +
                '</div></div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-local-edit="' +
                esc(i.id) +
                '">Изменить</button>' +
                '<button type="button" class="btn btn-danger btn-sm" data-local-delete="' +
                esc(i.id) +
                '">Удалить</button>' +
                '</div></div>'
              );
            })
            .join('')
        : '<span class="muted">Пока нет ингредиентов.</span>';

      Array.prototype.forEach.call(
        box.querySelectorAll('[data-local-edit]'),
        function (b) {
          b.onclick = function () {
            var item = ingredients.find(function (x) {
              return x.id === b.dataset.localEdit;
            });
            if (item) openLocalIngredientEditor(item);
          };
        }
      );

      Array.prototype.forEach.call(
        box.querySelectorAll('[data-local-delete]'),
        function (b) {
          b.onclick = function () {
            var item = ingredients.find(function (x) {
              return x.id === b.dataset.localDelete;
            });
            if (item) deleteLocalIngredient(item);
          };
        }
      );
    }

    function pick(id) {
      selected = id;

      var p = products.find(function (x) {
        return x.id === id;
      });

      if (!p) return;

      if ($('title')) {
        $('title').textContent = 'Рецептура: ' + p.name;
      }

      if ($('save')) {
        $('save').hidden = false;
      }

      var cat = catalog
        .map(function (c) {
          return {
            c: c,
            s: similarity(p.name, c.name)
          };
        })
        .sort(function (a, b) {
          return b.s - a.s;
        })[0];

      if ($('matchInfo')) {
        $('matchInfo').textContent =
          cat && cat.s >= 0.55
            ? 'Ближайшая техкарта: ' +
              cat.c.name +
              ' · совпадение ' +
              Math.round(cat.s * 100) +
              '%'
            : 'В базе подходящая техкарта не найдена';
      }

      rpc('manager_recipe_list', {
        p_venue_id: venueId,
        p_product_id: id
      })
        .then(function (data) {
          rows = (Array.isArray(data) ? data : []).map(function (r) {
            return {
              ingredient_id: r.ingredient_id,
              quantity: Number(r.quantity) || 0,
              note: r.note || ''
            };
          });

          renderRecipe();
          renderProducts();

          return loadCost();
        })
        .catch(function (e) {
          msg(
            'Ошибка загрузки рецептуры: ' + (e.message || e),
            true
          );
        });
    }

    function renderRecipe() {
      var c = $('recipe');
      if (!c) return;

      if (!selected) {
        c.innerHTML = '<p class="muted">Выберите товар.</p>';
        return;
      }

      if (!rows.length) {
        c.innerHTML =
          '<div class="muted" style="padding:12px 0">Рецептура пустая. Можно добавить ингредиент вручную или сгенерировать её из базы.</div>' +
          '<button class="btn btn-ghost" id="addRow">+ Ингредиент</button>';

        if ($('addRow')) {
          $('addRow').onclick = addRow;
        }

        return;
      }

      c.innerHTML =
        rows
          .map(function (r, i) {
            var ing = ingredients.find(function (x) {
              return x.id === r.ingredient_id;
            });

            var unit = ing ? ing.unit : 'g';

            return (
              '<div class="recipe-row">' +
              '<select data-ri="' +
              i +
              '">' +
              ingredients
                .map(function (x) {
                  return (
                    '<option value="' +
                    esc(x.id) +
                    '" ' +
                    (x.id === r.ingredient_id ? 'selected' : '') +
                    '>' +
                    esc(x.name) +
                    ' (' +
                    esc(unitLabel(x.unit)) +
                    ')</option>'
                  );
                })
                .join('') +
              '</select>' +
              '<input data-rq="' +
              i +
              '" type="number" min=".001" step=".001" value="' +
              esc(r.quantity) +
              '">' +
              '<span class="muted">' +
              esc(unitLabel(unit)) +
              '</span>' +
              '<input data-rn="' +
              i +
              '" placeholder="Примечание" value="' +
              esc(r.note) +
              '">' +
              '<button class="btn btn-danger" data-rd="' +
              i +
              '">×</button>' +
              '</div>'
            );
          })
          .join('') +
        '<button class="btn btn-ghost" id="addRow">+ Ингредиент</button>';

      Array.prototype.forEach.call(
        c.querySelectorAll('[data-ri]'),
        function (e) {
          e.onchange = function () {
            rows[+e.dataset.ri].ingredient_id = e.value;
            renderRecipe();
          };
        }
      );

      Array.prototype.forEach.call(
        c.querySelectorAll('[data-rq]'),
        function (e) {
          e.oninput = function () {
            rows[+e.dataset.rq].quantity = Number(e.value) || 0;
          };
        }
      );

      Array.prototype.forEach.call(
        c.querySelectorAll('[data-rn]'),
        function (e) {
          e.oninput = function () {
            rows[+e.dataset.rn].note = e.value;
          };
        }
      );

      Array.prototype.forEach.call(
        c.querySelectorAll('[data-rd]'),
        function (e) {
          e.onclick = function () {
            rows.splice(+e.dataset.rd, 1);
            renderRecipe();
          };
        }
      );

      if ($('addRow')) {
        $('addRow').onclick = addRow;
      }
    }

    function addRow() {
      if (!ingredients.length) {
        msg('Сначала добавьте ингредиент.', true);
        return;
      }

      rows.push({
        ingredient_id: ingredients[0].id,
        quantity: 1,
        note: ''
      });

      renderRecipe();
    }

    function loadCost() {
      if (!selected) return Promise.resolve();

      return rpc('manager_recipe_cost', {
        p_venue_id: venueId,
        p_product_id: selected
      })
        .then(function (c) {
          c = c || {};

          if (!$('cost')) return;

          $('cost').innerHTML =
            '<div class="cost-grid">' +
            '<div class="cost-card"><div class="n">' +
            Number(c.cost || 0).toFixed(2) +
            ' ₽</div><div class="l">Себестоимость</div></div>' +
            '<div class="cost-card"><div class="n">' +
            Number(c.price || 0).toFixed(2) +
            ' ₽</div><div class="l">Цена продажи</div></div>' +
            '<div class="cost-card"><div class="n">' +
            Number(c.gross_profit || 0).toFixed(2) +
            ' ₽</div><div class="l">Валовая прибыль</div></div>' +
            '<div class="cost-card"><div class="n">' +
            Number(c.margin_percent || 0).toFixed(1) +
            '%</div><div class="l">Маржа</div></div>' +
            '</div>';
        })
        .catch(function (e) {
          if ($('cost')) {
            $('cost').innerHTML =
              '<div class="msg err">Ошибка себестоимости: ' +
              esc(e.message || e) +
              '</div>';
          }
        });
    }

    function reloadIngredients() {
      return rpc('manager_ingredient_list', {
        p_venue_id: venueId
      }).then(function (d) {
        ingredients = Array.isArray(d) ? d : [];

        renderIngredients();
        renderRecipe();

        return selected ? loadCost() : null;
      });
    }

    function openLocalIngredientEditor(item) {
      var back = document.createElement('div');

      back.className = 'qr-local-ingredient-editor';
      back.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:200000;display:flex;align-items:center;justify-content:center;padding:15px';

      back.innerHTML =
        '<div class="glass card" style="width:min(440px,calc(100vw - 30px));padding:20px">' +
        '<h3 style="margin-top:0">Изменить ингредиент</h3>' +
        '<label>Название</label>' +
        '<input id="localIngName" value="' +
        esc(item.name) +
        '" style="width:100%;margin:6px 0 10px">' +
        '<label>Единица измерения</label>' +
        '<select id="localIngUnit" style="width:100%;margin:6px 0 10px">' +
        ['g', 'kg', 'ml', 'l', 'pcs']
          .map(function (u) {
            return (
              '<option value="' +
              u +
              '" ' +
              (item.unit === u ? 'selected' : '') +
              '>' +
              unitLabel(u) +
              '</option>'
            );
          })
          .join('') +
        '</select>' +
        '<label>Закупочное количество</label>' +
        '<input id="localIngQty" type="number" min=".001" step=".001" value="' +
        Number(item.purchase_quantity || 1) +
        '" style="width:100%;margin:6px 0 10px">' +
        '<label>Закупочная цена</label>' +
        '<input id="localIngPrice" type="number" min="0" step=".01" value="' +
        Number(item.purchase_price || 0) +
        '" style="width:100%;margin:6px 0 14px">' +
        '<div class="toolbar" style="justify-content:flex-end">' +
        '<button type="button" class="btn btn-ghost" id="localIngCancel">Отмена</button>' +
        '<button type="button" class="btn btn-primary" id="localIngSave">Сохранить</button>' +
        '</div></div>';

      document.body.appendChild(back);

      back.querySelector('#localIngCancel').onclick = function () {
        back.remove();
      };

      back.onclick = function (e) {
        if (e.target === back) back.remove();
      };

      back.querySelector('#localIngSave').onclick = function () {
        var name = back.querySelector('#localIngName').value.trim();
        var unit = back.querySelector('#localIngUnit').value;
        var qty = Number(back.querySelector('#localIngQty').value);
        var price = Number(back.querySelector('#localIngPrice').value);

        if (!name) {
          msg('Введите название ингредиента.', true);
          return;
        }

        if (!(qty > 0)) {
          msg('Закупочное количество должно быть больше нуля.', true);
          return;
        }

        if (!Number.isFinite(price) || price < 0) {
          msg('Некорректная цена закупки.', true);
          return;
        }

        var btn = this;
        btn.disabled = true;

        rpc('manager_ingredient_upsert', {
          p_venue_id: venueId,
          p_name: name,
          p_unit: unit,
          p_purchase_quantity: qty,
          p_purchase_price: price,
          p_id: item.id
        })
          .then(function () {
            back.remove();
            msg('Ингредиент изменён.');
            return reloadIngredients();
          })
          .catch(function (e) {
            btn.disabled = false;
            msg(
              'Ошибка изменения: ' + (e.message || e),
              true
            );
          });
      };
    }

    function deleteLocalIngredient(item) {
      if (!confirm('Удалить ингредиент «' + item.name + '»?')) return;

      rpc('manager_ingredient_delete', {
        p_venue_id: venueId,
        p_ingredient_id: item.id
      })
        .then(function () {
          msg('Ингредиент удалён.');
          return reloadIngredients();
        })
        .catch(function (e) {
          msg(
            'Не удалось удалить ингредиент: ' +
              (e.message || e),
            true
          );
        });
    }

    function renderTechCards() {
      var c = $('techList');
      if (!c) return;

      c.innerHTML = techCards.length
        ? techCards
            .map(function (t) {
              return (
                '<div class="tech-card">' +
                (t.file_url
                  ? '<img src="' +
                    esc(t.file_url) +
                    '" alt="">'
                  : '') +
                '<b>' +
                esc(t.file_name || 'Техкарта') +
                '</b>' +
                '<div class="muted" style="font-size:11px;margin:5px 0">' +
                (t.status === 'processed'
                  ? 'Распознано'
                  : 'Загружено') +
                '</div>' +
                '<button class="btn btn-ghost btn-sm" data-tech="' +
                esc(t.id) +
                '">Открыть / распознать</button>' +
                '</div>'
              );
            })
            .join('')
        : '<div class="muted">Техкарт пока нет.</div>';

      Array.prototype.forEach.call(
        c.querySelectorAll('[data-tech]'),
        function (b) {
          b.onclick = function () {
            var t = techCards.find(function (x) {
              return x.id === b.dataset.tech;
            });

            if (t) showOcr(t.ocr_text || '', t);
          };
        }
      );
    }

    function buildCatalogIndex() {
      catalogIndex = {};

      catalogItems.forEach(function (it) {
        if (!catalogIndex[it.recipe_id]) {
          catalogIndex[it.recipe_id] = [];
        }

        if (it.ingredient) {
          catalogIndex[it.recipe_id].push(
            it.ingredient.name
          );
        }
      });

      var cats = [
        ...new Set(
          catalog.map(function (x) {
            return x.category;
          }).filter(Boolean)
        )
      ].sort();

      var cuisines = [
        ...new Set(
          catalog.map(function (x) {
            return x.cuisine;
          }).filter(Boolean)
        )
      ].sort();

      if ($('catalogCategory')) {
        $('catalogCategory').innerHTML =
          '<option value="">Все категории</option>' +
          cats
            .map(function (x) {
              return (
                '<option value="' +
                esc(x) +
                '">' +
                esc(x) +
                '</option>'
              );
            })
            .join('');
      }

      if ($('catalogCuisine')) {
        $('catalogCuisine').innerHTML =
          '<option value="">Все кухни</option>' +
          cuisines
            .map(function (x) {
              return (
                '<option value="' +
                esc(x) +
                '">' +
                esc(x) +
                '</option>'
              );
            })
            .join('');
      }
    }

    function difficultyLabel(x) {
      return {
        easy: 'Легко',
        medium: 'Средне',
        hard: 'Сложно'
      }[x] || x || '—';
    }

    function renderCatalog() {
      var box = $('catalogList');
      if (!box) return;

      var q = norm(
        $('catalogSearch') ? $('catalogSearch').value : ''
      );

      var cat = $('catalogCategory')
        ? $('catalogCategory').value
        : '';

      var diff = $('catalogDifficulty')
        ? $('catalogDifficulty').value
        : '';

      var cuisine = $('catalogCuisine')
        ? $('catalogCuisine').value
        : '';

      var arr = catalog.filter(function (c) {
        var hay = norm(
          [c.name, c.description, c.cuisine]
            .concat(catalogIndex[c.id] || [])
            .join(' ')
        );

        return (
          (!q || hay.includes(q)) &&
          (!cat || c.category === cat) &&
          (!diff || c.difficulty === diff) &&
          (!cuisine || c.cuisine === cuisine)
        );
      });

      if ($('catalogStats')) {
        $('catalogStats').textContent =
          'Показано ' +
          arr.length +
          ' из ' +
          catalog.length +
          ' рецептур';
      }

      box.innerHTML = arr.length
        ? arr
            .map(function (c) {
              return (
                '<div class="catalog-card">' +
                '<div class="badge2">' +
                esc(c.category || 'Блюдо') +
                '</div>' +
                '<h4 style="margin:8px 0 4px">' +
                esc(c.name) +
                '</h4>' +
                '<div class="catalog-meta">' +
                (c.cuisine
                  ? '<span class="badge2">' +
                    esc(c.cuisine) +
                    '</span>'
                  : '') +
                (c.difficulty
                  ? '<span class="badge2">' +
                    esc(difficultyLabel(c.difficulty)) +
                    '</span>'
                  : '') +
                '</div>' +
                '<div class="muted" style="font-size:12px">' +
                esc(c.description || 'Стандартная техкарта') +
                '</div>' +
                '<button class="btn btn-primary btn-sm" style="margin-top:10px" data-detail="' +
                esc(c.id) +
                '">Открыть техкарту</button>' +
                '</div>'
              );
            })
            .join('')
        : '<p class="muted">Ничего не найдено.</p>';

      Array.prototype.forEach.call(
        box.querySelectorAll('[data-detail]'),
        function (b) {
          b.onclick = function () {
            var c = catalog.find(function (x) {
              return x.id === b.dataset.detail;
            });

            if (c) openCatalogDetail(c);
          };
        }
      );
    }

    function renderGlobalIngredients() {
      var box = $('ingredientsDbList');
      if (!box) return;

      var q = norm(
        $('ingredientsSearch')
          ? $('ingredientsSearch').value
          : ''
      );

      var arr = globalIngredients.filter(function (x) {
        return !q || norm(x.name).includes(q);
      });

      box.innerHTML = arr.length
        ? arr
            .map(function (x) {
              return (
                '<div class="ingredient-row">' +
                '<div style="flex:1"><b>' +
                esc(x.name) +
                '</b><span class="muted"> · ' +
                esc(unitLabel(x.unit)) +
                '</span></div>' +
                '<span class="badge2">' +
                esc(x.category || 'Ингредиент') +
                '</span>' +
                '</div>'
              );
            })
            .join('')
        : '<p class="muted">Ничего не найдено.</p>';
    }

    function openCatalogDetail(c) {
      var modal = $('catalogDetailModal');
      if (!modal) return;

      modal.hidden = false;

      if ($('catalogDetailTitle')) {
        $('catalogDetailTitle').textContent = c.name;
      }

      var items = catalogItems
        .filter(function (x) {
          return x.recipe_id === c.id;
        })
        .sort(function (a, b) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        });

      var steps = Array.isArray(c.steps) ? c.steps : [];

      if ($('catalogDetailBody')) {
        $('catalogDetailBody').innerHTML =
          '<div class="detail-section">' +
          '<b>Ингредиенты</b>' +
          '<table class="detail-table">' +
          '<tr><th>Ингредиент</th><th>Количество</th></tr>' +
          items
            .map(function (it) {
              return (
                '<tr><td>' +
                esc(
                  it.ingredient
                    ? it.ingredient.name
                    : 'Ингредиент'
                ) +
                '</td><td>' +
                esc(it.quantity) +
                ' ' +
                esc(
                  unitLabel(
                    it.unit ||
                      (it.ingredient &&
                        it.ingredient.unit)
                  )
                ) +
                '</td></tr>'
              );
            })
            .join('') +
          '</table></div>' +
          '<div class="detail-section">' +
          '<h4>Технология приготовления</h4>' +
          (steps.length
            ? steps
                .map(function (st, i) {
                  var text =
                    typeof st === 'string'
                      ? st
                      : st.text || '';

                  return (
                    '<div class="step-item">' +
                    '<div class="step-num">' +
                    (i + 1) +
                    '</div>' +
                    '<div>' +
                    esc(text) +
                    '</div>' +
                    '</div>'
                  );
                })
                .join('')
            : '<div class="muted">Технология не указана.</div>') +
          '</div>' +
          '<div class="import-bar">' +
          '<select id="catalogImportProduct">' +
          products
            .map(function (p) {
              return (
                '<option value="' +
                esc(p.id) +
                '" ' +
                (selected === p.id
                  ? 'selected'
                  : '') +
                '>' +
                esc(p.name) +
                '</option>'
              );
            })
            .join('') +
          '</select>' +
          '<button class="btn btn-green" id="catalogImportBtn">Импортировать в меню</button>' +
          '</div>';

        if ($('catalogImportBtn')) {
          $('catalogImportBtn').onclick = function () {
            importCatalogToProduct(
              c,
              $('catalogImportProduct').value
            );
          };
        }
      }
    }

    async function importCatalogToProduct(c, pid) {
      if (!pid) {
        msg('В меню нет выбранной позиции.', true);
        return;
      }

      var target = products.find(function (p) {
        return p.id === pid;
      });

      if (!target) return;

      if (
        !confirm(
          'Импортировать техкарту «' +
            c.name +
            '» в «' +
            target.name +
            '»? Существующая рецептура будет заменена.'
        )
      ) {
        return;
      }

      try {
        var ir = catalogItems
          .filter(function (x) {
            return x.recipe_id === c.id;
          })
          .sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
          });

        var rr = [];

        for (var i = 0; i < ir.length; i++) {
          var it = ir[i];

          if (!it.ingredient) continue;

          var local = await ensureIngByName(
            it.ingredient.name,
            it.unit || it.ingredient.unit
          );

          if (local) {
            rr.push({
              ingredient_id: local.id,
              quantity: convertQuantity(
                it.quantity,
                it.unit || it.ingredient.unit,
                local.unit
              ),
              note: it.note || ''
            });
          }
        }

        if (!rr.length) {
          throw new Error(
            'Не удалось сопоставить ингредиенты'
          );
        }

        await rpc('manager_product_recipe_save', {
          p_venue_id: venueId,
          p_product_id: pid,
          p_rows: rr
        });

        selected = pid;

        if ($('catalogDetailModal')) {
          $('catalogDetailModal').hidden = true;
        }

        if ($('catalogModal')) {
          $('catalogModal').hidden = true;
        }

        pick(pid);

        msg(
          'Техкарта «' +
            c.name +
            '» импортирована в «' +
            target.name +
            '».'
        );
      } catch (e) {
        msg(
          'Ошибка импорта: ' + (e.message || e),
          true
        );
      }
    }

    async function ensureIngByName(name, unit) {
      var ranked = ingredients
        .map(function (x) {
          return {
            x: x,
            s: similarity(x.name, name)
          };
        })
        .sort(function (a, b) {
          return b.s - a.s;
        })[0];

      if (ranked && ranked.s >= 0.86) {
        return ranked.x;
      }

      var up = await rpc(
        'manager_ingredient_upsert',
        {
          p_venue_id: venueId,
          p_name: name,
          p_unit: unit || 'g',
          p_purchase_quantity: 1,
          p_purchase_price: 0,
          p_id: null
        }
      );

      var iid =
        up && up.id
          ? up.id
          : Array.isArray(up) && up[0]
          ? up[0].id
          : null;

      await reloadIngredients();

      if (iid) {
        var found = ingredients.find(function (x) {
          return x.id === iid;
        });

        if (found) return found;
      }

      var fallback = ingredients
        .map(function (x) {
          return {
            x: x,
            s: similarity(x.name, name)
          };
        })
        .sort(function (a, b) {
          return b.s - a.s;
        })[0];

      return fallback ? fallback.x : null;
    }

    function convertQuantity(q, from, to) {
      q = Number(q) || 0;

      if (!from || !to || from === to) return q;

      var mass = {
        g: 1,
        kg: 1000
      };

      var volume = {
        ml: 1,
        l: 1000
      };

      if (mass[from] && mass[to]) {
        return (q * mass[from]) / mass[to];
      }

      if (volume[from] && volume[to]) {
        return (q * volume[from]) / volume[to];
      }

      return q;
    }

    function descriptionIngredientCandidates(description) {
      var text = String(description || '')
        .replace(/\r/g, ' ')
        .replace(/\n+/g, ' ');

      if (!text.trim()) return [];

      var aliases = [];

      globalIngredients.forEach(function (g) {
        aliases.push({
          name: g.name,
          unit: g.unit,
          alias: g.name,
          source: g
        });

        if (Array.isArray(g.aliases)) {
          g.aliases.forEach(function (a) {
            if (a) {
              aliases.push({
                name: g.name,
                unit: g.unit,
                alias: a,
                source: g
              });
            }
          });
        }
      });

      ingredients.forEach(function (g) {
        aliases.push({
          name: g.name,
          unit: g.unit,
          alias: g.name,
          local: g
        });
      });

      aliases.sort(function (a, b) {
        return norm(b.alias).length - norm(a.alias).length;
      });

      var found = [];
      var seen = {};

      aliases.forEach(function (a) {
        var raw = String(a.alias || '').trim();

        if (raw.length < 2) return;

        var re = new RegExp(
          '(?:^|[^а-яa-z0-9])' +
            raw.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            ) +
            '(?:[^а-яa-z0-9]|$)',
          'i'
        );

        var m = re.exec(text);
        if (!m) return;

        var after = text.slice(
          m.index + m[0].length,
          m.index + m[0].length + 30
        );

        var qm = after.match(
          /(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs)?/i
        );

        var q = qm
          ? Number(String(qm[1]).replace(',', '.'))
          : 1;

        var unit =
          (qm && canonUnit(qm[2])) ||
          a.unit ||
          'g';

        var key = norm(a.name);

        if (seen[key]) return;

        seen[key] = 1;

        found.push({
          name: a.name,
          unit: unit,
          quantity: q > 0 ? q : 1,
          source: a.source,
          local: a.local,
          note: 'Из описания блюда'
        });
      });

      return found;
    }

    async function buildRowsFromDescription(p) {
      var candidates =
        descriptionIngredientCandidates(
          p && p.description
        );

      var result = [];

      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        var local = c.local;

        if (!local && c.source) {
          try {
            local = await ensureIngByName(
              c.source.name,
              c.unit
            );
          } catch (e) {
            console.warn(
              '[Description] ingredient:',
              c.name,
              e
            );
          }
        }

        if (local) {
          result.push({
            ingredient_id: local.id,
            quantity: convertQuantity(
              c.quantity,
              c.unit,
              local.unit
            ),
            note: c.note
          });
        }
      }

      return result;
    }

    async function fillOne(p) {
      var existing = await rpc(
        'manager_recipe_list',
        {
          p_venue_id: venueId,
          p_product_id: p.id
        }
      );

      if (Array.isArray(existing) && existing.length) {
        return false;
      }

      var rowsNew = [];

      try {
        rowsNew = await buildRowsFromDescription(p);
      } catch (e) {}

      if (!rowsNew.length) {
        var best = catalog
          .map(function (c) {
            return {
              c: c,
              s: similarity(p.name, c.name)
            };
          })
          .sort(function (a, b) {
            return b.s - a.s;
          })[0];

        if (best && best.s >= 0.6) {
          var items = catalogItems
            .filter(function (x) {
              return x.recipe_id === best.c.id;
            })
            .sort(function (a, b) {
              return (a.sort_order || 0) -
                (b.sort_order || 0);
            });

          for (var i = 0; i < items.length; i++) {
            var it = items[i];

            if (!it.ingredient) continue;

            var local = await ensureIngByName(
              it.ingredient.name,
              it.unit || it.ingredient.unit
            );

            if (local) {
              rowsNew.push({
                ingredient_id: local.id,
                quantity: convertQuantity(
                  it.quantity,
                  it.unit || it.ingredient.unit,
                  local.unit
                ),
                note:
                  it.note ||
                  'Автотехкарта из базы'
              });
            }
          }
        }
      }

      if (!rowsNew.length) return false;

      await rpc(
        'manager_product_recipe_save',
        {
          p_venue_id: venueId,
          p_product_id: p.id,
          p_rows: rowsNew
        }
      );

      return true;
    }

    function autoFillOnOpen() {
      /* Автозаполнение оставлено, но запускается один раз. */
      (async function () {
        var made = 0;

        for (var i = 0; i < products.length; i++) {
          try {
            if (await fillOne(products[i])) {
              made++;
            }
          } catch (e) {
            console.warn(
              '[autoFill]',
              products[i].name,
              e
            );
          }
        }

        if (made) {
          await reloadIngredients();

          if ($('generationSummary')) {
            $('generationSummary').textContent =
              'Автозаполнение: добавлены ингредиенты к ' +
              made +
              ' блюдам.';
          }
        }
      })();
    }

    async function generateAll() {
      var made = 0;
      var skipped = 0;
      var errors = 0;

      if ($('generationSummary')) {
        $('generationSummary').textContent =
          'Сопоставление меню с базой техкарт…';
      }

      for (var i = 0; i < products.length; i++) {
        try {
          if (await fillOne(products[i])) {
            made++;
          } else {
            skipped++;
          }
        } catch (e) {
          console.error(
            '[generateAll]',
            products[i].name,
            e
          );
          errors++;
        }
      }

      await reloadIngredients();

      if ($('generationSummary')) {
        $('generationSummary').textContent =
          'Готово: создано ' +
          made +
          '; пропущено ' +
          skipped +
          '; ошибок ' +
          errors +
          '.';
      }

      msg(
        made
          ? 'Автозаполнение завершено.'
          : 'Новых рецептур не создано.',
        !made
      );
    }

    /* ---------------------------------------------------------
       Кнопки
       --------------------------------------------------------- */

    if ($('productSearch')) {
      $('productSearch').addEventListener(
        'input',
        renderProducts
      );
    }

    if ($('save')) {
      $('save').onclick = function () {
        if (!selected) return;

        if (
          rows.some(function (r) {
            return !(r.quantity > 0);
          })
        ) {
          msg(
            'Количество каждого ингредиента должно быть больше нуля.',
            true
          );
          return;
        }

        rpc('manager_product_recipe_save', {
          p_venue_id: venueId,
          p_product_id: selected,
          p_rows: rows
        })
          .then(function () {
            msg('Рецептура сохранена.');
            return loadCost();
          })
          .catch(function (e) {
            msg(
              'Ошибка сохранения: ' +
                (e.message || e),
              true
            );
          });
      };
    }

    if ($('addIng')) {
      $('addIng').onclick = function () {
        var n = $('iname').value.trim();
        var q = Number($('iqty').value);
        var price = Number($('iprice').value);

        if (!n) {
          msg('Введите название ингредиента.', true);
          return;
        }

        if (!(q > 0)) {
          msg(
            'Закупочное количество должно быть больше нуля.',
            true
          );
          return;
        }

        if (price < 0 || !Number.isFinite(price)) {
          msg(
            'Некорректная закупочная цена.',
            true
          );
          return;
        }

        rpc('manager_ingredient_upsert', {
          p_venue_id: venueId,
          p_name: n,
          p_unit: $('iunit').value,
          p_purchase_quantity: q,
          p_purchase_price: price,
          p_id: null
        })
          .then(function () {
            msg('Ингредиент добавлен.');

            $('iname').value = '';
            $('iqty').value = '1';
            $('iprice').value = '0';

            return reloadIngredients();
          })
          .catch(function (e) {
            msg(
              'Ошибка: ' + (e.message || e),
              true
            );
          });
      };
    }

    if ($('refreshIngredients')) {
      $('refreshIngredients').onclick = function () {
        reloadIngredients()
          .then(function () {
            msg('Ингредиенты обновлены');
          })
          .catch(function (e) {
            msg(
              'Ошибка: ' + (e.message || e),
              true
            );
          });
      };
    }

    if ($('generateAllBtn')) {
      $('generateAllBtn').onclick = function () {
        if (
          confirm(
            'Автозаполнить только пустые рецептуры? Существующие не будут изменены.'
          )
        ) {
          generateAll().catch(function (e) {
            msg(
              'Ошибка генерации: ' +
                (e.message || e),
              true
            );
          });
        }
      };
    }

    if ($('catalogSearch')) {
      $('catalogSearch').addEventListener(
        'input',
        renderCatalog
      );
    }

    if ($('catalogCategory')) {
      $('catalogCategory').addEventListener(
        'change',
        renderCatalog
      );
    }

    if ($('catalogDifficulty')) {
      $('catalogDifficulty').addEventListener(
        'change',
        renderCatalog
      );
    }

    if ($('catalogCuisine')) {
      $('catalogCuisine').addEventListener(
        'change',
        renderCatalog
      );
    }

    if ($('catalogBtn')) {
      $('catalogBtn').onclick = function () {
        $('catalogModal').hidden = false;
        renderCatalog();
      };
    }

    if ($('ingredientsDbBtn')) {
      $('ingredientsDbBtn').onclick = function () {
        $('ingredientsModal').hidden = false;
        renderGlobalIngredients();
      };
    }

    if ($('ingredientsSearch')) {
      $('ingredientsSearch').addEventListener(
        'input',
        renderGlobalIngredients
      );
    }

    /* ---------------------------------------------------------
       Закрытие модальных окон
       --------------------------------------------------------- */

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-close]'),
      function (b) {
        b.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();

          var m = $(b.dataset.close);

          if (m) {
            m.hidden = true;
            m.setAttribute('hidden', '');
          }
        };
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll('.modalx'),
      function (m) {
        if (m.__qrCloseBound) return;

        m.__qrCloseBound = true;

        m.addEventListener('click', function (e) {
          if (e.target === m) {
            m.hidden = true;
            m.setAttribute('hidden', '');
          }
        });
      }
    );

    if (!document.__qrRecipesEscapeBound) {
      document.__qrRecipesEscapeBound = true;

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;

        Array.prototype.forEach.call(
          document.querySelectorAll('.modalx'),
          function (m) {
            m.hidden = true;
            m.setAttribute('hidden', '');
          }
        );
      });
    }

    /* ---------------------------------------------------------
       OCR
       --------------------------------------------------------- */

    if ($('uploadTechBtn')) {
      $('uploadTechBtn').onclick = function () {
        $('techModal').hidden = false;
        $('techFiles').click();
      };
    }

    if ($('techFiles')) {
      $('techFiles').onchange = function () {
        var files = Array.from(this.files || []);

        if (!files.length) return;

        files
          .reduce(function (promise, file) {
            return promise.then(function () {
              return processImage(file);
            });
          }, Promise.resolve())
          .then(function () {
            msg(
              'Техкарты обработаны. Проверьте сопоставление блюда.'
            );
          })
          .catch(function (e) {
            msg(
              'Ошибка OCR: ' + (e.message || e),
              true
            );
          })
          .finally(function () {
            $('techFiles').value = '';
          });
      };
    }

    function parseTechText(text) {
      var out = [];
      var seen = {};
      var source = String(text || '')
        .replace(/\r/g, '');

      var aliases = [];

      globalIngredients.forEach(function (g) {
        aliases.push({
          name: g.name,
          unit: g.unit,
          alias: g.name
        });

        if (Array.isArray(g.aliases)) {
          g.aliases.forEach(function (a) {
            if (a) {
              aliases.push({
                name: g.name,
                unit: g.unit,
                alias: a
              });
            }
          });
        }
      });

      ingredients.forEach(function (g) {
        aliases.push({
          name: g.name,
          unit: g.unit,
          alias: g.name
        });
      });

      aliases.sort(function (a, b) {
        return norm(b.alias).length -
          norm(a.alias).length;
      });

      source
        .split(/\n+/)
        .map(function (x) {
          return x.replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .forEach(function (line) {
          var ln = norm(line);
          var best = null;

          aliases.forEach(function (a) {
            var an = norm(a.alias);

            if (!an) return;

            var pos = ln.indexOf(an);

            if (pos >= 0) {
              var score =
                an.length /
                  Math.max(ln.length, 1) +
                0.5;

              if (!best || score > best.score) {
                best = {
                  a: a,
                  pos: pos,
                  score: score
                };
              }
            }
          });

          if (!best) return;

          var nums = [];
          var re =
            /(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs)?/gi;
          var m;

          while ((m = re.exec(line))) {
            nums.push({
              value: Number(
                String(m[1]).replace(',', '.')
              ),
              unit: canonUnit(m[2])
            });
          }

          if (!nums.length) return;

          var n =
            nums.filter(function (x) {
              return x.unit;
            })[0] || nums[nums.length - 1];

          if (!(n.value > 0)) return;

          var key =
            norm(best.a.name) +
            '|' +
            n.value +
            '|' +
            (n.unit || best.a.unit || 'g');

          if (seen[key]) return;

          seen[key] = 1;

          out.push({
            name: best.a.name,
            quantity: n.value,
            unit: n.unit || best.a.unit || 'g',
            note: 'OCR'
          });
        });

      return out;
    }

    async function processImage(file) {
      if (!window.Tesseract) {
        throw new Error(
          'OCR-библиотека не загрузилась'
        );
      }

      if ($('techModal')) {
        $('techModal').hidden = false;
      }

      if ($('ocrPanel')) {
        $('ocrPanel').hidden = false;
      }

      if ($('ocrText')) {
        $('ocrText').textContent = '';
      }

      if ($('ocrStatus')) {
        $('ocrStatus').textContent =
          'Распознавание ' + file.name + '...';
      }

      var result = await Tesseract.recognize(
        file,
        'rus+eng',
        {
          logger: function (x) {
            if (
              x.progress != null &&
              $('ocrProgress')
            ) {
              $('ocrProgress').style.width =
                Math.round(
                  x.progress * 100
                ) + '%';
            }

            if (x.status && $('ocrStatus')) {
              $('ocrStatus').textContent =
                x.status;
            }
          }
        }
      );

      var text =
        (result.data && result.data.text || '')
          .trim();

      showOcr(text, {
        file: file,
        name: file.name
      });
    }

    function showOcr(text, meta) {
      if ($('ocrPanel')) {
        $('ocrPanel').hidden = false;
      }

      if ($('ocrText')) {
        $('ocrText').textContent =
          text || 'Текст не распознан';
      }

      ocrParsed = parseTechText(text);

      if ($('ocrRecipeRows')) {
        $('ocrRecipeRows').innerHTML =
          ocrParsed.length
            ? '<h4>Найденные ингредиенты</h4>' +
              ocrParsed
                .map(function (r, i) {
                  return (
                    '<div class="gen-row">' +
                    '<input data-oi="' +
                    i +
                    '" value="' +
                    esc(r.name) +
                    '">' +
                    '<input data-oq="' +
                    i +
                    '" type="number" step=".001" value="' +
                    esc(r.quantity) +
                    '">' +
                    '<select data-ou="' +
                    i +
                    '">' +
                    '<option value="g" ' +
                    (r.unit === 'g'
                      ? 'selected'
                      : '') +
                    '>г</option>' +
                    '<option value="kg" ' +
                    (r.unit === 'kg'
                      ? 'selected'
                      : '') +
                    '>кг</option>' +
                    '<option value="ml" ' +
                    (r.unit === 'ml'
                      ? 'selected'
                      : '') +
                    '>мл</option>' +
                    '<option value="l" ' +
                    (r.unit === 'l'
                      ? 'selected'
                      : '') +
                    '>л</option>' +
                    '<option value="pcs" ' +
                    (r.unit === 'pcs'
                      ? 'selected'
                      : '') +
                    '>шт</option>' +
                    '</select>' +
                    '<input data-on="' +
                    i +
                    '" placeholder="Примечание" value="' +
                    esc(r.note || '') +
                    '">' +
                    '</div>'
                  );
                })
                .join('')
            : '<div class="muted">Не удалось автоматически выделить ингредиенты.</div>';
      }

      if ($('ocrProduct')) {
        $('ocrProduct').innerHTML =
          products
            .map(function (p) {
              return (
                '<option value="' +
                esc(p.id) +
                '">' +
                esc(p.name) +
                '</option>'
              );
            })
            .join('');
      }

      if ($('ocrStatus')) {
        $('ocrStatus').textContent =
          'Распознано. Найдено строк ингредиентов: ' +
          ocrParsed.length;
      }

      meta = meta || {};
      meta.ocrText = text;
      meta.parsed = ocrParsed;

      window.__ocrMeta = meta;
    }

    if ($('applyOcr')) {
      $('applyOcr').onclick = async function () {
        var pid = $('ocrProduct').value;

        if (!pid) {
          msg('Выберите блюдо.', true);
          return;
        }

        var arr = ocrParsed
          .map(function (r, i) {
            var nameEl = $(
              '[data-oi="' + i + '"]'
            );
            var qtyEl = $(
              '[data-oq="' + i + '"]'
            );
            var unitEl = $(
              '[data-ou="' + i + '"]'
            );
            var noteEl = $(
              '[data-on="' + i + '"]'
            );

            return {
              name: nameEl
                ? nameEl.value.trim()
                : r.name,
              quantity: qtyEl
                ? Number(qtyEl.value)
                : r.quantity,
              unit: unitEl
                ? unitEl.value
                : r.unit,
              note: noteEl
                ? noteEl.value.trim()
                : r.note || ''
            };
          })
          .filter(function (r) {
            return r.name && r.quantity > 0;
          });

        if (!arr.length) {
          msg(
            'В техкарте не найдены ингредиенты.',
            true
          );
          return;
        }

        try {
          var recipeRows = [];

          for (var i = 0; i < arr.length; i++) {
            var local =
              await ensureIngByName(
                arr[i].name,
                arr[i].unit
              );

            if (local) {
              recipeRows.push({
                ingredient_id: local.id,
                quantity: convertQuantity(
                  arr[i].quantity,
                  arr[i].unit,
                  local.unit
                ),
                note: arr[i].note
              });
            }
          }

          if (!recipeRows.length) {
            throw new Error(
              'Не удалось создать ингредиенты'
            );
          }

          await rpc(
            'manager_product_recipe_save',
            {
              p_venue_id: venueId,
              p_product_id: pid,
              p_rows: recipeRows
            }
          );

          selected = pid;
          pick(pid);

          msg(
            'Техкарта распознана и рецептура создана.'
          );

          if ($('techModal')) {
            $('techModal').hidden = true;
          }
        } catch (e) {
          console.error(e);

          msg(
            'Ошибка создания рецептуры: ' +
              (e.message || e),
            true
          );
        }
      };
    }

    /* ---------------------------------------------------------
       Смена заведения
       --------------------------------------------------------- */

    if (!window.__QR_RECIPES_VENUE_HANDLER__) {
      window.__QR_RECIPES_VENUE_HANDLER__ = true;

      window.addEventListener(
        'manager-venue-selected',
        function (e) {
          if (!e.detail || !e.detail.id) return;

          venueId = e.detail.id;

          try {
            localStorage.setItem(
              'manager_venue_id',
              String(venueId)
            );
          } catch (_) {}

          loadAll();
        }
      );
    }

    loadAll();

    /* После успешной инициализации больше не наблюдаем весь DOM. */
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function observeRecipes() {
    startRecipes();

    if (recipeRoot) return;

    var app =
      document.getElementById('app') ||
      document.body;

    observer = new MutationObserver(function () {
      startRecipes();
    });

    observer.observe(app, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      observeRecipes,
      { once: true }
    );
  } else {
    observeRecipes();
  }
})();
```
