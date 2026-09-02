```html
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Рецептуры — OS QR-Меню</title>

<link rel="stylesheet" href="/css/style.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
<script src="/js/config.js"></script>
<script src="/js/app.js"></script>

<style>
body{
  background:#0b1020;
  color:#eef2ff;
  font-family:system-ui,sans-serif
}

.recipe-wrap{
  max-width:1250px;
  margin:0 auto;
  padding:20px 18px 40px
}

.recipe-head{
  display:flex;
  gap:12px;
  align-items:center;
  justify-content:space-between;
  margin-bottom:14px
}

.recipe-head h2{margin:0}

.recipe-actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap
}

.recipe-grid{
  display:grid;
  grid-template-columns:300px minmax(0,1fr);
  gap:16px
}

.glass{border-radius:16px}
.card{padding:18px}
.muted{color:#94a3b8}

.list button{
  width:100%;
  text-align:left;
  margin:4px 0
}

.product-active{
  border-color:#6366f1!important;
  background:rgba(99,102,241,.13)!important
}

.recipe-row{
  display:grid;
  grid-template-columns:minmax(180px,1fr) 110px 75px minmax(130px,1fr) auto;
  gap:8px;
  align-items:center;
  margin-bottom:8px
}

.toolbar{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center
}

.msg{
  padding:10px 12px;
  border-radius:10px;
  margin:10px 0
}

.ok{background:#064e3b}
.err{background:#7f1d1d}

.cost-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
  margin:14px 0
}

.cost-card{
  padding:12px;
  border:1px solid #ffffff12;
  border-radius:12px;
  background:#ffffff06
}

.cost-card .n{
  font-size:20px;
  font-weight:800
}

.cost-card .l{
  font-size:11px;
  color:#94a3b8;
  margin-top:3px
}

.ingredient-row{
  display:flex;
  gap:10px;
  align-items:center;
  padding:10px 0;
  border-bottom:1px solid #ffffff12
}

.ingredient-actions{
  display:flex;
  gap:6px;
  flex-wrap:wrap
}

.tech-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(210px,1fr));
  gap:10px
}

.tech-card{
  padding:12px;
  border:1px solid #ffffff12;
  border-radius:14px;
  background:#ffffff05
}

.tech-card img{
  width:100%;
  height:130px;
  object-fit:cover;
  border-radius:10px;
  background:#111827
}

/* =========================
   БАЗА БЛЮД
   ========================= */

.catalog-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:10px
}

.catalog-card{
  min-width:0;
  padding:11px;
  border:1px solid #ffffff12;
  border-radius:14px;
  background:#ffffff05;
  cursor:pointer;
  transition:
    border-color .15s ease,
    transform .15s ease,
    background .15s ease
}

.catalog-card:hover{
  border-color:#6366f1;
  background:#ffffff0a;
  transform:translateY(-2px)
}

.catalog-card:focus{
  outline:2px solid #6366f1;
  outline-offset:2px
}

.catalog-card .catalog-photo{
  width:100%;
  height:105px;
  object-fit:cover;
  border-radius:10px;
  background:#111827;
  margin:6px 0 8px
}

.catalog-card h4{
  font-size:14px;
  line-height:1.25;
  min-height:35px
}

.catalog-card .catalog-description{
  font-size:11px;
  line-height:1.35;
  color:#94a3b8;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  min-height:30px
}

.catalog-card .catalog-output{
  font-size:10px;
  color:#94a3b8;
  margin-top:6px
}

.catalog-meta{
  display:flex;
  gap:4px;
  flex-wrap:wrap;
  margin:5px 0
}

.catalog-meta .badge2{
  font-size:9px;
  padding:2px 5px
}

.catalog-card-action{
  margin-top:8px;
  width:100%
}

.catalog-detail-grid{
  display:grid;
  grid-template-columns:minmax(260px,1fr) 1.3fr;
  gap:18px
}

.catalog-detail-photo{
  width:100%;
  max-height:360px;
  object-fit:cover;
  border-radius:14px;
  background:#111827
}

.detail-section{
  margin-top:16px;
  padding-top:14px;
  border-top:1px solid #ffffff12
}

.detail-table{
  width:100%;
  border-collapse:collapse;
  font-size:13px
}

.detail-table th,
.detail-table td{
  padding:7px 6px;
  border-bottom:1px solid #ffffff10;
  text-align:left
}

.step-item{
  display:grid;
  grid-template-columns:34px 1fr auto;
  gap:10px;
  align-items:start;
  padding:9px 0;
  border-bottom:1px solid #ffffff0d
}

.step-num{
  width:28px;
  height:28px;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:rgba(99,102,241,.15);
  color:#c4b5fd;
  font-weight:800
}

.source-box{
  font-size:12px;
  line-height:1.5
}

.source-box a{
  color:#a5b4fc
}

.import-bar{
  display:flex;
  gap:8px;
  align-items:center;
  flex-wrap:wrap;
  margin-top:14px;
  padding-top:14px;
  border-top:1px solid #ffffff12
}

.import-bar select{
  flex:1;
  min-width:240px
}

.filter-row{
  display:flex;
  gap:8px;
  flex-wrap:wrap
}

.filter-row select{
  width:auto;
  min-width:150px
}

/* =========================
   БАЗА ИНГРЕДИЕНТОВ
   ========================= */

.ingredients-db-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:10px
}

.ingredient-db-card{
  min-width:0;
  padding:12px;
  border:1px solid #ffffff12;
  border-radius:14px;
  background:#ffffff05;
  cursor:pointer;
  transition:
    border-color .15s ease,
    transform .15s ease,
    background .15s ease
}

.ingredient-db-card:hover{
  border-color:#6366f1;
  background:#ffffff0a;
  transform:translateY(-2px)
}

.ingredient-db-card h4{
  margin:7px 0 4px;
  font-size:14px;
  line-height:1.25
}

.ingredient-db-icon{
  width:34px;
  height:34px;
  border-radius:10px;
  display:grid;
  place-items:center;
  background:rgba(99,102,241,.13);
  font-size:18px
}

.ingredient-db-unit{
  font-size:11px;
  color:#c4b5fd;
  margin-top:5px
}

.ingredient-db-category{
  margin-top:6px
}

.ingredient-db-category .badge2{
  font-size:9px;
  padding:2px 5px
}

/* =========================
   МОДАЛЬНЫЕ ОКНА
   ========================= */

.modalx{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.65);
  z-index:1000;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px
}

.modalx>div{
  width:min(1100px,100%);
  max-height:90vh;
  overflow:auto
}

.modalx.small-modal>div{
  width:min(620px,100%)
}

.modal-header-sticky{
  position:sticky;
  top:0;
  z-index:3;
  background:#0f172a;
  padding-bottom:10px
}

.progress{
  height:8px;
  border-radius:99px;
  background:#ffffff12;
  overflow:hidden
}

.progress>i{
  display:block;
  height:100%;
  background:#6366f1;
  width:0
}

.ocr-lines{
  max-height:300px;
  overflow:auto;
  white-space:pre-wrap;
  background:#020617;
  border:1px solid #ffffff12;
  padding:12px;
  border-radius:10px;
  font-size:12px
}

.gen-row{
  display:grid;
  grid-template-columns:minmax(160px,1.3fr) 100px 70px minmax(160px,1fr);
  gap:8px;
  margin:6px 0
}

.badge2{
  display:inline-flex;
  padding:3px 7px;
  border-radius:999px;
  background:rgba(99,102,241,.15);
  color:#c4b5fd;
  font-size:11px
}

.empty-db{
  grid-column:1/-1;
  padding:25px;
  text-align:center;
  border:1px dashed #ffffff18;
  border-radius:14px
}

.db-detail-list{
  display:grid;
  gap:8px;
  margin-top:10px
}

.db-detail-item{
  padding:10px 12px;
  border-radius:10px;
  background:#ffffff06;
  border:1px solid #ffffff0d
}

.db-detail-label{
  font-size:10px;
  color:#64748b;
  text-transform:uppercase;
  letter-spacing:.04em;
  margin-bottom:3px
}

.db-detail-value{
  font-size:13px
}

.ingredient-detail-head{
  display:flex;
  gap:14px;
  align-items:center;
  padding:6px 0 15px
}

.ingredient-detail-icon{
  width:58px;
  height:58px;
  border-radius:15px;
  display:grid;
  place-items:center;
  background:rgba(99,102,241,.13);
  font-size:30px;
  flex:none
}

.ingredient-detail-title{
  flex:1
}

.ingredient-detail-title h3{
  margin:0 0 4px
}

@media(max-width:1050px){
  .catalog-grid,
  .ingredients-db-grid{
    grid-template-columns:repeat(4,minmax(0,1fr))
  }
}

@media(max-width:850px){
  .catalog-detail-grid{
    grid-template-columns:1fr
  }

  .recipe-grid{
    grid-template-columns:1fr
  }

  .recipe-row{
    grid-template-columns:1fr 100px 70px 1fr auto
  }

  .cost-grid{
    grid-template-columns:repeat(2,1fr)
  }

  .gen-row{
    grid-template-columns:1fr 90px 60px 1fr
  }

  .catalog-grid,
  .ingredients-db-grid{
    grid-template-columns:repeat(2,minmax(0,1fr))
  }
}

@media(max-width:520px){
  .recipe-wrap{
    padding:12px 10px 30px
  }

  .cost-grid{
    grid-template-columns:1fr 1fr
  }

  .recipe-row{
    grid-template-columns:1fr 90px 60px auto
  }

  .recipe-row input:last-of-type{
    grid-column:1/-1
  }

  .catalog-grid,
  .ingredients-db-grid{
    grid-template-columns:1fr
  }

  .catalog-card .catalog-photo{
    height:150px
  }
}

body.embedded #backManager{
  display:none!important
}

body.embedded .recipe-wrap{
  max-width:none
}
</style>
</head>

<body>

<div class="recipe-wrap">

  <div class="recipe-head">
    <div>
      <h2>🧾 Рецептуры</h2>
      <div class="muted" style="font-size:12px">
        Техкарты → распознавание → сопоставление → рецептура → себестоимость
      </div>
    </div>

    <div class="recipe-actions">
      <button class="btn btn-primary" id="uploadTechBtn">
        📷 Добавить техкарты
      </button>

      <button class="btn btn-ghost" id="catalogBtn">
        📚 База блюд и техкарт
      </button>

      <button class="btn btn-ghost" id="ingredientsDbBtn">
        🧂 База ингредиентов
      </button>

      <input
        id="techFiles"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
      >
    </div>
  </div>

  <div id="msg"></div>

  <div
    id="generationSummary"
    class="muted"
    style="font-size:12px;margin:-4px 0 12px"
  ></div>

  <div class="glass card" style="margin-bottom:16px">
    <div class="toolbar">
      <div style="flex:1;min-width:220px">
        <b>Автоматическое заполнение</b>

        <div
          class="muted"
          style="font-size:11px;margin-top:3px"
        >
          Если техкарт нет, рецептуры берутся из общей базы стандартных
          техкарт и сопоставляются с меню заведения.
        </div>
      </div>

      <button class="btn btn-green" id="generateAllBtn">
        ⚡ Автозаполнить рецептуры
      </button>
    </div>
  </div>

  <div class="recipe-grid">

    <div class="glass card">

      <div class="toolbar">
        <h3 style="margin:0;flex:1">Блюда</h3>
        <span class="badge2" id="productCount">0</span>
      </div>

      <input
        id="productSearch"
        placeholder="Поиск блюда..."
        style="width:100%;margin:10px 0"
      >

      <div id="products" class="list"></div>

    </div>

    <div class="glass card">

      <div class="toolbar">

        <div style="flex:1">
          <h3 id="title" style="margin:0">
            Выберите товар
          </h3>

          <div
            id="matchInfo"
            class="muted"
            style="font-size:11px;margin-top:3px"
          ></div>
        </div>

        <button
          id="save"
          class="btn btn-primary"
          hidden
        >
          Сохранить рецептуру
        </button>

      </div>

      <div id="cost"></div>
      <div id="recipe"></div>

      <hr style="border-color:#ffffff12;margin:22px 0">

      <div class="toolbar">

        <h3 style="margin:0;flex:1">
          Ингредиенты заведения
        </h3>

        <button
          id="refreshIngredients"
          class="btn btn-ghost btn-sm"
        >
          🔄 Обновить
        </button>

      </div>

      <div class="toolbar" style="margin-top:10px">

        <input
          id="iname"
          placeholder="Название"
        >

        <select id="iunit">
          <option value="g">г</option>
          <option value="kg">кг</option>
          <option value="ml">мл</option>
          <option value="l">л</option>
          <option value="pcs">шт</option>
        </select>

        <input
          id="iqty"
          type="number"
          min="0.001"
          step="0.001"
          value="1"
          placeholder="Закуп. кол-во"
        >

        <input
          id="iprice"
          type="number"
          min="0"
          step="0.01"
          value="0"
          placeholder="Цена закупки"
        >

        <button
          id="addIng"
          class="btn btn-green"
        >
          Добавить
        </button>

      </div>

      <div
        id="ingredients"
        style="margin-top:12px"
      ></div>

    </div>

  </div>

</div>


<!-- =========================
     ТЕХКАРТЫ
     ========================= -->

<div id="techModal" class="modalx" hidden>

  <div class="glass card">

    <div class="toolbar">

      <div style="flex:1">

        <h3 style="margin:0">
          📷 Техкарты заведения
        </h3>

        <div
          class="muted"
          style="font-size:11px"
        >
          OCR работает в браузере. OpenAI API не используется.
        </div>

      </div>

      <button
        class="btn btn-ghost"
        data-close="techModal"
      >
        ×
      </button>

    </div>

    <div
      id="techList"
      class="tech-grid"
      style="margin-top:14px"
    ></div>

    <div
      id="ocrPanel"
      hidden
      style="margin-top:16px"
    >

      <h4>Результат распознавания</h4>

      <div class="progress">
        <i id="ocrProgress"></i>
      </div>

      <div
        id="ocrStatus"
        class="muted"
        style="font-size:12px;margin:7px 0"
      ></div>

      <div id="ocrText" class="ocr-lines"></div>

      <div
        id="ocrRecipeRows"
        style="margin-top:12px"
      ></div>

      <div
        class="toolbar"
        style="margin-top:12px"
      >

        <select
          id="ocrProduct"
          style="flex:1"
        ></select>

        <button
          class="btn btn-primary"
          id="applyOcr"
        >
          Создать рецептуру из распознанной техкарты
        </button>

      </div>

    </div>

  </div>

</div>


<!-- =========================
     БАЗА БЛЮД
     ========================= -->

<div id="catalogModal" class="modalx" hidden>

  <div class="glass card">

    <div class="modal-header-sticky">

      <div class="toolbar">

        <div style="flex:1">

          <h3 style="margin:0">
            📚 База блюд и техкарт
          </h3>

          <div
            class="muted"
            style="font-size:11px"
          >
            Общая база используется как источник стандартных техкарт.
            Нажмите на карточку, чтобы открыть полную информацию.
          </div>

        </div>

        <button
          class="btn btn-ghost"
          data-close="catalogModal"
        >
          ×
        </button>

      </div>

      <input
        id="catalogSearch"
        placeholder="Поиск блюда, ингредиента или кухни..."
        style="width:100%;margin:12px 0"
      >

      <div
        class="filter-row"
        style="margin-bottom:12px"
      >

        <select id="catalogCategory">
          <option value="">Все категории</option>
        </select>

        <select id="catalogDifficulty">
          <option value="">Любая сложность</option>
          <option value="easy">Легко</option>
          <option value="medium">Средне</option>
          <option value="hard">Сложно</option>
        </select>

        <select id="catalogCuisine">
          <option value="">Все кухни</option>
        </select>

      </div>

      <div
        id="catalogStats"
        class="muted"
        style="font-size:11px;margin-bottom:10px"
      ></div>

    </div>

    <div
      id="catalogList"
      class="catalog-grid"
    ></div>

  </div>

</div>


<!-- =========================
     ОКНО ТЕХКАРТЫ
     ========================= -->

<div id="catalogDetailModal" class="modalx" hidden>

  <div class="glass card">

    <div class="modal-header-sticky">

      <div class="toolbar">

        <div style="flex:1">

          <h3
            id="catalogDetailTitle"
            style="margin:0"
          >
            Техкарта
          </h3>

          <div
            id="catalogDetailSub"
            class="muted"
            style="font-size:11px;margin-top:3px"
          ></div>

        </div>

        <button
          class="btn btn-ghost"
          data-close="catalogDetailModal"
        >
          ×
        </button>

      </div>

    </div>

    <div
      id="catalogDetailBody"
      style="margin-top:14px"
    ></div>

  </div>

</div>


<!-- =========================
     БАЗА ИНГРЕДИЕНТОВ
     ========================= -->

<div id="ingredientsModal" class="modalx" hidden>

  <div class="glass card">

    <div class="modal-header-sticky">

      <div class="toolbar">

        <div style="flex:1">

          <h3 style="margin:0">
            🧂 База ингредиентов
          </h3>

          <div
            class="muted"
            style="font-size:11px"
          >
            Стандартные ингредиенты и единицы измерения.
            Нажмите на карточку для просмотра информации.
          </div>

        </div>

        <button
          class="btn btn-ghost"
          data-close="ingredientsModal"
        >
          ×
        </button>

      </div>

      <input
        id="ingredientsSearch"
        placeholder="Поиск ингредиента..."
        style="width:100%;margin:12px 0"
      >

    </div>

    <div
      id="ingredientsDbList"
      class="ingredients-db-grid"
    ></div>

  </div>

</div>


<!-- =========================
     ОКНО ИНГРЕДИЕНТА
     ========================= -->

<div
  id="ingredientDetailModal"
  class="modalx small-modal"
  hidden
>

  <div class="glass card">

    <div class="toolbar">

      <div style="flex:1">

        <h3
          id="ingredientDetailTitle"
          style="margin:0"
        >
          Ингредиент
        </h3>

        <div
          id="ingredientDetailSub"
          class="muted"
          style="font-size:11px;margin-top:3px"
        ></div>

      </div>

      <button
        class="btn btn-ghost"
        data-close="ingredientDetailModal"
      >
        ×
      </button>

    </div>

    <div
      id="ingredientDetailBody"
      style="margin-top:14px"
    ></div>

  </div>

</div>


<script>
(function(){

'use strict';

var db=window.db;

var venueId=
  localStorage.getItem('manager_venue_id')||
  localStorage.getItem('selectedVenueId');

if(
  new URLSearchParams(location.search).get('embedded')==='1'
){
  document.body.classList.add('embedded');
}

var products=[];
var ingredients=[];
var selected=null;
var rows=[];

var catalog=[];
var catalogItems=[];
var globalIngredients=[];
var techCards=[];
var ocrParsed=[];
var catalogIndex={};

var $=function(id){
  return document.getElementById(id);
};

function esc(s){
  return String(s==null?'':s).replace(
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

function msg(t,e){
  $('msg').innerHTML=
    t
      ? '<div class="msg '+(e?'err':'ok')+'">'+esc(t)+'</div>'
      : '';
}

function rpc(name,args){
  return db.rpc(name,args).then(function(r){
    if(r.error)throw r.error;
    return r.data;
  });
}

function norm(s){
  return String(s||'')
    .toLowerCase()
    .replace(/ё/g,'е')
    .replace(/[^а-яa-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function similarity(a,b){

  a=norm(a);
  b=norm(b);

  if(!a||!b)return 0;
  if(a===b)return 1;

  if(a.includes(b)||b.includes(a))return .92;

  var A=a.split(' ');
  var B=b.split(' ');

  var SA=new Set(A);
  var SB=new Set(B);

  var inter=0;

  A.forEach(function(x){
    if(SB.has(x))inter++;
  });

  var score=
    inter/
    (SA.size+SB.size-inter||1);

  var stop={
    с:1,
    сборка:1,
    классический:1,
    классическая:1,
    домашний:1,
    домашняя:1,
    фирменный:1,
    фирменная:1,
    порция:1,
    большой:1,
    большая:1,
    мини:1,
    pro:1,
    демо:1
  };

  var coreA=
    A.filter(function(x){
      return x.length>3&&!stop[x];
    })[0];

  var coreB=
    B.filter(function(x){
      return x.length>3&&!stop[x];
    })[0];

  if(
    coreA&&
    coreB&&
    coreA===coreB
  ){
    score=Math.max(score,.78);
  }

  return score;
}

function unitLabel(u){
  return ({
    g:'г',
    kg:'кг',
    ml:'мл',
    l:'л',
    pcs:'шт'
  })[u]||u||'';
}


/* ==========================================
   ЗАГРУЗКА ДАННЫХ
   ========================================== */

function loadAll(){

  if(!venueId){

    msg(
      'Не найдено выбранное заведение. Откройте кабинет управляющего и выберите заведение.',
      true
    );

    return;
  }

  Promise.all([

    db
      .from('products')
      .select('id,name,category,price')
      .eq('venue_id',venueId)
      .order('name'),

    rpc(
      'manager_ingredient_list',
      {p_venue_id:venueId}
    ),

    db
      .from('global_recipe_catalog')
      .select(
        'id,name,category,description,yield_quantity,yield_unit,cuisine,native_name,difficulty,base_servings,prep_minutes,cook_minutes,nutrition_per_serving,photo,source,source_license,source_attribution,source_url'
      )
      .eq('is_active',true)
      .order('name'),

    db
      .from('global_recipe_catalog_items')
      .select(
        'id,recipe_id,ingredient_id,quantity,unit,note,sort_order,ingredient:global_ingredient_catalog(id,name,unit,category)'
      )
      .order('sort_order'),

    db
      .from('global_ingredient_catalog')
      .select(
        'id,name,unit,category,aliases'
      )
      .eq('is_active',true)
      .order('name'),

    db
      .from('manager_tech_cards')
      .select(
        'id,product_id,file_name,file_path,file_url,ocr_text,status,created_at'
      )
      .eq('venue_id',venueId)
      .order('created_at',{ascending:false})

  ]).then(function(r){

    if(r[0].error)throw r[0].error;
    if(r[2].error)throw r[2].error;
    if(r[3].error)throw r[3].error;
    if(r[4].error)throw r[4].error;
    if(r[5].error)throw r[5].error;

    products=r[0].data||[];

    ingredients=
      Array.isArray(r[1])
        ?r[1]
        :[];

    catalog=
      r[2].data||[];

    catalogItems=
      r[3].data||[];

    globalIngredients=
      r[4].data||[];

    techCards=
      r[5].data||[];

    return Promise.all(
      techCards.map(function(t){

        return t.file_path
          ?db
            .storage
            .from('tech-cards')
            .createSignedUrl(
              t.file_path,
              3600
            )
            .then(function(x){

              if(
                !x.error&&
                x.data
              ){
                t.file_url=
                  x.data.signedUrl;
              }

            })
          :Promise.resolve();

      })
    ).then(function(){

      buildCatalogIndex();

      renderProducts();
      renderIngredients();
      renderTechCards();
      renderCatalog();
      renderGlobalIngredients();

    });

  }).catch(function(e){

    console.error(e);

    msg(
      'Ошибка загрузки: '+(e.message||e),
      true
    );

  });

}


/* ==========================================
   БЛЮДА ЗАВЕДЕНИЯ
   ========================================== */

function renderProducts(){

  var q=
    norm($('productSearch').value);

  var arr=
    products.filter(function(p){
      return !q||
        norm(p.name).includes(q);
    });

  $('productCount').textContent=
    products.length;

  $('products').innerHTML=
    arr.length
      ?arr.map(function(p){

        return (
          '<button type="button" class="btn '+
          (selected===p.id
            ?'product-active'
            :'btn-ghost')+
          '" data-p="'+esc(p.id)+'">'+
          esc(p.name)+
          ' <span class="muted">'+
          (p.category
            ?' · '+esc(p.category)
            :'')+
          ' · '+
          Number(p.price||0).toFixed(2)+
          ' ₽</span></button>'
        );

      }).join('')
      :
      '<p class="muted">Нет товаров.</p>';

  Array.prototype.forEach.call(
    document.querySelectorAll('[data-p]'),
    function(b){

      b.onclick=function(){
        pick(
          b.getAttribute('data-p')
        );
      };

    }
  );
}

$('productSearch').addEventListener(
  'input',
  renderProducts
);


/* ==========================================
   ВЫБОР БЛЮДА
   ========================================== */

function pick(id){

  selected=id;

  var p=
    products.find(function(x){
      return x.id===id;
    });

  if(!p)return;

  $('title').textContent=
    'Рецептура: '+p.name;

  $('save').hidden=false;

  var cat=
    catalog
      .map(function(c){
        return {
          c:c,
          s:similarity(
            p.name,
            c.name
          )
        };
      })
      .sort(function(a,b){
        return b.s-a.s;
      })[0];

  $('matchInfo').textContent=
    cat&&cat.s>=.55
      ?'Ближайшая техкарта в базе: '+
       cat.c.name+
       ' · совпадение '+
       Math.round(cat.s*100)+'%'
      :'В базе подходящая техкарта не найдена';

  rows=[];

  rpc(
    'manager_recipe_list',
    {
      p_venue_id:venueId,
      p_product_id:id
    }
  ).then(function(data){

    rows=
      (Array.isArray(data)?data:[])
        .map(function(r){

          return {
            ingredient_id:r.ingredient_id,
            quantity:Number(r.quantity)||0,
            note:r.note||''
          };

        });

    renderRecipe();
    renderProducts();

    return loadCost();

  }).catch(function(e){

    msg(
      'Ошибка загрузки рецептуры: '+e.message,
      true
    );

  });
}


/* ==========================================
   СЕБЕСТОИМОСТЬ
   ========================================== */

function loadCost(){

  if(!selected){
    $('cost').innerHTML='';
    return;
  }

  return rpc(
    'manager_recipe_cost',
    {
      p_venue_id:venueId,
      p_product_id:selected
    }
  ).then(function(c){

    c=c||{};

    $('cost').innerHTML=

      '<div class="cost-grid">'+

      '<div class="cost-card">'+
      '<div class="n">'+
      Number(c.cost||0).toFixed(2)+
      ' ₽</div>'+
      '<div class="l">Себестоимость</div>'+
      '</div>'+

      '<div class="cost-card">'+
      '<div class="n">'+
      Number(c.price||0).toFixed(2)+
      ' ₽</div>'+
      '<div class="l">Цена продажи</div>'+
      '</div>'+

      '<div class="cost-card">'+
      '<div class="n">'+
      Number(c.gross_profit||0).toFixed(2)+
      ' ₽</div>'+
      '<div class="l">Валовая прибыль</div>'+
      '</div>'+

      '<div class="cost-card">'+
      '<div class="n">'+
      Number(c.margin_percent||0).toFixed(1)+
      '%</div>'+
      '<div class="l">Маржа</div>'+
      '</div>'+

      '</div>';

  }).catch(function(e){

    $('cost').innerHTML=
      '<div class="msg err">'+
      'Ошибка себестоимости: '+
      esc(e.message)+
      '</div>';

  });
}


/* ==========================================
   РЕЦЕПТУРА
   ========================================== */

function renderRecipe(){

  var c=$('recipe');

  if(!selected){

    c.innerHTML=
      '<p class="muted">Выберите товар.</p>';

    return;
  }

  if(!rows.length){

    c.innerHTML=
      '<div class="muted" style="padding:12px 0">'+
      'Рецептура пустая. Можно добавить ингредиент вручную или сгенерировать её из базы/техкарты.'+
      '</div>'+
      '<button class="btn btn-ghost" id="addRow">+ Ингредиент</button>';

    var a=$('addRow');

    if(a)a.onclick=addRow;

    return;
  }

  c.innerHTML=

    rows.map(function(r,i){

      var ing=
        ingredients.find(function(x){
          return x.id===r.ingredient_id;
        });

      var unit=
        ing?ing.unit:'g';

      return (

        '<div class="recipe-row">'+

        '<select data-ri="'+i+'">'+

        ingredients.map(function(x){

          return (
            '<option value="'+
            esc(x.id)+
            '" '+
            (x.id===r.ingredient_id
              ?'selected'
              :'')+
            '>'+
            esc(x.name)+
            ' ('+
            esc(unitLabel(x.unit))+
            ')</option>'
          );

        }).join('')+

        '</select>'+

        '<input data-rq="'+i+'" type="number" min=".001" step=".001" value="'+
        esc(r.quantity)+
        '">' +

        '<span class="muted">'+
        esc(unitLabel(unit))+
        '</span>'+

        '<input data-rn="'+i+'" placeholder="Примечание" value="'+
        esc(r.note)+
        '">'+

        '<button class="btn btn-danger" data-rd="'+i+'">×</button>'+

        '</div>'
      );

    }).join('')+

    '<button class="btn btn-ghost" id="addRow">+ Ингредиент</button>';

  Array.prototype.forEach.call(
    c.querySelectorAll('[data-ri]'),
    function(e){

      e.onchange=function(){

        var i=+e.dataset.ri;

        rows[i].ingredient_id=
          e.value;

        renderRecipe();

      };

    }
  );

  Array.prototype.forEach.call(
    c.querySelectorAll('[data-rq]'),
    function(e){

      e.oninput=function(){

        rows[+e.dataset.rq].quantity=
          Number(e.value)||0;

      };

    }
  );

  Array.prototype.forEach.call(
    c.querySelectorAll('[data-rn]'),
    function(e){

      e.oninput=function(){

        rows[+e.dataset.rn].note=
          e.value;

      };

    }
  );

  Array.prototype.forEach.call(
    c.querySelectorAll('[data-rd]'),
    function(e){

      e.onclick=function(){

        rows.splice(
          +e.dataset.rd,
          1
        );

        renderRecipe();

      };

    }
  );

  $('addRow').onclick=addRow;
}

function addRow(){

  if(!ingredients.length){

    msg(
      'Сначала добавьте ингредиент.',
      true
    );

    return;
  }

  rows.push({
    ingredient_id:ingredients[0].id,
    quantity:1,
    note:''
  });

  renderRecipe();
}

$('save').onclick=function(){

  if(!selected)return;

  if(
    rows.some(function(r){
      return !(r.quantity>0);
    })
  ){

    msg(
      'Количество каждого ингредиента должно быть больше нуля.',
      true
    );

    return;
  }

  rpc(
    'manager_product_recipe_save',
    {
      p_venue_id:venueId,
      p_product_id:selected,
      p_rows:rows
    }
  ).then(function(){

    msg('Рецептура сохранена.');

    return loadCost();

  }).catch(function(e){

    msg(
      'Ошибка сохранения: '+e.message,
      true
    );

  });

};


/* ==========================================
   ИНГРЕДИЕНТЫ ЗАВЕДЕНИЯ
   ========================================== */

$('addIng').onclick=function(){

  var n=
    $('iname').value.trim();

  var q=
    Number($('iqty').value);

  var price=
    Number($('iprice').value);

  if(!n){

    msg(
      'Введите название ингредиента.',
      true
    );

    return;
  }

  if(!(q>0)){

    msg(
      'Закупочное количество должно быть больше нуля.',
      true
    );

    return;
  }

  if(
    price<0||
    !Number.isFinite(price)
  ){

    msg(
      'Некорректная закупочная цена.',
      true
    );

    return;
  }

  rpc(
    'manager_ingredient_upsert',
    {
      p_venue_id:venueId,
      p_name:n,
      p_unit:$('iunit').value,
      p_purchase_quantity:q,
      p_purchase_price:price,
      p_id:null
    }
  ).then(function(){

    msg('Ингредиент добавлен.');

    $('iname').value='';
    $('iqty').value='1';
    $('iprice').value='0';

    return reloadIngredients();

  }).catch(function(e){

    msg(
      'Ошибка: '+e.message,
      true
    );

  });

};

function reloadIngredients(){

  return rpc(
    'manager_ingredient_list',
    {
      p_venue_id:venueId
    }
  ).then(function(d){

    ingredients=
      Array.isArray(d)
        ?d
        :[];

    renderIngredients();
    renderRecipe();

    if(selected)
      return loadCost();

  });
}

$('refreshIngredients').onclick=function(){

  reloadIngredients()
    .then(function(){

      msg(
        'Ингредиенты обновлены'
      );

    })
    .catch(function(e){

      msg(
        'Ошибка: '+e.message,
        true
      );

    });

};

function renderIngredients(){

  $('ingredients').innerHTML=
    ingredients.length

      ?ingredients.map(function(i){

        return (
          '<div class="ingredient-row">'+

          '<div style="flex:1">'+
          '<b>'+esc(i.name)+'</b>'+

          '<div class="muted" style="font-size:11px">'+
          esc(unitLabel(i.unit))+
          ' · закупка '+
          Number(i.purchase_price||0).toFixed(2)+
          ' ₽ / '+
          esc(i.purchase_quantity)+
          ' '+
          esc(unitLabel(i.unit))+
          '</div>'+

          '</div>'+

          '</div>'
        );

      }).join('')

      :'<span class="muted">Пока нет ингредиентов.</span>';

}


/* ==========================================
   ТЕХКАРТЫ ЗАВЕДЕНИЯ
   ========================================== */

function renderTechCards(){

  var c=$('techList');

  c.innerHTML=

    techCards.length

      ?techCards.map(function(t){

        return (
          '<div class="tech-card">'+

          (
            t.file_url
              ?'<img src="'+
               esc(t.file_url)+
               '" alt="">'
              :''
          )+

          '<b>'+
          esc(t.file_name||'Техкарта')+
          '</b>'+

          '<div class="muted" style="font-size:11px;margin:5px 0">'+
          (
            t.status==='processed'
              ?'Распознано'
              :'Загружено'
          )+
          '</div>'+

          '<button class="btn btn-ghost btn-sm" data-tech="'+
          esc(t.id)+
          '">'+
          'Открыть / распознать'+
          '</button>'+

          '</div>'
        );

      }).join('')

      :
      '<div class="muted">'+
      'Техкарт пока нет. Добавьте изображения — система распознает их локально.'+
      '</div>';

  Array.prototype.forEach.call(
    c.querySelectorAll('[data-tech]'),
    function(b){

      b.onclick=function(){

        var t=
          techCards.find(function(x){
            return x.id===b.dataset.tech;
          });

        if(t)
          showOcr(
            t.ocr_text||'',
            t
          );

      };

    }
  );

}

$('uploadTechBtn').onclick=function(){

  $('techModal').hidden=false;
  $('techFiles').click();

};

$('techFiles').onchange=function(){

  var fs=
    Array.from(
      this.files||[]
    );

  if(!fs.length)return;

  fs.reduce(
    function(pr,f){

      return pr.then(function(){
        return processImage(f);
      });

    },
    Promise.resolve()
  )
  .then(function(){

    msg(
      'Техкарты обработаны. Проверяйте сопоставление блюда перед сохранением.'
    );

  })
  .catch(function(e){

    msg(
      'Ошибка OCR: '+(e.message||e),
      true
    );

  })
  .finally(function(){

    $('techFiles').value='';

  });

};

async function processImage(file){

  $('techModal').hidden=false;

  $('ocrPanel').hidden=false;

  $('ocrText').textContent='';

  $('ocrRecipeRows').innerHTML='';

  $('ocrProgress').style.width='0%';

  $('ocrStatus').textContent=
    'Распознавание '+file.name+'...';

  if(!window.Tesseract)
    throw new Error(
      'OCR-библиотека не загрузилась'
    );

  var result=
    await Tesseract.recognize(
      file,
      'rus+eng',
      {
        logger:function(x){

          if(x.progress!=null)
            $('ocrProgress').style.width=
              Math.round(
                x.progress*100
              )+'%';

          if(x.status)
            $('ocrStatus').textContent=
              x.status;

        }
      }
    );

  var text=
    (
      result.data&&
      result.data.text||
      ''
    ).trim();

  showOcr(
    text,
    {
      file:file,
      name:file.name
    }
  );

}

function showOcr(text,meta){

  $('ocrPanel').hidden=false;

  $('ocrText').textContent=
    text||'Текст не распознан';

  ocrParsed=
    parseTechText(text);

  $('ocrRecipeRows').innerHTML=

    ocrParsed.length

      ?'<h4>Найденные ингредиенты</h4>'+
       ocrParsed.map(function(r,i){

        return (
          '<div class="gen-row">'+

          '<input data-oi="'+i+'" value="'+
          esc(r.name)+
          '">' +

          '<input data-oq="'+i+'" type="number" step=".001" value="'+
          esc(r.quantity)+
          '">' +

          '<select data-ou="'+i+'">'+

          '<option value="g" '+
          (r.unit==='g'?'selected':'')+
          '>г</option>'+

          '<option value="kg" '+
          (r.unit==='kg'?'selected':'')+
          '>кг</option>'+

          '<option value="ml" '+
          (r.unit==='ml'?'selected':'')+
          '>мл</option>'+

          '<option value="l" '+
          (r.unit==='l'?'selected':'')+
          '>л</option>'+

          '<option value="pcs" '+
          (r.unit==='pcs'?'selected':'')+
          '>шт</option>'+

          '</select>'+

          '<input data-on="'+i+'" placeholder="Примечание" value="'+
          esc(r.note||'')+
          '">' +

          '</div>'
        );

      }).join('')

      :
      '<div class="muted">'+
      'Не удалось выделить строки ингредиентов автоматически. Текст OCR можно использовать для ручного ввода.'+
      '</div>';

  var best=
    products
      .map(function(p){

        return {
          p:p,
          s:similarity(
            text.split('\n')[0]||'',
            p.name
          )
        };

      })
      .sort(function(a,b){
        return b.s-a.s;
      });

  $('ocrProduct').innerHTML=

    products.map(function(p){

      var b=
        best.find(function(x){
          return x.p.id===p.id;
        });

      return (
        '<option value="'+
        esc(p.id)+
        '" '+
        (
          b&&b.s>=.45
            ?'selected'
            :''
        )+
        '>'+
        esc(p.name)+
        '</option>'
      );

    }).join('');

  $('ocrStatus').textContent=
    'Распознано. Найдено строк ингредиентов: '+
    ocrParsed.length;

  meta=meta||{};

  meta.ocrText=text;
  meta.parsed=ocrParsed;

  window.__ocrMeta=meta;

}

function parseTechText(text){

  var out=[];

  String(text||'')
    .split(/\n+/)
    .forEach(function(line){

      line=
        line
          .replace(/\s+/g,' ')
          .trim();

      if(!line||line.length<3)
        return;

      var m=
        line.match(
          /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|g|мл|ml|л|l|шт|pcs)\b(?:\s+(.*))?$/i
        );

      if(!m)return;

      var unit=
        (m[3]||'g').toLowerCase();

      if(
        unit==='гр'||
        unit==='g'
      )
        unit='g';

      else if(
        unit==='кг'||
        unit==='kg'
      )
        unit='kg';

      else if(
        unit==='мл'||
        unit==='ml'
      )
        unit='ml';

      else if(
        unit==='л'||
        unit==='l'
      )
        unit='l';

      else
        unit='pcs';

      var name=
        m[1]
          .replace(
            /^[•·\-–—\d.)\s]+/,
            ''
          )
          .trim();

      if(name.length<2)return;

      out.push({
        name:name,
        quantity:Number(
          String(m[2]).replace(',','.')
        ),
        unit:unit,
        note:m[4]||''
      });

    });

  return out;
}


/* ==========================================
   OCR → РЕЦЕПТУРА
   ========================================== */

$('applyOcr').onclick=async function(){

  var pid=
    $('ocrProduct').value;

  if(!pid){

    msg(
      'Выберите блюдо.',
      true
    );

    return;
  }

  var arr=
    ocrParsed
      .map(function(r,i){

        return {
          name:
            $('[data-oi="'+i+'"]').value.trim(),

          quantity:
            Number(
              $('[data-oq="'+i+'"]').value
            ),

          unit:
            $('[data-ou="'+i+'"]').value,

          note:
            $('[data-on="'+i+'"]').value.trim()
        };

      })
      .filter(function(r){

        return r.name&&r.quantity>0;

      });

  if(!arr.length){

    msg(
      'В техкарте не найдены ингредиенты. Проверьте OCR.',
      true
    );

    return;
  }

  try{

    for(
      var i=0;
      i<arr.length;
      i++
    ){

      var existing=
        ingredients
          .map(function(x){

            return {
              x:x,
              s:similarity(
                x.name,
                arr[i].name
              )
            };

          })
          .sort(function(a,b){
            return b.s-a.s;
          })[0];

      var iid=
        existing&&
        existing.s>=.78
          ?existing.x.id
          :null;

      if(!iid){

        var g=
          globalIngredients
            .map(function(x){

              return {
                x:x,
                s:similarity(
                  x.name,
                  arr[i].name
                )
              };

            })
            .sort(function(a,b){
              return b.s-a.s;
            })[0];

        var name=
          g&&g.s>=.78
            ?g.x.name
            :arr[i].name;

        var rr=
          await rpc(
            'manager_ingredient_upsert',
            {
              p_venue_id:venueId,
              p_name:name,
              p_unit:arr[i].unit,
              p_purchase_quantity:1,
              p_purchase_price:0,
              p_id:null
            }
          );

        iid=
          rr&&rr.id
            ?rr.id
            :(rr&&rr[0]
              ?rr[0].id
              :null);

        if(!iid){

          await reloadIngredients();

          var ni=
            ingredients.find(function(x){

              return similarity(
                x.name,
                name
              )>=.95;

            });

          if(ni)
            iid=ni.id;

        }

      }

      if(iid)
        arr[i].ingredient_id=iid;

    }

    await reloadIngredients();

    var recipeRows=
      arr
        .filter(function(x){
          return x.ingredient_id;
        })
        .map(function(x){

          return {
            ingredient_id:x.ingredient_id,
            quantity:x.quantity,
            note:x.note||''
          };

        });

    await rpc(
      'manager_product_recipe_save',
      {
        p_venue_id:venueId,
        p_product_id:pid,
        p_rows:recipeRows
      }
    );

    var p=
      products.find(function(x){
        return x.id===pid;
      });

    if(p)
      selected=pid;

    pick(pid);

    await saveTechCardRecord(
      window.__ocrMeta||
      {
        ocrText:$('ocrText').textContent,
        name:'Техкарта'
      }
    );

    msg(
      'Техкарта распознана и рецептура создана.'
    );

    $('techModal').hidden=true;

  }catch(e){

    console.error(e);

    msg(
      'Ошибка создания рецептуры: '+
      (e.message||e),
      true
    );

  }

};


/* ==========================================
   СОХРАНЕНИЕ ТЕХКАРТЫ
   ========================================== */

async function saveTechCardRecord(meta){

  if(!meta||!meta.file)
    return;

  var file=meta.file;

  var path=
    venueId+
    '/'+
    Date.now()+
    '_'+
    file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

  var up=
    await db.storage
      .from('tech-cards')
      .upload(
        path,
        file,
        {upsert:false}
      );

  if(up.error)
    throw up.error;

  var ins=
    await db
      .from('manager_tech_cards')
      .insert({
        venue_id:venueId,
        product_id:$('ocrProduct').value,
        file_name:file.name,
        file_path:path,
        file_url:null,
        ocr_text:meta.ocrText||'',
        status:'processed'
      });

  if(ins.error)
    throw ins.error;

  return reloadTechCards();

}

async function reloadTechCards(){

  var r=
    await db
      .from('manager_tech_cards')
      .select(
        'id,product_id,file_name,file_path,file_url,ocr_text,status,created_at'
      )
      .eq('venue_id',venueId)
      .order(
        'created_at',
        {ascending:false}
      );

  if(r.error)
    throw r.error;

  techCards=
    r.data||[];

  for(
    var i=0;
    i<techCards.length;
    i++
  ){

    if(
      techCards[i].file_path
    ){

      var su=
        await db.storage
          .from('tech-cards')
          .createSignedUrl(
            techCards[i].file_path,
            3600
          );

      if(
        !su.error&&
        su.data
      ){

        techCards[i].file_url=
          su.data.signedUrl;

      }

    }

  }

  renderTechCards();

}


/* ==========================================
   ГЛОБАЛЬНЫЙ ИНГРЕДИЕНТ → ЛОКАЛЬНЫЙ
   ========================================== */

async function ensureLocalIngredient(globalItem){

  var gi=
    globalItem.ingredient;

  if(!gi)return null;

  var ranked=
    ingredients
      .map(function(x){

        return {
          x:x,
          s:similarity(
            x.name,
            gi.name
          )
        };

      })
      .sort(function(a,b){
        return b.s-a.s;
      });

  if(
    ranked[0]&&
    ranked[0].s>=.86
  )
    return ranked[0].x;

  var up=
    await rpc(
      'manager_ingredient_upsert',
      {
        p_venue_id:venueId,
        p_name:gi.name,
        p_unit:
          gi.unit||
          globalItem.unit||
          'g',
        p_purchase_quantity:1,
        p_purchase_price:0,
        p_id:null
      }
    );

  var iid=
    up&&up.id
      ?up.id
      :(Array.isArray(up)&&up[0]
        ?up[0].id
        :null);

  await reloadIngredients();

  if(iid){

    var found=
      ingredients.find(function(x){
        return x.id===iid;
      });

    if(found)
      return found;

  }

  var fallback=
    ingredients
      .map(function(x){

        return {
          x:x,
          s:similarity(
            x.name,
            gi.name
          )
        };

      })
      .sort(function(a,b){
        return b.s-a.s;
      })[0];

  return fallback
    ?fallback.x
    :null;

}

function convertQuantity(q,from,to){

  q=Number(q)||0;

  if(
    !from||
    !to||
    from===to
  )
    return q;

  var mass={
    g:1,
    kg:1000
  };

  var vol={
    ml:1,
    l:1000
  };

  if(
    mass[from]&&
    mass[to]
  )
    return q*mass[from]/mass[to];

  if(
    vol[from]&&
    vol[to]
  )
    return q*vol[from]/vol[to];

  return q;
}


/* ==========================================
   АВТОЗАПОЛНЕНИЕ
   ========================================== */

async function generateAll(){

  if(!catalog.length){

    msg(
      'База техкарт пуста. Сначала выполните recipe_database.sql в Supabase.',
      true
    );

    return;
  }

  var made=0;
  var skipped=0;
  var errors=0;

  $('generationSummary').textContent=
    'Сопоставление меню с базой техкарт…';

  for(
    var i=0;
    i<products.length;
    i++
  ){

    var p=products[i];

    try{

      var existing=
        await rpc(
          'manager_recipe_list',
          {
            p_venue_id:venueId,
            p_product_id:p.id
          }
        );

      if(
        Array.isArray(existing)&&
        existing.length
      ){

        skipped++;
        continue;

      }

      var best=
        catalog
          .map(function(c){

            return {
              c:c,
              s:similarity(
                p.name,
                c.name
              )
            };

          })
          .sort(function(a,b){
            return b.s-a.s;
          })[0];

      if(
        !best||
        best.s<.72
      ){

        skipped++;
        continue;

      }

      var ir=
        await db
          .from('global_recipe_catalog_items')
          .select(
            'ingredient_id,quantity,unit,note,ingredient:global_ingredient_catalog(id,name,unit)'
          )
          .eq(
            'recipe_id',
            best.c.id
          )
          .order('sort_order');

      if(ir.error)
        throw ir.error;

      var recipeRows=[];

      for(
        var j=0;
        j<(ir.data||[]).length;
        j++
      ){

        var it=ir.data[j];

        var local=
          await ensureLocalIngredient(it);

        if(!local)
          continue;

        recipeRows.push({

          ingredient_id:
            local.id,

          quantity:
            convertQuantity(
              it.quantity,
              it.unit||
              it.ingredient.unit,
              local.unit
            ),

          note:
            it.note||
            'Автотехкарта из базы'

        });

      }

      if(recipeRows.length){

        await rpc(
          'manager_product_recipe_save',
          {
            p_venue_id:venueId,
            p_product_id:p.id,
            p_rows:recipeRows
          }
        );

        made++;

      }else{

        skipped++;

      }

    }catch(e){

      console.error(
        '[generateAll]',
        p.name,
        e
      );

      errors++;

    }

  }

  await reloadIngredients();

  $('generationSummary').textContent=
    'Готово: создано '+
    made+
    '; пропущено '+
    skipped+
    '; ошибок '+
    errors+
    '. Существующие рецептуры не перезаписывались.';

  msg(
    made
      ?'Автозаполнение завершено.'
      :'Новых рецептур не создано. Проверьте названия блюд и базу техкарт.',
    !made
  );

}

$('generateAllBtn').onclick=function(){

  if(
    confirm(
      'Автозаполнить только пустые рецептуры подходящих позиций меню из базы стандартных техкарт? Существующие рецептуры не будут изменены.'
    )
  )
    generateAll()
      .catch(function(e){

        msg(
          'Ошибка генерации: '+e.message,
          true
        );

      });

};


/* ==========================================
   ИНДЕКС БАЗЫ БЛЮД
   ========================================== */

function buildCatalogIndex(){

  catalogIndex={};

  catalogItems.forEach(function(it){

    if(
      !catalogIndex[it.recipe_id]
    )
      catalogIndex[it.recipe_id]=[];

    if(it.ingredient)
      catalogIndex[it.recipe_id].push(
        it.ingredient.name
      );

  });

  var cats=
    [
      ...new Set(
        catalog
          .map(function(x){
            return x.category;
          })
          .filter(Boolean)
      )
    ].sort();

  var cuisines=
    [
      ...new Set(
        catalog
          .map(function(x){
            return x.cuisine;
          })
          .filter(Boolean)
      )
    ].sort();

  $('catalogCategory').innerHTML=
    '<option value="">Все категории</option>'+
    cats.map(function(x){

      return (
        '<option value="'+
        esc(x)+
        '">'+
        esc(x)+
        '</option>'
      );

    }).join('');

  $('catalogCuisine').innerHTML=
    '<option value="">Все кухни</option>'+
    cuisines.map(function(x){

      return (
        '<option value="'+
        esc(x)+
        '">'+
        esc(x)+
        '</option>'
      );

    }).join('');

}

function difficultyLabel(x){

  return ({
    easy:'Легко',
    medium:'Средне',
    hard:'Сложно'
  })[x]||x||'—';

}


/* ==========================================
   КАРТОЧКИ БАЗЫ БЛЮД
   ========================================== */

function renderCatalog(){

  var q=
    norm(
      $('catalogSearch').value
    );

  var cat=
    $('catalogCategory').value;

  var diff=
    $('catalogDifficulty').value;

  var cuisine=
    $('catalogCuisine').value;

  var arr=
    catalog.filter(function(c){

      var hay=
        norm(
          [
            c.name,
            c.description,
            c.cuisine,
            c.native_name
          ]
          .concat(
            catalogIndex[c.id]||[]
          )
          .join(' ')
        );

      return (
        (!q||hay.includes(q))&&
        (!cat||c.category===cat)&&
        (!diff||c.difficulty===diff)&&
        (!cuisine||c.cuisine===cuisine)
      );

    });

  $('catalogStats').textContent=
    'Показано '+
    arr.length+
    ' из '+
    catalog.length+
    ' рецептур';

  $('catalogList').innerHTML=

    arr.length

      ?arr.map(function(c){

        var photo=
          c.photo&&c.photo.url
            ?c.photo.url
            :'';

        var nutrition=
          c.nutrition_per_serving||{};

        var ingredientCount=
          (catalogIndex[c.id]||[])
            .length;

        return (

          '<div class="catalog-card" '+
          'tabindex="0" '+
          'role="button" '+
          'data-detail="'+
          esc(c.id)+
          '">'+

          (
            photo
              ?'<img class="catalog-photo" src="'+
               esc(photo)+
               '" alt="">'
              :''
          )+

          '<div class="badge2">'+
          esc(c.category||'Блюдо')+
          '</div>'+

          '<h4 style="margin:7px 0 3px">'+
          esc(c.name)+
          '</h4>'+

          '<div class="catalog-meta">'+

          (
            c.cuisine
              ?'<span class="badge2">'+
               esc(c.cuisine)+
               '</span>'
              :''
          )+

          (
            c.difficulty
              ?'<span class="badge2">'+
               esc(
                 difficultyLabel(
                   c.difficulty
                 )
               )+
               '</span>'
              :''
          )+

          (
            c.base_servings
              ?'<span class="badge2">'+
               esc(c.base_servings)+
               ' порц.</span>'
              :''
          )+

          '</div>'+

          '<div class="catalog-description">'+
          esc(
            c.description||
            'Стандартная техкарта'
          )+
          '</div>'+

          '<div class="catalog-output">'+
          'Выход: '+
          esc(c.yield_quantity||'—')+
          ' '+
          esc(
            unitLabel(c.yield_unit)
          )+

          (
            c.prep_minutes||
            c.cook_minutes
              ?' · '+
               esc(
                 (Number(c.prep_minutes)||0)+
                 (Number(c.cook_minutes)||0)
               )+
               ' мин'
              :''
          )+

          '</div>'+

          '<div class="catalog-output">'+
          'Состав: '+
          ingredientCount+
          ' ингредиентов'+

          (
            nutrition.calories
              ?' · '+
               esc(nutrition.calories)+
               ' ккал'
              :''
          )+

          '</div>'+

          '<button '+
          'type="button" '+
          'class="btn btn-primary btn-sm catalog-card-action" '+
          'data-detail-btn="'+
          esc(c.id)+
          '">'+
          'Открыть техкарту'+
          '</button>'+

          '</div>'
        );

      }).join('')

      :
      '<div class="empty-db muted">'+
      'Ничего не найдено.<br>'+
      '<span style="font-size:11px">Измените поисковый запрос или фильтры.</span>'+
      '</div>';

  Array.prototype.forEach.call(
    $('catalogList').querySelectorAll('[data-detail]'),
    function(card){

      card.onclick=function(e){

        if(
          e.target&&
          e.target.closest&&
          e.target.closest('button')
        )
          e.stopPropagation();

        var c=
          catalog.find(function(x){
            return x.id===
              card.dataset.detail;
          });

        if(c)
          openCatalogDetail(c);

      };

      card.onkeydown=function(e){

        if(
          e.key==='Enter'||
          e.key===' '
        ){

          e.preventDefault();

          var c=
            catalog.find(function(x){
              return x.id===
                card.dataset.detail;
            });

          if(c)
            openCatalogDetail(c);

        }

      };

    }
  );

}

$('catalogSearch').addEventListener(
  'input',
  renderCatalog
);

$('catalogCategory').addEventListener(
  'change',
  renderCatalog
);

$('catalogDifficulty').addEventListener(
  'change',
  renderCatalog
);

$('catalogCuisine').addEventListener(
  'change',
  renderCatalog
);


/* ==========================================
   ОКНО ПОЛНОЙ ТЕХКАРТЫ
   ========================================== */

function openCatalogDetail(c){

  $('catalogDetailModal').hidden=false;

  $('catalogDetailTitle').textContent=
    c.name;

  $('catalogDetailSub').textContent=
    [
      c.cuisine,
      c.difficulty
        ?difficultyLabel(c.difficulty)
        :'',
      c.native_name
    ]
    .filter(Boolean)
    .join(' · ');

  var items=
    catalogItems
      .filter(function(x){
        return x.recipe_id===c.id;
      })
      .sort(function(a,b){
        return (
          (a.sort_order||0)-
          (b.sort_order||0)
        );
      });

  var n=
    c.nutrition_per_serving||{};

  var photo=
    c.photo&&c.photo.url
      ?c.photo.url
      :'';

  var steps=
    Array.isArray(c.steps)
      ?c.steps
      :[];

  var source=

    '<div class="source-box">'+

    '<b>Источник:</b> '+
    esc(c.source||'—')+
    '<br>'+

    '<b>Лицензия:</b> '+
    esc(c.source_license||'—')+
    '<br>'+

    '<b>Атрибуция:</b> '+
    esc(c.source_attribution||'—')+

    (
      c.source_url
        ?'<br><b>Страница:</b> '+
         '<a href="'+
         esc(c.source_url)+
         '" target="_blank" rel="noopener">'+
         'Открыть источник</a>'
        :''
    )+

    '</div>';

  $('catalogDetailBody').innerHTML=

    '<div class="catalog-detail-grid">'+

    '<div>'+

    (
      photo
        ?'<img class="catalog-detail-photo" src="'+
         esc(photo)+
         '" alt="">'
        :'<div class="catalog-detail-photo"></div>'
    )+

    (
      c.description
        ?'<div class="detail-section">'+
         '<h4 style="margin-top:0">Описание</h4>'+
         '<div class="muted" style="line-height:1.6">'+
         esc(c.description)+
         '</div>'+
         '</div>'
        :''
    )+

    '<div class="detail-section">'+

    '<b>Основные параметры</b>'+

    '<div class="catalog-meta">'+

    (
      c.base_servings
        ?'<span class="badge2">'+
         'Базовый выход: '+
         esc(c.base_servings)+
         ' порц.</span>'
        :''
    )+

    (
      c.yield_quantity
        ?'<span class="badge2">'+
         'Выход: '+
         esc(c.yield_quantity)+
         ' '+
         esc(
           unitLabel(
             c.yield_unit
           )
         )+
         '</span>'
        :''
    )+

    '<span class="badge2">'+
    'Подготовка: '+
    esc(c.prep_minutes||0)+
    ' мин</span>'+

    '<span class="badge2">'+
    'Готовка: '+
    esc(c.cook_minutes||0)+
    ' мин</span>'+

    '</div>'+

    '</div>'+

    '<div class="detail-section">'+
    source+
    '</div>'+

    '</div>'+

    '<div>'+

    '<div class="detail-section" style="margin-top:0;padding-top:0;border-top:0">'+

    '<h4 style="margin-top:0">'+
    'Ингредиенты ('+
    items.length+
    ')'+
    '</h4>'+

    (
      items.length

        ?'<table class="detail-table">'+
         '<tr>'+
         '<th>Ингредиент</th>'+
         '<th>Количество</th>'+
         '<th>Примечание</th>'+
         '</tr>'+

         items.map(function(it){

           return (
             '<tr>'+
             '<td>'+
             esc(
               it.ingredient
                 ?it.ingredient.name
                 :'Ингредиент'
             )+
             '</td>'+

             '<td>'+
             esc(it.quantity)+
             ' '+
             esc(
               unitLabel(
                 it.unit||
                 (
                   it.ingredient&&
                   it.ingredient.unit
                 )
               )
             )+
             '</td>'+

             '<td class="muted">'+
             esc(it.note||'')+
             '</td>'+

             '</tr>'
           );

         }).join('')+

         '</table>'

        :'<div class="muted">'+
         'Ингредиенты в техкарте не указаны.'+
         '</div>'
    )+

    '</div>'+

    '<div class="detail-section">'+

    '<h4>Технология приготовления</h4>'+

    (
      steps.length

        ?steps.map(function(st,i){

          var text=
            typeof st==='string'
              ?st
              :(st.text&&st.text.ru)||
               st.text||
               '';

          var mins=
            typeof st==='object'
              ?st.minutes
              :'';

          return (
            '<div class="step-item">'+

            '<div class="step-num">'+
            (i+1)+
            '</div>'+

            '<div>'+
            esc(text)+
            '</div>'+

            '<div class="muted" style="font-size:11px">'+
            (
              mins
                ?esc(mins)+' мин'
                :''
            )+
            '</div>'+

            '</div>'
          );

        }).join('')

        :'<div class="muted">'+
         'Технология не указана.'+
         '</div>'
    )+

    '</div>'+

    '<div class="detail-section">'+

    '<h4>Пищевая ценность на порцию</h4>'+

    '<div class="catalog-meta">'+

    '<span class="badge2">'+
    'Калории: '+
    esc(n.calories||0)+
    ' ккал</span>'+

    '<span class="badge2">'+
    'Белки: '+
    esc(n.protein||0)+
    ' г</span>'+

    '<span class="badge2">'+
    'Жиры: '+
    esc(n.fat||0)+
    ' г</span>'+

    '<span class="badge2">'+
    'Углеводы: '+
    esc(n.carbs||0)+
    ' г</span>'+

    '</div>'+

    '</div>'+

    '<div class="import-bar">'+

    '<select id="catalogImportProduct">'+

    products.map(function(p){

      return (
        '<option value="'+
        esc(p.id)+
        '" '+
        (
          selected===p.id
            ?'selected'
            :''
        )+
        '>'+
        esc(p.name)+
        '</option>'
      );

    }).join('')+

    '</select>'+

    '<button class="btn btn-green" id="catalogImportBtn">'+
    'Импортировать в меню'+
    '</button>'+

    '</div>'+

    '</div>'+

    '</div>';

  $('catalogImportBtn').onclick=function(){

    var pid=
      $('catalogImportProduct').value;

    importCatalogToProduct(
      c,
      pid
    );

  };

}


/* ==========================================
   ИМПОРТ ТЕХКАРТЫ В МЕНЮ
   ========================================== */

async function importCatalogToProduct(c,pid){

  if(!pid){

    msg(
      'В меню нет выбранной позиции.',
      true
    );

    return;
  }

  var target=
    products.find(function(p){
      return p.id===pid;
    });

  if(!target)return;

  if(
    !confirm(
      'Импортировать техкарту «'+
      c.name+
      '» в «'+
      target.name+
      '»? Существующая рецептура будет заменена.'
    )
  )
    return;

  try{

    var ir=
      catalogItems
        .filter(function(x){
          return x.recipe_id===c.id;
        })
        .sort(function(a,b){
          return (
            (a.sort_order||0)-
            (b.sort_order||0)
          );
        });

    if(!ir.length)
      throw new Error(
        'У рецептуры нет ингредиентов'
      );

    var rr=[];

    for(
      var i=0;
      i<ir.length;
      i++
    ){

      var it=ir[i];

      var gi=it.ingredient;

      if(!gi)continue;

      var ranked=
        ingredients
          .map(function(x){

            return {
              x:x,
              s:similarity(
                x.name,
                gi.name
              )
            };

          })
          .sort(function(a,b){
            return b.s-a.s;
          })[0];

      var iid=
        ranked&&
        ranked.s>=.86
          ?ranked.x.id
          :null;

      if(!iid){

        var up=
          await rpc(
            'manager_ingredient_upsert',
            {
              p_venue_id:venueId,
              p_name:gi.name,
              p_unit:
                it.unit||
                gi.unit||
                'g',
              p_purchase_quantity:1,
              p_purchase_price:0,
              p_id:null
            }
          );

        iid=
          up&&up.id
            ?up.id
            :(Array.isArray(up)&&up[0]
              ?up[0].id
              :null);

        if(!iid){

          await reloadIngredients();

          var ni=
            ingredients.find(function(x){

              return similarity(
                x.name,
                gi.name
              )>=.95;

            });

          if(ni)
            iid=ni.id;

        }

      }

      if(iid){

        rr.push({

          ingredient_id:iid,

          quantity:
            convertQuantity(
              it.quantity,
              it.unit||
              gi.unit,
              (
                ingredients.find(function(x){
                  return x.id===iid;
                })||{}
              ).unit||
              it.unit||
              gi.unit
            ),

          note:it.note||''

        });

      }

    }

    if(!rr.length)
      throw new Error(
        'Не удалось сопоставить ингредиенты'
      );

    await rpc(
      'manager_product_recipe_save',
      {
        p_venue_id:venueId,
        p_product_id:pid,
        p_rows:rr
      }
    );

    selected=pid;

    $('catalogDetailModal').hidden=true;
    $('catalogModal').hidden=true;

    pick(pid);

    msg(
      'Техкарта «'+
      c.name+
      '» импортирована в «'+
      target.name+
      '».'
    );

  }catch(e){

    msg(
      'Ошибка импорта: '+(e.message||e),
      true
    );

  }

}


/* ==========================================
   СТАРАЯ ФУНКЦИЯ ПРИМЕНЕНИЯ ТЕХКАРТЫ
   ========================================== */

async function useCatalog(c){

  var best=
    products
      .map(function(p){

        return {
          p:p,
          s:similarity(
            p.name,
            c.name
          )
        };

      })
      .sort(function(a,b){
        return b.s-a.s;
      })[0];

  if(
    !best||
    best.s<.45
  ){

    msg(
      'Не удалось уверенно сопоставить техкарту с меню. Откройте нужное блюдо и выберите его вручную.',
      true
    );

    return;
  }

  if(
    !confirm(
      'Применить техкарту «'+
      c.name+
      '» к «'+
      best.p.name+
      '»?'
    )
  )
    return;

  $('catalogModal').hidden=true;

  try{

    var ir=
      await db
        .from('global_recipe_catalog_items')
        .select(
          'ingredient_id,quantity,unit,note,ingredient:global_ingredient_catalog(id,name,unit)'
        )
        .eq(
          'recipe_id',
          c.id
        );

    if(ir.error)
      throw ir.error;

    var rr=[];

    for(
      var i=0;
      i<ir.data.length;
      i++
    ){

      var it=ir.data[i];

      var gi=it.ingredient;

      if(!gi)continue;

      var local=
        ingredients
          .map(function(x){

            return {
              x:x,
              s:similarity(
                x.name,
                gi.name
              )
            };

          })
          .sort(function(a,b){
            return b.s-a.s;
          })[0];

      var iid=
        local&&
        local.s>=.86
          ?local.x.id
          :null;

      if(!iid){

        var up=
          await rpc(
            'manager_ingredient_upsert',
            {
              p_venue_id:venueId,
              p_name:gi.name,
              p_unit:
                it.unit||
                gi.unit||
                'g',
              p_purchase_quantity:1,
              p_purchase_price:0,
              p_id:null
            }
          );

        iid=
          up&&up.id
            ?up.id
            :null;

        await reloadIngredients();

        if(!iid){

          var ni=
            ingredients.find(function(x){

              return similarity(
                x.name,
                gi.name
              )>=.95;

            });

          if(ni)
            iid=ni.id;

        }

      }

      if(iid){

        rr.push({
          ingredient_id:iid,
          quantity:Number(
            it.quantity
          )||0,
          note:it.note||''
        });

      }

    }

    await rpc(
      'manager_product_recipe_save',
      {
        p_venue_id:venueId,
        p_product_id:best.p.id,
        p_rows:rr
      }
    );

    selected=best.p.id;

    pick(best.p.id);

    msg(
      'Техкарта применена к «'+
      best.p.name+
      '».'
    );

  }catch(e){

    msg(
      'Ошибка: '+e.message,
      true
    );

  }

}


/* ==========================================
   БАЗА ИНГРЕДИЕНТОВ
   ========================================== */

function ingredientIcon(category){

  var c=
    norm(category);

  if(
    c.includes('мяс')||
    c.includes('гов')||
    c.includes('свини')||
    c.includes('птиц')
  )
    return '🥩';

  if(
    c.includes('овощ')||
    c.includes('зел')
  )
    return '🥬';

  if(
    c.includes('молоч')
  )
    return '🥛';

  if(
    c.includes('рыб')||
    c.includes('мор')
  )
    return '🐟';

  if(
    c.includes('напит')
  )
    return '🥤';

  if(
    c.includes('спец')
  )
    return '🌿';

  if(
    c.includes('соус')
  )
    return '🥫';

  if(
    c.includes('круп')||
    c.includes('мук')
  )
    return '🌾';

  return '🧂';

}

function renderGlobalIngredients(){

  var q=
    norm(
      $('ingredientsSearch').value
    );

  var arr=
    globalIngredients.filter(function(x){

      return (
        !q||
        norm(x.name).includes(q)||
        norm(x.category).includes(q)
      );

    });

  $('ingredientsDbList').innerHTML=

    arr.length

      ?arr.map(function(x){

        return (

          '<div class="ingredient-db-card" '+
          'tabindex="0" '+
          'role="button" '+
          'data-ingredient-detail="'+
          esc(x.id)+
          '">'+

          '<div class="ingredient-db-icon">'+
          ingredientIcon(x.category)+
          '</div>'+

          '<h4>'+
          esc(x.name)+
          '</h4>'+

          '<div class="ingredient-db-unit">'+
          'Единица: '+
          esc(
            unitLabel(x.unit)
          )+
          '</div>'+

          (
            x.category
              ?'<div class="ingredient-db-category">'+
               '<span class="badge2">'+
               esc(x.category)+
               '</span>'+
               '</div>'
              :''
          )+

          '</div>'

        );

      }).join('')

      :

      '<div class="empty-db muted">'+
      'Ничего не найдено.<br>'+
      '<span style="font-size:11px">Измените поисковый запрос.</span>'+
      '</div>';

  Array.prototype.forEach.call(
    $('ingredientsDbList')
      .querySelectorAll(
        '[data-ingredient-detail]'
      ),
    function(card){

      card.onclick=function(){

        var x=
          globalIngredients.find(function(i){
            return i.id===
              card.dataset.ingredientDetail;
          });

        if(x)
          openIngredientDetail(x);

      };

      card.onkeydown=function(e){

        if(
          e.key==='Enter'||
          e.key===' '
        ){

          e.preventDefault();

          var x=
            globalIngredients.find(function(i){
              return i.id===
                card.dataset.ingredientDetail;
            });

          if(x)
            openIngredientDetail(x);

        }

      };

    }
  );

}

$('ingredientsSearch').addEventListener(
  'input',
  renderGlobalIngredients
);


/* ==========================================
   ОКНО ИНГРЕДИЕНТА
   ========================================== */

function openIngredientDetail(x){

  $('ingredientDetailModal').hidden=false;

  $('ingredientDetailTitle').textContent=
    x.name;

  $('ingredientDetailSub').textContent=
    [
      x.category,
      unitLabel(x.unit)
    ]
    .filter(Boolean)
    .join(' · ');

  var aliases=[];

  if(Array.isArray(x.aliases))
    aliases=x.aliases;

  else if(
    typeof x.aliases==='string'
  ){

    try{

      var parsed=
        JSON.parse(x.aliases);

      aliases=
        Array.isArray(parsed)
          ?parsed
          :[];

    }catch(_e){

      aliases=
        x.aliases
          .split(',')
          .map(function(a){
            return a.trim();
          })
          .filter(Boolean);

    }

  }

  var local=
    ingredients.find(function(i){

      return (
        similarity(
          i.name,
          x.name
        )>=.95
      );

    });

  $('ingredientDetailBody').innerHTML=

    '<div class="ingredient-detail-head">'+

    '<div class="ingredient-detail-icon">'+
    ingredientIcon(x.category)+
    '</div>'+

    '<div class="ingredient-detail-title">'+

    '<h3>'+
    esc(x.name)+
    '</h3>'+

    (
      x.category
        ?'<span class="badge2">'+
         esc(x.category)+
         '</span>'
        :''
    )+

    '</div>'+

    '</div>'+

    '<div class="db-detail-list">'+

    '<div class="db-detail-item">'+

    '<div class="db-detail-label">'+
    'Единица измерения'+
    '</div>'+

    '<div class="db-detail-value">'+
    esc(
      unitLabel(x.unit)||'—'
    )+
    '</div>'+

    '</div>'+

    (
      aliases.length
        ?'<div class="db-detail-item">'+
         '<div class="db-detail-label">Алиасы</div>'+
         '<div class="db-detail-value">'+
         aliases
           .map(function(a){
             return esc(a);
           })
           .join(', ')+
         '</div>'+
         '</div>'
        :''
    )+

    '</div>'+

    '<div class="import-bar">'+

    (
      local

        ?'<div style="flex:1">'+
         '<b>✓ Уже есть в заведении</b>'+
         '<div class="muted" style="font-size:11px;margin-top:3px">'+
         esc(local.name)+
         ' · закупочная цена '+
         Number(
           local.purchase_price||0
         ).toFixed(2)+
         ' ₽</div>'+
         '</div>'

        :'<div style="flex:1">'+
         '<b>Ингредиент ещё не добавлен</b>'+
         '<div class="muted" style="font-size:11px;margin-top:3px">'+
         'Можно добавить его в ингредиенты текущего заведения.</div>'+
         '</div>'
    )+

    (
      local

        ?'<button class="btn btn-ghost" id="editGlobalIngredientBtn">'+
         'Использовать в рецептуре'+
         '</button>'

        :'<button class="btn btn-green" id="addGlobalIngredientBtn">'+
         'Добавить в заведение'+
         '</button>'
    )+

    '</div>';

  if(local){

    $('editGlobalIngredientBtn').onclick=
      function(){

        $('ingredientDetailModal').hidden=true;

        $('iname').value=
          local.name;

        $('iunit').value=
          local.unit||
          x.unit||
          'g';

        $('iqty').focus();

        msg(
          'Ингредиент выбран. Укажите закупочное количество и цену.'
        );

      };

  }else{

    $('addGlobalIngredientBtn').onclick=
      function(){

        addGlobalIngredientToVenue(
          x
        );

      };

  }

}


/* ==========================================
   ДОБАВЛЕНИЕ ГЛОБАЛЬНОГО ИНГРЕДИЕНТА
   ========================================== */

async function addGlobalIngredientToVenue(x){

  var existing=
    ingredients.find(function(i){

      return similarity(
        i.name,
        x.name
      )>=.95;

    });

  if(existing){

    openIngredientDetail(x);

    return;

  }

  try{

    var result=
      await rpc(
        'manager_ingredient_upsert',
        {
          p_venue_id:venueId,
          p_name:x.name,
          p_unit:x.unit||'g',
          p_purchase_quantity:1,
          p_purchase_price:0,
          p_id:null
        }
      );

    await reloadIngredients();

    $('ingredientDetailModal').hidden=true;

    msg(
      'Ингредиент «'+
      x.name+
      '» добавлен в ингредиенты заведения. Укажите закупочную цену.'
    );

    $('iname').value=
      x.name;

    $('iunit').value=
      x.unit||
      'g';

    $('iqty').value='1';
    $('iprice').value='0';

  }catch(e){

    msg(
      'Ошибка добавления ингредиента: '+
      (e.message||e),
      true
    );

  }

}


/* ==========================================
   КНОПКИ ОТКРЫТИЯ БАЗ
   ========================================== */

$('catalogBtn').onclick=function(){

  $('catalogModal').hidden=false;

  renderCatalog();

};

$('ingredientsDbBtn').onclick=function(){

  $('ingredientsModal').hidden=false;

  renderGlobalIngredients();

};


/* ==========================================
   ЗАКРЫТИЕ МОДАЛОК
   ========================================== */

Array.prototype.forEach.call(
  document.querySelectorAll('[data-close]'),
  function(b){

    b.onclick=function(){

      var id=
        b.dataset.close;

      if($(id))
        $(id).hidden=true;

    };

  }
);


/* ==========================================
   ESC + КЛИК ПО ФОНУ
   ========================================== */

document.addEventListener(
  'keydown',
  function(e){

    if(e.key!=='Escape')
      return;

    Array.prototype.forEach.call(
      document.querySelectorAll('.modalx'),
      function(m){

        if(!m.hidden)
          m.hidden=true;

      }
    );

  }
);

Array.prototype.forEach.call(
  document.querySelectorAll('.modalx'),
  function(modal){

    modal.addEventListener(
      'click',
      function(e){

        if(e.target===modal)
          modal.hidden=true;

      }
    );

  }
);


/* ==========================================
   СМЕНА ЗАВЕДЕНИЯ
   ========================================== */

window.addEventListener(
  'message',
  function(e){

    if(
      e.origin!==
      window.location.origin
    )
      return;

    if(
      e.data&&
      e.data.type===
        'manager-venue-changed'&&
      e.data.venueId
    ){

      venueId=
        e.data.venueId;

      try{

        localStorage.setItem(
          'manager_venue_id',
          String(venueId)
        );

      }catch(_e){}

      loadAll();

    }

  }
);


/* ==========================================
   СТАРТ
   ========================================== */

loadAll();

})();
</script>

</body>
</html>
```
