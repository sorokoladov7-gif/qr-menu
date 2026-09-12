/* QR-Menu — общие утилиты для управляющего и администратора */
(function(){
'use strict';
if(window.__QR_UTILS__)return;window.__QR_UTILS__=true;
window.fmt=function(v){return Number(v||0).toLocaleString('ru-RU');};
window.esc=function(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});};
window.slugify=function(v){var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return String(v||'').toLowerCase().trim().replace(/[а-яё]/g,function(c){return m[c]||'';}).replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);};
window.statusName=function(s){var map={'new':'Новый','cooking':'Готовится','ready':'Готов','delivery':'Доставка','done':'Выдан','cancelled':'Отменён'};return map[s]||s;};
window.statusColor=function(s){var map={'new':'#60a5fa','cooking':'#fbbf24','ready':'#34d399','delivery':'#a78bfa','done':'#6ee7b7','cancelled':'#f87171'};return map[s]||'#64748b';};
window.categoryLabel=function(c){var map={'main':'🍽 Блюдо','drink':'🥤 Напиток','addon':'🧂 Доп','breakfast':'🍳 Завтрак','salad':'🥗 Салат','soup':'🍲 Суп','dessert':'🍰 Десерт','sauce':'🌶 Соус','snack':'🥨 Закуска','hot':'🔥 Горячее','bbq':'🥩 Гриль','burger':'🍔 Бургеры'};return map[c]||c;};
window.fmtDate=function(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('ru-RU');}catch(e){return'—';}};
window.norm=function(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim().replace(/\s+/g,' ');};
window.copyText=function(text,showToast){try{navigator.clipboard.writeText(text);if(showToast)showToast('Скопировано');}catch(e){prompt('Скопируйте:',text);}};

function injectCabinetVisualLayer(){
 if(document.getElementById('qr-unified-cabinet-ui'))return;
 var style=document.createElement('style');style.id='qr-unified-cabinet-ui';
 style.textContent=`
/* QR-Menu — единый визуальный слой кабинетов. Не меняет DOM или бизнес-логику. */
.qr-corp-shell{--qr-ui-bg:#070b14;--qr-ui-surface:rgba(15,23,42,.78);--qr-ui-surface-2:rgba(30,41,59,.58);--qr-ui-border:rgba(148,163,184,.16);--qr-ui-border-strong:rgba(129,140,248,.34);--qr-ui-text:#f8fafc;--qr-ui-muted:#94a3b8;--qr-ui-accent:#6366f1;--qr-ui-accent-2:#8b5cf6;--qr-ui-success:#10b981;--qr-ui-danger:#ef4444;background:radial-gradient(circle at 12% -8%,rgba(99,102,241,.10),transparent 32%),radial-gradient(circle at 92% 105%,rgba(52,211,153,.055),transparent 30%),var(--qr-ui-bg)!important;color:var(--qr-ui-text)!important;font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,"Roboto","Helvetica Neue",Arial,sans-serif!important;font-synthesis:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.qr-corp-shell #app{color:inherit}
.qr-corp-shell .topbar{background:rgba(7,12,24,.94)!important;border-color:var(--qr-ui-border)!important;box-shadow:0 12px 36px rgba(0,0,0,.28)!important;backdrop-filter:blur(20px) saturate(135%)!important;-webkit-backdrop-filter:blur(20px) saturate(135%)!important}
.qr-corp-shell .topbar .brand{color:#f8fafc!important}
.qr-corp-shell .topbar .brand .logo,.qr-corp-shell .topbar .brand>img{filter:drop-shadow(0 6px 16px rgba(99,102,241,.22))}
.qr-corp-shell .tabs{background:linear-gradient(180deg,rgba(17,24,39,.985),rgba(7,12,23,.985))!important;border-color:var(--qr-ui-border)!important;box-shadow:0 20px 60px rgba(0,0,0,.38)!important}
.qr-corp-shell .tabs button{font-family:inherit!important;min-height:42px!important;border-radius:12px!important;color:#cbd5e1!important;background:transparent!important;border-color:transparent!important;letter-spacing:0!important}
.qr-corp-shell .tabs button:hover{background:rgba(255,255,255,.065)!important;color:#fff!important}
.qr-corp-shell .tabs button.on{background:linear-gradient(135deg,rgba(99,102,241,.30),rgba(139,92,246,.14))!important;color:#fff!important;border-color:rgba(129,140,248,.36)!important;box-shadow:inset 3px 0 0 #6366f1,0 8px 24px rgba(79,70,229,.13)!important}
.qr-corp-shell .glass,.qr-corp-shell .card,.qr-corp-shell .stat,.qr-corp-shell .analytics-section,.qr-corp-shell .analytics-dashboard-card{background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))!important;border:1px solid var(--qr-ui-border)!important;box-shadow:0 10px 34px rgba(0,0,0,.12)!important}
.qr-corp-shell .glass:hover,.qr-corp-shell .card:hover{border-color:rgba(148,163,184,.24)!important}
.qr-corp-shell input,.qr-corp-shell select,.qr-corp-shell textarea,.qr-corp-shell .field input,.qr-corp-shell .field select,.qr-corp-shell .field textarea{background:rgba(9,15,27,.82)!important;color:#f8fafc!important;border:1px solid rgba(148,163,184,.18)!important;border-radius:11px!important;box-shadow:none!important}
.qr-corp-shell input:focus,.qr-corp-shell select:focus,.qr-corp-shell textarea:focus{border-color:rgba(129,140,248,.72)!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)!important;outline:none!important}
.qr-corp-shell .btn{font-family:inherit!important;border-radius:11px!important;font-weight:700!important;min-height:38px!important;box-shadow:none}
.qr-corp-shell .btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6)!important;color:#fff!important;box-shadow:0 7px 20px rgba(99,102,241,.22)!important}
.qr-corp-shell .btn-green{background:linear-gradient(135deg,#10b981,#059669)!important;color:#ecfdf5!important}
.qr-corp-shell .btn-danger{background:rgba(239,68,68,.12)!important;color:#fca5a5!important;border:1px solid rgba(239,68,68,.24)!important}
.qr-corp-shell .btn-ghost{background:rgba(255,255,255,.045)!important;color:#cbd5e1!important;border:1px solid rgba(148,163,184,.16)!important}
.qr-corp-shell .btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.qr-corp-shell .tblwrap,.qr-corp-shell .glass.card{border-radius:16px!important;overflow:auto!important}
.qr-corp-shell .tbl th{color:#94a3b8!important;background:rgba(255,255,255,.025)!important;font-weight:700!important}
.qr-corp-shell .tbl td{color:#e2e8f0!important;border-color:rgba(148,163,184,.09)!important}
.qr-corp-shell .badge{border:1px solid rgba(148,163,184,.12)}
.qr-corp-shell .modal{background:rgba(2,6,23,.78)!important;backdrop-filter:blur(9px)!important;-webkit-backdrop-filter:blur(9px)!important}
.qr-corp-shell .modal .box{background:linear-gradient(145deg,#111827,#0b1220)!important;border-color:rgba(148,163,184,.18)!important;border-radius:20px!important;box-shadow:0 30px 90px rgba(0,0,0,.48)!important}
.qr-corp-shell h1,.qr-corp-shell h2,.qr-corp-shell h3,.qr-corp-shell h4{color:#f8fafc}
.qr-corp-shell .muted,.qr-corp-shell label{color:#94a3b8!important}
.qr-corp-shell .menu-grid>.card,.qr-corp-shell .menu-item-compact,.qr-corp-shell .manager-template-product-card,.qr-corp-shell .analytics-mini-card{background:rgba(255,255,255,.035)!important;border-color:rgba(148,163,184,.13)!important;box-shadow:none!important}
.qr-corp-shell .menu-grid>.card:hover,.qr-corp-shell .menu-item-compact:hover,.qr-corp-shell .manager-template-product-card:hover{border-color:rgba(129,140,248,.42)!important;box-shadow:0 12px 30px rgba(0,0,0,.20)!important}
.qr-corp-shell .progress>div{background:linear-gradient(90deg,#6366f1,#10b981)!important}
@media(max-width:900px){
 .qr-corp-shell .topbar{padding-left:60px!important}
 .qr-corp-shell>.wrap,.qr-corp-shell .wrap{padding:16px 12px 28px!important}
 .qr-corp-shell .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
 .qr-corp-shell .glass.card{border-radius:14px!important}
}
@media(max-width:520px){
 .qr-corp-shell .stats{grid-template-columns:1fr 1fr!important}
 .qr-corp-shell .btn{min-height:36px!important}
}
@media(prefers-reduced-motion:reduce){.qr-corp-shell *,.qr-corp-shell *:before,.qr-corp-shell *:after{animation-duration:.001ms!important;transition-duration:.001ms!important}}
`;
 document.head.appendChild(style);
}

function initCorporateShell(){
 if(!document.body)return;
 var body=document.body,app=document.getElementById('app')||body,root=document.documentElement,nav=null,toggle=null,overlay=null;
 body.classList.add('qr-corp-shell');
 injectCabinetVisualLayer();
 function closeNav(){body.classList.remove('nav-open');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Открыть меню');toggle.innerHTML='<span aria-hidden="true">☰</span>';}root.style.overflow='';}
 function setupNav(){
  var next=document.querySelector('.qr-corp-shell .tabs');if(!next||next===nav)return;nav=next;
  document.querySelectorAll('.qr-corp-nav-toggle,.qr-corp-nav-overlay').forEach(function(el){el.remove();});
  overlay=document.createElement('button');
  overlay.type='button';
  overlay.className='qr-corp-nav-overlay';
  overlay.setAttribute('aria-label','Закрыть меню');
  overlay.setAttribute('tabindex','-1');
  body.appendChild(overlay);
  overlay.addEventListener('click',function(e){e.preventDefault();closeNav();});
  toggle=document.createElement('button');toggle.type='button';toggle.className='qr-corp-nav-toggle';toggle.setAttribute('aria-label','Открыть меню');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span aria-hidden="true">☰</span>';body.appendChild(toggle);
  function toggleNav(e){e.preventDefault();e.stopPropagation();var open=!body.classList.contains('nav-open');body.classList.toggle('nav-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');toggle.innerHTML=open?'<span aria-hidden="true">×</span>':'<span aria-hidden="true">☰</span>';root.style.overflow=open?'hidden':'';}
  toggle.addEventListener('click',toggleNav);
  toggle.addEventListener('pointerup',function(e){if(e.pointerType==='touch'){e.preventDefault();}});
  nav.addEventListener('click',function(ev){var btn=ev.target.closest&&ev.target.closest('button');if(btn&&window.matchMedia('(max-width:900px)').matches)setTimeout(closeNav,120);});
 }
 setupNav();new MutationObserver(setupNav).observe(app,{childList:true,subtree:true});
 window.addEventListener('resize',function(){if(!window.matchMedia('(max-width:900px)').matches)closeNav();});window.addEventListener('keydown',function(e){if(e.key==='Escape')closeNav();});
}

function setupManagerInstructionScroll(){
 function apply(){
  var panel=document.getElementById('manager-instruction-panel');
  if(!panel)return;
  panel.style.overflowY='auto';
  panel.style.overflowX='hidden';
  panel.style.webkitOverflowScrolling='touch';
  panel.style.overscrollBehavior='contain';
  panel.style.touchAction='pan-y';
  panel.style.maxHeight='calc(100dvh - 82px)';
  panel.style.paddingBottom='calc(24px + env(safe-area-inset-bottom, 0px))';
  var card=panel.querySelector('.card');
  if(card){card.style.boxSizing='border-box';card.style.marginBottom='24px';}
 }
 apply();
 new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('resize',apply,{passive:true});
 if(window.visualViewport)window.visualViewport.addEventListener('resize',apply,{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){initCorporateShell();setupManagerInstructionScroll();},{once:true});else{initCorporateShell();setupManagerInstructionScroll();}
})();
