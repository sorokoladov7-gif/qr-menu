window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',arrived:'📍 Курьер на месте',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',arrived:'#f472b6',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ return ({main:'🍽 Блюдо',drink:'🥤 Напиток',addon:'🧂 Доп',breakfast:'🍳 Завтрак',salad:'🥗 Салат',soup:'🍲 Суп',dessert:'🍰 Десерт',sauce:'🌶 Соус',snack:'🥨 Закуска',hot:'🔥 Горячее',bbq:'🥩 Гриль'}[c]||'🍽 Блюдо'); };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

function safeRedirect(fallbackUrl, reason) {
  var last = parseInt(sessionStorage.getItem('last_redirect') || '0', 10), now = Date.now();
  if (now - last < 3000) {
    document.body.innerHTML = '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Ваш email авторизован, но профиль не найден в базе данных.</p><p><b>Причина:</b> '+(reason||'неизвестно')+'</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px">🔄 Очистить и попробовать снова</button></div>';
    return;
  }
  sessionStorage.setItem('last_redirect',String(now)); location.href=fallbackUrl;
}

async function requireAuth(roles){
  try{
    const {data:{session}} = await db.auth.getSession();
    if(!session){safeRedirect('index.html','нет активной сессии');return null;}
    const {data:profile,error} = await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(error){console.error('Profile fetch error:',error);safeRedirect('index.html','ошибка чтения профиля: '+error.message);return null;}
    if(!profile){
      const {data:newProfile,error:insertError} = await db.from('profiles').insert({id:session.user.id,email:session.user.email,display_name:session.user.user_metadata?.display_name||session.user.email,role:'manager'}).select().single();
      if(insertError||!newProfile){safeRedirect('login.html','профиль не найден и не создан. Выполните SQL в Supabase');return null;}
      return newProfile;
    }
    if(roles && roles.length && roles.indexOf(profile.role)===-1){safeRedirect('login.html','нет доступа: нужна роль '+roles.join('/')+', у вас '+profile.role);return null;}
    return profile;
  }catch(e){console.error(e);safeRedirect('login.html','исключение: '+e.message);return null;}
}

async function logout(){
  try{await db.auth.signOut();}catch(e){}
  sessionStorage.clear();
  location.href='/login.html';
}

(function(){
  'use strict';
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  var lastVenueId=null, lastFee=null;
  function sync(){
    var el=document.getElementById('app');
    if(!el) return;
    try{
      var vm=el.__vueParentComponent?.proxy||el.vue_app?._instance?.proxy||null;
      if(!vm||!vm.venue) return;
      var id=vm.venue.id, raw=vm.venue.delivery_fee;
      var fee=raw===null||raw===undefined||raw===''?150:Number(raw);
      if(!isFinite(fee)||fee<0) fee=150;
      if(id!==lastVenueId||fee!==lastFee){window.DELIVERY_FEE=fee;lastVenueId=id;lastFee=fee;}
    }catch(e){}
  }
  if(typeof window.DELIVERY_FEE==='undefined') window.DELIVERY_FEE=150;
  function start(){sync();setInterval(sync,250);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
