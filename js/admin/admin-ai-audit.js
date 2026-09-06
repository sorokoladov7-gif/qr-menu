/* QR Menu — Qrchick Admin AI Center (single source of truth) */
(function () {
  'use strict';
  if (window.__QR_ADMIN_AI_AUDIT__) return;
  window.__QR_ADMIN_AI_AUDIT__ = true;

  var STORAGE = 'qrchick_admin_chat_v5';
  var MAX_SIZE = 3 * 1024 * 1024;
  var MAX_FILES = 3;
  var history = [];
  var previousInteractionId = '';
  var pendingChanges = [];
  var pendingDbChanges = [];
  var pendingFiles = [];
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function text(v) {
    var s = esc(v);
    s = s.replace(/```([\s\S]*?)```/g, function (_, c) { return '<pre class="qc-code">' + c + '</pre>'; });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s.replace(/\n/g, '<br>');
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ history: history.slice(-80), previousInteractionId: previousInteractionId })); } catch (e) {}
  }
  function load() {
    try {
      var x = JSON.parse(localStorage.getItem(STORAGE) || '{}');
      history = Array.isArray(x.history) ? x.history : [];
      previousInteractionId = String(x.previousInteractionId || '');
    } catch (e) { history = []; previousInteractionId = ''; }
  }
  async function session() {
    try {
      if (window.db && db.auth && db.auth.getSession) return await db.auth.getSession();
    } catch (e) {}
    return { data: { session: null } };
  }
  async function api(payload) {
    var s = await session();
    var token = s && s.data && s.data.session ? s.data.session.access_token : '';
    if (!token) throw new Error('Сессия администратора не найдена');
    var r = await fetch('/api/admin-ai-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || 'Qrchick: ошибка AI');
    return d;
  }
  function render() {
    var box = $('qc-messages');
    if (!box) return;
    box.innerHTML = history.map(function (m) {
      var user = m.role === 'user';
      return '<article class="qc-message ' + (user ? 'qc-user' : 'qc-ai') + '"><div class="qc-msg-wrap">' +
        (user ? '' : '<div class="qc-avatar">Q</div>') +
        '<div class="qc-msg-content">' + (user ? '' : '<div class="qc-msg-name">Qrchick</div>') +
        '<div class="qc-text">' + text(m.content) + '</div></div></div></article>';
    }).join('');
    var scroll = $('qc-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }
  function renderFiles() {
    var old = $('qc-attachments');
    if (old) old.remove();
    if (!pendingFiles.length) return;
    var wrap = document.querySelector('.qc-input-wrap');
    if (!wrap) return;
    var list = document.createElement('div');
    list.id = 'qc-attachments';
    list.className = 'qc-attachments';
    pendingFiles.forEach(function (file, index) {
      var item = document.createElement('div');
      item.className = 'qc-attachment';
      item.innerHTML = '<div><b>' + esc(file.name) + '</b><small>' + Math.ceil(file.size / 1024) + ' КБ</small></div><button type="button">×</button>';
      item.querySelector('button').onclick = function () { pendingFiles.splice(index, 1); renderFiles(); };
      list.appendChild(item);
    });
    wrap.parentNode.insertBefore(list, wrap);
  }
  function addFiles(files) {
    Array.prototype.slice.call(files || []).forEach(function (file) {
      if (pendingFiles.length >= MAX_FILES) return;
      if (file.size > MAX_SIZE && !/^image\//i.test(file.type || '')) { alert(file.name + ': файл больше 3 МБ.'); return; }
      pendingFiles.push(file);
    });
    renderFiles();
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var value = String(r.result || '');
        resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: value.indexOf(',') >= 0 ? value.split(',').pop() : value });
      };
      r.onerror = function () { reject(new Error('Не удалось прочитать ' + file.name)); };
      r.readAsDataURL(file);
    });
  }
  async function analyzeFiles(prompt) {
    var s = await session();
    var token = s && s.data && s.data.session ? s.data.session.access_token : '';
    if (!token) throw new Error('Сессия администратора не найдена');
    var result = [];
    for (var i = 0; i < pendingFiles.length; i += 1) {
      var file = pendingFiles[i];
      var payload = await readFile(file);
      var r = await fetch('/api/admin-ai-attachment', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ prompt: prompt, file: payload }) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(d.error || 'Ошибка обработки вложения');
      result.push('Файл: ' + file.name + '\n' + String(d.analysis || ''));
    }
    return result.join('\n\n');
  }
  function status(value) { var e = $('qc-status'); if (e) e.textContent = value; }
  function activity(value) { var e = $('qc-activity'); if (e) { e.textContent = value; e.classList.add('show'); } }
  async function run(message) {
    message = String(message || '').trim();
    if ((!message && !pendingFiles.length) || busy) return;
    busy = true;
    var send = $('qc-send');
    if (send) send.disabled = true;
    var userText = message || 'Проанализируй вложения';
    history.push({ role: 'user', content: userText });
    render(); activity('Qrchick анализирует запрос…'); status('Анализ');
    try {
      var ctx = '';
      if (pendingFiles.length) { ctx = '\n\n[ВЛОЖЕНИЯ]\n' + await analyzeFiles(userText); pendingFiles = []; renderFiles(); }
      var messages = history.slice(-12);
      if (ctx && messages.length) messages[messages.length - 1] = { role: 'user', content: userText + ctx };
      var d = await api({ action: 'audit', mode: 'agent', message: userText + ctx, history: messages, previous_interaction_id: previousInteractionId });
      var result = d.result || {};
      previousInteractionId = d.interaction_id || previousInteractionId;
      history.push({ role: 'assistant', content: result.answer || result.summary || 'Анализ завершён.' });
      save(); render(); showResult(d); activity('Qrchick завершил работу'); status('Готов');
    } catch (e) {
      history.push({ role: 'assistant', content: 'Ошибка: ' + e.message });
      save(); render(); activity('Ошибка выполнения запроса'); status('Ошибка');
    } finally { busy = false; if (send) send.disabled = false; }
  }
  function showResult(d) {
    var box = $('qc-result'); if (!box) return;
    var x = d.result || {}, html = '';
    pendingChanges = Array.isArray(x.proposed_changes) ? x.proposed_changes : [];
    pendingDbChanges = Array.isArray(x.database_changes) ? x.database_changes : [];
    if (x.root_cause) html += '<div class="qc-card"><b>Первопричина</b><div>' + text(x.root_cause) + '</div></div>';
    if (Array.isArray(x.findings) && x.findings.length) html += '<div class="qc-card"><b>Найдено · ' + x.findings.length + '</b>' + x.findings.map(function (f) { return '<div class="qc-finding"><strong>' + esc(f.title || 'Проблема') + '</strong><span>' + esc(f.severity || '') + '</span><small>' + esc(f.file || '') + '</small><div>' + text(f.explanation || f.evidence || '') + '</div></div>'; }).join('') + '</div>';
    if (Array.isArray(x.actions) && x.actions.length) html += '<div class="qc-card"><b>План действий</b><ol>' + x.actions.map(function (a) { return '<li>' + text(a) + '</li>'; }).join('') + '</ol></div>';
    if (pendingChanges.length) html += '<div class="qc-card"><b>Изменения кода · ' + pendingChanges.length + '</b><div class="qc-muted">Требуется подтверждение.</div><button id="qc-apply-code" class="qc-apply" type="button">Применить</button></div>';
    if (pendingDbChanges.length) html += '<div class="qc-card"><b>Изменения БД · ' + pendingDbChanges.length + '</b><div class="qc-muted">SQL выполняется только после подтверждения.</div><button id="qc-apply-db" class="qc-apply" type="button">Применить SQL</button></div>';
    box.innerHTML = html;
    var code = $('qc-apply-code'), dbButton = $('qc-apply-db');
    if (code) code.onclick = applyCode;
    if (dbButton) dbButton.onclick = applyDb;
  }
  async function applyCode() {
    if (!pendingChanges.length || !window.confirm('Применить изменения кода?')) return;
    try { var d = await api({ action: 'apply', changes: pendingChanges }); pendingChanges = []; $('qc-result').innerHTML = '<div class="qc-card"><b>Изменения кода применены</b><pre class="qc-code">' + esc(JSON.stringify(d.changes || [], null, 2)) + '</pre></div>'; } catch (e) { status('Ошибка: ' + e.message); }
  }
  async function applyDb() {
    if (!pendingDbChanges.length || !window.confirm('Выполнить подтверждённый SQL?')) return;
    try { var d = await api({ action: 'apply_db', database_changes: pendingDbChanges }); pendingDbChanges = []; $('qc-result').innerHTML = '<div class="qc-card"><b>Изменения БД применены</b><pre class="qc-code">' + esc(JSON.stringify(d.changes || [], null, 2)) + '</pre></div>'; } catch (e) { status('Ошибка БД: ' + e.message); }
  }
  function resetChat() { history = []; previousInteractionId = ''; pendingChanges = []; pendingDbChanges = []; pendingFiles = []; try { localStorage.removeItem(STORAGE); } catch (e) {} var r = $('qc-result'); if (r) r.innerHTML = ''; renderFiles(); showWelcome(); }
  function showWelcome() {
    if (!history.length) { history.push({ role: 'assistant', content: 'Я Qrchick, инженерный AI проекта. Анализирую код, Supabase, RLS/RPC, Vercel и импорт. Изменения production выполняются только после подтверждения.' }); save(); }
    render();
  }
  function openChat() { var root = $('qr-center'), w = $('qc-window'); if (!root || !w) return; root.classList.add('open'); w.setAttribute('aria-hidden', 'false'); var input = $('qc-input'); if (input) setTimeout(function () { input.focus(); }, 0); }
  function closeChat() { var root = $('qr-center'), w = $('qc-window'); if (!root || !w) return; root.classList.remove('open'); w.setAttribute('aria-hidden', 'true'); }
  function mount() {
    if ($('qr-center')) return;
    load();
    var root = document.createElement('div'); root.id = 'qr-center';
    root.innerHTML = '<button id="qc-fab" type="button" aria-label="Qrchick"><span>Q</span><i></i></button><section id="qc-window" aria-hidden="true"><main><header><div class="qc-brand"><strong>Q</strong><div><b>Qrchick</b><small>AI-инженер проекта</small></div></div><div class="qc-head-actions"><button id="qc-clear" type="button" aria-label="Новый чат">＋</button><button id="qc-close" type="button" aria-label="Закрыть">×</button></div></header><div id="qc-scroll"><div id="qc-messages"></div><div id="qc-activity"></div><div id="qc-result"></div></div><div class="qc-compose"><div class="qc-suggestions"><button type="button" data-prompt="Проведи аудит проекта и найди реальные ошибки">Аудит проекта</button><button type="button" data-prompt="Проверь последние ошибки Vercel и найди причину">Vercel</button><button type="button" data-prompt="Проверь RLS, RPC и права Supabase">Supabase</button><button type="button" data-prompt="Проверь импорт PDF, фото и сайта">Импорт</button></div><div class="qc-input-wrap"><button id="qc-attach" type="button" aria-label="Прикрепить файл">＋</button><input id="qc-file" type="file" hidden multiple accept="image/*,application/pdf,text/plain,text/markdown,text/csv,application/json,application/javascript,text/javascript,text/css,text/html,application/xml,text/xml"><textarea id="qc-input" rows="1" placeholder="Сообщение…"></textarea><button id="qc-send" type="button" aria-label="Отправить">↑</button></div><div class="qc-foot">Enter — отправить · Shift+Enter — новая строка</div></div><div id="qc-status">Готов</div></main></section></div>';
    document.body.appendChild(root);
    var style = document.createElement('style');
    style.textContent = '#qc-fab{position:fixed;right:22px;bottom:22px;z-index:30000;width:68px;height:68px;border-radius:50%;border:1px solid rgba(90,210,255,.75);background:radial-gradient(circle at 50% 35%,#164f8c,#071b38 60%,#020816);box-shadow:0 0 34px rgba(28,180,255,.5),0 18px 50px rgba(0,0,0,.4);color:#dffaff;cursor:pointer;font:800 28px Arial}#qc-fab i{position:absolute;right:3px;bottom:4px;width:12px;height:12px;border-radius:50%;background:#25dc83;border:3px solid #07162d}#qc-window{position:fixed;z-index:29999;right:18px;bottom:18px;width:min(920px,calc(100vw - 36px));height:min(820px,calc(100dvh - 36px));display:flex;background:#07101f;color:#edf7ff;border:1px solid rgba(116,198,255,.22);border-radius:20px;overflow:hidden;box-shadow:0 35px 120px rgba(0,0,0,.65);opacity:0;transform:translateY(12px) scale(.985);pointer-events:none;transition:.2s ease}#qr-center.open #qc-window{opacity:1;transform:none;pointer-events:auto}#qr-center.open #qc-fab{display:none}#qc-window main{display:flex;flex-direction:column;min-width:0;flex:1;background:#07111f}#qc-window header{height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid rgba(120,190,240,.12)}.qc-brand{display:flex;align-items:center;gap:10px}.qc-brand>strong{width:36px;height:36px;border-radius:11px;background:linear-gradient(145deg,#15558e,#071c39);border:1px solid #35c9ff;display:flex;align-items:center;justify-content:center}.qc-brand small{display:block;color:#7f9fbe;font-size:11px;margin-top:3px}.qc-head-actions{display:flex;gap:6px}#qc-window header button{width:34px;height:34px;border:1px solid rgba(120,190,240,.14);border-radius:9px;background:rgba(255,255,255,.03);color:#a9c9e5;cursor:pointer;font-size:20px}#qc-scroll{flex:1;min-height:0;overflow:auto}.qc-message{padding:24px 8%;border-bottom:1px solid rgba(120,190,240,.05)}.qc-msg-wrap{display:flex;gap:12px;max-width:820px;margin:auto}.qc-user .qc-msg-wrap{justify-content:flex-end}.qc-user .qc-msg-content{max-width:78%;background:#173a60;border:1px solid rgba(86,185,255,.14);border-radius:18px 18px 5px 18px;padding:11px 14px}.qc-ai .qc-msg-content{flex:1}.qc-msg-name{font-size:11px;color:#7ecfff;margin-bottom:5px;font-weight:700}.qc-text{font-size:15px;line-height:1.65;overflow-wrap:anywhere}.qc-avatar{width:30px;height:30px;flex:0 0 30px;border-radius:9px;background:linear-gradient(145deg,#15558e,#071c39);border:1px solid #35c9ff;display:flex;align-items:center;justify-content:center;font-weight:800}.qc-code{background:#020914;border:1px solid rgba(100,190,245,.14);border-radius:10px;padding:12px;white-space:pre-wrap;overflow:auto;font:12px/1.55 Consolas,monospace}.qc-compose{padding:10px max(18px,8%)}.qc-suggestions{display:flex;gap:6px;overflow:auto;margin-bottom:8px}.qc-suggestions button{white-space:nowrap;border:1px solid rgba(110,190,240,.14);border-radius:9px;background:rgba(255,255,255,.025);color:#8fb1ce;padding:6px 9px;font-size:10px;cursor:pointer}.qc-input-wrap{display:flex;align-items:flex-end;gap:7px;padding:8px;border:1px solid rgba(110,190,240,.24);border-radius:17px;background:#0a182a}.qc-input-wrap textarea{flex:1;min-height:24px;max-height:160px;resize:none;border:0;outline:0;background:transparent;color:#edf7ff;font:14px/1.5 Arial;padding:7px}.qc-input-wrap button{width:38px;height:38px;border-radius:12px;border:1px solid rgba(110,190,240,.14);background:rgba(255,255,255,.04);color:#a9c9e5;cursor:pointer;font-size:20px}.qc-input-wrap #qc-send{background:#dffaff;color:#03111c;border:0}.qc-foot,#qc-status{font-size:10px;color:#6f8da8;text-align:center;padding-top:6px}#qc-status{padding-bottom:10px}#qc-activity{display:none;max-width:820px;margin:0 auto 12px;padding:9px 12px;border-radius:10px;background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.14);color:#8de7bb;font-size:11px}#qc-activity.show{display:block}.qc-card{max-width:820px;margin:12px auto;padding:14px;border:1px solid rgba(110,190,240,.14);border-radius:14px;background:rgba(255,255,255,.025)}.qc-card b{display:block;margin-bottom:8px}.qc-muted{color:#718da5;font-size:11px;margin:6px 0 10px}.qc-finding{padding:10px 0;border-top:1px solid rgba(120,190,240,.08)}.qc-finding strong{display:block}.qc-finding span{display:inline-block;font-size:10px;color:#8fb1ce;margin:3px 8px 0 0}.qc-finding small{display:block;color:#637f98;font-size:10px;margin-top:3px}.qc-apply{border:0;border-radius:10px;padding:8px 12px;background:#25c98a;color:#03111c;font-weight:800;cursor:pointer}.qc-attachments{max-width:820px;margin:0 auto 8px;display:flex;gap:6px;flex-wrap:wrap}.qc-attachment{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(110,190,240,.14);border-radius:10px;background:rgba(255,255,255,.025)}.qc-attachment small{display:block;color:#718da5;font-size:9px}.qc-attachment button{border:0;background:transparent;color:#8fb1ce;cursor:pointer;font-size:17px}@media(max-width:700px){#qc-fab{right:14px;bottom:14px;width:58px;height:58px;font-size:24px}#qc-window{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}.qc-message{padding:18px 4%}.qc-compose{padding:8px 4%}.qc-user .qc-msg-content{max-width:88%}}';
    document.head.appendChild(style);
    $('qc-fab').onclick = openChat; $('qc-close').onclick = closeChat; $('qc-clear').onclick = resetChat;
    $('qc-attach').onclick = function () { $('qc-file').click(); };
    $('qc-file').onchange = function (e) { addFiles(e.target.files); e.target.value = ''; };
    $('qc-send').onclick = function () { var input = $('qc-input'); if (!input) return; var value = input.value; input.value = ''; input.style.height = 'auto'; run(value); };
    $('qc-input').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 160) + 'px'; });
    $('qc-input').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('qc-send').click(); } });
    root.querySelectorAll('[data-prompt]').forEach(function (button) { button.onclick = function () { run(button.getAttribute('data-prompt') || ''); }; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChat(); });
    showWelcome();
  }
  function start() { if (document.body) mount(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();