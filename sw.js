const CACHE = 'qr-platform-v11';
const CORE = [
  '/', '/index.html', '/login.html', '/register.html', '/menu.html', '/menu-v2.html', '/venues.html', '/hall.html',
  '/staff-table.html', '/staff-history.html', '/admin-analytics.html', '/admin-permissions.html', '/venue-analytics.html',
  '/tables.html', '/cook.html', '/manager.html', '/courier.html', '/waiter.html', '/admin.html', '/admin_templates.html',
  '/manager_templates_v2.html', '/staff-guide.html', '/manager-demo.html', '/demo-staff.html', '/robots.txt', '/sitemap.xml',
  '/css/style.css', '/js/config.js', '/js/app.js', '/js/auth.js', '/js/staff-auth.js', '/js/manager-hall.js',
  '/js/manager-tables.js', '/js/staff-table-flow.js', '/js/menu-table-flow.js', '/js/admin-design-access.js',
  '/js/design-runtime.js', '/js/pwa-install.js', '/js/offline-sync.js', '/manifest.webmanifest', '/manifest-admin.webmanifest',
  '/manifest-manager.webmanifest', '/manifest-cook.webmanifest', '/manifest-courier.webmanifest', '/manifest-waiter.webmanifest',
  '/icon-192.png', '/icon-512.png', '/icon-manager-192.png', '/icon-manager-512.png', '/icon-cook-192.png', '/icon-cook-512.png',
  '/icon-courier-192.png', '/icon-courier-512.png', '/icon-waiter-192.png', '/icon-waiter-512.png', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(url => c.add(url).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function enhanceHtml(r) {
  const text = await r.text();
  if (!/<\\/body>/i.test(text)) return new Response(text, {status:r.status,statusText:r.statusText,headers:r.headers});
  let extra = '';
  if (!/pwa-install\\.js/i.test(text)) extra += '<script src="/js/pwa-install.js"></script><script src="/js/offline-sync.js"></script>';
  if (/manager\\.html/i.test(self.registration.scope + new URL(r.url).pathname)) {
    extra += `<script>
(function(){
  'use strict';
  if(window.__QR_MANAGER_CREATE_BUTTON_FIX_V11__)return;
  window.__QR_MANAGER_CREATE_BUTTON_FIX_V11__=true;
  function getButtons(){
    var root=document.getElementById('app')||document.body;
    return Array.prototype.slice.call(root.querySelectorAll('button')).filter(function(b){
      var t=(b.textContent||'').replace(/\\s+/g,' ').trim();
      return /^\\+?\\s*Создать$/.test(t)||/^\\+?\\s*Создать\\s+заведение$/i.test(t);
    });
  }
  async function getLimit(){
    if(typeof db==='undefined'||!db.auth||typeof db.from!=='function')return null;
    var u=await db.auth.getUser();var uid=u&&u.data&&u.data.user&&u.data.user.id;
    if(!uid)return null;
    var s=await db.from('subscriptions').select('id,plan_id,status,current_period_end').eq('manager_id',uid).is('venue_id',null).in('status',['trialing','active']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(s.error||!s.data)return null;
    if(!s.data.current_period_end||new Date(s.data.current_period_end)<new Date())return {allowed:false,limit:0,count:0};
    var p=await db.from('plans').select('id,max_venues,is_active').eq('id',s.data.plan_id).eq('is_active',true).maybeSingle();
    if(p.error||!p.data)return null;
    var c=await db.from('manager_venues').select('venue_id',{count:'exact',head:true}).eq('manager_id',uid);
    if(c.error)return null;
    var limit=Number(p.data.max_venues||0),count=Number(c.count||0);
    return {allowed:limit>count,limit:limit,count:count,plan:s.data.plan_id};
  }
  async function sync(){
    try{
      var state=await getLimit();
      if(!state)return;
      getButtons().forEach(function(b){
        b.disabled=!state.allowed;
        b.style.opacity=state.allowed?'1':'';
        b.style.cursor=state.allowed?'pointer':'';
        b.removeAttribute('aria-disabled');
        if(state.allowed)b.title='Создать заведение. Доступно: '+Math.max(0,state.limit-state.count)+' из '+state.limit;
        else b.title='Достигнут лимит заведений по тарифу';
      });
    }catch(e){console.warn('[QR Manager] create button fix:',e);}
  }
  var obs=new MutationObserver(function(){
    clearTimeout(window.__QR_MANAGER_CREATE_BUTTON_TIMER__);
    window.__QR_MANAGER_CREATE_BUTTON_TIMER__=setTimeout(sync,50);
  });
  function start(){obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});sync();setTimeout(sync,1000);setTimeout(sync,3000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>`;
  }
  return new Response(text.replace(/<\\/body>/i, extra + '</body>'), {status:r.status,statusText:r.statusText,headers:r.headers});
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/supabase|qrserver|fonts\\.googleapis|fonts\\.gstatic/.test(u.hostname)) return;
  e.respondWith(fetch(e.request).then(async r => {
    const out = r.headers.get('content-type')?.includes('text/html') ? await enhanceHtml(r.clone()) : r.clone();
    caches.open(CACHE).then(c => c.put(e.request,out.clone())).catch(() => {});
    return out;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
