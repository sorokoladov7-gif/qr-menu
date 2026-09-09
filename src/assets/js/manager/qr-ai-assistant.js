/* QR MENU — manager AI assistant. Access is enforced by /api/manager-ai. */
(function(){
  'use strict';
  if(window.__QR_AI_ASSISTANT__) return;
  if(!/\/manager\.html$/i.test(location.pathname)) return;
  window.__QR_AI_ASSISTANT__=true;

  var state={open:false,busy:false,allowed:false,plan:'',status:'',end:'',history:[]};
  function escapeHtml(v){var d=document.createElement('div');d.textContent=String(v==null?'':v);return d.innerHTML.replace(/\n/g,'<br>');}
  function style(){
    if(document.getElementById('qr-manager-ai-style'))return;
    var s=document.createElement('style');s.id='qr-manager-ai-style';s.textContent=''+
      '#qr-manager-ai{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Segoe UI,system-ui,sans-serif}'+
      '#qr-manager-ai .fab{width:64px;height:64px;border-radius:50%;border:2px solid rgba(93,211,255,.72);background:radial-gradient(circle,#123b72,#041126 70%);color:#dffaff;box-shadow:0 0 24px rgba(22,140,255,.42),0 14px 36px rgba(0,0,0,.24);cursor:pointer;font-size:25px}'+
      '#qr-manager-ai .drawer{display:none;position:absolute;right:0;bottom:78px;width:min(420px,calc(100vw - 24px));height:min(680px,calc(100dvh - 105px));border-radius:22px;overflow:hidden;border:1px solid rgba(75,188,255,.35);background:linear-gradient(180deg,#071a36,#031022);box-shadow:0 28px 90px rgba(1,15,38,.55)}'+
      '#qr-manager-ai.open .drawer{display:flex;flex-direction:column}'+
      '#qr-manager-ai .head{display:flex;align-items:center;gap:10px;padding:15px 16px;border-bottom:1px solid rgba(97,191,255,.15);background:linear-gradient(180deg,rgba(24,71,130,.72),rgba(7,30,64,.72));color:#fff}'+
      '#qr-manager-ai .head b{font-size:15px}#qr-manager-ai .head small{display:block;color:#86a8cf;margin-top:2px;font-size:10px}'+
      '#qr-manager-ai .close{margin-left:auto;border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:10px;width:34px;height:34px;cursor:pointer;font-size:20px}'+
      '#qr-manager-ai .body{flex:1;overflow:auto;padding:14px}'+
      '#qr-manager-ai .banner{padding:13px;border-radius:15px;background:radial-gradient(circle at 80% 20%,rgba(28,167,255,.25),transparent 35%),linear-gradient(135deg,#082758,#031226);border:1px solid rgba(76,190,255,.18);color:#dff6ff;margin-bottom:10px}'+
      '#qr-manager-ai .banner b{display:block;font-size:15px}#qr-manager-ai .banner span{display:block;color:#9fc2e2;font-size:11px;margin-top:6px;line-height:1.45}'+
      '#qr-manager-ai .msg{display:flex;gap:8px;margin:10px 0}.qr-ai-manager-bubble{max-width:85%;padding:10px 12px;border-radius:13px;background:rgba(255,255,255,.06);border:1px solid rgba(104,193,255,.12);color:#eef8ff;font-size:12px;line-height:1.45}.user .qr-ai-manager-bubble{margin-left:auto;background:rgba(38,121,214,.22);border-color:rgba(74,173,255,.24)}'+
      '#qr-manager-ai .compose{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(97,191,255,.15);background:rgba(2,13,28,.78)}'+
      '#qr-manager-ai textarea{flex:1;min-height:42px;max-height:120px;resize:none;padding:10px;border-radius:12px;border:1px solid rgba(86,180,255,.22);background:rgba(255,255,255,.05);color:#fff;outline:none;font:12px Segoe UI,system-ui,sans-serif}'+
      '#qr-manager-ai .send{width:44px;border:0;border-radius:12px;background:linear-gradient(135deg,#087cf0,#21b7ff);color:#fff;font-size:20px;cursor:pointer}'+
      '#qr-manager-ai .lock{padding:14px;border-radius:15px;background:rgba(239,68,68,.08);border:1px solid rgba(248,113,113,.22);color:#ffc2c2;font-size:12px;line-height:1.5}'+
      '@media(max-width:900px){#qr-manager-ai{right:12px;bottom:14px}#qr-manager-ai .fab{width:58px;height:58px}#qr-manager-ai .drawer{right:-2px;bottom:70px;width:calc(100vw - 20px);height:min(720px,calc(100dvh - 95px))}}';document.head.appendChild(s);
  }
  function mount(){
    if(document.getElementById('qr-manager-ai'))return;
    var r=document.createElement('div');r.id='qr-manager-ai';
    r.innerHTML='<button class="fab" type="button" aria-label="ИИ-помощник">✦</button><section class="drawer"><header class="head"><div><b>QR AI</b><small>ИИ-помощник управляющего</small></div><button class="close" type="button">×</button></header><div class="body"><div class="banner"><b>Ваш ИИ-помощник</b><span>Помогаю с меню, заказами, аналитикой, рецептурами, настройками и рабочими вопросами.</span></div><div class="history"></div></div><div class="compose"><textarea rows="1" placeholder="Напишите вопрос…"></textarea><button class="send" type="button">→</button></div></section>';
    document.body.appendChild(r);
    r.querySelector('.fab').onclick=function(){state.open=!state.open;r.classList.toggle('open',state.open);if(state.open)r.querySelector('textarea').focus();};
    r.querySelector('.close').onclick=function(){state.open=false;r.classList.remove('open');};
    r.querySelector('textarea').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    r.querySelector('.send').onclick=send;
  }
  function render(){
    var root=document.getElementById('qr-manager-ai');if(!root)return;
    var body=root.querySelector('.body');
    if(!state.allowed){
      body.innerHTML='<div class="banner"><b>Ваш ИИ-помощник</b><span>Доступ определяется выбранным тарифом.</span></div><div class="lock"><b>AI не подключён</b><br>Выберите тариф с включённым ИИ в разделе «Тарифы». При активном trial доступ к AI также работает.</div>';
      return;
    }
    body.innerHTML='<div class="banner"><b>Ваш ИИ-помощник</b><span>Тариф: '+escapeHtml(state.plan||'—')+' · '+escapeHtml(state.status||'')+' · до '+escapeHtml(state.end?new Date(state.end).toLocaleDateString('ru-RU'):'—')+'</span></div><div class="history"></div>';
    var h=body.querySelector('.history');
    state.history.forEach(function(m){var row=document.createElement('div');row.className='msg '+(m.role==='user'?'user':'assistant');var b=document.createElement('div');b.className='qr-ai-manager-bubble';b.innerHTML=escapeHtml(m.text);row.appendChild(b);h.appendChild(row);});
    if(state.busy){var row=document.createElement('div');row.className='msg assistant';var b=document.createElement('div');b.className='qr-ai-manager-bubble';b.textContent='Думаю…';row.appendChild(b);h.appendChild(row);}
    body.scrollTop=body.scrollHeight;
  }
  async function loadEntitlement(){
    try{
      var session=await db.auth.getSession();var token=session&&session.data&&session.data.session&&session.data.session.access_token;if(!token)throw new Error('AUTH_REQUIRED');
      var r=await fetch('/api/manager-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({message:'__entitlement_check__'})});
      var d=await r.json().catch(function(){return{};});
      if(r.ok&&d.ai_enabled){state.allowed=true;state.plan=d.plan||'';state.status=d.subscription_status||'';state.end=d.subscription_end||'';}
      render();
    }catch(e){render();}
  }
  async function send(){
    var root=document.getElementById('qr-manager-ai');if(!root||state.busy)return;
    var ta=root.querySelector('textarea'),message=(ta.value||'').trim();if(!message)return;
    if(!state.allowed){state.open=true;root.classList.add('open');render();return;}
    state.history.push({role:'user',text:message});ta.value='';state.busy=true;render();
    try{
      var session=await db.auth.getSession();var token=session&&session.data&&session.data.session&&session.data.session.access_token;if(!token)throw new Error('AUTH_REQUIRED');
      var r=await fetch('/api/manager-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({message:message})});
      var d=await r.json().catch(function(){return{};});if(!r.ok)throw new Error(d.error||'MANAGER_AI_FAILED');
      state.plan=d.plan||state.plan;state.status=d.subscription_status||state.status;state.end=d.subscription_end||state.end;state.history.push({role:'assistant',text:d.answer||'Не удалось получить ответ.'});
    }catch(e){state.history.push({role:'assistant',text:'Ошибка AI: '+(e.message||e)});}
    finally{state.busy=false;render();}
  }
  style();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){mount();loadEntitlement();},{once:true});else{mount();loadEntitlement();}
})();
