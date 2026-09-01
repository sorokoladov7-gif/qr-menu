/* QR-Menu — общие утилиты для управляющего и администратора */
(function(){
  'use strict';
  if (window.__QR_UTILS__) return;
  window.__QR_UTILS__ = true;

  // Форматирование чисел
  window.fmt = function(v) {
    return Number(v || 0).toLocaleString('ru-RU');
  };

  // Экранирование HTML
  window.esc = function(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };

  // Транслитерация для slug
  window.slugify = function(v) {
    var m = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
      'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
      'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch',
      'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
    };
    return String(v || '').toLowerCase().trim()
      .replace(/[а-яё]/g, function(c){ return m[c] || ''; })
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  };

  // Статусы заказов
  window.statusName = function(s) {
    var map = {
      'new': 'Новый',
      'cooking': 'Готовится',
      'ready': 'Готов',
      'delivery': 'Доставка',
      'done': 'Выдан',
      'cancelled': 'Отменён'
    };
    return map[s] || s;
  };

  window.statusColor = function(s) {
    var map = {
      'new': '#60a5fa',
      'cooking': '#fbbf24',
      'ready': '#34d399',
      'delivery': '#a78bfa',
      'done': '#6ee7b7',
      'cancelled': '#f87171'
    };
    return map[s] || '#64748b';
  };

  window.categoryLabel = function(c) {
    var map = {
      'main': '🍽 Блюдо',
      'drink': '🥤 Напиток',
      'addon': '🧂 Доп',
      'breakfast': '🍳 Завтрак',
      'salad': '🥗 Салат',
      'soup': '🍲 Суп',
      'dessert': '🍰 Десерт',
      'sauce': '🌶 Соус',
      'snack': '🥨 Закуска',
      'hot': '🔥 Горячее',
      'bbq': '🥩 Гриль'
    };
    return map[c] || c;
  };

  window.fmtDate = function(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ru-RU'); }
    catch(e) { return '—'; }
  };

  // Сокращённое имя для полезных нагрузок
  window.norm = function(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  };

  // Копирование текста
  window.copyText = function(text, showToast) {
    try {
      navigator.clipboard.writeText(text);
      if (showToast) showToast('Скопировано');
    } catch(e) {
      prompt('Скопируйте:', text);
    }
  };

})();
