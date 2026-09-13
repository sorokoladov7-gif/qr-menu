/* QR-Menu — поддержка управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUPPORT__)return;
  window.__QR_MANAGER_SUPPORT__=true;
  var state={threadId:null,messages:[],panel:null,poll:null,unreadPoll:null,syncTimer:null,navObserver:null,loading:false};
  function vm(){return window.__managerVue||null;}
  function esc(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){try{return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
  function setUnreadBadge(n){
    var b=document.querySelector('[data-qr-support-badge]');
    if(!b)return;
    n=Number(n)||0;
    b.textContent=n>99?'99+':String(n);
    b.style.display=n?'inline-flex':'none';
  }
  async function refreshUnread(){
    try{
      var user=await db.auth.getUser(),uid=user&&user.data&&user.data.user&&user.data.user.id;
      if(!uid){setUnreadBadge(0);return;}
      var id=state.threadId;
      if(!id){
        var existing=await db.from('manager_support_threads').select('id').eq('manager_id',uid).neq('status','closed').order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(existing.error)throw existing.error;
        id=existing.data&&existing.data.id;
        if(!id){setUnreadBadge(0);return;}
        state.threadId=id;
      }
      var m=await db.from('manager_support_messages').select('id').eq('thread_id',id).eq('sender_role','admin').is('read_at',null);
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
    b.onclick=function(e){e.preventDefault();e.stopPropagation();var v=vm();if(!v)return;v.tab='support';sync();};
    b.classList.toggle('on',!!(vm()&&vm().tab==='support'));
    return true;
  }
  function makePanel(){
    if(state.panel&&document.body.contains(state.panel))return state.panel;
    var p=document.getElementById('qr-manager-support-panel');
    if(p){state.panel=p;return p;}
    p=document.createElement('section');p.id='qr-manager-support-panel';
    p.style.cssText='display:none;position:fixed;top:78px;right:18px;bottom:18px;left:300px;z-index:10040;box-sizing:border-box;overflow:hidden;padding:18px;min-height:0;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:linear-gradient(145deg,rgba(15,23,42,.985),rgba(7,12,23,.985));color:#eef2f7;box-shadow:0 24px 70px rgba(0,0,0,.35);';
    p.innerHTML='<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;min-height:0"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex:0 0 auto"><div><h3 style="margin:0;font-size:20px">Поддержка</h3><div style="font-size:12px;color:#94a3b8;margin-top:4px">Прямой чат с администратором платформы.</div></div><div style="display:flex;align-items:center;gap:7px"><span data-support-status style="font-size:12px;color:#94a3b8"></span><button type="button" data-support-refresh class="btn btn-ghost" title="Обновить">↻</button><button type="button" data-support-close class="btn btn-ghost">Закрыть</button></div></div><div data-support-messages style="flex:1;min-height:0;overflow:auto;padding:16px;border-radius:14px;background:rgba(2,6,23,.42);border:1px solid rgba(148,163,184,.08)"></div><div style="display:flex;gap:8px;margin-top:10px;flex:0 0 auto"><textarea data-support-text maxlength="8000" placeholder="Опишите вопрос..." style="flex:1;min-height:72px;max-height:180px;resize:vertical;box-sizing:border-box"></textarea><button type="button" data-support-send class="btn btn-primary" style="min-width:110px">Отправить</button></div><div style="font-size:10px;color:#64748b;margin-top:5px">Ctrl+Enter — отправить</div></div>';
    document.body.appendChild(p);state.panel=p;
    p.querySelector('[data-support-send]').onclick=send;
    p.querySelector('[data-support-refresh]').onclick=function(){loadMessages(true);};
    p.querySelector('[data-support-close]').onclick=function(e){e.preventDefault();e.stopPropagation();var v=vm();if(v)v.tab='menu';hideSupport();ensureNav();};
    p.querySelector('textarea').addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}});
    return p;
  }
  async function ensureThread(){if(state.threadId)return state.threadId;var r=await db.rpc('manager_support_get_or_create_thread');if(r.error)throw r.error;state.threadId=r.data;return state.threadId;}
  async function markAdminRead(id){try{var r=await db.rpc('manager_support_mark_read',{p_thread_id:id});if(r.error)throw r.error;}catch(e){console.warn('[QR Manager Support] mark read',e);}}
  async function loadMessages(force){
    if(state.loading&&!force)return;
    state.loading=true;
    try{
      var id=await ensureThread();
      var r=await db.from('manager_support_messages').select('id,thread_id,sender_role,sender_id,message,created_at,read_at').eq('thread_id',id).order('created_at',{ascending:true});
      if(r.error)throw r.error;
      state.messages=r.data||[];
      await markAdminRead(id);
      setUnreadBadge(0);
      renderMessages();
      var s=state.panel&&state.panel.querySelector('[data-support-status]');if(s)s.textContent='';
    }catch(e){var s=state.panel&&state.panel.querySelector('[data-support-status]');if(s)s.textContent='Ошибка: '+(e.message||e);console.error('[QR Manager Support]',e);}finally{state.loading=false;}
  }
  function renderMessages(){
    if(!state.panel)return;var box=state.panel.querySelector('[data-support-messages]');if(!box)return;
    box.innerHTML=state.messages.length?state.messages.map(function(m){var mine=m.sender_role==='manager',status=mine?' · ✓':(m.read_at?' · ✓✓':' · ✓');return '<div style="display:flex;justify-content:'+(mine?'flex-end':'flex-start')+';margin:7px 0"><div style="max-width:78%;padding:10px 12px;border-radius:13px;background:'+(mine?'rgba(99,102,241,.20)':'rgba(148,163,184,.10)')+';border:1px solid rgba(148,163,184,.08)"><div style="font-size:10px;color:#94a3b8;margin-bottom:5px">'+(mine?'Вы':'Администратор')+' · '+esc(fmt(m.created_at))+status+'</div><div style="white-space:pre-wrap;word-break:break-word;line-height:1.45">'+esc(m.message)+'</div></div></div>';}).join(''):'<div style="color:#94a3b8;text-align:center;padding:45px 10px">Сообщений пока нет. Напишите администратору.</div>';
    box.scrollTop=box.scrollHeight;
  }
  async function send(){var p=makePanel(),ta=p.querySelector('textarea'),btn=p.querySelector('[data-support-send]'),text=String(ta.value||'').trim();if(!text)return;btn.disabled=true;try{var id=await ensureThread();var r=await db.rpc('manager_support_send',{p_thread_id:id,p_message:text});if(r.error)throw r.error;ta.value='';await loadMessages(true);}catch(e){p.querySelector('[data-support-status]').textContent='Ошибка: '+(e.message||e);}finally{btn.disabled=false;ta.focus();}}
  function showSupport(){var p=makePanel();p.style.display='flex';if(!state.poll)state.poll=setInterval(function(){var v=vm();if(v&&v.tab==='support')loadMessages(false);},5000);if(!state.messages.length)loadMessages(false);}
  function hideSupport(){if(state.panel)state.panel.style.display='none';if(state.poll){clearInterval(state.poll);state.poll=null;}}
  function sync(){var v=vm();if(!v)return;ensureNav();if(v.tab==='support')showSupport();else hideSupport();}
  function boot(){sync();state.syncTimer=setInterval(sync,1000);state.unreadPoll=setInterval(refreshUnread,5000);var root=document.getElementById('app');if(root){state.navObserver=new MutationObserver(function(){setTimeout(sync,0);});state.navObserver.observe(root,{subtree:true,childList:true});}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
