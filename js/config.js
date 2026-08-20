const SUPABASE_URL = 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const baseDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = baseDb;

// Unified manager hall UI loader. Kept here so the existing manager.html
// does not need to be rewritten and the working cabinet remains untouched.
(function(){
  if (!/\/manager\.html$/i.test(location.pathname)) return;
  if (window.__managerHallLoader) return;
  window.__managerHallLoader = true;
  var s = document.createElement('script');
  s.src = '/js/manager-hall-view.js?v=4';
  s.async = false;
  document.head.appendChild(s);
})();
