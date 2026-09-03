/* QR-Menu — общие утилиты для управляющего и администратора */
(function(){
'use strict';
if(window.__QR_UTILS__)return;window.__QR_UTILS__=true;
window.fmt=function(v){return Number(v||0).toLocaleString('ru-RU');};
window.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
window.slugify=function(v){var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return String(v||'').toLowerCase().trim().replace(/[а-яё]/g,function(c){return m[c]||'';}).replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);};
window.statusName=function(s){var map={'new':'Новый','cooking':'Готовится','ready':'Готов','delivery':'Доставка','done':'Выдан','cancelled':'Отменён'};return map[s]||s;};
window.statusColor=function(s){var map={'new':'#60a5fa','cooking':'#fbbf24','ready':'#34d399','delivery':'#a78bfa','done':'#6ee7b7','cancelled':'#f87171'};return map[s]||'#64748b';};
window.categoryLabel=function(c){var map={'main':'🍽 Блюдо','drink':'🥤 Напиток','addon':'🧂 Доп','breakfast':'🍳 Завтрак','salad':'🥗 Салат','soup':'🍲 Суп','dessert':'🍰 Десерт','sauce':'🌶 Соус','snack':'🥨 Закуска','hot':'🔥 Горячее','bbq':'🥩 Гриль'};return map[c]||c;};
window.fmtDate=function(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('ru-RU');}catch(e){return'—';}};
window.norm=function(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim().replace(/\s+/g,' ');};
window.copyText=function(text,showToast){try{navigator.clipboard.writeText(text);if(showToast)showToast('Скопировано');}catch(e){prompt('Скопируйте:',text);}};

function initCorporateShell(){
 if(!document.body)return;
 var body=document.body,app=document.getElementById('app')||body,root=document.documentElement,nav=null,toggle=null;
 body.classList.add('qr-corp-shell');
 function closeNav(){body.classList.remove('nav-open');if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Открыть меню');toggle.innerHTML='<span aria-hidden="true">☰</span>';}root.style.overflow='';}
 function setupNav(){
  var next=document.querySelector('.qr-corp-shell .tabs');if(!next||next===nav)return;nav=next;
  document.querySelectorAll('.qr-corp-nav-toggle,.qr-corp-nav-overlay').forEach(function(el){el.remove();});
  toggle=document.createElement('button');toggle.type='button';toggle.className='qr-corp-nav-toggle';toggle.setAttribute('aria-label','Открыть меню');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<span aria-hidden="true">☰</span>';body.appendChild(toggle);
  toggle.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var open=!body.classList.contains('nav-open');body.classList.toggle('nav-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');toggle.innerHTML=open?'<span aria-hidden="true">×</span>':'<span aria-hidden="true">☰</span>';root.style.overflow=open?'hidden':'';});
  nav.addEventListener('click',function(ev){var btn=ev.target.closest&&ev.target.closest('button');if(btn&&window.matchMedia('(max-width:900px)').matches)setTimeout(closeNav,120);});
 }
 setupNav();new MutationObserver(setupNav).observe(app,{childList:true,subtree:true});
 window.addEventListener('resize',function(){if(!window.matchMedia('(max-width:900px)').matches)closeNav();});window.addEventListener('keydown',function(e){if(e.key==='Escape')closeNav();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCorporateShell,{once:true});else initCorporateShell();
})();
