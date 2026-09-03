/* QR Menu — Admin Gemini AI Center */
(function(){
  'use strict';
  if(window.__QR_ADMIN_AI_AUDIT__) return;
  window.__QR_ADMIN_AI_AUDIT__=true;

  function token(){
    try { return window.db?.auth?.getSession ? window.db.auth.getSession() : Promise.resolve({data:{session:null}}); } catch(e){ return Promise.resolve({data:{session:null}}); }
  }
  async function call(payload){
    var s=await token(); var access=s?.data?.session?.access_token;
    if(!access) throw new Error('Сессия администратора не найдена');
    var r=await fetch('/api/admin-ai-audit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify(payload)});
    var d=await r.json().catch(function(){return {};});
    if(!r.ok) throw new Error(d.error||'AI_AUDIT_FAILED');
    return d;
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function renderResult(box,d){
    var x=d.result||{}; var findings=Array.isArray(x.findings)?x.findings:[];
    var html='<div class="ai-summary"><b>'+esc(x.summary||x.answer||'Готово')+'</b>';
    if(x.root_cause) html+='<div class="ai-root"><b>Первопричина:</b> '+esc(x.root_cause)+'</div>';
    html+='</div>';
    if(findings.length){html+='<div class="ai-findings">';findings.forEach(function(f){html+='<div class="ai-finding ai-'+esc(String(f.severity||'info').toLowerCase())+'"><div><b>'+esc(f.title||'Проблема')+'</b> <span>'+esc(f.severity||'')+'</span></div><div class="ai-file">'+esc(f.file||'')+(f.line_start?' · строки '+esc(f.line_start)+'–'+esc(f.line_end||f.line_start):'')+'</div><p>'+esc(f.explanation||f.evidence||'')+'</p>'+(f.fix?'<div><b>Исправление:</b> '+esc(f.fix)+'</div>':'')+'</div>';});html+='</div>';}
    if(Array.isArray(x.actions)&&x.actions.length) html+='<div class="ai-actions"><b>Дальнейшие действия:</b><ul>'+x.actions.map(function(a){return '<li>'+esc(a)+'</li>';}).join('')+'</ul></div>';
    html+='<div class="ai-meta">Проверено файлов: '+esc(d.files_scanned||0)+' · Модель: '+esc(d.model||'Gemini')+'</div>';
    box.innerHTML=html;
  }
  function mount(){
    if(document.getElementById('qr-ai-tab')) return;
    var tabs=document.querySelector('.tabs'); if(!tabs) return;
    var b=document.createElement('button');b.id='qr-ai-tab';b.textContent='🤖 AI-аудит';
    tabs.appendChild(b);
    var panel=document.createElement('div');panel.id='qr-ai-panel';panel.style.display='none';
    panel.innerHTML='<div class="glass card ai-panel"><div class="spread"><div><h3 style="margin:0">🤖 Gemini — AI-центр платформы</h3><div class="muted" style="margin-top:5px">Аудит кода, поиск конфликтов, диагностика ошибок и технический диалог с администратором.</div></div><span id="qr-ai-status" class="muted">Готов</span></div><div class="ai-toolbar"><button data-mode="quick">Быстрый аудит</button><button data-mode="full">Полный аудит</button><button data-mode="import">Аудит импорта меню</button><button data-mode="security">Техническая проверка</button></div><textarea id="qr-ai-message" placeholder="Например: Найди причину ошибки импорта PDF и покажи конкретные файлы и строки..."></textarea><div class="ai-actions-row"><button id="qr-ai-send" class="btn btn-primary">Отправить Gemini</button><button id="qr-ai-audit" class="btn btn-ghost">Запустить полный аудит</button></div><div id="qr-ai-result" class="ai-result"></div></div>';
    var root=document.getElementById('app'); if(root) root.appendChild(panel); else return;
    var active='full';
    function run(mode,msg){var status=document.getElementById('qr-ai-status'),box=document.getElementById('qr-ai-result');status.textContent='Gemini анализирует проект…';box.innerHTML='<div class="muted">Идёт анализ кода и диагностических данных…</div>';call({action:'audit',mode:mode||active,message:msg||''}).then(function(d){status.textContent='Gemini завершил анализ';renderResult(box,d);}).catch(function(e){status.textContent='Ошибка';box.innerHTML='<div class="ai-error">'+esc(e.message)+'</div>';});}
    b.onclick=function(){var visible=panel.style.display!=='none';panel.style.display=visible?'none':'block';b.classList.toggle('on',!visible);if(!visible){document.querySelectorAll('.tabs button').forEach(function(x){if(x!==b)x.classList.remove('on');});}};
    panel.querySelectorAll('[data-mode]').forEach(function(x){x.onclick=function(){active=x.dataset.mode;run(active,document.getElementById('qr-ai-message').value);};});
    document.getElementById('qr-ai-send').onclick=function(){run(active,document.getElementById('qr-ai-message').value);};
    document.getElementById('qr-ai-audit').onclick=function(){run('full','Проведи полный аудит платформы. Найди реальные ошибки, конфликты и первопричины. Для каждой проблемы укажи конкретный файл и строки, затем предложи безопасное исправление.');};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,0);});else setTimeout(mount,0);
})();
