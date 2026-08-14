async function getSession(){ const {data}=await db.auth.getSession(); return data.session; }
async function getProfile(){
  const s=await getSession(); if(!s) return null;
  const {data}=await db.from('profiles').select('*').eq('id',s.user.id).maybeSingle();
  return data;
}
function homeForRole(p){
  if(!p) return 'index.html';
  if(p.role==='admin') return 'admin.html';
  return 'manager.html';
}
async function requireAuth(roles){
  const p=await getProfile();
  if(!p){ location.replace('index.html'); return null; }
  if(roles && !roles.includes(p.role)){ location.replace(homeForRole(p)); return null; }
  return p;
}
async function logout(){ await db.auth.signOut(); location.replace('index.html'); }