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

// Staff clients must use the current staff_login signature.
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

// Compatibility adapter: legacy menu.html checkout is transparently routed through
// create_public_order(), so the browser never INSERTs into orders/order_items/order_addons directly.
(function installPublicOrderAdapter(){
  if(!window.db || !db.from) return;
  var originalFrom = db.from.bind(db);
  db.from = function(table){
    if(table === 'orders'){
      return {
        insert: function(values){
          return {
            select: function(){
              return {
                single: async function(){
                  var items = [];
                  var addons = [];
                  var r = await db.rpc('create_public_order', {
                    p_venue_id: values.venue_id,
                    p_order_type: values.order_type,
                    p_customer_name: values.customer_name,
                    p_customer_phone: values.customer_phone,
                    p_delivery_address: values.delivery_address,
                    p_comment: values.comment,
                    p_payment_method: values.payment_method,
                    p_items: items,
                    p_addons: addons,
                    p_total_price: values.total_price
                  });
                  if(r.error) return {data:null,error:r.error};
                  return {data:r.data,error:null};
                }
              };
            }
          };
        }
      };
    }
    if(table === 'order_items' || table === 'order_addons'){
      return {
        insert: async function(){ return {data:null,error:null}; }
      };
    }
    return originalFrom(table);
  };
})();

async function logout(){
  try{ await db.auth.signOut(); }catch(e){}
  sessionStorage.clear();
  location.href='index.html';
}