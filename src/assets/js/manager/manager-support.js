/* QR-Menu — поддержка управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUPPORT__)return;
  window.__QR_MANAGER_SUPPORT__=true;

  var state={threadId:null,messages:[],panel:null,poll:null,navObserver:null};
  function vm(){return window.__managerVue||null;}
  function esc(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){try{return window.fmtDate?window.fmtDate(v):new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}

  function ensureNav(){
    var root=document.getElementById('app'),tabs=root&&root.querySelector('.tabs');
    if(!tabs)return false;
    var b=tabs.querySelector('[data-qr-support-nav]');
    if(!b){
      b=document.createElement('button');
      b.type='button';
      b.setAttribute('data-qr-support-nav','1');
      b.textContent='🛟 Поддержка';
      tabs.appendChild(b);
    }
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      var v=vm();
      if(!v)return;
      v.tab='support';
      showSupport();
    };
    b.classList.toggle('on',!!(vm()&&vm().tab==='support'));
    return true;
  }

  function makePanel(){
    if(state.panel&&document.body.contains(state.panel))return state.panel;
    var p=document.getElementById('qr-manager-support-panel');
    if(p){state.panel=p;return p;}
    p=document.createElement('section');
    p.id='qr-manager-support-panel';
    p.style.cssText='display:none;position:fixed;inset:90px 24px 24px 280px;z-index:5000;overflow:auto;padding:20px;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.97);box-shadow:0 20px 60px rgba(0,0,0,.35);color:#eef2f7;';
    p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><h3 style="margin:0">Поддержка</h3><div style="font-size:12px;color:#94a3b8;margin-top:4px">Напишите администратору — сообщение появится у него в кабинете.</div></div><span data-support-status style="font-size:12px;color:#94a3b8"></span></div><div data-support-messages style="min-height:160px;max-height:calc(100vh - 300px);overflow:auto;padding:10px;border-radius:12px;background:rgba(2,6,23,.35)"></div><div style="display:flex;gap:8px;margin-top:12px"><textarea data-support-text placeholder="Опишите вопрос..." style="flex:1;min-height:80px;resize:vertical"></textarea><button type="button" data-support-send class="btn">Отправить</button></div>';
    document.body.appendChild(p);
    state.panel=p;
    p.querySelector('[data-support-send]').onclick=send;
    p.querySelector('textarea').addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}});
    return p;
  }

  async function ensureThread(){
    if(state.threadId)return state.threadId;
    var r=await db.rpc('manager_support_get_or_create_thread');
    if(r.error)throw r.error;
    state.threadId=r.data;
    return state.threadId;
  }
  async function loadMessages(){
    try{
      var id=await ensureThread();
      var r=await db.from('manager_support_messages').select('id,thread_id,sender_role,sender_id,message,created_at,read_at').eq('thread_id',id).order('created_at',{ascending:true});
      if(r.error)throw r.error;
      state.messages=r.data||[];
      renderMessages();
      var s=state.panel&&state.panel.querySelector('[data-support-status]');
      if(s)s.textContent='';
    }catch(e){
      var s=state.panel&&state.panel.querySelector('[data-support-status]');
      if(s)s.textContent='Ошибка: '+(e.message||e);
      console.error('[QR Manager Support]',e);
    }
  }
  function renderMessages(){
    if(!state.panel)return;
    var box=state.panel.querySelector('[data-support-messages]');
    if(!box)return;
    box.innerHTML=state.messages.length?state.messages.map(function(m){
      var mine=m.sender_role==='manager';
      return '<div style="display:flex;justify-content:'+(mine?'flex-end':'flex-start')+';margin:7px 0"><div style="max-width:78%;padding:9px 11px;border-radius:12px;background:'+(mine?'rgba(99,102,241,.18)':'rgba(148,163,184,.10)')+'"><div style="font-size:11px;color:#94a3b8;margin-bottom:4px">'+(mine?'Вы':'Администратор')+' · '+esc(fmt(m.created_at))+'</div><div style="white-space:pre-wrap;word-break:break-word">'+esc(m.message)+'</div></div></div>';
    }).join(''):'<div style="color:#94a3b8;text-align:center;padding:45px 10px">Сообщений пока нет. Напишите администратору.</div>';
    box.scrollTop=box.scrollHeight;
  }
  async function send(){
    var p=makePanel(),ta=p.querySelector('textarea'),btn=p.querySelector('[data-support-send]'),text=String(ta.value||'').trim();
    if(!text)return;
    btn.disabled=true;
    try{
      var id=await ensureThread();
      var r=await db.rpc('manager_support_send',{p_thread_id:id,p_message:text});
      if(r.error)throw r.error;
      ta.value='';
      await loadMessages();
    }catch(e){p.querySelector('[data-support-status]').textContent='Ошибка: '+(e.message||e);}
    finally{btn.disabled=false;ta.focus();}
  }
  function showSupport(){
    var p=makePanel();
    p.style.display='block';
    loadMessages();
    if(state.poll)clearInterval(state.poll);
    state.poll=setInterval(function(){var v=vm();if(v&&v.tab==='support')loadMessages();},10000);
  }
  function hideSupport(){
    if(state.panel)state.panel.style.display='none';
    if(state.poll){clearInterval(state.poll);state.poll=null;}
  }
  function sync(){
    var v=vm();
    if(!v)return;
    ensureNav();
    if(v.tab==='support')showSupport();
    else hideSupport();
  }

  function boot(){
    function tick(){sync();}
    tick();
    setInterval(tick,500);
    var root=document.getElementById('app');
    if(root){
      state.navObserver=new MutationObserver(function(){setTimeout(tick,0);});
      state.navObserver.observe(root,{subtree:true,childList:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
