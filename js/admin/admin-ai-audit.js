/* QR Menu — Admin Gemini AI Center */
(function(){
  'use strict';
  if(window.__QR_ADMIN_AI_AUDIT__) return;
  window.__QR_ADMIN_AI_AUDIT__=true;
  var history=[];
  var pendingChanges=[];

  function token(){try{return window.db?.auth?.getSession?window.db.auth.getSession():Promise.resolve({data:{session:null}});}catch(e){return Promise.resolve({data:{session:null}});}}
  async function call(payload){var s=await token(),access=s?.data?.session?.access_token;if(!access)throw new Error('Сессия администратора не найдена');var r=await fetch('/api/admin-ai-audit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify(payload)});var d=await r.json().catch(function(){return {};});if(!r.ok)throw new Error(d.error||'AI_AUDIT_FAILED');return d;}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function renderResult(box,d){
    var x=d.result||{},findings=Array.isArray(x.findings)?x.findings:[],changes=Array.isArray(x.proposed_changes)?x.proposed_changes:[];
    pendingChanges=changes;
    var html='<div class="ai-summary"><b>'+esc(x.summary||x.answer||'Готово')+'</b>';
    if(x.answer&&x.summary)html+='<p>'+esc(x.answer)+'</p>';
    if(x.root_cause)html+='<div class="ai-root"><b>Первопричина:</b> '+esc(x.root_cause)+'</div></div>';else html+='</div>';
    if(findings.length){html+='<div class="ai-findings">';findings.forEach(function(f){html+='<div class="ai-finding ai-'+esc(String(f.severity||'info').toLowerCase())+'"><div><b>'+esc(f.title||'Проблема')+'</b> <span>'+esc(f.severity||'')+'</span></div><div class="ai-file">'+esc(f.file||'')+(f.line_start?' · строки '+esc(f.line_start)+'–'+esc(f.line_end||f.line_start):'')+'</div><p>'+esc(f.explanation||f.evidence||'')+'</p>'+(f.fix?'<div><b>Исправление:</b> '+esc(f.fix)+'</div>':'')+'</div>';});html+='</div>';}
    if(Array.isArray(x.actions)&&x.actions.length)html+='<div class="ai-actions"><b>Дальнейшие действия:</b><ul>'+x.actions.map(function(a){return '<li>'+esc(a)+'</li>';}).join('')+'</ul></div>';
    if(changes.length){html+='<div class="ai-proposals"><b>Предложенные изменения: '+changes.length+'</b><div class="muted">Gemini только предлагает изменения. Ничего не меняется без отдельного подтверждения администратора.</div>';changes.forEach(function(c,i){html+='<div class="ai-change"><b>'+esc(c.operation==='delete'?'Удалить':'Изменить')+': '+esc(c.file)+'</b><div>Причина: '+esc(c.reason||'')+'</div><div>Ожидаемый SHA: '+esc(c.expected_sha||'')+'</div></div>';});html+='<button id="qr-ai-apply" class="btn btn-primary" type="button">Применить предложенные изменения</button></div>';}
    html+='<div class="ai-meta">Проверено файлов: '+esc(d.files_scanned||0)+' · Модель: '+esc(d.model||'Gemini')+'</div>';box.innerHTML=html;
    var apply=document.getElementById('qr-ai-apply');if(apply)apply.onclick=applyPending;
  }
  async function applyPending(){
    if(!pendingChanges.length)return;
    var hasDelete=pendingChanges.some(function(c){return c.operation==='delete';});
    var text=hasDelete?'ВНИМАНИЕ: среди изменений есть удаление файлов. Применить весь предложенный набор?':'Применить предложенные изменения в репозитории?';
    if(!window.confirm(text))return;
    var status=document.getElementById('qr-ai-status');status.textContent='Gemini применяет подтверждённые изменения…';
    try{var d=await call({action:'apply',changes:pendingChanges});status.textContent='Изменения применены';pendingChanges=[];var box=document.getElementById('qr-ai-result');box.innerHTML='<div class="ai-summary"><b>✓ Изменения применены</b><p>Коммиты созданы в ветке main. После завершения деплоя рекомендуется повторно запустить полный аудит.</p><pre>'+esc(JSON.stringify(d.changes||[],null,2))+'</pre></div>';}catch(e){status.textContent='Ошибка применения';document.getElementById('qr-ai-result').insertAdjacentHTML('afterbegin','<div class="ai-error">'+esc(e.message)+'</div>');}
  }
  function mount(){
    if(document.getElementById('qr-ai-tab'))return;var tabs=document.querySelector('.tabs');if(!tabs)return;
    var b=document.createElement('button');b.id='qr-ai-tab';b.textContent='🤖 AI-аудит';tabs.appendChild(b);
    var panel=document.createElement('div');panel.id='qr-ai-panel';panel.style.display='none';panel.innerHTML='<div class="glass card ai-panel"><div class="spread"><div><h3 style="margin:0">🤖 Gemini — AI-центр платформы</h3><div class="muted" style="margin-top:5px">Аудит кода, поиск конфликтов, диагностика, диалог и подтверждаемые исправления.</div></div><span id="qr-ai-status" class="muted">Готов</span></div><div class="ai-toolbar"><button data-mode="quick">Быстрый аудит</button><button data-mode="full">Полный аудит</button><button data-mode="import">Аудит импорта меню</button><button data-mode="security">Техническая проверка</button></div><div id="qr-ai-chat" class="ai-chat"></div><textarea id="qr-ai-message" placeholder="Например: Найди причину ошибки импорта PDF, объясни первопричину и предложи безопасный diff..."></textarea><div class="ai-actions-row"><button id="qr-ai-send" class="btn btn-primary">Отправить Gemini</button><button id="qr-ai-audit" class="btn btn-ghost">Запустить полный аудит</button><button id="qr-ai-clear" class="btn btn-ghost">Очистить диалог</button></div><div id="qr-ai-result" class="ai-result"></div></div>';
    var root=document.getElementById('app');if(root)root.appendChild(panel);else return;
    var active='full';
    function renderChat(){var chat=document.getElementById('qr-ai-chat');if(!chat)return;chat.innerHTML=history.map(function(m){return '<div class="ai-chat-msg '+esc(m.role)+'"><b>'+esc(m.role==='user'?'Администратор':'Gemini')+'</b><div>'+esc(m.content)+'</div></div>';}).join('');chat.scrollTop=chat.scrollHeight;}
    async function run(mode,msg){var status=document.getElementById('qr-ai-status'),box=document.getElementById('qr-ai-result');if(!msg&&mode==='chat')return;status.textContent='Gemini анализирует проект…';box.innerHTML='<div class="muted">Идёт анализ кода и диагностических данных…</div>';if(msg){history.push({role:'user',content:msg});renderChat();}try{var d=await call({action:'audit',mode:mode||active,message:msg||'',history:history});var answer=d.result?.answer||d.result?.summary||'Анализ завершён';history.push({role:'assistant',content:answer});if(history.length>16)history=history.slice(-16);renderChat();status.textContent='Gemini готов';renderResult(box,d);}catch(e){status.textContent='Ошибка';box.innerHTML='<div class="ai-error">'+esc(e.message)+'</div>';}}
    b.onclick=function(){var visible=panel.style.display!=='none';panel.style.display=visible?'none':'block';b.classList.toggle('on',!visible);if(!visible)document.querySelectorAll('.tabs button').forEach(function(x){if(x!==b)x.classList.remove('on');});};
    panel.querySelectorAll('[data-mode]').forEach(function(x){x.onclick=function(){active=x.dataset.mode;run(active,document.getElementById('qr-ai-message').value);};});
    document.getElementById('qr-ai-send').onclick=function(){var msg=document.getElementById('qr-ai-message').value.trim();if(!msg)return;document.getElementById('qr-ai-message').value='';run('chat',msg);};
    document.getElementById('qr-ai-audit').onclick=function(){run('full','Проведи полный аудит платформы. Найди реальные ошибки, конфликты и первопричины. Для каждой проблемы укажи конкретный файл и строки, затем предложи безопасное исправление.');};
    document.getElementById('qr-ai-clear').onclick=function(){history=[];pendingChanges=[];renderChat();document.getElementById('qr-ai-result').innerHTML='';document.getElementById('qr-ai-status').textContent='Готов';};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,0);});else setTimeout(mount,0);
})();
