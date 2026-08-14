const PLANS={free:'Free',start:'Start',business:'Business',premium:'Premium',network:'Network'};
const PLAN_PRICE={free:0,start:990,business:2490,premium:4990,network:9990};
const PLAN_LIMITS={free:'До 10 позиций',start:'До 30 позиций',business:'До 100 позиций + аналитика',premium:'Безлимит + приоритет',network:'Сеть заведений'};
const STATUS_NAME={new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён'};
const STATUS_PROGRESS={new:15,cooking:45,ready:70,delivery:88,done:100,cancelled:0};
const STATUS_HINT={new:'Заказ передан на кухню',cooking:'Повар готовит ваш заказ…',ready:'Можно забирать! 🎉',delivery:'Курьер уже в пути',done:'Спасибо за заказ!',cancelled:'Заказ отменён'};
function fmt(n){return String(n||0).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function statusName(s){return STATUS_NAME[s]||s;}
function planName(p){return PLANS[p]||p;}
function planPrice(p){return PLAN_PRICE[p]||0;}
function slugify(t){
  const m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
  return t.toLowerCase().split('').map(c=>m[c]!==undefined?m[c]:c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function uuid(){ return crypto.randomUUID ? crypto.randomUUID() : 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2); }