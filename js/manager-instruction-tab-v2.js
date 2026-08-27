/* QR Menu — manager instruction as a real in-cabinet tab. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_INSTRUCTION_TAB_V3__) return;
  window.__QR_MANAGER_INSTRUCTION_TAB_V3__=true;

  var active=false, panel=null, button=null, host=null;
  var sections=[
    ['overview','🏠','Как начать','Пошаговая работа управляющего с заведением.'],
    ['menu','🍽️','Меню','Категории, блюда, цены, фото и доступность.'],
    ['orders','📦','Заказы','Новые, готовящиеся, готовые, доставка и история.'],
    ['analytics','📊','Аналитика','Выручка, заказы, средний чек, позиции и часы.'],
    ['hall','🪑','Зал / Столы','Столы, посадка, резервы и активные сессии.'],
    ['staff','👥','Персонал','Повара, курьеры, официанты, PIN и лимиты.'],
    ['billing','💳','Тарифы','Тариф, срок подписки, лимиты и продление.'],
    ['settings','⚙️','Настройки','Основные данные выбранного заведения.'],
    ['delivery','🚚','Доставка','Включение, координаты, тариф, радиус и условия.'],
    ['design','🎨','Дизайн','Фирменное оформление клиентского меню.'],
    ['sbp','💰','СБП','Подключение и проверка онлайн-оплаты.']
  ];
  var data={
    overview:[['1. Выберите заведение','При нескольких заведениях сначала откройте нужное. Все изменения относятся только к выбранному заведению.'],['2. Настройте заведение','Проверьте название, описание, адрес, телефон, сайт, часы работы и логотип.'],['3. Заполните меню','Создайте категории и позиции, укажите цены, описания, фотографии и наличие.'],['4. Настройте доставку','Включайте её только если заведение действительно принимает доставку. Проверьте адрес и координаты.'],['5. Добавьте персонал','Создайте поваров, курьеров и официантов и передайте им данные входа.'],['6. Контролируйте работу','Используйте Заказы, Зал / Столы и Аналитику для ежедневного контроля.']],
    menu:[['Позиция','Название, описание, цена, категория, фотография и доступность.'],['Категории','Используйте понятные категории: закуски, салаты, горячее, напитки, десерты и т. д.'],['Доступность','Временно закончившееся блюдо лучше отключить, а не удалять.'],['Цены','Изменение цены применяется к новым заказам. Старые заказы не должны пересчитываться.'],['Импорт','После импорта сайта обязательно проверьте позиции, цены и категории вручную.']],
    orders:[['Новые','Проверьте состав, комментарий, тип заказа и способ оплаты.'],['Статусы','Отслеживайте движение заказа по рабочему процессу кухни и доставки.'],['Доставка','Проверьте адрес, телефон, сумму и стоимость доставки.'],['СБП','При онлайн-оплате контролируйте состояние платежа отдельно.'],['История','История заказов используется для контроля и аналитики.']],
    analytics:[['Выручка','Сумма завершённых продаж за выбранный период.'],['Заказы','Количество и структура заказов показывают загрузку заведения.'],['Средний чек','Помогает оценивать продажи и эффективность предложений.'],['Популярные позиции','Используйте данные для управления ассортиментом.'],['Пиковые часы','Помогают планировать загрузку кухни и персонала.']],
    hall:[['Свободный стол','Откройте сессию, когда гость занимает стол.'],['Занятый стол','Смотрите активную сессию и связанные заказы.'],['Освобождение','Не закрывайте стол до завершения связанных заказов.'],['Резерв','Используйте резервирование для планируемых посадок.']],
    staff:[['Повара','Работают с кухней и статусами приготовления.'],['Курьеры','Получают заказы доставки и меняют их статусы.'],['Официанты','Работают с залом, столами и выдачей заказов.'],['PIN','При необходимости PIN сотрудника можно сбросить.'],['Лимиты','Количество сотрудников определяется тарифом.']],
    billing:[['Тариф','Показывает активный план и срок подписки.'],['Лимиты','Тариф определяет количество заведений, позиций и сотрудников.'],['Продление','После успешной оплаты срок подписки обновляется.'],['Данные','Смена тарифа не должна удалять меню или историю заказов.']],
    settings:[['Основные данные','Название, описание, телефон, сайт и часы работы.'],['Адрес','Указывайте полный точный адрес. Координаты используются для доставки.'],['Логотип','Используйте качественное изображение.'],['Сохранение','После изменения дождитесь сообщения о сохранении.']],
    delivery:[['Включение','Включайте доставку только для заведения, которое принимает доставку.'],['Координаты','Используются для расчёта расстояния до клиента.'],['Базовая стоимость','Фиксированная стоимость доставки.'],['За километр','Доплата за расстояние при включённой настройке.'],['Максимальная зона','Ограничивает допустимое расстояние.'],['Минимальный заказ','Задаёт минимальную сумму заказа.'],['Бесплатная доставка','Определяет сумму, начиная с которой доставка бесплатна.'],['Проверка','После сохранения протестируйте оформление заказа как клиент.']],
    design:[['Цвета','Используйте фирменные цвета заведения.'],['Логотип','Проверьте отображение на мобильном экране.'],['Предпросмотр','После изменений откройте публичное меню и проверьте результат.'],['Важно','Меняйте дизайн через настройки кабинета.']],
    sbp:[['Подключение','Запустите подключение ЮKassa из раздела СБП.'],['Отдельный СБП','Используется выбранным заведением.'],['Общий СБП','Один магазин может использоваться несколькими заведениями.'],['Приоритет','Активный отдельный СБП имеет приоритет перед общим.'],['Безопасность','Секретные ключи не должны храниться в браузере.'],['Проверка','После подключения выполните тестовый заказ с СБП.']]
  };
  function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c];});}
  function ensure(){
    var wrap=document.querySelector('.wrap'), tabs=document.querySelector('.tabs');
    if(!wrap||!tabs)return false;
    host=wrap;
    if(!panel){
      panel=document.createElement('section');
      panel.id='manager-instruction-panel';
      panel.style.cssText='display:none;margin:0 0 18px;';
      tabs.insertAdjacentElement('afterend',panel);
    }
    if(!button){
      button=[].slice.call(tabs.querySelectorAll('button')).find(function(x){return /Инструкция/.test(x.textContent||'');});
      if(button){
        button.setAttribute('data-manager-instruction-tab','1');
        button.__qrInstructionBound=true;
        button.addEventListener('click',function(e){
          e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
          active=true;show();
        },true);
      }
    }
    return !!button;
  }
  function render(){
    if(!panel)return;
    var key=window.__QR_MANAGER_INSTRUCTION_SECTION__||'overview';
    var item=sections.find(function(x){return x[0]===key;})||sections[0];
    var blocks=data[key]||[];
    panel.innerHTML='<div class="glass card" style="padding:24px;max-width:1100px;margin:0 auto">'+
      '<div style="font-size:12px;color:#94a3b8;letter-spacing:.08em">РУКОВОДСТВО УПРАВЛЯЮЩЕГО</div>'+\
      '<h2 style="margin:5px 0 8px">'+item[1]+' '+esc(item[2])+'</h2>'+\
      '<p class="muted" style="line-height:1.6">'+esc(item[3])+'</p>'+\
      '<div data-it-nav style="display:flex;gap:7px;flex-wrap:wrap;margin:20px 0">'+sections.map(function(s){return '<button type="button" class="btn btn-sm '+(s[0]===key?'btn-primary':'btn-ghost')+'" data-it-section="'+s[0]+'">'+s[1]+' '+esc(s[2])+'</button>';}).join('')+'</div>'+\
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">'+blocks.map(function(x){return '<div style="border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;background:rgba(255,255,255,.02)"><div style="font-weight:800;margin-bottom:7px">'+esc(x[0])+'</div><div class="muted" style="font-size:13px;line-height:1.65">'+esc(x[1])+'</div></div>';}).join('')+'</div></div>';
    panel.querySelectorAll('[data-it-section]').forEach(function(b){b.onclick=function(e){e.preventDefault();window.__QR_MANAGER_INSTRUCTION_SECTION__=b.getAttribute('data-it-section');render();};});
  }
  function show(){
    if(!panel) return;
    document.querySelectorAll('.wrap > .glass.card, .wrap > .glass:not(#manager-instruction-panel)').forEach(function(el){
      if(el!==panel && el!==document.querySelector('.stats')){el.setAttribute('data-it-hidden','1');el.style.display='none';}
    });
    var tabs=document.querySelector('.tabs');if(tabs)tabs.style.display='none';
    panel.style.display='block';render();
  }
  function hideIfOtherTab(){
    if(!active||!panel)return;
    var clicked=document.activeElement;
    if(clicked&&button&&clicked!==button&&clicked.closest&&clicked.closest('.tabs')&&/Инструкция/.test(clicked.textContent||'')===false){
      active=false;panel.style.display='none';var tabs=document.querySelector('.tabs');if(tabs)tabs.style.display='flex';document.querySelectorAll('[data-it-hidden]').forEach(function(el){el.style.display='';el.removeAttribute('data-it-hidden');});
    }
  }
  function install(){if(!ensure())return;document.addEventListener('click',hideIfOtherTab,true);}
  function start(){install();setInterval(install,700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
