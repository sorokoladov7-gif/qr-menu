async function requireAuth(roles){
  try{
    const { data:{ session } } = await db.auth.getSession();
    if(!session){ location.href='index.html'; return null; }
    const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if(!profile || (roles && roles.length && !roles.includes(profile.role))){ location.href='index.html'; return null; }
    return profile;
  }catch(e){ console.error('auth error:', e); location.href='index.html'; return null; }
}
async function logout(){ await db.auth.signOut(); location.href='index.html'; }
