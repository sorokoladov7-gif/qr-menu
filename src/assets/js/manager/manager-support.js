/* QR-Menu — поддержка управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUPPORT__)return;
  window.__QR_MANAGER_SUPPORT__=true;
  var state={threadId:null,messages:[],panel:null,poll:null,unreadPoll:null,navObserver:null};
  function vm(){return window.__managerVue||null;}
  function esc(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){try{return window.fmtDate?window.fmtDate(v):new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
  function setUnreadBadge(n){
    var b=document.querySelector('[data-qr-support-badge]');
    if(!b)return;
    n=Number(n)||0;
    b.textContent=n>99?'99+':String(n);
    b.style.display=n?'inline-flex':'none';
  }
  async function refreshUnread(){
    try{
      var r=await db.from('manager_support_threads').select('id').limit(1);
      if(r.error)throw r.error;
      var ids=(r.data||[]).map(function(x){return x.id;});
      if(!ids.length){setUnreadBadge(0);return;}
      var m=await db.from('manager_support_messages').select('id').in('thread_id',ids).eq('sender_role','admin').is('read_at',null);
      if(m.error)throw m.error;
      setUnreadBadge((m.data||[]).length);
    }catch(e){console.warn('[QR Manager Support] unread',e);}
  }
  function ensureNav(){
    var root=document.getElementById('app'),tabs=root&&root.querySelector('.tabs');
    if(!tabs)return false;
    var b=tabs.querySelector('[data-qr-support-nav]');
    if(!b){
      b=document.createElement('button');b.type='button';b.setAttribute('data-qr-support-nav','1');
      b.innerHTML='🛟 Поддержка <span data-qr-support-badge style="display:none;min-width:18px;height:18px;padding:0 5px;margin-left:5px;align-items:center;justify-content:center;border-radius:999px;background:#ef4444;color:#fff;font:800 10px system-ui;vertical-align:middle"></span>';
      tabs.appendChild(b);
    }
    b.onclick=function(e){e.preventDefault();e.stopPropagation();var v=vm();if(!v)return;v.tab='support';showSupport();};
    b.classList.toggle('on',!!(vm()&&vm().tab==='support'));
    return true;
  }
  function makePanel(){
    if(state.panel&&document.body.contains(state.panel))return state.panel;
    var p=document.getElementById('qr-manager-support-panel');
    if(p){state.panel=p;return p;}
    p=document.createElement('section');p.id='qr-manager-support-panel';
    p.style.cssText='display:none;position:fixed;inset:0;z-index:99998;box-sizing:border-box;overflow:auto;padding:24px;min-height:100dvh;width:100vw;border:0;border-radius:0;background:#0b1220;color:#eef2f7;';
    p.innerHTML='<div style="width:100%;min-height:calc(100dvh - 48px);box-sizing:border-box;display:flex;flex-direction:column"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><h3 style="margin:0">Поддержка</h3><div style="font-size:12px;color:#94a3b8;margin-top:4px">Напишите администратору — ответ появится здесь автоматически.</div></div><div style="display:flex;align-items:center;gap:10px"><span data-support-status style="font-size:12px;color:#94a3b8"></span><button type="button" data-support-refresh class="btn">↻</button><button type="button" data-support-close class="btn">✕ Закрыть</button></div></div><div data-support-messages style="flex:1;min-height:0;overflow:auto;padding:14px;border-radius:12px;background:rgba(2,6,23,.35)"></div><div style="display:flex;gap:8px;margin-top:12px"><textarea data-support-text maxlength="8000" placeholder="Опишите вопрос..." style="flex:1;min-height:80px;resize:vertical;box-sizing:border-box"></textarea><button type="button" data-support-send class="btn">Отправить</button></div></div>';
    document.body.appendChild(p);state.panel=p;
    p.querySelector('[data-support-send]').onclick=send;
    p.querySelector('[data-support-refresh]').onclick=loadMessages;
    p.querySelector('[data-support-close]').onclick=function(e){e.preventDefault();e.stopPropagation();var v=vm();if(v)v.tab='';hideSupport();ensureNav();};
    p.querySelector('textarea').addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}});
    return p;
  }
  async function ensureThread(){if(state.threadId)return state.threadId;var r=await db.rpc('manager_support_get_or_create_thread');if(r.error)throw r.error;state.threadId=r.data;return state.threadId;}
  async function markAdminRead(id){try{var r=await db.rpc('manager_support_mark_read',{p_thread_id:id});if(r.error)throw r.error;}catch(e){console.warn('[QR Manager Support] mark read',e);}}
  async function loadMessages(){
    try{
      var id=await ensureThread();
      var r=await db.from('manager_support_messages').select('id,thread_id,sender_role,sender_id,message,created_at,read_at').eq('thread_id',id).order('created_at',{ascending:true});
      if(r.error)throw r.error;
      state.messages=r.data||[];
      await markAdminRead(id);
      setUnreadBadge(0);
      renderMessages();
      var s=state.panel&&state.panel.querySelector('[data-support-status]');if(s)s.textContent='';
    }catch(e){var s=state.panel&&state.panel.querySelector('[data-support-status]');if(s)s.textContent='Ошибка: '+(e.message||e);console.error('[QR Manager Support]',e);}
  }
  function renderMessages(){
    if(!state.panel)return;var box=state.panel.querySelector('[data-support-messages]');if(!box)return;
    box.innerHTML=state.messages.length?state.messages.map(function(m){var mine=m.sender_role==='manager',status=mine?' · ✓':(m.read_at?' · ✓✓':' · ✓');return '<div style="display:flex;justify-content:'+(mine?'flex-end':'flex-start')+';margin:7px 0"><div style="max-width:78%;padding:9px 11px;border-radius:12px;background:'+(mine?'rgba(99,102,241,.18)':'rgba(148,163,184,.10)')+'"><div style="font-size:11px;color:#94a3b8;margin-bottom:4px">'+(mine?'Вы':'Администратор')+' · '+esc(fmt(m.created_at))+status+'</div><div style="white-space:pre-wrap;word-break:break-word">'+esc(m.message)+'</div></div></div>';}).join(''):'<div style="color:#94a3b8;text-align:center;padding:45px 10px">Сообщений пока нет. Напишите администратору.</div>';
    box.scrollTop=box.scrollHeight;
  }
  async function send(){var p=makePanel(),ta=p.querySelector('textarea'),btn=p.querySelector('[data-support-send]'),text=String(ta.value||'').trim();if(!text)return;btn.disabled=true;try{var id=await ensureThread();var r=await db.rpc('manager_support_send',{p_thread_id:id,p_message:text});if(r.error)throw r.error;ta.value='';await loadMessages();}catch(e){p.querySelector('[data-support-status]').textContent='Ошибка: '+(e.message||e);}finally{btn.disabled=false;ta.focus();}}
  function showSupport(){var p=makePanel();p.style.display='block';loadMessages();if(state.poll)clearInterval(state.poll);state.poll=setInterval(function(){var v=vm();if(v&&v.tab==='support')loadMessages();},5000);}
  function hideSupport(){if(state.panel)state.panel.style.display='none';if(state.poll){clearInterval(state.poll);state.poll=null;}}
  function sync(){var v=vm();if(!v)return;ensureNav();if(v.tab==='support')showSupport();else hideSupport();}
  function boot(){function tick(){sync();refreshUnread();}tick();setInterval(sync,500);state.unreadPoll=setInterval(refreshUnread,5000);var root=document.getElementById('app');if(root){state.navObserver=new MutationObserver(function(){setTimeout(tick,0);});state.navObserver.observe(root,{subtree:true,childList:true});}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
