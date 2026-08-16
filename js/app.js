window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){
  var map = {'main':'🍽 Блюдо','drink':'🥤 Напиток','addon':'🧂 Доп','breakfast':'🍳 Завтрак','salad':'🥗 Салат','soup':'🍲 Суп','dessert':'🍰 Десерт','sauce':'🌶 Соус','snack':'🥨 Закуска','hot':'🔥 Горячее','bbq':'🥩 Гриль'};
  return map[c] || '🍽 Блюдо';
};
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

function safeRedirect(fallbackUrl, reason) {
  var last = parseInt(sessionStorage.getItem('last_redirect') || '0', 10), now = Date.now();
  if (now - last < 3000) {
    document.body.innerHTML = '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Не удалось подтвердить профиль пользователя.</p><p><b>Причина:</b> ' + String(reason || 'неизвестно').replace(/[<>]/g,'') + '</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer">🔄 Повторить</button></div>';
    return;
  }
  sessionStorage.setItem('last_redirect', String(now));
  location.href = fallbackUrl;
}

async function requireAuth(roles){
  try{
    const { data:{ session } } = await db.auth.getSession();
    if(!session){ safeRedirect('index.html', 'нет активной сессии'); return null; }
    const { data: profile, error } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if(error){ console.error('Profile fetch error:', error); safeRedirect('index.html', 'ошибка чтения профиля: ' + error.message); return null; }
    if(!profile){
      safeRedirect('index.html', 'профиль не найден. Создайте профиль через административный onboarding.');
      return null;
    }
    if(roles && roles.length && roles.indexOf(profile.role) === -1){ safeRedirect('index.html', 'нет доступа: нужна роль ' + roles.join('/')); return null; }
    return profile;
  }catch(e){ console.error(e); safeRedirect('index.html', 'исключение: ' + e.message); return null; }
}

window.staffLogin = async function(role, slug, pin){
  const { data, error } = await db.rpc('staff_login', { p_type: role, p_slug: slug, p_pin: pin });
  if(error) throw new Error(error.message || 'Неверный код заведения или PIN');
  return data;
};
window.staffUpdateOrder = async function(token, orderId, status){
  const { data, error } = await db.rpc('staff_update_order', { p_token: token, p_order_id: orderId, p_status: status });
  if(error) throw new Error(error.message || 'Не удалось изменить заказ');
  return data;
};

(function installPublicOrderAdapter(){
  if(!window.db || !db.from) return;
  var originalFrom = db.from.bind(db);
  var pending = null;

  function wrap(table, insertHandler){
    var target = originalFrom(table);
    return new Proxy(target, {
      get: function(obj, prop){
        if(prop === 'insert') return insertHandler;
        var value = obj[prop];
        return typeof value === 'function' ? value.bind(obj) : value;
      }
    });
  }

  db.from = function(table){
    if(table === 'orders'){
      return wrap('orders', function(values){
        pending = {values: values, actualOrderId: null};
        return {
          select: function(){
            return {
              single: async function(){
                var fakeId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
                return {data:{id:fakeId},error:null};
              }
            };
          }
        };
      });
    }

    if(table === 'order_items'){
      return wrap('order_items', async function(itemRows){
        if(!pending) return {data:null,error:null};
        var items=(itemRows||[]).map(function(i){return {product_id:i.product_id,qty:Number(i.qty)||0};});
        var v=pending.values;
        var r=await db.rpc('create_public_order',{
          p_venue_id:v.venue_id,p_order_type:v.order_type,p_customer_name:v.customer_name,
          p_customer_phone:v.customer_phone,p_delivery_address:v.delivery_address,
          p_comment:v.comment,p_payment_method:v.payment_method,p_items:items,
          p_addons:[],p_total_price:v.total_price
        });
        if(r.error) return {data:null,error:r.error};
        pending.actualOrderId=r.data&&r.data.id;
        return {data:itemRows,error:null};
      });
    }

    if(table === 'order_addons'){
      return wrap('order_addons', async function(addonRows){
        if(!pending || !pending.actualOrderId || !addonRows || !addonRows.length) return {data:addonRows||[],error:null};
        var grouped={};
        addonRows.forEach(function(a){
          var key=a.name+'|'+(a.item_name||'');
          if(!grouped[key]) grouped[key]={id:null,name:a.name,item_name:a.item_name||null,qty:0};
          grouped[key].qty++;
        });
        var list=Object.keys(grouped).map(function(k){return grouped[k]});
        var venueId=pending.values.venue_id;
        var productsResult=await originalFrom('products').select('id,name').eq('venue_id',venueId).eq('category','addon').eq('is_available',true);
        if(productsResult.error) return {data:null,error:productsResult.error};
        list.forEach(function(a){var p=(productsResult.data||[]).find(function(x){return x.name===a.name});if(p)a.id=p.id;});
        list=list.filter(function(a){return a.id;});
        var r=await db.rpc('append_public_order_addons',{
          p_order_id:pending.actualOrderId,p_customer_phone:pending.values.customer_phone,p_addons:list
        });
        if(r.error) return {data:null,error:r.error};
        return {data:addonRows,error:null};
      });
    }

    return originalFrom(table);
  };
})();

async function logout(){
  try{ await db.auth.signOut(); }catch(e){}
  sessionStorage.clear();
  location.href='index.html';
}