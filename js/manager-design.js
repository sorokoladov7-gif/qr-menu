(function(){
'use strict';

if(!/\/manager\.html$/i.test(location.pathname)) return;

if(window.__managerDesignLoaded) return;
window.__managerDesignLoaded = true;


/* =========================================================
   DESIGN TEMPLATES
========================================================= */

var templates = {

  coffee:{
    name:'Кофейня',
    emoji:'☕',
    brand_color:'#8b5e3c',
    button_color:'#c47f45',
    header_color:'#fff7ed',
    font_family:'Plus+Jakarta+Sans',
    card_style:'soft',
    hero_style:'warm',
    card_radius:18,
    button_radius:12
  },

  shawarma:{
    name:'Шаурма',
    emoji:'🌯',
    brand_color:'#f97316',
    button_color:'#ea580c',
    header_color:'#fff7ed',
    font_family:'Montserrat',
    card_style:'bold',
    hero_style:'gradient',
    card_radius:16,
    button_radius:12
  },

  bakery:{
    name:'Пекарня',
    emoji:'🥐',
    brand_color:'#d97706',
    button_color:'#b45309',
    header_color:'#fffbeb',
    font_family:'Montserrat',
    card_style:'soft',
    hero_style:'warm',
    card_radius:20,
    button_radius:14
  },

  cafe:{
    name:'Кафе',
    emoji:'🍽️',
    brand_color:'#6366f1',
    button_color:'#4f46e5',
    header_color:'#f8fafc',
    font_family:'Plus+Jakarta+Sans',
    card_style:'glass',
    hero_style:'gradient',
    card_radius:18,
    button_radius:12
  },

  streetfood:{
    name:'Стритфуд',
    emoji:'🍔',
    brand_color:'#ef4444',
    button_color:'#dc2626',
    header_color:'#fff7ed',
    font_family:'Oswald',
    card_style:'bold',
    hero_style:'gradient',
    card_radius:14,
    button_radius:10
  },

  premium:{
    name:'Premium',
    emoji:'✨',
    brand_color:'#a78bfa',
    button_color:'#7c3aed',
    header_color:'#0f172a',
    font_family:'Plus+Jakarta+Sans',
    card_style:'glass',
    hero_style:'dark',
    card_radius:22,
    button_radius:14
  },

  dark:{
    name:'Dark',
    emoji:'🌙',
    brand_color:'#6366f1',
    button_color:'#4f46e5',
    header_color:'#020617',
    font_family:'Inter',
    card_style:'glass',
    hero_style:'dark',
    card_radius:18,
    button_radius:12
  },

  minimal:{
    name:'Minimal',
    emoji:'🤍',
    brand_color:'#111827',
    button_color:'#111827',
    header_color:'#ffffff',
    font_family:'Inter',
    card_style:'flat',
    hero_style:'minimal',
    card_radius:12,
    button_radius:10
  }

};


/* =========================================================
   HELPERS
========================================================= */

function esc(v){

  return String(v == null ? '' : v).replace(
    /[&<>"']/g,
    function(c){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c];
    }
  );

}


function getProxy(){

  var root = document.getElementById('app');

  if(!root) return null;

  /*
   * Основной способ.
   *
   * В текущей версии Vue _instance может быть null,
   * поэтому НЕ полагаемся только на root.__vue_app__._instance.
   */

  try{

    if(
      root.__vueParentComponent &&
      root.__vueParentComponent.proxy
    ){
      return root.__vueParentComponent.proxy;
    }

  }catch(e){}


  /*
   * Совместимость с текущим проектом.
   */

  try{

    if(
      window.__QR_MANAGER_VUE_APP__ &&
      window.__QR_MANAGER_VUE_APP__._instance &&
      window.__QR_MANAGER_VUE_APP__._instance.proxy
    ){
      return window.__QR_MANAGER_VUE_APP__._instance.proxy;
    }

  }catch(e){}


  /*
   * Старый способ.
   */

  try{

    if(
      root.__vue_app__ &&
      root.__vue_app__._instance &&
      root.__vue_app__._instance.proxy
    ){
      return root.__vue_app__._instance.proxy;
    }

  }catch(e){}


  return null;

}


/* =========================================================
   PERMISSIONS
========================================================= */

var permissionVenueId = null;
var permissionLoading = false;


function setPermission(target,source,key,legacyKey){

  if(
    source &&
    Object.prototype.hasOwnProperty.call(source,key)
  ){

    target[legacyKey] = source[key] === true;
    target[key] = source[key] === true;

  }

}


function applyPermissions(p,x){

  if(!p || !p.venue) return;

  x = x || {};

  /*
   * ВАЖНО:
   * начинаем с текущих прав, но только для текущего venue.
   */
  var legacy = Object.assign(
    {},
    p.venue.manager_permissions || {}
  );

  setPermission(
    legacy,
    x,
    'can_edit_menu',
    'products'
  );

  setPermission(
    legacy,
    x,
    'can_edit_prices',
    'prices'
  );

  setPermission(
    legacy,
    x,
    'can_edit_delivery',
    'delivery'
  );

  setPermission(
    legacy,
    x,
    'can_edit_design',
    'design'
  );

  setPermission(
    legacy,
    x,
    'can_edit_branding',
    'branding'
  );

  setPermission(
    legacy,
    x,
    'can_edit_venue',
    'venue'
  );

  p.venue.manager_permissions = legacy;

}


function clearDesignPermission(p){

  if(!p || !p.venue) return;

  var current = p.venue.manager_permissions || {};

  current.design = false;
  current.can_edit_design = false;

  p.venue.manager_permissions = current;

}


function loadPermissions(p,done){

  if(
    !p ||
    !p.venue ||
    !p.venue.id
  ){

    permissionVenueId = null;
    permissionLoading = false;

    if(done) done();

    return;

  }


  var venueId = p.venue.id;


  /*
   * ADMIN
   */

  if(
    p.profile &&
    p.profile.role === 'admin'
  ){

    applyPermissions(
      p,
      {
        can_edit_menu:true,
        can_edit_prices:true,
        can_edit_delivery:true,
        can_edit_design:true,
        can_edit_branding:true,
        can_edit_venue:true
      }
    );

    permissionVenueId = venueId;
    permissionLoading = false;

    if(done) done();

    return;

  }


  /*
   * Если уже загружается именно это заведение,
   * второй запрос не запускаем.
   */

  if(
    permissionLoading &&
    permissionVenueId === venueId
  ){

    if(done) done();

    return;

  }


  /*
   * НОВОЕ ЗАВЕДЕНИЕ.
   *
   * Старые права больше не используем.
   */

  if(permissionVenueId !== venueId){

    permissionLoading = false;

    /*
     * Сбрасываем дизайн-права от предыдущего venue.
     */
    clearDesignPermission(p);

  }


  permissionLoading = true;

  /*
   * Запоминаем venue, для которого выполняется запрос.
   */
  permissionVenueId = venueId;


  /*
   * Если db ещё не существует —
   * корректно завершаем.
   */

  if(typeof db === 'undefined'){

    permissionLoading = false;

    console.warn(
      '[Manager Design] db is not available'
    );

    if(done) done();

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

    .eq(
      'manager_id',
      p.profile && p.profile.id
        ? p.profile.id
        : ''
    )

    .eq(
      'venue_id',
      venueId
    )

    .maybeSingle()

    .then(function(r){

      /*
       * Пока запрос выполнялся,
       * пользователь мог перейти в другое заведение.
       */

      var current = getProxy();

      if(
        current &&
        current.venue &&
        current.venue.id === venueId
      ){

        if(r.error){

          console.warn(
            '[Manager] permission bridge:',
            r.error.message || r.error
          );

          clearDesignPermission(current);

        }else if(r.data){

          applyPermissions(
            current,
            r.data
          );

        }else{

          /*
           * Для нового заведения нет записи прав.
           * Старые права не переносим.
           */
          clearDesignPermission(current);

        }

        build();
        sync();

      }


      permissionLoading = false;

      if(done) done();

    })

    .catch(function(e){

      permissionLoading = false;

      var current = getProxy();

      if(
        current &&
        current.venue &&
        current.venue.id === venueId
      ){

        clearDesignPermission(current);

        build();
        sync();

      }

      console.warn(
        '[Manager] permission bridge exception:',
        e
      );

      if(done) done();

    });

}


function allowed(p){

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


/* =========================================================
   STYLE
========================================================= */

function ensureStyle(){

  if(
    document.getElementById(
      'manager-design-style'
    )
  ) return;


  var s = document.createElement('style');

  s.id = 'manager-design-style';

  s.textContent =

    '.md-wrap{padding:4px 0 30px}' +

    '.md-grid{' +
      'display:grid;' +
      'grid-template-columns:minmax(0,1fr) 420px;' +
      'gap:14px' +
    '}' +

    '.md-card{' +
      'border:1px solid rgba(255,255,255,.1);' +
      'border-radius:16px;' +
      'background:rgba(255,255,255,.035);' +
      'padding:16px' +
    '}' +

    '.md-templates{' +
      'display:grid;' +
      'grid-template-columns:repeat(4,1fr);' +
      'gap:8px' +
    '}' +

    '.md-template{' +
      'padding:11px;' +
      'border:1px solid rgba(255,255,255,.1);' +
      'border-radius:12px;' +
      'cursor:pointer;' +
      'background:rgba(255,255,255,.02)' +
    '}' +

    '.md-template:hover,' +
    '.md-template.on{' +
      'border-color:#8b5cf6;' +
      'background:rgba(99,102,241,.12)' +
    '}' +

    '.md-template b{' +
      'display:block' +
    '}' +

    '.md-template span{' +
      'font-size:22px' +
    '}' +

    '.md-fields{' +
      'display:grid;' +
      'gap:10px;' +
      'margin-top:12px' +
    '}' +

    '.md-field{' +
      'display:grid;' +
      'gap:5px;' +
      'font-size:12px;' +
      'color:#94a3b8' +
    '}' +

    '.md-field input,' +
    '.md-field select{' +
      'width:100%;' +
      'box-sizing:border-box;' +
      'padding:9px;' +
      'border-radius:9px;' +
      'border:1px solid rgba(255,255,255,.1);' +
      'background:rgba(255,255,255,.04);' +
      'color:inherit' +
    '}' +

    '.md-two{' +
      'display:grid;' +
      'grid-template-columns:1fr 1fr;' +
      'gap:8px' +
    '}' +

    '.md-actions{' +
      'display:flex;' +
      'gap:8px;' +
      'flex-wrap:wrap;' +
      'margin-top:14px' +
    '}' +

    '.md-preview{' +
      'background:#0b1020;' +
      'border-radius:18px;' +
      'padding:12px;' +
      'min-height:650px' +
    '}' +

    '.md-preview iframe{' +
      'width:100%;' +
      'height:620px;' +
      'border:0;' +
      'border-radius:14px;' +
      'background:#fff' +
    '}' +

    '.md-note{' +
      'font-size:11px;' +
      'color:#94a3b8;' +
      'margin-top:8px' +
    '}' +

    '.md-lock{' +
      'padding:35px;' +
      'text-align:center' +
    '}' +

    '.md-badge{' +
      'display:inline-block;' +
      'padding:5px 9px;' +
      'border-radius:999px;' +
      'background:rgba(52,211,153,.12);' +
      'color:#6ee7b7;' +
      'font-size:11px' +
    '}' +

    '@media(max-width:1050px){' +

      '.md-grid{' +
        'grid-template-columns:1fr' +
      '}' +

      '.md-templates{' +
        'grid-template-columns:repeat(2,1fr)' +
      '}' +

    '}';


  document.head.appendChild(s);

}


/* =========================================================
   BUILD TAB
========================================================= */

function build(){

  var p = getProxy();


  /*
   * Нет venue — полностью убираем дизайн.
   */

  if(
    !p ||
    !p.venue
  ){

    var emptyTab =
      document.getElementById(
        'manager-design-tab'
      );

    var emptyHost =
      document.getElementById(
        'manager-design-host'
      );

    if(emptyTab) emptyTab.remove();
    if(emptyHost) emptyHost.remove();

    return;

  }


  var tabs =
    document.querySelector('.tabs');

  if(!tabs) return;


  var venueId = String(p.venue.id);

  var ok = allowed(p);


  var old =
    document.getElementById(
      'manager-design-host'
    );

  var button =
    document.getElementById(
      'manager-design-tab'
    );


  /*
   * Нет доступа.
   */

  if(!ok){

    if(button) button.remove();

    if(old) old.remove();

    if(p.tab === 'design'){
      p.tab = 'menu';
    }

    return;

  }


  /*
   * Создаём кнопку.
   */

  if(!button){

    button =
      document.createElement(
        'button'
      );

    button.id =
      'manager-design-tab';

    button.type =
      'button';

    button.textContent =
      '🎨 Дизайн';


    button.onclick =
      function(){

        p.tab = 'design';

        sync();

      };


    tabs.appendChild(button);

  }


  /*
   * Создаём контейнер.
   */

  if(!old){

    old =
      document.createElement(
        'div'
      );

    old.id =
      'manager-design-host';


    tabs.parentNode.insertBefore(
      old,
      tabs.nextSibling
    );

  }


  /*
   * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ.
   *
   * Если venue изменился —
   * полностью пересоздаём редактор.
   */

  if(
    old.dataset.venueId !== venueId
  ){

    old.dataset.venueId =
      venueId;

    old.innerHTML = '';

    render(
      old,
      p
    );

  }


  sync();

}


/* =========================================================
   CURRENT SETTINGS
========================================================= */

function currentSettings(p){

  var d =
    p.venue.design_settings || {};


  return Object.assign(

    {
      template:'default',

      brand_color:
        p.venue.brand_color ||
        '#6366f1',

      button_color:
        '#8b5cf6',

      header_color:
        '#ffffff',

      font_family:
        'Plus+Jakarta+Sans',

      hero_enabled:
        true,

      hero_style:
        'gradient',

      card_style:
        'glass',

      card_radius:
        18,

      button_radius:
        12,

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


/* =========================================================
   RENDER
========================================================= */

function render(host,p){

  ensureStyle();


  var d =
    currentSettings(p);


  var html =

    '<div class="md-wrap">' +

      '<div class="spread" style="margin-bottom:14px">' +

        '<div>' +

          '<h3 style="margin:0 0 4px">' +
            '🎨 Дизайн заведения' +
          '</h3>' +

          '<div class="muted" style="font-size:12px">' +
            'Фирменный стиль, карточки, кнопки и главный экран' +
          '</div>' +

        '</div>' +

        '<span class="md-badge">' +
          'Доступ выдан администратором' +
        '</span>' +

      '</div>' +


      '<div class="md-grid">' +


        '<div>' +


          '<div class="md-card">' +

            '<h4 style="margin-top:0">' +
              'Шаблоны' +
            '</h4>' +

            '<div class="md-templates">';


  Object.keys(templates).forEach(
    function(k){

      var t =
        templates[k];

      html +=

        '<div ' +
          'class="md-template" ' +
          'data-template="' +
            esc(k) +
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

          '</div>' +


          '<div class="md-card">' +

            '<h4 style="margin-top:0">' +
              'Фирменный стиль' +
            '</h4>' +

            '<div class="md-fields">' +


              '<div class="md-two">' +

                '<label class="md-field">' +

                  'Основной цвет' +

                  '<input ' +
                    'id="md-brand" ' +
                    'type="color" ' +
                    'value="' +
                      esc(d.brand_color) +
                    '">' +

                '</label>' +


                '<label class="md-field">' +

                  'Цвет кнопок' +

                  '<input ' +
                    'id="md-button" ' +
                    'type="color" ' +
                    'value="' +
                      esc(d.button_color) +
                    '">' +

                '</label>' +

              '</div>' +


              '<div class="md-two">' +

                '<label class="md-field">' +

                  'Цвет заголовка' +

                  '<input ' +
                    'id="md-header" ' +
                    'type="color" ' +
                    'value="' +
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

              '</div>' +


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

              '</div>' +


              '<div class="md-two">' +

                '<label class="md-field">' +

                  'Радиус карточек' +

                  '<input ' +
                    'id="md-cr" ' +
                    'type="number" ' +
                    'min="0" ' +
                    'max="40" ' +
                    'value="' +
                      Number(d.card_radius || 18) +
                    '">' +

                '</label>' +


                '<label class="md-field">' +

                  'Радиус кнопок' +

                  '<input ' +
                    'id="md-br" ' +
                    'type="number" ' +
                    'min="0" ' +
                    'max="40" ' +
                    'value="' +
                      Number(d.button_radius || 12) +
                    '">' +

                '</label>' +

              '</div>' +


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

              '</div>' +


              '<label class="md-field">' +

                '<span>' +

                  '<input ' +
                    'id="md-hero-enabled" ' +
                    'type="checkbox" ' +
                    (
                      d.hero_enabled !== false
                        ? 'checked'
                        : ''
                    ) +
                  '> ' +

                  'Показывать главный экран' +

                '</span>' +

              '</label>' +


            '</div>' +


            '<div class="md-actions">' +

              '<button ' +
                'id="md-save" ' +
                'class="btn btn-primary">' +

                'Сохранить дизайн' +

              '</button>' +


              '<button ' +
                'id="md-reset" ' +
                'class="btn btn-ghost">' +

                'Восстановить стандартный' +

              '</button>' +

            '</div>' +


            '<div ' +
              'id="md-msg" ' +
              'class="md-note">' +
            '</div>' +


          '</div>' +

        '</div>' +


        '<div class="md-preview">' +

          '<h4 style="margin:0 0 10px">' +
            'Предпросмотр' +
          '</h4>' +

          '<iframe ' +
            'id="md-frame" ' +
            'title="Предпросмотр меню">' +
          '</iframe>' +

          '<div class="md-note">' +
            'Предпросмотр использует реальное клиентское меню заведения.' +
          '</div>' +

        '</div>' +


      '</div>' +

    '</div>';


  host.innerHTML =
    html;


  /*
   * Устанавливаем значения select.
   */

  var font =
    host.querySelector('#md-font');

  if(font){
    font.value =
      d.font_family ||
      'Plus+Jakarta+Sans';
  }


  var card =
    host.querySelector('#md-card');

  if(card){
    card.value =
      d.card_style ||
      'glass';
  }


  var hero =
    host.querySelector('#md-hero');

  if(hero){
    hero.value =
      d.hero_style ||
      'gradient';
  }


  var bs =
    host.querySelector('#md-bs');

  if(bs){
    bs.value =
      d.button_style ||
      'gradient';
  }


  var ratio =
    host.querySelector('#md-ratio');

  if(ratio){
    ratio.value =
      d.image_ratio ||
      '4:3';
  }


  /*
   * Шаблоны.
   */

  Object.keys(templates).forEach(
    function(k){

      var el =
        host.querySelector(
          '[data-template="' +
          k +
          '"]'
        );

      if(el){

        el.onclick =
          function(){

            applyTemplate(
              host,
              k
            );

          };

      }

    }
  );


  /*
   * Сохранение.
   */

  var saveButton =
    host.querySelector('#md-save');

  if(saveButton){

    saveButton.onclick =
      function(){

        save(
          host,
          p
        );

      };

  }


  /*
   * Сброс.
   */

  var resetButton =
    host.querySelector('#md-reset');

  if(resetButton){

    resetButton.onclick =
      function(){

        applyTemplate(
          host,
          'cafe'
        );

        var msg =
          host.querySelector(
            '#md-msg'
          );

        if(msg){

          msg.textContent =
            'Выбран стандартный стиль. Нажмите «Сохранить».';

        }

      };

  }


  /*
   * Предпросмотр.
   */

  var frame =
    host.querySelector(
      '#md-frame'
    );

  if(frame){

    frame.src =
      '/menu.html?venue=' +
      encodeURIComponent(
        p.venue.slug
      ) +
      '&designPreview=1';

  }

}


/* =========================================================
   APPLY TEMPLATE
========================================================= */

function applyTemplate(host,k){

  var t =
    templates[k];

  if(!t) return;


  var map = {

    brand_color:'#md-brand',
    button_color:'#md-button',
    header_color:'#md-header',
    font_family:'#md-font',
    card_style:'#md-card',
    hero_style:'#md-hero',
    card_radius:'#md-cr',
    button_radius:'#md-br'

  };


  Object.keys(map).forEach(
    function(key){

      var el =
        host.querySelector(
          map[key]
        );

      if(!el) return;


      if(
        el.type === 'color' ||
        el.type === 'text'
      ){

        el.value =
          t[key] ||
          el.value;

      }else{

        el.value =
          t[key] ||
          el.value;

      }

    }
  );


  host
    .querySelectorAll(
      '.md-template'
    )
    .forEach(
      function(x){

        x.classList.toggle(
          'on',
          x.dataset.template === k
        );

      }
    );

}


/* =========================================================
   SAVE
========================================================= */

function save(host,p){

  var msg =
    host.querySelector(
      '#md-msg'
    );


  if(msg){

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


  if(typeof db === 'undefined'){

    if(msg){

      msg.textContent =
        'Ошибка: db не инициализирован';

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

    .then(
      function(r){

        if(r.error){

          throw r.error;

        }


        /*
         * Обновляем локальное состояние.
         */

        p.venue.design_settings =
          r.data;


        if(msg){

          msg.textContent =
            'Сохранено';

        }


        /*
         * Обновляем preview.
         */

        var f =
          host.querySelector(
            '#md-frame'
          );


        if(f){

          f.src =
            '/menu.html?venue=' +
            encodeURIComponent(
              p.venue.slug
            ) +
            '&designPreview=1&t=' +
            Date.now();

        }

      }
    )

    .catch(
      function(e){

        if(msg){

          msg.textContent =
            'Ошибка: ' +
            (
              e.message ||
              e
            );

        }

      }
    );

}


/* =========================================================
   SYNC
========================================================= */

function sync(){

  var p =
    getProxy();

  var host =
    document.getElementById(
      'manager-design-host'
    );

  var tab =
    document.getElementById(
      'manager-design-tab'
    );


  if(
    !p ||
    !p.venue
  ){

    if(tab) tab.remove();
    if(host) host.remove();

    return;

  }


  /*
   * Если права изменились —
   * сразу скрываем редактор.
   */

  var ok =
    allowed(p);


  if(!tab || !host){

    if(ok){

      build();

    }

    return;

  }


  tab.style.display =
    ok
      ? ''
      : 'none';


  host.style.display =
    ok &&
    p.tab === 'design'
      ? 'block'
      : 'none';


  /*
   * Если venue изменился,
   * перестраиваем редактор.
   */

  if(
    ok &&
    host.dataset.venueId !==
      String(p.venue.id)
  ){

    host.dataset.venueId =
      String(p.venue.id);

    host.innerHTML = '';

    render(
      host,
      p
    );

  }

}


/* =========================================================
   BOOT
========================================================= */

function boot(){

  ensureStyle();


  var n = 0;

  /*
   * Последнее заведение,
   * которое реально видели.
   */
  var lastSeenVenueId =
    null;


  var t =
    setInterval(
      function(){

        var p =
          getProxy();


        /*
         * НЕТ ЗАВЕДЕНИЯ
         *
         * Например пользователь нажал
         * «К списку».
         */

        if(
          !p ||
          !p.venue
        ){

          lastSeenVenueId =
            null;

          permissionVenueId =
            null;

          permissionLoading =
            false;


          var oldTab =
            document.getElementById(
              'manager-design-tab'
            );

          var oldHost =
            document.getElementById(
              'manager-design-host'
            );


          if(oldTab)
            oldTab.remove();


          if(oldHost)
            oldHost.remove();


        }else{

          var currentVenueId =
            String(
              p.venue.id
            );


          /*
           * ПЕРЕКЛЮЧЕНИЕ ЗАВЕДЕНИЯ
           *
           * Это основной фикс.
           */

          if(
            lastSeenVenueId !==
            currentVenueId
          ){

            lastSeenVenueId =
              currentVenueId;


            /*
             * Сбрасываем состояние
             * предыдущего заведения.
             */

            permissionVenueId =
              null;

            permissionLoading =
              false;


            /*
             * Удаляем старый интерфейс.
             */

            var oldTab =
              document.getElementById(
                'manager-design-tab'
              );

            var oldHost =
              document.getElementById(
                'manager-design-host'
              );


            if(oldTab)
              oldTab.remove();


            if(oldHost)
              oldHost.remove();


            /*
             * Загружаем права
             * НОВОГО заведения.
             */

            loadPermissions(
              p,
              function(){

                build();
                sync();

              }
            );


          }else{

            /*
             * Обычная работа.
             */

            build();
            sync();

          }

        }


        /*
         * Через 30 секунд
         * больше не держим интервал.
         *
         * При необходимости повторный
         * запуск происходит через
         * смену venue / перезагрузку.
         */

        if(++n > 120){

          clearInterval(t);

        }


      },
      250
    );

}


/* =========================================================
   START
========================================================= */

if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    boot
  );

}else{

  boot();

}

})();
