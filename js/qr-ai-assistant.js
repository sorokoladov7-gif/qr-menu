/* QR MENU — movable AI assistant mascot. */
(function(){
  'use strict';
  if(window.__QR_AI_ASSISTANT__) return;
  window.__QR_AI_ASSISTANT__=true;
  if(!/\/(manager|admin)\.html$/i.test(location.pathname)) return;

  function boot(){
    if(document.getElementById('qr-ai-assistant')) return;
    var host=document.createElement('div'); host.id='qr-ai-assistant';
    host.innerHTML='<button class="qr-ai-avatar" type="button" aria-label="Открыть QR AI помощника">'+
      '<span class="qr-ai-status"></span><span class="qr-ai-glow"></span>'+
      '<svg viewBox="0 0 160 160" aria-hidden="true">'+
      '<defs><radialGradient id="qrag" cx="50%" cy="45%"><stop offset="0" stop-color="#173d73"/><stop offset=".65" stop-color="#061326"/><stop offset="1" stop-color="#020611"/></radialGradient><filter id="qrglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'+
      '<circle cx="80" cy="80" r="66" fill="url(#qrag)" stroke="#1aa8ff" stroke-width="3"/>'+
      '<g fill="none" stroke="#159eea" stroke-width="4" stroke-linecap="round" opacity=".95">'+
      '<path d="M30 49 C45 15 116 15 132 48"/><path d="M22 70 C20 35 55 15 83 17"/><path d="M24 92 C20 122 52 145 79 143"/><path d="M82 17 C120 15 145 44 137 75"/><path d="M77 143 C113 146 139 119 138 88"/>'+
      '<path d="M32 117 C58 151 105 153 130 116"/><path d="M39 33 C70 8 116 24 130 52"/></g>'+
      '<circle cx="80" cy="80" r="48" fill="#020914" stroke="#0c83d1" stroke-width="2"/>'+
      '<g fill="#9eeaff" filter="url(#qrglow)"><circle cx="62" cy="74" r="7"/><circle cx="98" cy="74" r="7"/><path d="M64 96 Q80 108 96 96" fill="none" stroke="#8eeaff" stroke-width="5" stroke-linecap="round"/></g>'+
      '<g fill="none" stroke="#1ba8ff" stroke-width="4" stroke-linecap="round"><path d="M24 91 C7 101 7 116 17 124"/><path d="M136 61 C153 52 157 37 148 29"/></g>'+
      '<circle cx="16" cy="126" r="4" fill="#b9f2ff"/><circle cx="149" cy="27" r="4" fill="#b9f2ff"/>'+
      '</svg></button>'+
      '<section class="qr-ai-panel" aria-hidden="true">'+
      '<header><div><b>QR AI</b><small><i></i> Онлайн</small></div><button type="button" class="qr-ai-close" aria-label="Закрыть">×</button></header>'+
      '<div class="qr-ai-hello"><div class="qr-ai-mini">'+
      '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="#071426" stroke="#16a7ff" stroke-width="2"/><circle cx="31" cy="37" r="4" fill="#9eeaff"/><circle cx="49" cy="37" r="4" fill="#9eeaff"/><path d="M31 51 Q40 58 49 51" fill="none" stroke="#8eeaff" stroke-width="3" stroke-linecap="round"/></svg></div>'+
      '<div><b>Ваш ИИ-помощник QR MENU</b><p>Я здесь, чтобы помогать управлять заведением, анализировать данные и находить решения.</p></div></div>'+
      '<div class="qr-ai-actions"><button data-tab="Аналитика">Анализировать продажи</button><button data-tab="Меню">Помощь с меню</button><button data-tab="Дизайн">Создать дизайн</button><button data-tab="Настройки">Настроить систему</button></div>'+
      '<div class="qr-ai-note">Выберите действие — я открою нужный раздел кабинета.</div>'+
      '</section>';
    var style=document.createElement('style');
    style.textContent='#qr-ai-assistant{position:fixed;right:24px;bottom:24px;z-index:2147483000;font-family:Plus Jakarta Sans,system-ui,-apple-system,sans-serif;touch-action:none}.qr-ai-avatar{position:relative;width:94px;height:94px;border:1px solid rgba(65,185,255,.65);border-radius:50%;padding:0;background:radial-gradient(circle at 50% 42%,#173d73 0,#071426 58%,#020611 100%);box-shadow:0 0 0 1px rgba(38,169,255,.12),0 12px 38px rgba(0,120,255,.42),inset 0 0 25px rgba(0,180,255,.2);cursor:grab;overflow:visible;display:grid;place-items:center}.qr-ai-avatar:active{cursor:grabbing}.qr-ai-avatar svg{width:100%;height:100%;position:relative;z-index:2;filter:drop-shadow(0 0 10px rgba(0,169,255,.55))}.qr-ai-glow{position:absolute;inset:-10px;border-radius:50%;background:rgba(0,155,255,.24);filter:blur(18px);z-index:0;animation:qrAiPulse 2.8s ease-in-out infinite}.qr-ai-status{position:absolute;right:3px;bottom:7px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid #071426;z-index:5;box-shadow:0 0 12px rgba(34,197,94,.8)}.qr-ai-panel{position:absolute;right:0;bottom:108px;width:min(380px,calc(100vw - 28px));background:linear-gradient(180deg,rgba(9,23,45,.98),rgba(5,12,27,.98));border:1px solid rgba(50,166,255,.42);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.48),0 0 35px rgba(0,136,255,.18);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:#f8fbff;overflow:hidden;opacity:0;transform:translateY(12px) scale(.96);pointer-events:none;transition:opacity .2s ease,transform .2s ease}.qr-ai-panel.open{opacity:1;transform:none;pointer-events:auto}.qr-ai-panel header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)}.qr-ai-panel header b{display:block;font-size:16px}.qr-ai-panel header small{display:block;color:#8fa8c7;font-size:11px;margin-top:3px}.qr-ai-panel header i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;margin-right:5px}.qr-ai-close{border:0;background:rgba(255,255,255,.06);color:#cbd5e1;width:32px;height:32px;border-radius:10px;font-size:22px;cursor:pointer}.qr-ai-hello{display:flex;gap:12px;padding:18px}.qr-ai-mini{flex:0 0 46px;width:46px;height:46px}.qr-ai-mini svg{width:46px;height:46px}.qr-ai-hello b{font-size:13px}.qr-ai-hello p{margin:5px 0 0;color:#a9bad1;font-size:11px;line-height:1.5}.qr-ai-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:0 18px 14px}.qr-ai-actions button{border:1px solid rgba(66,165,245,.26);background:rgba(23,69,112,.22);color:#e8f4ff;border-radius:12px;padding:11px 10px;font-size:11px;font-weight:700;text-align:left;cursor:pointer;transition:.18s}.qr-ai-actions button:hover{background:rgba(34,135,220,.3);border-color:rgba(80,190,255,.65);transform:translateY(-1px)}.qr-ai-note{margin:0 18px 17px;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.045);color:#8298b5;font-size:10px;line-height:1.45}@keyframes qrAiPulse{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:.9;transform:scale(1.06)}}@media(max-width:900px){#qr-ai-assistant{right:14px;bottom:max(14px,env(safe-area-inset-bottom))}.qr-ai-avatar{width:76px;height:76px}.qr-ai-panel{bottom:88px;width:min(360px,calc(100vw - 20px))}.qr-ai-actions button{font-size:10px;padding:10px 8px}}';
    document.head.appendChild(style); document.body.appendChild(host);
    var avatar=host.querySelector('.qr-ai-avatar'), panel=host.querySelector('.qr-ai-panel');
    avatar.addEventListener('click',function(e){if(host.dataset.moved==='1'){host.dataset.moved='0';return;}panel.classList.toggle('open');panel.setAttribute('aria-hidden',panel.classList.contains('open')?'false':'true');});
    host.querySelector('.qr-ai-close').addEventListener('click',function(){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');});
    host.querySelectorAll('.qr-ai-actions button').forEach(function(btn){btn.addEventListener('click',function(){var label=btn.getAttribute('data-tab');var buttons=[].slice.call(document.querySelectorAll('.tabs button'));var target=buttons.find(function(b){return (b.textContent||'').toLowerCase().indexOf(label.toLowerCase())!==-1;});if(target){target.click();panel.classList.remove('open');}else{var map={"Дизайн":"Настройки","Настройки":"Настройки"};var t=map[label];if(t){var b=buttons.find(function(x){return (x.textContent||'').toLowerCase().indexOf(t.toLowerCase())!==-1;});if(b)b.click();}}});});
    var drag=false,sx=0,sy=0,startX=0,startY=0,moved=false;
    avatar.addEventListener('pointerdown',function(e){drag=true;moved=false;sx=e.clientX;sy=e.clientY;var r=host.getBoundingClientRect();startX=r.left;startY=r.top;avatar.setPointerCapture&&avatar.setPointerCapture(e.pointerId);});
    avatar.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>7)moved=true;if(!moved)return;var nx=Math.max(6,Math.min(window.innerWidth-host.offsetWidth-6,startX+dx));var ny=Math.max(6,Math.min(window.innerHeight-host.offsetHeight-6,startY+dy));host.style.left=nx+'px';host.style.top=ny+'px';host.style.right='auto';host.style.bottom='auto';});
    function end(e){if(!drag)return;drag=false;if(moved){host.dataset.moved='1';try{localStorage.setItem('qr_ai_pos',JSON.stringify({left:host.style.left,top:host.style.top}));}catch(_){} }avatar.releasePointerCapture&&avatar.releasePointerCapture(e.pointerId);}
    avatar.addEventListener('pointerup',end);avatar.addEventListener('pointercancel',end);
    try{var pos=JSON.parse(localStorage.getItem('qr_ai_pos')||'null');if(pos&&pos.left&&pos.top){host.style.left=pos.left;host.style.top=pos.top;host.style.right='auto';host.style.bottom='auto';}}catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
