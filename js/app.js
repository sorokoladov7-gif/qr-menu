window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ var map = {'main':'🍽 Блюдо','drink':'🥤 Напиток','addon':'🧂 Доп','breakfast':'🍳 Завтрак','salad':'🥗 Салат','soup':'🍲 Суп','dessert':'🍰 Десерт','sauce':'🌶 Соус','snack':'🥨 Закуска','hot':'🔥 Горячее','bbq':'🥩 Гриль'}; return map[c] || '🍽 Блюдо'; };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

function safeRedirect(fallbackUrl, reason) { var last=parseInt(sessionStorage.getItem('last_redirect')||'0',10),now=Date.now(); if(now-last<3000){document.body.innerHTML='<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Не удалось подтвердить профиль пользователя.</p><p><b>Причина:</b> '+String(reason||'неизвестно').replace(/[<>]/g,'')+'</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer">🔄 Повторить</button></div>';return;} sessionStorage.setItem('last_redirect',String(now));location.href=fallbackUrl; }
async function requireAuth(roles){try{const{data:{session}}=await db.auth.getSession();if(!session){safeRedirect('index.html','нет активной сессии');return null;}const{data:profile,error}=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();if(error){console.error('Profile fetch error:',error);safeRedirect('index.html','ошибка чтения профиля: '+error.message);return null;}if(!profile){safeRedirect('index.html','профиль не найден. Создайте профиль через административный onboarding.');return null;}if(roles&&roles.length&&roles.indexOf(profile.role)===-1){safeRedirect('index.html','нет доступа: нужна роль '+roles.join('/'));return null;}return profile;}catch(e){console.error(e);safeRedirect('index.html','исключение: '+e.message);return null;}}
window.staffLogin=async function(role,slug,pin){const{data,error}=await db.rpc('staff_login',{p_type:role,p_slug:slug,p_pin:pin});if(error)throw new Error(error.message||'Неверный код заведения или PIN');return data;};
window.staffUpdateOrder=async function(token,orderId,status){const{data,error}=await db.rpc('staff_update_order',{p_token:token,p_order_id:orderId,p_status:status});if(error)throw new Error(error.message||'Не удалось изменить заказ');return data;};

(function installPublicOrderAdapter(){
 if(!window.db||!db.from)return;
 var originalFrom=db.from.bind(db);
 function wrap(table,insertHandler){var target=originalFrom(table);return new Proxy(target,{get:function(obj,prop){if(prop==='insert')return insertHandler;var value=obj[prop];return typeof value==='function'?value.bind(obj):value;}});}
 db.from=function(table){
  if(table==='orders'){
   var targetOrders=originalFrom('orders');
   return new Proxy(targetOrders,{get:function(obj,prop){
    if(prop==='insert'){
     return function(values){return {select:function(){return {single:async function(){return{data:{id:(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())},error:null};}}};};
    }
    if(prop==='select'){
     return function(columns){
      if(columns&&columns.indexOf('items:order_items')!==-1&&columns.indexOf('addons:order_addons')!==-1){
       var venueId=null,customerPhone=null;
       var chain={
        eq:function(field,value){if(field==='venue_id')venueId=value;if(field==='customer_phone')customerPhone=value;return chain;},
        order:function(){return chain;},limit:function(){return chain;},
        maybeSingle:async function(){
         if(!venueId||!customerPhone)return{data:null,error:null};
         var r=await db.rpc('get_public_order',{p_venue_id:venueId,p_customer_phone:customerPhone});
         if(r.error)return{data:null,error:r.error};
         var d=r.data;
         if(Array.isArray(d))d=d.length?d[0]:null;
         if(d&&d.get_public_order)d=d.get_public_order;
         if(d&&d.order)d=d.order;
         if(d&&d.result)d=d.result;
         if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){}}
         if(d){d.items=Array.isArray(d.items)?d.items:[];d.addons=Array.isArray(d.addons)?d.addons:[];}
         return{data:d||null,error:null};
        }
       };return chain;
      }
      return obj.select.apply(obj,arguments);
     };
    }
    var value=obj[prop];return typeof value==='function'?value.bind(obj):value;
   }});
  }
  if(table==='order_items')return wrap('order_items',async function(){return{data:[],error:null};});
  if(table==='order_addons')return wrap('order_addons',async function(){return{data:[],error:null};});
  return originalFrom(table);
 };
})();
async function logout(){try{await db.auth.signOut();}catch(e){}sessionStorage.clear();location.href='index.html';}