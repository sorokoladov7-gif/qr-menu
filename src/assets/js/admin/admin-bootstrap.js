const SHELL_URL='/src/pages/admin/admin-shell.html';
const LEGACY_SCRIPTS=[
  '/src/assets/js/pwa/pwa-install.js',
  '/src/assets/js/shared/config.js',
  '/src/assets/js/shared/app.js',
  '/src/assets/js/shared/utils.js',
  '/src/assets/js/admin/admin-core.js',
  '/src/assets/js/admin/admin-venues.js',
  '/src/assets/js/admin/admin-managers.js',
  '/src/assets/js/admin/admin-staff.js',
  '/src/assets/js/admin/admin-subscriptions.js',
  '/src/assets/js/admin/admin-payments.js',
  '/src/assets/js/admin/admin-menu.js',
  '/src/assets/js/admin/admin-settings.js',
  '/src/assets/js/admin/admin-templates.js',
  '/src/assets/js/admin/admin-statistics.js',
  '/src/assets/js/admin/admin-app.js'
];

async function fetchText(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok) throw new Error(`Admin module load failed: ${url} (${r.status})`);
  return r.text();
}

function absoluteUrl(src){return new URL(src,location.origin).href;}

function collectScripts(doc){
  const seen=new Set();
  return [...doc.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).filter(src=>{
    if(!src||seen.has(src)) return false;
    seen.add(src); return true;
  });
}

function appendScripts(urls){
  return urls.reduce((chain,src)=>chain.then(()=>new Promise((resolve,reject)=>{
    if([...document.scripts].some(s=>s.src===absoluteUrl(src))) return resolve();
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Admin script load failed: ${src}`));
    document.head.appendChild(s);
  })),Promise.resolve());
}

async function boot(){
  const raw=await fetchText(SHELL_URL);
  const parser=new DOMParser();
  const shell=parser.parseFromString(raw,'text/html');

  document.title=shell.title||document.title;
  document.documentElement.lang=shell.documentElement.lang||'ru';

  shell.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{
    const href=link.getAttribute('href');
    if(!href||[...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>x.href===absoluteUrl(href))) return;
    const clone=document.createElement('link');
    clone.rel='stylesheet'; clone.href=href;
    document.head.appendChild(clone);
  });

  document.body.innerHTML=shell.body.innerHTML;
  document.body.classList.add('admin-modular-shell');

  const shellScripts=collectScripts(shell);
  const scripts=[...shellScripts,...LEGACY_SCRIPTS].filter((src,i,a)=>a.indexOf(src)===i);
  await appendScripts(scripts);

  const loader=document.getElementById('admin-bootstrap-loader');
  if(loader) loader.remove();
  window.__QR_ADMIN_MODULAR_BOOTED__=true;
}

boot().catch(err=>{
  console.error('[admin-bootstrap] fatal:',err);
  const loader=document.getElementById('admin-bootstrap-loader');
  if(loader){
    loader.textContent='Не удалось загрузить админ-панель. Откройте консоль для диагностики.';
    loader.style.color='#f87171';
  }
});
