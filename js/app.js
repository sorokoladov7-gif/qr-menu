window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c) { 
  var map = {
    'main': 'Блюдо',
    'drink': 'Напиток',
    'addon': 'Доп',
    'breakfast': 'Завтрак',
    'salad': 'Салат',
    'soup': 'Суп',
    'dessert': 'Десерт',
    'sauce': 'Соус',
    'snack': 'Закуска',
    'hot': 'Горячее',
    'bbq': 'Гриль'
  };
  return map[c] || 'Блюдо'; 
};
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

// ЗАЩИТА ОТ LOOP: если за последние 3 секунды уже был редирект - показываем ошибку вместо редиректа
function safeRedirect(fallbackUrl, reason) {
  var last = parseInt(sessionStorage.getItem('last_redirect') || '0', 10);
  var now = Date.now();
  if (now - last < 3000) {
    // LOOP DETECTED - показываем диагностическую страницу
    document.body.innerHTML = '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px">' +
      '<h2 style="color:#f87171">⚠️ Проблема с профилем</h2>' +
      '<p>Ваш email авторизован, но профиль не найден в базе данных.</p>' +
      '<p><b>Причина:</b> ' + (reason || 'неизвестно') + '</p>' +
      '<h3>Как исправить:</h3>' +
      '<ol>' +
      '<li>Откройте <a href="https://supabase.com/dashboard" target="_blank" style="color:#60a5fa">Supabase Dashboard</a></li>' +
      '<li>Перейдите в SQL Editor</li>' +
      '<li>Выполните SQL для восстановления профиля (инструкция ниже)</li>' +
      '</ol>' +
      '<details style="margin-top:20px;background:#111827;padding:15px;border-radius:8px">' +
      '<summary style="cursor:pointer;color:#60a5fa"><b>Показать SQL</b></summary>' +
      '<pre style="background:#0b1020;padding:15px;border-radius:8px;overflow:auto;font-size:12px;margin-top:10px;color:#9ca3af">' +
      'insert into profiles (id, email, display_name, role)\n' +
      "select id, email, email, 'manager'\n" +
      'from auth.users\n' +
      "where email = 'ВАШ-EMAIL'\n" +
      'on conflict (id) do nothing;</pre>' +
      '</details>' +
      '<button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">🔄 Очистить и попробовать снова</button>' +
      '<button onclick="db.auth.signOut().then(function(){sessionStorage.clear();location.href=\'/index.html\'})" style="margin-top:10px;margin-left:10px;padding:12px 24px;background:#374151;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Выйти и войти заново</button>' +
      '</div>';
    return;
  }
  sessionStorage.setItem('last_redirect', String(now));
  location.href = fallbackUrl;
}

async function requireAuth(roles){
  try{
    const { data:{ session } } = await db.auth.getSession();
    if(!session){ 
      safeRedirect('index.html', 'нет активной сессии'); 
      return null; 
    }
    const { data: profile, error } = await db.from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if(error){
      console.error('Profile fetch error:', error);
      safeRedirect('index.html', 'ошибка чтения профиля: ' + error.message);
      return null;
    }
    if(!profile){
      // Попытка автосоздания профиля
      const { data: newProfile, error: insertError } = await db.from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.display_name || session.user.email,
          role: 'manager'
        })
        .select()
        .single();
      
      if(insertError || !newProfile){
        safeRedirect('index.html', 'профиль не найден и не создан. Выполните SQL в Supabase');
        return null;
      }
      return newProfile;
    }
    if(roles && roles.length && roles.indexOf(profile.role) === -1){
      safeRedirect('index.html', 'нет доступа: нужна роль ' + roles.join('/') + ', у вас ' + profile.role);
      return null;
    }
    return profile;
  }catch(e){ 
    console.error(e); 
    safeRedirect('index.html', 'исключение: ' + e.message); 
    return null; 
  }
}

async function logout(){ 
  try{ await db.auth.signOut(); }catch(e){}
  sessionStorage.clear();
  location.href='index.html'; 
}
