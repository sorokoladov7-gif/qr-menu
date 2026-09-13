/* QR-Menu — поддержка управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SUPPORT__)return;
  window.__QR_MANAGER_SUPPORT__=true;

  var state={threadId:null,messages:[],panel:null,poll:null,button:null};
  var vm=function(){return window.__managerVue||null;};
  var esc=function(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});};
  var fmt=function(v){try{return window.fmtDate?window.fmtDate(v):new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return '';}};

  /* ВАЖНО: manager-support загружается SW в <head>, раньше Vue.
     Поэтому навигационная кнопка добавляется в шаблон ДО app.mount(). */
  function injectNavIntoVueTemplate(){
    var tabs=document.querySelector('#app .tabs');
    if(!tabs||tabs.querySelector('[data-qr-support-nav]'))return;
    var b=document.createElement('button');
    b.type='button';
    b.setAttribute('data-qr-support-nav','1');
    b.setAttribute('v-bind:class',"{on:tab==='support'}");
    b.setAttribute('v-on:click',"tab='support'");
    b.innerHTML='🛟 Поддержка<span class="qr-support-badge" data-support-badge style="display:none">0</span>';
    tabs.appendChild(b);
  }

  function hookVue(){
    if(!window.Vue||typeof window.Vue.createApp!=='function')return false;
    if(window.Vue.__QR_MANAGER_SUPPORT_HOOK__)return true;
    var original=window.Vue.createApp;
    window.Vue.createApp=function(){
      injectNavIntoVueTemplate();
      return original.apply(this,arguments);
    };
    window.Vue.__QR_MANAGER_SUPPORT_HOOK__=true;
    return true;
  }

  function styles(){
    if(document.getElementById('qr-manager-support-style'))return;
    var s=document.createElement('style');s.id='qr-manager-support-style';s.textContent=
      '.qr-support-badge{display:inline-flex;min-width:18px;height:18px;padding:0 5px;align-items:center;justify-content:center;border-radius:999px;background:#f87171;color:#fff;font:800 10px/1 system-ui;margin-left:6px}'+
      '.qr-support-panel{position:relative;min-height:520px;padding:0!important;overflow:hidden}.qr-support-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08)}'+
      '.qr-support-title{font-size:18px;font-weight:800}.qr-support-sub{margin-top:3px;color:#94a3b8;font-size:12px}.qr-support-body{display:flex;flex-direction:column;height:calc(100vh - 260px);min-height:420px;max-height:700px}'+
      '.qr-support-messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:10px}.qr-support-msg{max-width:min(760px,86%);padding:11px 13px;border-radius:14px;border:1px solid rgba(255,255,255,.07);line-height:1.45;font-size:13px;white-space:pre-wrap;word-break:break-word}'+
      '.qr-support-msg.manager{align-self:flex-end;background:rgba(99,102,241,.13)}.qr-support-msg.admin{align-self:flex-start;background:rgba(255,255,255,.035)}'+
      '.qr-support-meta{display:block;margin-top:6px;color:#94a3b8;font-size:10px}.qr-support-empty{margin:auto;color:#94a3b8;text-align:center;padding:30px}'+
      '.qr-support-compose{display:flex;gap:10px;padding:14px 18px;border-top:1px solid rgba(255,255,255,.08);background:rgba(8,12,22,.55)}'+
      '.qr-support-compose textarea{flex:1;min-height:52px;max-height:150px;resize:vertical;border-radius:12px;padding:11px 12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);color:#eef2f7;font:inherit;outline:none}'+
      '@media(max-width:700px){.qr-support-body{height:calc(100vh - 245px);min-height:420px}.qr-support-compose{flex-direction:column}.qr-support-compose .btn{width:100%}.qr-support-msg{max-width:94%}}';
    document.head.appendChild(s);
  }

  async function ensureThread(){
    if(state.threadId)return state.threadId;
    var v=vm();
    if(!v||!v.venue||!v.venue.id)throw new Error('Сначала выберите заведение');
    var r=await db.rpc('manager_support_get_or_create_thread',{p_venue_id:v.venue.id,p_subject:'Поддержка платформы'});
    if(r.error)throw r.error;
    state.threadId=r.data;
    return state.threadId;
  }

  async function loadMessages(scroll){
    try{
      var id=await ensureThread();
      var r=await db.from('manager_support_messages').select('id,thread_id,sender_role,message,created_at').eq('thread_id',id).order('created_at',{ascending:true});
      if(r.error)throw r.error;
      state.messages=r.data||[];renderMessages(scroll);
    }catch(e){
      var box=state.panel&&state.panel.querySelector('[data-support-messages]');
      if(box)box.innerHTML='<div class="qr-support-empty">Не удалось загрузить поддержку.<br><small>'+esc(e.message||e)+'</small></div>';
    }
  }

  function renderMessages(scroll){
    var box=state.panel&&state.panel.querySelector('[data-support-messages]');if(!box)return;
    box.innerHTML=state.messages.length?state.messages.map(function(m){return '<div class="qr-support-msg '+(m.sender_role==='manager'?'manager':'admin')+'">'+esc(m.message)+'<span class="qr-support-meta">'+(m.sender_role==='manager'?'Вы':'Администратор')+' · '+esc(fmt(m.created_at))+'</span></div>';}).join(''):'<div class="qr-support-empty">Напишите вопрос — сообщение сразу появится у администратора.</div>';
    if(scroll)box.scrollTop=box.scrollHeight;
  }

  async function send(){
    var ta=state.panel&&state.panel.querySelector('textarea');var text=String(ta&&ta.value||'').trim();if(!text)return;
    ta.disabled=true;
    try{var id=await ensureThread();var r=await db.rpc('manager_support_send',{p_thread_id:id,p_message:text});if(r.error)throw r.error;ta.value='';await loadMessages(true);}
    catch(e){alert('Не удалось отправить сообщение: '+(e.message||e));}
    finally{ta.disabled=false;ta.focus();}
  }

  function open(){
    styles();
    var v=vm();if(!v||!v.profile||v.profile.role!=='manager')return;
    var wrap=document.querySelector('#app .wrap');if(!wrap)return;
    if(state.panel)state.panel.remove();
    state.panel=document.createElement('div');state.panel.className='glass card qr-support-panel';
    state.panel.innerHTML='<div class="qr-support-head"><div><div class="qr-support-title">Поддержка</div><div class="qr-support-sub">Связь с администратором платформы</div></div><span class="badge">Онлайн</span></div><div class="qr-support-body"><div class="qr-support-messages" data-support-messages><div class="qr-support-empty">Загрузка…</div></div><div class="qr-support-compose"><textarea maxlength="8000" placeholder="Опишите вопрос или проблему…"></textarea><button class="btn btn-primary" type="button" data-support-send>Отправить</button></div></div>';
    wrap.appendChild(state.panel);
    state.panel.querySelector('[data-support-send]').addEventListener('click',send);
    state.panel.querySelector('textarea').addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();send();}});
    loadMessages(true);
    if(state.poll)clearInterval(state.poll);state.poll=setInterval(function(){if(vm()&&vm().tab==='support')loadMessages(false);},10000);
  }

  function sync(){
    var v=vm(),wrap=document.querySelector('#app .wrap');if(!v||!wrap)return;
    if(v.tab==='support'){
      if(!state.panel)open();
    }else if(state.panel){state.panel.remove();state.panel=null;}
    if(state.button)state.button.classList.toggle('on',v.tab==='support');
  }

  function badge(){
    var v=vm();if(!v||!v.profile||v.profile.role!=='manager'||!state.button)return;
    db.from('manager_support_threads').select('id').eq('manager_id',v.profile.id).neq('status','closed').limit(1).maybeSingle().then(function(r){
      if(r.error||!r.data){setBadge(0);return;}
      return db.from('manager_support_messages').select('sender_role').eq('thread_id',r.data.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    }).then(function(r){if(r&&r.data)setBadge(r.data.sender_role==='admin'?1:0);}).catch(function(){});
  }
  function setBadge(n){var b=state.button&&state.button.querySelector('[data-support-badge]');if(b){b.textContent=String(n);b.style.display=n?'inline-flex':'none';}}

  function boot(){
    styles();
    injectNavIntoVueTemplate();
    var tries=0;
    var timer=setInterval(function(){
      hookVue();
      injectNavIntoVueTemplate();
      if(window.__managerVue){state.button=document.querySelector('[data-qr-support-nav]');sync();badge();clearInterval(timer);setInterval(function(){sync();badge();},1000);}
      if(++tries>300)clearInterval(timer);
    },50);
    window.addEventListener('qr-manager-vue-ready',function(){state.button=document.querySelector('[data-qr-support-nav]');sync();badge();});
  }

  boot();
})();