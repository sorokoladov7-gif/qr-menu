(function(){
'use strict';
if(window.__QR_ADMIN_CONSOLE_ENHANCER__)return;
window.__QR_ADMIN_CONSOLE_ENHANCER__=true;
function vm(){var a=window.__QR_ADMIN_VUE_APP__;return a&&a._instance?a._instance.proxy:null}
function tab(k){var a=vm();if(a&&typeof a.switchTab==='function'){a.switchTab(k);return}var names={stats:'Статистика',venues:'Заведения',menu:'Меню',activity:'Активность',analytics:'Аналитика',plans:'Тарифы',managers:'Менеджеры',templates:'Шаблоны',settings:'Настройки'};var b=[].slice.call(document.querySelectorAll('#app .tabs button')).find(function(x){return(x.textContent||'').indexOf(names[k]||'')>-1||(k==='managers'&&(x.textContent||'').indexOf('Управляющие')>-1)});if(b)b.click()}
function ai(){var c=document.getElementById('qr-ai-center');if(c){c.classList.add('open');var i=document.getElementById('qr-ai-message');if(i)i.focus();return}var f=document.getElementById('qr-ai-fab');if(f)f.click()}
function design(){var a=vm();if(a&&typeof a.openDesignPanel==='function')a.openDesignPanel()}
var items=[['stats','Главная'],['subs','Подписки'],['analytics','Аналитика'],['venues','Заведения'],['menu','Меню'],['activity','Активность'],['managers','Менеджеры'],['plans','Тарифы и оплаты'],['templates','Шаблоны'],['design','Дизайн'],['settings','Настройки']];
function patch(){
 var s=document.getElementById('qr-admin-shell');if(!s)return false;var n=s.querySelector('.qr-nav');
 if(n&&!n.dataset.enhanced){n.innerHTML='';items.forEach(function(x){var b=document.createElement('button');b.type='button';b.dataset.navKey=x[0];b.innerHTML='<span>'+x[1]+'</span>';b.onclick=function(){if(x[0]==='design')design();else tab(x[0]);s.classList.remove('open');document.body.classList.remove('qr-admin-menu-open')};n.appendChild(b)});n.dataset.enhanced='1';var h=s.querySelector('.qr-side-help');if(h){h.textContent='Центр поддержки и AI-инженер';h.onclick=function(e){e.preventDefault();ai()};h.style.cursor='pointer'}}
 sync(s);return true
}
function sync(s){var t=(document.querySelector('#app .tabs button.on')||{}).textContent||'';var map={Статистика:'stats',Заведения:'venues',Меню:'menu',Активность:'activity',Подписки:'subs',Тарифы:'plans',Менеджеры:'managers',Управляющие:'managers',Аналитика:'analytics',Шаблоны:'templates',Настройки:'settings'};var k=Object.keys(map).find(function(x){return t.indexOf(x)>-1})||'stats';s.querySelectorAll('.qr-nav button').forEach(function(b){b.classList.toggle('active',b.dataset.navKey===k)})}
function boot(){if(!patch())return;var a=document.getElementById('qr-admin-hero'),b=document.getElementById('qr-hero-ai');if(a&&b)b.onclick=ai}
function start(){boot();setInterval(boot,700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,500)},{once:true});else setTimeout(start,500)
})();
