const SHELL_URL='/src/pages/admin/admin-shell.html';

async function boot(){
  const response=await fetch(SHELL_URL,{cache:'no-store'});
  if(!response.ok) throw new Error(`Admin shell load failed: ${response.status}`);

  // The shell remains a complete, known-good document during the migration.
  // document.write preserves execution order of its existing scripts and inline runtime hooks.
  const html=await response.text();
  document.open();
  document.write(html);
  document.close();
}

boot().catch(err=>{
  console.error('[admin-bootstrap] fatal:',err);
  document.body.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#0a0f1a;color:#f87171;font:600 14px system-ui,sans-serif;padding:24px;text-align:center">Не удалось загрузить админ-панель.<br>Откройте консоль для диагностики.</div>';
});
