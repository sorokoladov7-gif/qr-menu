const SHELL_URL='/src/pages/admin/admin-shell.html';
const MANIFEST_URL='/src/assets/js/admin/admin-module-manifest.js';

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Admin module load failed: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadManifest(){
  await loadScript(MANIFEST_URL);
  const modules=window.QR_ADMIN_MODULES;
  if(!Array.isArray(modules)||!modules.length) throw new Error('QR_ADMIN_MODULES is empty');
  return modules;
}

async function boot(){
  const [response,modules]=await Promise.all([
    fetch(SHELL_URL,{cache:'no-store'}),
    loadManifest()
  ]);
  if(!response.ok) throw new Error(`Admin shell load failed: ${response.status}`);

  // Keep the existing shell/template byte-for-byte compatible, but move script ownership
  // out of the HTML document. The manifest is now the single runtime dependency graph.
  const html=await response.text();
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script[src]').forEach(node=>node.remove());

  document.documentElement.replaceWith(doc.documentElement);
  document.querySelectorAll('script[src]').forEach(node=>node.remove());

  for(const src of modules) await loadScript(src);
}

boot().catch(err=>{
  console.error('[admin-bootstrap] fatal:',err);
  document.body.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#0a0f1a;color:#f87171;font:600 14px system-ui,sans-serif;padding:24px;text-align:center">Не удалось загрузить админ-панель.<br>Откройте консоль для диагностики.</div>';
});
