window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ return {main:'Блюдо',drink:'Напиток',addon:'Доп'}[c]||'Блюдо'; };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

async function requireAuth(roles){
  try{
    const { data:{ session } } = await db.auth.getSession();
    if(!session){ location.href='index.html'; return null; }
    const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if(!profile || (roles && roles.length && !roles.includes(profile.role))){ location.href='index.html'; return null; }
    return profile;
  }catch(e){ console.error(e); location.href='index.html'; return null; }
}
async function logout(){ await db.auth.signOut(); location.href='index.html'; }
