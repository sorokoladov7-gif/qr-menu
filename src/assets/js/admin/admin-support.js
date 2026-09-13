/* QR-Menu — администратор: мессенджер поддержки управляющих */
(function(){
  'use strict';
  if(window.__QR_ADMIN_SUPPORT__)return;
  window.__QR_ADMIN_SUPPORT__=true;

  var state={threads:[],selected:null,messages:[],panel:null,timer:null,unreadTimer:null,button:null,unreadByThread:{},unreadTotal:0,open:false,loading:false};

  function vm(){var a=window.__QR_ADMIN_VUE_APP__;return a&&a._instance&&a._instance.proxy?a._instance.proxy:null;}
  function esc(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){try{return window.fmtDate?window.fmtDate(v):new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}

  function styles(){
    if(document.getElementById('qr-admin-support-style'))return;
    var s=document.createElement('style');s.id='qr-admin-support-style';
    s.textContent='\
.qr-admin-support-panel{position:fixed;inset:0;z-index:99990;display:grid;grid-template-columns:340px minmax(0,1fr);min-height:100dvh;width:100vw;overflow:hidden!important;padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:#0b1220;color:#eef2f7}\
.qr-admin-support-sidebar{display:flex;flex-direction:column;min-width:0;border-right:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.96)}\
.qr-admin-support-sidebar-head{padding:20px 18px 14px;border-bottom:1px solid rgba(255,255,255,.08)}\
.qr-admin-support-sidebar-title{font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}\
.qr-admin-support-sidebar-sub{margin-top:5px;color:#94a3b8;font-size:11px}\
.qr-admin-support-search{margin-top:13px;width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#eef2f7;outline:none}\
.qr-admin-support-list{flex:1;min-height:0;overflow:auto}\
.qr-admin-support-item{display:block;width:100%;box-sizing:border-box;text-align:left;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#eef2f7;padding:14px 15px;cursor:pointer}\
.qr-admin-support-item:hover,.qr-admin-support-item.active{background:rgba(99,102,241,.12)}\
.qr-admin-support-item .name{font-weight:800;font-size:13px;display:flex;align-items:center;gap:7px;min-width:0}\
.qr-admin-support-item .name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.qr-admin-support-item .meta{margin-top:5px;color:#94a3b8;font-size:10px}\
.qr-admin-support-item .preview{margin-top:7px;color:#cbd5e1;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.qr-admin-support-unread{display:inline-flex;min-width:18px;height:18px;padding:0 5px;align-items:center;justify-content:center;box-sizing:border-box;border-radius:999px;background:#f87171;color:#fff;font:800 10px/1 system-ui;flex:0 0 auto}\
.qr-admin-support-chat{min-width:0;display:flex;flex-direction:column;background:#0b1220}\
.qr-admin-support-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(11,18,32,.96)}\
.qr-admin-support-head .title{font-size:17px;font-weight:800}\
.qr-admin-support-head .sub{margin-top:4px;color:#94a3b8;font-size:11px}\
.qr-admin-support-head .status{display:inline-flex;align-items:center;gap:6px;margin-top:6px;color:#94a3b8;font-size:10px}\
.qr-admin-support-head .dot{width:7px;height:7px;border-radius:50%;background:#22c55e}\
.qr-admin-support-close{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:#cbd5e1;border-radius:9px;padding:7px 11px;cursor:pointer;font:inherit;white-space:nowrap}\
.qr-admin-support-close:hover{background:rgba(255,255,255,.09);color:#fff}\
.qr-admin-support-messages{flex:1;min-height:0;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:10px}\
.qr-admin-support-msg{max-width:min(760px,82%);padding:10px 13px;border-radius:13px;border:1px solid rgba(255,255,255,.07);white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.45;box-shadow:0 4px 18px rgba(0,0,0,.08)}\
.qr-admin-support-msg.manager{align-self:flex-start;background:rgba(248,113,113,.08);border-bottom-left-radius:5px}\
.qr-admin-support-msg.admin{align-self:flex-end;background:rgba(99,102,241,.14);border-bottom-right-radius:5px}\
.qr-admin-support-meta{display:block;margin-top:5px;color:#94a3b8;font-size:10px}\
.qr-admin-support-compose{display:flex;gap:10px;padding:13px 16px;border-top:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.72)}\
.qr-admin-support-compose textarea{flex:1;min-height:52px;resize:vertical;max-height:160px;border-radius:11px;padding:10px 12px;box-sizing:border-box;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);color:#eef2f7;font:inherit;outline:none}\
.qr-admin-support-compose textarea:focus{border-color:rgba(99,102,241,.65)}\
.qr-admin-support-compose button{min-width:105px}\
.qr-admin-support-empty{margin:auto;text-align:center;color:#94a3b8;padding:30px}\
.qr-admin-support-error{color:#fca5a5}\
@media(max-width:760px){.qr-admin-support-panel{grid-template-columns:1fr}.qr-admin-support-sidebar{max-height:40dvh;border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}.qr-admin-support-messages{padding:14px}.qr-admin-support-msg{max-width:94%}.qr-admin-support-compose{padding:10px}.qr-admin-support-compose button{min-width:88px}}';
    document.head.appendChild(s);
  }

  function nav(){
    var tabs=document.querySelector('#app .tabs');if(!tabs)return;
    var b=tabs.querySelector('[data-qr-admin-support-nav]');
    if(!b){b=document.createElement('button');b.type='button';b.setAttribute('data-qr-admin-support-nav','1');b.innerHTML='🛟 Поддержка<span class="qr-admin-support-badge" data-admin-support-badge style="display:none">0</span>';tabs.appendChild(b);}
    b.onclick=function(e){e.preventDefault();e.stopPropagation();openSupport();};
    state.button=b;b.classList.toggle('on',!!(vm()&&vm().tab==='support'));
  }

  function setBadge(n){
    state.unreadTotal=Number(n)||0;var b=state.button&&state.button.querySelector('[data-admin-support-badge]');
    if(b){b.textContent=String(state.unreadTotal);b.style.display=state.unreadTotal?'inline-flex':'none';}
  }

  async function unread(){
    try{
      var r=await db.from('manager_support_messages').select('id,thread_id').eq('sender_role','manager').is('read_at',null);
      if(r.error)throw r.error;state.unreadByThread={};
      (r.data||[]).forEach(function(x){state.unreadByThread[x.thread_id]=(state.unreadByThread[x.thread_id]||0)+1;});
      setBadge((r.data||[]).length);renderList();
    }catch(e){console.warn('[QR Admin Support] unread:',e);}
  }

  async function loadThreads(){
    if(state.loading)return;state.loading=true;
    try{
      var r=await db.from('manager_support_threads').select('id,manager_id,venue_id,subject,status,last_message_at,created_at').neq('status','closed').order('last_message_at',{ascending:false});
      if(r.error)throw r.error;
      var rows=r.data||[],ids=rows.map(function(x){return x.manager_id;}),profiles={};
      if(ids.length){var p=await db.from('profiles').select('id,display_name,email').in('id',ids);if(p.error)throw p.error;(p.data||[]).forEach(function(x){profiles[x.id]=x;});}
      rows.forEach(function(x){x.manager=profiles[x.manager_id]||{};});state.threads=rows;
      await unread();
      renderList();
      if(!state.selected&&rows.length)await selectThread(rows[0].id);
      else if(state.selected&&!rows.some(function(x){return x.id===state.selected;})){state.selected=null;state.messages=[];renderChat(false);}
      else if(state.selected)renderChat(false);
    }catch(e){renderError(e);}finally{state.loading=false;}
  }

  async function selectThread(id){
    if(!id)return;state.selected=id;renderList();
    try{
      var r=await db.from('manager_support_messages').select('id,thread_id,sender_role,message,created_at,read_at').eq('thread_id',id).order('created_at',{ascending:true});
      if(r.error)throw r.error;state.messages=r.data||[];
      var m=await db.from('manager_support_messages').update({read_at:new Date().toISOString()}).eq('thread_id',id).eq('sender_role','manager').is('read_at',null);
      if(m.error)throw m.error;
      await unread();renderChat(true);
    }catch(e){renderError(e);}
  }

  function renderList(){
    var box=state.panel&&state.panel.querySelector('[data-admin-support-list]');if(!box)return;
    var q=String(state.panel.querySelector('[data-admin-support-search]')&&state.panel.querySelector('[data-admin-support-search]').value||'').trim().toLowerCase();
    var rows=state.threads.filter(function(t){var n=(t.manager.display_name||t.manager.email||'Управляющий')+' '+(t.subject||'');return !q||n.toLowerCase().indexOf(q)!==-1;});
    box.innerHTML=rows.length?rows.map(function(t){
      var n=t.manager.display_name||t.manager.email||'Управляющий',u=Number(state.unreadByThread[t.id]||0);
      return '<button class="qr-admin-support-item '+(state.selected===t.id?'active':'')+'" data-thread="'+esc(t.id)+'"><div class="name"><span class="name-text">'+esc(n)+'</span>'+(u?' <span class="qr-admin-support-unread">'+u+'</span>':'')+'</div><div class="meta">'+esc(t.status==='in_progress'?'В работе':'Открыто')+' · '+esc(fmt(t.last_message_at))+'</div><div class="preview">'+esc(t.subject||'Поддержка')+'</div></button>';
    }).join(''):'<div class="qr-admin-support-empty">'+(q?'Ничего не найдено.':'Обращений пока нет.')+'</div>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-thread]'),function(b){b.onclick=function(){selectThread(b.getAttribute('data-thread'));};});
  }

  function renderChat(scroll){
    var t=state.threads.find(function(x){return x.id===state.selected;}),h=state.panel&&state.panel.querySelector('[data-admin-support-head]'),box=state.panel&&state.panel.querySelector('[data-admin-support-messages]');
    if(!h||!box)return;
    if(!t){h.innerHTML='<div><div class="title">Поддержка</div><div class="sub">Выберите обращение управляющего слева</div></div><button type="button" class="qr-admin-support-close" data-admin-support-close>✕ Закрыть</button>';box.innerHTML='<div class="qr-admin-support-empty">Выберите вопрос управляющего.</div>';bindClose();return;}
    var n=t.manager.display_name||t.manager.email||'Управляющий';
    h.innerHTML='<div><div class="title">'+esc(n)+'</div><div class="sub">'+esc(t.manager.email||'')+' · '+esc(t.subject||'Поддержка')+'</div><div class="status"><span class="dot"></span>'+esc(t.status==='in_progress'?'В работе':'Открыто')+'</div></div><button type="button" class="qr-admin-support-close" data-admin-support-close>✕ Закрыть</button>';
    box.innerHTML=state.messages.length?state.messages.map(function(m){return '<div class="qr-admin-support-msg '+(m.sender_role==='manager'?'manager':'admin')+'">'+esc(m.message)+'<span class="qr-admin-support-meta">'+(m.sender_role==='manager'?esc(n):'Администратор')+' · '+esc(fmt(m.created_at))+'</span></div>';}).join(''):'<div class="qr-admin-support-empty">Сообщений пока нет.</div>';
    if(scroll)box.scrollTop=box.scrollHeight;bindClose();
  }

  function bindClose(){var b=state.panel&&state.panel.querySelector('[data-admin-support-close]');if(b)b.onclick=function(e){e.preventDefault();e.stopPropagation();closeSupport();var p=vm();if(p)p.tab='';nav();};}
  function renderError(e){var box=state.panel&&state.panel.querySelector('[data-admin-support-messages]');if(box)box.innerHTML='<div class="qr-admin-support-empty qr-admin-support-error">Ошибка загрузки поддержки.<br><small>'+esc(e.message||e)+'</small></div>';}

  async function send(){
    var ta=state.panel&&state.panel.querySelector('textarea'),btn=state.panel&&state.panel.querySelector('[data-admin-support-send]'),text=String(ta&&ta.value||'').trim();
    if(!text||!state.selected)return;ta.disabled=true;btn.disabled=true;
    try{var r=await db.rpc('manager_support_send',{p_thread_id:state.selected,p_message:text});if(r.error)throw r.error;ta.value='';await loadThreads();await selectThread(state.selected);}
    catch(e){alert('Не удалось отправить ответ: '+(e.message||e));}
    finally{ta.disabled=false;btn.disabled=false;ta.focus();}
  }

  function makePanel(){
    if(state.panel&&document.body.contains(state.panel))return state.panel;
    var p=document.createElement('section');p.className='qr-admin-support-panel';
    p.innerHTML='<aside class="qr-admin-support-sidebar"><div class="qr-admin-support-sidebar-head"><div class="qr-admin-support-sidebar-title"><span>Поддержка</span><span class="qr-admin-support-unread" data-admin-support-total style="display:none">0</span></div><div class="qr-admin-support-sidebar-sub">Чат с управляющими</div><input class="qr-admin-support-search" data-admin-support-search type="search" placeholder="Поиск управляющего..."></div><div class="qr-admin-support-list" data-admin-support-list></div></aside><main class="qr-admin-support-chat"><div class="qr-admin-support-head" data-admin-support-head></div><div class="qr-admin-support-messages" data-admin-support-messages></div><div class="qr-admin-support-compose"><textarea maxlength="8000" placeholder="Напишите ответ управляющему..."></textarea><button class="btn btn-primary" type="button" data-admin-support-send>Ответить</button></div></main>';
    document.body.appendChild(p);state.panel=p;
    p.querySelector('[data-admin-support-send]').onclick=send;
    p.querySelector('textarea').onkeydown=function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}};
    p.querySelector('[data-admin-support-search]').oninput=renderList;
    p.querySelector('[data-admin-support-total]').onclick=function(){var i=p.querySelector('[data-admin-support-search]');if(i){i.value='';i.focus();renderList();}};
    return p;
  }

  function openSupport(){
    styles();var p=vm();if(p&&p.tab!=='support')p.tab='support';
    var panel=makePanel();if(!state.open){state.open=true;panel.style.display='grid';loadThreads();}
    if(state.timer)clearInterval(state.timer);state.timer=setInterval(function(){var x=vm();if(state.open&&x&&x.tab==='support'){loadThreads();if(state.selected)selectThread(state.selected);}},10000);
    renderList();renderChat(false);
  }

  function closeSupport(){
    state.open=false;if(state.panel)state.panel.style.display='none';if(state.timer){clearInterval(state.timer);state.timer=null;}
  }

  function sync(){
    var p=vm();if(!p)return;nav();if(p.tab==='support')openSupport();else closeSupport();
  }

  function boot(){
    styles();var tries=0,t=setInterval(function(){nav();sync();if(++tries>240)clearInterval(t);},250);
    unread();state.unreadTimer=setInterval(unread,10000);
    var root=document.getElementById('app');if(root)new MutationObserver(function(){nav();}).observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
