/* QR-Menu — поддержка управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUPPORT__)return;
  window.__QR_MANAGER_SUPPORT__=true;

  var state={threadId:null,messages:[],panel:null,poll:null};
  var vm=function(){return window.__managerVue||null;};
  var esc=function(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});};
  var fmt=function(v){try{return window.fmtDate?window.fmtDate(v):new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}};

  function ensureNav(){
    var root=document.getElementById('app');
    var tabs=root&&root.querySelector('.tabs');
    if(!tabs)return false;
    var old=tabs.querySelector('[data-qr-support-nav]');
    if(old){
      old.onclick=function(e){e.preventDefault();e.stopPropagation();openSupport();};
      return true;
    }
    var b=document.createElement('button');
    b.type='button';
    b.setAttribute('data-qr-support-nav','1');
    b.textContent='🛟 Поддержка';
    b.onclick=function(e){e.preventDefault();e.stopPropagation();openSupport();};
    tabs.appendChild(b);
    return true;
  }

  function makePanel(){
    if(state.panel)return state.panel;
    var p=document.createElement('section');
    p.id='qr-manager-support-panel';
    p.style.cssText='display:none;margin-top:18px;padding:18px;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(15,23,42,.72);';
    p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><h3 style="margin:0">Поддержка</h3><div style="font-size:12px;color:#94a3b8;margin-top:4px">Напишите администратору — сообщение появится у него в кабинете.</div></div><span data-support-status style="font-size:12px;color:#94a3b8"></span></div><div data-support-messages style="min-height:160px;max-height:420px;overflow:auto;padding:10px;border-radius:12px;background:rgba(2,6,23,.35)"></div><div style="display:flex;gap:8px;margin-top:12px"><textarea data-support-text placeholder="Опишите вопрос..." style="flex:1;min-height:80px;resize:vertical"></textarea><button type="button" data-support-send class="btn">Отправить</button></div>';
    var app=document.getElementById('app');
    (app&&app.querySelector('.wrap')||app||document.body).appendChild(p);
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
    }catch(e){
      var s=state.panel&&state.panel.querySelector('[data-support-status]');
      if(s)s.textContent='Ошибка: '+(e.message||e);
      console.error('[QR Manager Support]',e);
    }
  }

  function renderMessages(){
    if(!state.panel)return;
    var box=state.panel.querySelector('[data-support-messages]');
    var profile=vm()&&vm().profile;
    box.innerHTML=state.messages.length?state.messages.map(function(m){var mine=m.sender_role==='manager';return '<div style="display:flex;justify-content:'+(mine?'flex-end':'flex-start')+';margin:7px 0"><div style="max-width:78%;padding:9px 11px;border-radius:12px;background:'+(mine?'rgba(99,102,241,.18)':'rgba(148,163,184,.10)')+'"><div style="font-size:11px;color:#94a3b8;margin-bottom:4px">'+(mine?'Вы':'Администратор')+' · '+esc(fmt(m.created_at))+'</div><div style="white-space:pre-wrap">'+esc(m.message)+'</div></div></div>';}).join(''):'<div style="color:#94a3b8;text-align:center;padding:45px 10px">Сообщений пока нет. Напишите администратору.</div>';
    box.scrollTop=box.scrollHeight;
  }

  async function send(){
    var p=makePanel(),ta=p.querySelector('textarea'),text=(ta.value||'').trim();
    if(!text)return;
    var btn=p.querySelector('[data-support-send]');btn.disabled=true;
    try{
      var id=await ensureThread();
      var r=await db.rpc('manager_support_send',{p_thread_id:id,p_message:text});
      if(r.error)throw r.error;
      ta.value='';
      await loadMessages();
    }catch(e){p.querySelector('[data-support-status]').textContent='Ошибка: '+(e.message||e);}
    finally{btn.disabled=false;}
  }

  function openSupport(){
    var v=vm();
    if(!v){setTimeout(openSupport,100);return;}
    if(typeof v.tab==='string')v.tab='support';
    var p=makePanel();
    p.style.display='block';
    var root=document.getElementById('app');
    Array.prototype.forEach.call(root.querySelectorAll('[data-qr-manager-main-section]'),function(x){x.style.display='none';});
    loadMessages();
    if(state.poll)clearInterval(state.poll);
    state.poll=setInterval(function(){if(vm()&&vm().tab==='support')loadMessages();},10000);
  }

  function sync(){
    var v=vm();
    if(!v)return;
    ensureNav();
    var p=state.panel;
    if(v.tab==='support'){
      if(!p) p=makePanel();
      p.style.display='block';
      loadMessages();
    }else if(p){p.style.display='none';}
  }

  var observer=new MutationObserver(function(){setTimeout(sync,0);});
  function boot(){
    if(!document.getElementById('app'))return setTimeout(boot,100);
    ensureNav();
    observer.observe(document.getElementById('app'),{subtree:true,childList:true});
    setInterval(sync,1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
