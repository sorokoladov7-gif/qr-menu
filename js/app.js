// ===== СТАТУСЫ ЗАКАЗОВ =====
const STATUS_NAME={new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён'};
const STATUS_PROGRESS={new:15,cooking:45,ready:70,delivery:88,done:100,cancelled:0};
const STATUS_HINT={new:'Заказ передан на кухню',cooking:'Повар готовит ваш заказ…',ready:'Можно забирать! 🎉',delivery:'Курьер уже в пути',done:'Спасибо за заказ!',cancelled:'Заказ отменён'};

// ===== УТИЛИТЫ =====
function fmt(n){return String(n||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function statusName(s){return STATUS_NAME[s]||s;}

// Транслитерация для slug (ЧПУ-ссылок)
function slugify(t){
  const m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
  return t.toLowerCase().split('').map(c=>m[c]!==undefined?m[c]:c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

// Генерация UUID
function uuid(){return crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);}

// ===== КОНСТАНТЫ ДЛЯ КЛИЕНТА =====
const DELIVERY_FEE = 150;
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400';
