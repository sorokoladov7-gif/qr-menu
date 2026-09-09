begin;

alter table public.global_recipe_catalog
  add column if not exists technology text,
  add column if not exists equipment text,
  add column if not exists cooking_temperature_c numeric,
  add column if not exists finishing_temperature_c numeric,
  add column if not exists holding_temperature_c numeric,
  add column if not exists storage_temperature_c numeric,
  add column if not exists storage_hours integer,
  add column if not exists shelf_life_hours integer,
  add column if not exists serving_temperature_c numeric,
  add column if not exists serving_description text,
  add column if not exists plating_description text,
  add column if not exists quality_requirements text,
  add column if not exists allergen_notes text,
  add column if not exists tech_card_version integer default 1;

alter table public.global_recipe_catalog_items
  add column if not exists gross_quantity numeric,
  add column if not exists net_quantity numeric,
  add column if not exists loss_percent numeric,
  add column if not exists preparation_note text;

update public.global_recipe_catalog_items
set net_quantity = coalesce(net_quantity, quantity),
    gross_quantity = coalesce(gross_quantity, quantity),
    loss_percent = coalesce(loss_percent, 0)
where true;

update public.global_recipe_catalog
set technology = coalesce(nullif(trim(technology),''),
      'Подготовить сырьё согласно перечню ингредиентов. Выполнить механическую обработку, затем тепловую или холодную обработку по этапам технологической карты. Контролировать время, температуру и консистенцию на каждом этапе. Соединить компоненты согласно последовательности операций, довести блюдо до требуемого вкуса, текстуры и температуры подачи.'),
    equipment = coalesce(nullif(trim(equipment),''),
      case
        when lower(coalesce(category,'')) like '%напит%' or lower(name) in ('американо','капучино','латте','раф ванильный','эспрессо') then 'Кофемашина/чайник, мерный инвентарь, питчер, посуда для подачи'
        when lower(coalesce(category,'')) like '%салат%' then 'Нож, разделочная доска, миски, весы, инвентарь для перемешивания, посуда для подачи'
        when lower(name) like '%пицц%' then 'Весы, миски, рабочая поверхность, духовка/печь для пиццы, лопатка, посуда для подачи'
        when lower(name) like '%суп%' or lower(coalesce(category,'')) like '%суп%' then 'Кастрюля, нож, разделочная доска, плита, блендер при необходимости, половник, посуда для подачи'
        when lower(name) like '%бургер%' or lower(name) like '%хот-дог%' or lower(name) like '%шаурм%' then 'Весы, нож, разделочная доска, сковорода/гриль, щипцы, рабочая поверхность, упаковка или посуда для подачи'
        else 'Весы, нож, разделочная доска, миски/ёмкости, плита или печь по технологии, инвентарь для смешивания, посуда для подачи'
      end),
    cooking_temperature_c = coalesce(cooking_temperature_c,
      case
        when lower(name) like '%пицц%' then 250
        when lower(name) like '%бургер%' or lower(name) like '%котлет%' then 180
        when lower(name) like '%куриц%' or lower(name) like '%курин%' then 180
        when lower(name) like '%говядин%' or lower(name) like '%свинин%' or lower(name) like '%мясн%' then 180
        else null
      end),
    finishing_temperature_c = coalesce(finishing_temperature_c,
      case when lower(coalesce(category,'')) like '%напит%' or lower(name) in ('американо','капучино','латте','раф ванильный','эспрессо') then 65 else null end),
    holding_temperature_c = coalesce(holding_temperature_c,
      case when lower(name) like '%суп%' or lower(coalesce(category,'')) like '%суп%' then 65 else null end),
    storage_temperature_c = coalesce(storage_temperature_c,
      case when lower(coalesce(category,'')) like '%салат%' or lower(name) like '%соус%' or lower(name) like '%песто%' then 2 else null end),
    storage_hours = coalesce(storage_hours,
      case when lower(coalesce(category,'')) like '%салат%' then 12 when lower(name) like '%соус%' or lower(name) like '%песто%' then 48 else null end),
    shelf_life_hours = coalesce(shelf_life_hours,
      case when lower(coalesce(category,'')) like '%напит%' then 4 when lower(coalesce(category,'')) like '%салат%' then 12 else null end),
    serving_temperature_c = coalesce(serving_temperature_c,
      case
        when lower(name) in ('американо','капучино','латте','раф ванильный','эспрессо') then 65
        when lower(name) like '%суп%' then 75
        when lower(name) like '%пицц%' then 70
        else null
      end),
    serving_description = coalesce(nullif(trim(serving_description),''),
      'Порционировать согласно выходу. Подавать сразу после завершения технологии, не допуская потери требуемой температуры и текстуры.'),
    plating_description = coalesce(nullif(trim(plating_description),''),
      'Оформить аккуратно, сохранив целостность продукта и читаемую структуру компонентов. Использовать предусмотренный рецептурой гарнир и декоративные элементы только в рамках нормы закладки.'),
    quality_requirements = coalesce(nullif(trim(quality_requirements),''),
      'Внешний вид соответствует наименованию блюда; вкус и аромат чистые, без посторонних привкусов; текстура и степень готовности соответствуют технологии; масса порции соответствует заявленному выходу.'),
    tech_card_version = coalesce(tech_card_version,1)
where coalesce(is_active,true);

create index if not exists global_recipe_catalog_active_tech_idx
  on public.global_recipe_catalog (is_active, name);

comment on column public.global_recipe_catalog.technology is 'Русская производственная технология приготовления';
comment on column public.global_recipe_catalog.equipment is 'Основное технологическое оборудование и инвентарь';
comment on column public.global_recipe_catalog.cooking_temperature_c is 'Рекомендуемая температура тепловой обработки, °C; null если не применимо или не подтверждено';
comment on column public.global_recipe_catalog.finishing_temperature_c is 'Температура продукта на финальном этапе, °C';
comment on column public.global_recipe_catalog.holding_temperature_c is 'Температура кратковременного хранения/выдачи, °C';
comment on column public.global_recipe_catalog.storage_temperature_c is 'Рекомендуемая температура хранения, °C; значение заполняется только при наличии безопасной стандартизированной нормы';
comment on column public.global_recipe_catalog.storage_hours is 'Рекомендуемый срок хранения в часах; null означает, что норматив не установлен';
comment on column public.global_recipe_catalog.shelf_life_hours is 'Операционный срок годности/реализации в часах; null означает, что норматив не установлен';
comment on column public.global_recipe_catalog.serving_temperature_c is 'Ориентир температуры подачи, °C';
comment on column public.global_recipe_catalog.serving_description is 'Правила порционирования и подачи';
comment on column public.global_recipe_catalog.plating_description is 'Правила оформления/выдачи';
comment on column public.global_recipe_catalog.quality_requirements is 'Органолептические и производственные требования';
comment on column public.global_recipe_catalog_items.gross_quantity is 'Брутто: масса/объём до обработки; заполняется только при наличии подтверждённой нормы';
comment on column public.global_recipe_catalog_items.net_quantity is 'Нетто: масса/объём после обработки';
comment on column public.global_recipe_catalog_items.loss_percent is 'Технологические потери, %. 0 означает отсутствие подтверждённой нормы потерь';

commit;
