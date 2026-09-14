/* Manager support — messenger-like support tab */
(function () {
  'use strict';

  if (window.__QR_MANAGER_SUPPORT_LOADED__) return;
  window.__QR_MANAGER_SUPPORT_LOADED__ = true;

  var state = { panel: null, threadId: null, threadVenueId: null, timer: null, sending: false };

  // The manager cabinet uses the canonical Supabase client exposed as window.db.
  // window.supabase is the Supabase JS namespace/factory, not the configured client.
  function db() { return window.db || window.__SUPABASE__ || null; }
  function currentVenueId() {
    var vm = window.__managerVue || window.__QR_MANAGER_VUE_APP__ || null;
    var candidates = [
      window.currentVenueId,
      window.__currentVenueId,
      window.__managerCurrentVenue && window.__managerCurrentVenue.id,
      window.__managerSelectedVenue && window.__managerSelectedVenue.id,
      window.managerState && window.managerState.venueId,
      vm && vm.venue && vm.venue.id,
      vm && vm.currentVenue && vm.currentVenue.id,
      vm && vm.selectedVenue && vm.selectedVenue.id
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] != null && String(candidates[i]).trim()) return String(candidates[i]);
    }
    try {
      var saved = localStorage.getItem('manager_venue_id') || localStorage.getItem('selectedVenueId');
      if (saved && String(saved).trim()) return String(saved);
    } catch (e) {}
    return null;
  }

  function styles() {
    if (document.getElementById('qr-support-styles')) return;
    var s = document.createElement('style');
    s.id = 'qr-support-styles';
    s.textContent = `
      #app .wrap.qr-support-mode { position:relative !important; min-height:0 !important; }
      #app .wrap.qr-support-mode > *:not(.tabs):not(.qr-support-panel) { display:none !important; }
      #app .wrap.qr-support-mode .qr-support-panel {
        position:absolute !important; inset:0 !important; z-index:20 !important;
        width:100% !important; min-width:0 !important; max-width:none !important;
        height:100% !important; min-height:0 !important; margin:0 !important; padding:0 !important;
        box-sizing:border-box !important; overflow:hidden !important;
        display:flex !important; flex-direction:column !important;
      }
      .qr-support-head { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; border-bottom:1px solid rgba(127,127,127,.18); }
      .qr-support-title { min-width:0; font-weight:700; font-size:16px; }
      .qr-support-status { flex:0 0 auto; font-size:12px; opacity:.65; white-space:nowrap; }
      .qr-support-body { flex:1 1 auto; min-height:0; height:auto !important; max-height:none !important; display:flex; flex-direction:column; }
      .qr-support-messages { flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; padding:18px; display:flex; flex-direction:column; gap:10px; -webkit-overflow-scrolling:touch; }
      .qr-support-msg { max-width:min(760px,86%); padding:10px 13px; border-radius:14px; line-height:1.4; overflow-wrap:anywhere; word-break:break-word; }
      .qr-support-msg.mine { align-self:flex-end; }
      .qr-support-msg.theirs { align-self:flex-start; }
      .qr-support-compose { flex:0 0 auto; display:flex; align-items:flex-end; gap:10px; padding:12px 14px; border-top:1px solid rgba(127,127,127,.18); background:inherit; }
      .qr-support-compose textarea { flex:1 1 auto; min-width:0; min-height:44px; max-height:140px; resize:vertical; box-sizing:border-box; }
      .qr-support-compose .btn { flex:0 0 auto; min-height:44px; }
      @media (max-width:900px) {
        #app .wrap.qr-support-mode .qr-support-panel {
          position:fixed !important; top:0 !important; right:0 !important; bottom:0 !important; left:0 !important;
          width:100vw !important; height:100vh !important; height:100dvh !important;
          min-width:0 !important; max-width:none !important; min-height:0 !important; max-height:none !important;
          margin:0 !important; padding:0 !important; border-radius:0 !important; box-sizing:border-box !important; z-index:10060 !important;
        }
        .qr-support-head { padding:12px 14px; }
        .qr-support-messages { padding:12px; }
        .qr-support-compose { padding:10px; gap:8px; align-items:stretch; flex-direction:column; }
        .qr-support-compose textarea { width:100%; min-height:48px; max-height:120px; }
        .qr-support-compose .btn { width:100%; min-height:46px; }
        .qr-support-msg { max-width:94%; }
      }
    `;
    document.head.appendChild(s);
  }

  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
  function formatTime(value) { if (!value) return ''; var d = new Date(value); if (isNaN(d.getTime())) return ''; return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

  async function ensureThread() {
    var venueId = currentVenueId();
    if (!venueId) throw new Error('Не удалось определить заведение. Сначала выберите заведение в кабинете.');
    if (state.threadId && state.threadVenueId === String(venueId)) return state.threadId;
    state.threadId = null;
    state.threadVenueId = String(venueId);
    var client = db();
    if (!client || typeof client.rpc !== 'function') throw new Error('Supabase клиент не найден');
    var result = await client.rpc('manager_support_get_or_create_thread', {p_venue_id: venueId, p_subject:'Поддержка платформы'});
    if (result.error) throw result.error;

    // The SQL function returns uuid directly. Depending on the Supabase/PostgREST
    // response shape it may arrive as a scalar string, a row object, or a one-row array.
    var data = result.data;
    var row = Array.isArray(data) ? data[0] : data;
    if (typeof row === 'string') {
      state.threadId = row.trim();
    } else if (row && typeof row === 'object') {
      state.threadId = row.id || row.thread_id || row.uuid || null;
    } else {
      state.threadId = null;
    }

    if (!state.threadId) throw new Error('Не удалось открыть чат поддержки');
    return state.threadId;
  }

  async function loadMessages() {
    if (!state.panel) return;
    try {
      var client=db(), threadId=await ensureThread();
      var result=await client.from('manager_support_messages').select('*').eq('thread_id',threadId).order('created_at',{ascending:true});
      if (result.error) throw result.error;
      var box=state.panel.querySelector('.qr-support-messages'); if (!box) return;
      var wasBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80, rows=result.data||[];
      box.dataset.errorShown='';
      box.innerHTML=rows.length?rows.map(function(m){var mine=!!(m.manager_id||m.sender_role==='manager'||m.sender_type==='manager');return '<div class="qr-support-msg '+(mine?'mine':'theirs')+'"><div>'+escapeHtml(m.message||m.text||'')+'</div><small style="opacity:.55;display:block;margin-top:4px">'+escapeHtml(formatTime(m.created_at))+'</small></div>';}).join(''):'<div style="opacity:.6;text-align:center;padding:32px 12px">Напишите вопрос — сообщение сразу появится у администратора.</div>';
      if (wasBottom||!rows.length) box.scrollTop=box.scrollHeight;
    } catch(e) {
      var messages=state.panel.querySelector('.qr-support-messages');
      if (messages&&!messages.dataset.errorShown) { messages.dataset.errorShown='1'; messages.innerHTML='<div style="padding:20px;color:#b42318">Ошибка загрузки поддержки: '+escapeHtml(e.message||e)+'</div>'; }
    }
  }

  async function send() {
    if (state.sending||!state.panel) return;
    var input=state.panel.querySelector('textarea'), text=input&&input.value.trim(); if (!text) return;
    state.sending=true; var button=state.panel.querySelector('.qr-support-send'); if (button) button.disabled=true;
    try { var client=db(), threadId=await ensureThread(); var result=await client.rpc('manager_support_send',{p_thread_id:threadId,p_message:text}); if(result.error)throw result.error; input.value=''; await loadMessages(); input.focus(); }
    catch(e) { alert('Не удалось отправить сообщение: '+(e.message||e)); }
    finally { state.sending=false; if(button)button.disabled=false; }
  }

  function createPanel() {
    state.panel=document.createElement('div'); state.panel.className='glass card qr-support-panel';
    state.panel.innerHTML=`<div class="qr-support-head"><div class="qr-support-title">Поддержка</div><div class="qr-support-status">Онлайн</div></div><div class="qr-support-body"><div class="qr-support-messages"></div><div class="qr-support-compose"><textarea class="input" placeholder="Напишите вопрос администрации…" rows="2"></textarea><button class="btn qr-support-send" type="button">Отправить</button></div></div>`;
    state.panel.querySelector('.qr-support-send').addEventListener('click',send);
    state.panel.querySelector('textarea').addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}});
  }

  function closeMobileNav() { if(window.matchMedia&&window.matchMedia('(max-width:900px)').matches){document.body.classList.remove('nav-open');document.documentElement.style.overflow='';document.body.style.overflow='';} }

  function syncMode() {
    var wrap=document.querySelector('#app .wrap'); if(!wrap)return;
    var active=!!(document.querySelector('[data-tab="support"].active')||document.querySelector('.tab-support.active'));
    wrap.classList.toggle('qr-support-mode',active);
    if(active){closeMobileNav();if(!state.panel)createPanel();if(state.panel.parentNode!==wrap)wrap.appendChild(state.panel);loadMessages();if(state.timer)clearInterval(state.timer);state.timer=setInterval(loadMessages,10000);}
    else{if(state.timer)clearInterval(state.timer);state.timer=null;if(state.panel&&state.panel.parentNode)state.panel.parentNode.removeChild(state.panel);state.panel=null;}
  }

  function addNavButton() {
    var tabs=document.querySelector('#app .tabs'); if(!tabs||tabs.querySelector('[data-tab="support"]'))return;
    var button=document.createElement('button'); button.type='button';button.className='tab tab-support';button.dataset.tab='support';button.textContent='🛟 Поддержка';
    button.addEventListener('click',function(){closeMobileNav();tabs.querySelectorAll('.tab').forEach(function(el){el.classList.remove('active');});button.classList.add('active');tabs.querySelectorAll('[data-tab-panel]').forEach(function(el){el.hidden=true;});syncMode();});
    tabs.appendChild(button);
  }

  function boot(){styles();addNavButton();syncMode();}
  var observer=new MutationObserver(function(){addNavButton();syncMode();});
  function init(){boot();var root=document.getElementById('app');if(root)observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();