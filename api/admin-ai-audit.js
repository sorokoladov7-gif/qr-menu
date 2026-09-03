'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_AUDIT_MODEL || 'gemini-3.7-flash';
const GITHUB_REPO = 'sorokoladov7-gif/qr-menu';
const GITHUB_BRANCH = 'main';
const MAX_FILES = 160;
const MAX_FILE_CHARS = 30000;
const MAX_CONTEXT_CHARS = 1000000;
const MAX_HISTORY = 16;

function clean(v,n=500){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);}
function bearer(req){const h=String(req.headers?.authorization||req.headers?.Authorization||'');const m=h.match(/^Bearer\s+(.+)$/i);return m?m[1].trim():'';}
async function adminAuth(req){
  const token=bearer(req);if(!token)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});
  const u=await r.json().catch(()=>null);if(!r.ok||!u?.id)throw Object.assign(new Error('AUTH_INVALID'),{status:401});
  const p=await fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(u.id)+'&select=role&limit=1',{headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token,accept:'application/json'}});
  const rows=await p.json().catch(()=>[]);const role=String(rows?.[0]?.role||'').toLowerCase();
  if(!p.ok||role!=='admin')throw Object.assign(new Error('ADMIN_ONLY'),{status:403});
  return {id:u.id,email:u.email||''};
}
function githubHeaders(){const h={'User-Agent':'QR-Menu-Admin-Gemini','Accept':'application/vnd.github+json'};if(process.env.GITHUB_TOKEN)h.Authorization='Bearer '+process.env.GITHUB_TOKEN;return h;}
async function gh(path,opts){const r=await fetch('https://api.github.com/repos/'+GITHUB_REPO+path,Object.assign({headers:githubHeaders()},opts||{}));const b=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(b?.message||'GITHUB_HTTP_'+r.status),{status:r.status});return b;}
function shouldSkip(path){return /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|\.vercel)(\/|$)/.test(path)||/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|zip)$/i.test(path);}
async function repoSnapshot(){
  const tree=await gh('/git/trees/'+encodeURIComponent(GITHUB_BRANCH)+'?recursive=1');
  const files=(tree.tree||[]).filter(x=>x.type==='blob'&&!shouldSkip(x.path)&&/\.(js|mjs|cjs|ts|tsx|html|css|json|sql|md)$/i.test(x.path)).slice(0,MAX_FILES);
  const chunks=[];let total=0;
  for(const f of files){try{const d=await gh('/contents/'+f.path+'?ref='+encodeURIComponent(GITHUB_BRANCH));const text=d?.encoding==='base64'?Buffer.from(d.content||'','base64').toString('utf8'):String(d?.content||'');const part='===== FILE: '+f.path+' =====\n'+text.slice(0,MAX_FILE_CHARS);if(total+part.length>MAX_CONTEXT_CHARS)break;chunks.push(part);total+=part.length;}catch(e){chunks.push('===== FILE: '+f.path+' =====\n[UNREADABLE]');}}
  return {files:files.map(x=>x.path),context:chunks.join('\n\n')};
}
async function vercelSnapshot(){
  const token=process.env.VERCEL_TOKEN;if(!token)return '[Vercel data unavailable: VERCEL_TOKEN is not configured]';
  const project=process.env.VERCEL_PROJECT_ID||'prj_LGw7oYwZum4EsfmY3J0QiLDU4mzq';const team=process.env.VERCEL_TEAM_ID||'team_8QI087XOgioMrRulnW2TdDDF';
  try{const r=await fetch('https://api.vercel.com/v3/now/deployments?projectId='+encodeURIComponent(project)+'&teamId='+encodeURIComponent(team)+'&limit=8',{headers:{Authorization:'Bearer '+token}});return JSON.stringify(await r.json().catch(()=>({}))).slice(0,70000);}catch(e){return '[Vercel unavailable]';}
}
function historyText(history){return (Array.isArray(history)?history:[]).slice(-MAX_HISTORY).map(m=>{const role=m?.role==='assistant'?'assistant':'user';return role.toUpperCase()+': '+String(m?.content||'').slice(0,5000);}).join('\n');}
function prompt(context,logs,message,mode,history){return ['Ты — внутренний AI-инженер и полноценный технический помощник платформы QR Menu. Работаешь только для авторизованного администратора.','Отвечай как инженер-партнёр: веди диалог, помни последние сообщения в рамках переданной истории, связывай симптомы с реальным кодом и не ограничивайся общими советами.','Анализируй только факты из переданного проекта и диагностических данных. Не выдумывай файлы, функции, строки, логи или результаты тестов.','Если данных недостаточно — прямо укажи, чего не хватает и какой проверкой это установить.','Никогда не утверждай, что изменение выполнено, пока сервер действительно его не выполнил.','Никогда не раскрывай секреты, токены, пароли, service-role keys, API keys или персональные данные.','Не предлагай отключать авторизацию, RLS, CSP, rate limits или другие защитные механизмы ради исправления.','Для исправлений сначала сформируй предложение: конкретные файлы, операции, старое состояние и новое состояние. Удаление допускается только по явной команде администратора и с указанием зависимостей/риска.','Режим: '+clean(mode||'full',40),'История диалога:\n'+historyText(history),'Новый запрос администратора:\n'+String(message||'').slice(0,12000),'Верни JSON: {summary,answer,severity,root_cause,findings,actions,proposed_changes,confidence,safe_to_change}.','finding={severity,title,file,line_start,line_end,evidence,explanation,fix}.','proposed_changes=[{operation:"update"|"delete",file,expected_sha,reason,new_content}]. Если изменения не нужны — []. Для удаления new_content должен быть пустым. Никогда не включай секреты в new_content.','Код проекта:\n'+context,'Vercel:\n'+logs].join('\n\n');}
function validateChanges(changes){
  if(!Array.isArray(changes)||changes.length>20)throw new Error('INVALID_CHANGE_SET');
  return changes.map(c=>{const operation=c?.operation;const file=String(c?.file||'');if(!['update','delete'].includes(operation))throw new Error('INVALID_CHANGE_OPERATION');if(!/^[A-Za-z0-9._\-/]+$/.test(file)||file.includes('..'))throw new Error('INVALID_CHANGE_PATH');if(!c.expected_sha||typeof c.expected_sha!=='string')throw new Error('EXPECTED_SHA_REQUIRED');if(operation==='update'&&typeof c.new_content!=='string')throw new Error('NEW_CONTENT_REQUIRED');if(operation==='delete'&&file==='api/admin-ai-audit.js')throw new Error('SELF_DELETE_BLOCKED');return {operation,file,expected_sha:c.expected_sha,new_content:operation==='update'?c.new_content:''};});}
async function applyChanges(changes,admin){
  if(!process.env.GITHUB_TOKEN)throw Object.assign(new Error('GITHUB_TOKEN_NOT_CONFIGURED'),{status:503});
  const safe=validateChanges(changes);const results=[];
  for(const c of safe){
    if(c.operation==='update'){
      if(c.new_content.length>150000)throw new Error('FILE_TOO_LARGE');
      const r=await gh('/contents/'+c.file,{method:'PUT',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Admin Gemini fix: '+c.file,content:Buffer.from(c.new_content,'utf8').toString('base64'),sha:c.expected_sha,branch:GITHUB_BRANCH})});
      results.push({operation:'update',file:c.file,commit:r.commit?.sha||null});
    }else{
      const r=await gh('/contents/'+c.file,{method:'DELETE',headers:Object.assign({},githubHeaders(),{'Content-Type':'application/json'}),body:JSON.stringify({message:'Admin Gemini delete: '+c.file,sha:c.expected_sha,branch:GITHUB_BRANCH})});
      results.push({operation:'delete',file:c.file,commit:r.commit?.sha||null});
    }
  }
  return {applied:true,admin:admin.email,changes:results};
}

// -------------------- HTML-интерфейс (безопасная генерация) --------------------
function getHtml() {
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="ru">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">',
    '<title>AI-аудит QR Menu</title>',
    '<style>',
    '* { box-sizing: border-box; margin: 0; padding: 0; }',
    'body {',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;',
    '  background: #0b0e14;',
    '  color: #e0e4ec;',
    '  min-height: 100vh;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 16px;',
    '}',
    '.container {',
    '  max-width: 820px;',
    '  width: 100%;',
    '  background: #181e28;',
    '  border-radius: 24px;',
    '  padding: 24px 20px 32px;',
    '  box-shadow: 0 20px 60px rgba(0,0,0,0.7);',
    '}',
    'h1 {',
    '  font-size: 1.8rem;',
    '  font-weight: 600;',
    '  letter-spacing: -0.5px;',
    '  color: #c8d0dc;',
    '  margin-bottom: 8px;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 10px;',
    '}',
    'h1 small {',
    '  font-size: 0.9rem;',
    '  font-weight: 400;',
    '  color: #7a8899;',
    '  margin-left: auto;',
    '}',
    '.sub {',
    '  color: #7a8899;',
    '  font-size: 0.95rem;',
    '  margin-bottom: 24px;',
    '  border-left: 3px solid #3b4a5c;',
    '  padding-left: 14px;',
    '}',
    '.field-group { margin-bottom: 16px; }',
    'label {',
    '  display: block;',
    '  font-size: 0.85rem;',
    '  font-weight: 500;',
    '  color: #a6b3c4;',
    '  margin-bottom: 4px;',
    '  letter-spacing: 0.3px;',
    '}',
    'input, select, textarea {',
    '  width: 100%;',
    '  padding: 10px 14px;',
    '  background: #11171f;',
    '  border: 1px solid #2a3340;',
    '  border-radius: 12px;',
    '  color: #e8edf5;',
    '  font-size: 0.95rem;',
    '  transition: border 0.15s;',
    '}',
    'input:focus, select:focus, textarea:focus {',
    '  outline: none;',
    '  border-color: #4f7cff;',
    '  box-shadow: 0 0 0 3px rgba(79,124,255,0.2);',
    '}',
    'textarea { resize: vertical; min-height: 80px; font-family: inherit; }',
    '.row { display: flex; gap: 12px; flex-wrap: wrap; }',
    '.row .field-group { flex: 1 1 200px; }',
    'button {',
    '  background: #4f7cff;',
    '  border: none;',
    '  color: #fff;',
    '  font-weight: 600;',
    '  font-size: 1rem;',
    '  padding: 12px 28px;',
    '  border-radius: 40px;',
    '  cursor: pointer;',
    '  transition: background 0.15s, transform 0.1s;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  gap: 8px;',
    '  margin-top: 8px;',
    '}',
    'button:hover { background: #3f68e6; }',
    'button:active { transform: scale(0.97); }',
    'button:disabled { opacity: 0.5; pointer-events: none; }',
    '.history-box {',
    '  margin-top: 20px;',
    '  background: #0f151e;',
    '  border-radius: 16px;',
    '  padding: 12px 16px;',
    '  max-height: 200px;',
    '  overflow-y: auto;',
    '  font-size: 0.85rem;',
    '  border: 1px solid #232d3b;',
    '  color: #b8c4d4;',
    '}',
    '.history-box .entry { padding: 6px 0; border-bottom: 1px solid #1f2937; }',
    '.history-box .entry:last-child { border-bottom: none; }',
    '.history-box .role { font-weight: 600; color: #7a8899; }',
    '.history-box .role.user { color: #6ea8fe; }',
    '.history-box .role.assistant { color: #a8c4ff; }',
    '.history-box .content { word-break: break-word; }',
    '.status { margin-top: 12px; font-size: 0.9rem; color: #7a8899; }',
    '.modal-overlay {',
    '  position: fixed;',
    '  top: 0; left: 0; right: 0; bottom: 0;',
    '  background: rgba(0,0,0,0.75);',
    '  backdrop-filter: blur(6px);',
    '  display: none;',
    '  align-items: center;',
    '  justify-content: center;',
    '  z-index: 999;',
    '  padding: 20px;',
    '}',
    '.modal-overlay.active { display: flex; }',
    '.modal {',
    '  background: #1a212c;',
    '  max-width: 980px;',
    '  width: 100%;',
    '  max-height: 90vh;',
    '  border-radius: 28px;',
    '  padding: 28px 24px 24px;',
    '  box-shadow: 0 40px 80px rgba(0,0,0,0.8);',
    '  display: flex;',
    '  flex-direction: column;',
    '  overflow: hidden;',
    '  position: relative;',
    '}',
    '.modal-header {',
    '  display: flex;',
    '  justify-content: space-between;',
    '  align-items: center;',
    '  margin-bottom: 14px;',
    '  flex-shrink: 0;',
    '}',
    '.modal-header h2 { font-size: 1.4rem; font-weight: 500; color: #d0dae8; }',
    '.modal-close {',
    '  background: #2d3a4a;',
    '  border: none;',
    '  color: #bcc8d8;',
    '  width: 40px;',
    '  height: 40px;',
    '  border-radius: 40px;',
    '  font-size: 1.6rem;',
    '  cursor: pointer;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  transition: background 0.15s;',
    '  padding: 0;',
    '  line-height: 1;',
    '}',
    '.modal-close:hover { background: #3f4f62; }',
    '.modal-body {',
    '  overflow-y: auto;',
    '  flex: 1 1 auto;',
    '  padding-right: 4px;',
    '  font-size: 0.95rem;',
    '  line-height: 1.6;',
    '  white-space: pre-wrap;',
    '  word-break: break-word;',
    '}',
    '.modal-body pre {',
    '  background: #0f151e;',
    '  padding: 16px;',
    '  border-radius: 12px;',
    '  overflow-x: auto;',
    '  font-size: 0.85rem;',
    '  color: #d4deec;',
    '  border: 1px solid #28323f;',
    '  white-space: pre-wrap;',
    '  word-break: break-word;',
    '}',
    '.modal-body .severity-badge {',
    '  display: inline-block;',
    '  background: #2d3a4a;',
    '  padding: 2px 12px;',
    '  border-radius: 20px;',
    '  font-size: 0.75rem;',
    '  font-weight: 600;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.4px;',
    '}',
    '.modal-body .severity-high { background: #c44545; color: #fff; }',
    '.modal-body .severity-medium { background: #d9a13b; color: #000; }',
    '.modal-body .severity-low { background: #3b7a5c; color: #fff; }',
    '.modal-footer {',
    '  margin-top: 16px;',
    '  display: flex;',
    '  gap: 12px;',
    '  justify-content: flex-end;',
    '  flex-shrink: 0;',
    '}',
    '@media (max-width: 600px) {',
    '  .container { padding: 16px; }',
    '  h1 { font-size: 1.4rem; flex-wrap: wrap; }',
    '  h1 small { font-size: 0.75rem; margin-left: 0; }',
    '  .row { flex-direction: column; gap: 0; }',
    '  .modal { padding: 16px; max-height: 95vh; }',
    '  .modal-header h2 { font-size: 1.2rem; }',
    '  button { width: 100%; justify-content: center; }',
    '}',
    '@media (max-width: 400px) {',
    '  body { padding: 8px; }',
    '  .container { border-radius: 16px; padding: 12px; }',
    '}',
    '::-webkit-scrollbar { width: 6px; height: 6px; }',
    '::-webkit-scrollbar-track { background: #0f151e; border-radius: 8px; }',
    '::-webkit-scrollbar-thumb { background: #2d3a4a; border-radius: 8px; }',
    '::-webkit-scrollbar-thumb:hover { background: #3f4f62; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '  <h1>🛠 AI-аудит <small>QR Menu</small></h1>',
    '  <div class="sub">Полноэкранный диалог с инженерным ассистентом. Ответы не обрезаются.</div>',
    '  <div class="field-group">',
    '    <label for="token">Bearer-токен (Supabase)</label>',
    '    <input type="password" id="token" placeholder="Введите ваш токен администратора" autocomplete="off">',
    '  </div>',
    '  <div class="field-group">',
    '    <label for="message">Запрос</label>',
    '    <textarea id="message" placeholder="Опишите проблему или задайте вопрос по коду...">Проанализируй последние ошибки в логах Vercel</textarea>',
    '  </div>',
    '  <div class="row">',
    '    <div class="field-group">',
    '      <label for="mode">Режим</label>',
    '      <select id="mode">',
    '        <option value="audit">Аудит</option>',
    '        <option value="fix" selected>Исправление</option>',
    '        <option value="full">Полный анализ</option>',
    '      </select>',
    '    </div>',
    '    <div class="field-group" style="display: flex; align-items: flex-end;">',
    '      <button id="sendBtn">➤ Отправить</button>',
    '    </div>',
    '  </div>',
    '  <div class="status" id="status">Готов к работе</div>',
    '  <div class="history-box" id="historyBox">',
    '    <div style="color:#6a7a8a; text-align:center; padding:8px;">История диалога будет здесь</div>',
    '  </div>',
    '</div>',
    '<div class="modal-overlay" id="modalOverlay">',
    '  <div class="modal">',
    '    <div class="modal-header">',
    '      <h2>📋 Ответ ассистента</h2>',
    '      <button class="modal-close" id="modalClose">✕</button>',
    '    </div>',
    '    <div class="modal-body" id="modalBody">',
    '      <div style="color:#7a8899;">Загрузка...</div>',
    '    </div>',
    '    <div class="modal-footer">',
    '      <button id="modalCloseBtn" style="background:#2d3a4a; color:#c8d0dc;">Закрыть</button>',
    '    </div>',
    '  </div>',
    '</div>',
    '<script>',
    '(function() {',
    '  var tokenInput = document.getElementById("token");',
    '  var messageInput = document.getElementById("message");',
    '  var modeSelect = document.getElementById("mode");',
    '  var sendBtn = document.getElementById("sendBtn");',
    '  var statusEl = document.getElementById("status");',
    '  var historyBox = document.getElementById("historyBox");',
    '  var modalOverlay = document.getElementById("modalOverlay");',
    '  var modalBody = document.getElementById("modalBody");',
    '  var modalClose = document.getElementById("modalClose");',
    '  var modalCloseBtn = document.getElementById("modalCloseBtn");',
    '  var savedToken = localStorage.getItem("ai_audit_token");',
    '  if (savedToken) tokenInput.value = savedToken;',
    '  tokenInput.addEventListener("change", function() { localStorage.setItem("ai_audit_token", tokenInput.value); });',
    '  var history = JSON.parse(localStorage.getItem("ai_audit_history")) || [];',
    '  function renderHistory() {',
    '    if (!history.length) {',
    '      historyBox.innerHTML = "<div style=\\"color:#6a7a8a; text-align:center; padding:8px;\\">История диалога пуста</div>";',
    '      return;',
    '    }',
    '    var html = "";',
    '    history.slice(-8).forEach(function(entry) {',
    '      var roleClass = entry.role === "assistant" ? "assistant" : "user";',
    '      var label = entry.role === "assistant" ? "Ассистент" : "Вы";',
    '      html += "<div class=\\"entry\\"><span class=\\"role " + roleClass + "\\">" + label + ":</span> <span class=\\"content\\">" + escapeHtml(entry.content) + "</span></div>";',
    '    });',
    '    historyBox.innerHTML = html;',
    '    historyBox.scrollTop = historyBox.scrollHeight;',
    '  }',
    '  function escapeHtml(text) {',
    '    var div = document.createElement("div");',
    '    div.textContent = text;',
    '    return div.innerHTML;',
    '  }',
    '  renderHistory();',
    '  function setStatus(text, isError) {',
    '    statusEl.textContent = text;',
    '    statusEl.style.color = isError ? "#f28b8b" : "#7a8899";',
    '  }',
    '  function showModal(content) {',
    '    modalBody.innerHTML = content;',
    '    modalOverlay.classList.add("active");',
    '    document.body.style.overflow = "hidden";',
    '  }',
    '  function closeModal() {',
    '    modalOverlay.classList.remove("active");',
    '    document.body.style.overflow = "";',
    '  }',
    '  modalClose.addEventListener("click", closeModal);',
    '  modalCloseBtn.addEventListener("click", closeModal);',
    '  modalOverlay.addEventListener("click", function(e) { if (e.target === modalOverlay) closeModal(); });',
    '  async function sendRequest() {',
    '    var token = tokenInput.value.trim();',
    '    if (!token) { setStatus("❌ Введите Bearer-токен", true); return; }',
    '    var message = messageInput.value.trim();',
    '    if (!message) { setStatus("❌ Введите запрос", true); return; }',
    '    var mode = modeSelect.value;',
    '    sendBtn.disabled = true;',
    '    setStatus("⏳ Отправка запроса...");',
    '    try {',
    '      var response = await fetch(window.location.href, {',
    '        method: "POST",',
    '        headers: {',
    '          "Authorization": "Bearer " + token,',
    '          "Content-Type": "application/json"',
    '        },',
    '        body: JSON.stringify({ message: message, mode: mode, history: history })',
    '      });',
    '      var data = await response.json();',
    '      if (!response.ok) throw new Error(data.error || "Ошибка сервера");',
    '      history.push({ role: "user", content: message });',
    '      if (data.result && data.result.answer) {',
    '        history.push({ role: "assistant", content: data.result.answer });',
    '      } else if (data.result && data.result.summary) {',
    '        history.push({ role: "assistant", content: data.result.summary });',
    '      } else {',
    '        history.push({ role: "assistant", content: JSON.stringify(data.result, null, 2) });',
    '      }',
    '      if (history.length > 50) history = history.slice(-50);',
    '      localStorage.setItem("ai_audit_history", JSON.stringify(history));',
    '      renderHistory();',
    '      var modalContent = "";',
    '      if (data.result) {',
    '        var r = data.result;',
    '        if (r.summary) modalContent += "<h3>📌 Резюме</h3><p>" + escapeHtml(r.summary) + "</p>";',
    '        if (r.answer) modalContent += "<h3>💬 Ответ</h3><p>" + escapeHtml(r.answer) + "</p>";',
    '        if (r.root_cause) modalContent += "<h3>🔍 Корневая причина</h3><p>" + escapeHtml(r.root_cause) + "</p>";',
    '        if (r.findings && r.findings.length) {',
    '          modalContent += "<h3>📋 Находки</h3>";',
    '          r.findings.forEach(function(f) {',
    '            var sev = f.severity || "low";',
    '            modalContent += "<div style=\\"margin-bottom:12px; background:#0f151e; padding:12px; border-radius:12px; border-left:4px solid " + (sev==="high" ? "#c44545" : sev==="medium" ? "#d9a13b" : "#3b7a5c") + ";\\">";',
    '            modalContent += "<span class=\\"severity-badge severity-" + sev + "\\">" + sev + "</span>";',
    '            modalContent += "<strong>" + escapeHtml(f.title || "Находка") + "</strong>";',
    '            if (f.file) modalContent += "<span style=\\"color:#7a8899; font-size:0.85rem;\\"> в " + escapeHtml(f.file) + "</span>";',
    '            if (f.line_start) modalContent += "<span style=\\"color:#7a8899; font-size:0.85rem;\\"> строки " + f.line_start + (f.line_end ? "-" + f.line_end : "") + "</span>";',
    '            if (f.explanation) modalContent += "<div style=\\"margin-top:6px; font-size:0.9rem;\\">" + escapeHtml(f.explanation) + "</div>";',
    '            if (f.fix) modalContent += "<div style=\\"margin-top:6px; background:#1e2937; padding:8px; border-radius:8px; font-size:0.9rem;\\"><strong>Исправление:</strong> " + escapeHtml(f.fix) + "</div>";',
    '            modalContent += "</div>";',
    '          });',
    '        }',
    '        if (r.proposed_changes && r.proposed_changes.length) {',
    '          modalContent += "<h3>🔄 Предлагаемые изменения</h3><pre>" + escapeHtml(JSON.stringify(r.proposed_changes, null, 2)) + "</pre>";',
    '        }',
    '        if (r.confidence !== undefined) {',
    '          modalContent += "<p><strong>Уверенность:</strong> " + r.confidence + "%</p>";',
    '        }',
    '        if (r.safe_to_change !== undefined) {',
    '          modalContent += "<p><strong>Безопасно применить:</strong> " + (r.safe_to_change ? "✅ Да" : "❌ Нет") + "</p>";',
    '        }',
    '        if (!modalContent) modalContent = "<pre>" + escapeHtml(JSON.stringify(r, null, 2)) + "</pre>";',
    '      } else {',
    '        modalContent = "<pre>" + escapeHtml(JSON.stringify(data, null, 2)) + "</pre>";',
    '      }',
    '      showModal(modalContent);',
    '      setStatus("✅ Ответ получен (открыто модальное окно)");',
    '    } catch (err) {',
    '      setStatus("❌ Ошибка: " + err.message, true);',
    '      console.error(err);',
    '    } finally {',
    '      sendBtn.disabled = false;',
    '    }',
    '  }',
    '  sendBtn.addEventListener("click", sendRequest);',
    '  messageInput.addEventListener("keydown", function(e) {',
    '    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {',
    '      e.preventDefault();',
    '      sendRequest();',
    '    }',
    '  });',
    '  tokenInput.addEventListener("input", function() {',
    '    localStorage.setItem("ai_audit_token", tokenInput.value);',
    '  });',
    '})();',
    '</script>',
    '</body>',
    '</html>'
  ];
  return lines.join('\n');
}

// -------------------- Основной обработчик --------------------
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    res.status(200).setHeader('Content-Type', 'text/html').send(getHtml());
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const admin = await adminAuth(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = clean(body.action || 'audit', 30);

    if (action === 'apply') {
      const result = await applyChanges(body.changes, admin);
      return res.status(200).json({ ok: true, ...result });
    }

    const snap = await repoSnapshot();
    const logs = await vercelSnapshot();
    const result = await callGemini(
      prompt(snap.context, logs, body.message || '', body.mode || action, body.history || [])
    );
    return res.status(200).json({
      ok: true,
      admin: admin.email,
      model: GEMINI_MODEL,
      result,
      files_scanned: snap.files.length,
      scanned_files: snap.files,
    });
  } catch (e) {
    const status = Number(e?.status) || 500;
    console.error('[admin-ai-audit]', e);
    return res.status(status).json({ error: clean(e?.message || 'AI_AUDIT_FAILED', 300) });
  }
}

async function callGemini(promptText) {
  if (!GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY_NOT_CONFIGURED'), { status: 503 });
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent', {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 30000,
        thinkingConfig: { thinkingLevel: 'low' }
      }
    })
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(d?.error?.message || 'GEMINI_HTTP_' + r.status), { status: r.status });
  const text = (d?.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  if (!text) throw Object.assign(new Error('AI_EMPTY_RESPONSE'), { status: 502 });
  try { return JSON.parse(text); } catch (_) { return { answer: text }; }
}

module.exports = handler;
