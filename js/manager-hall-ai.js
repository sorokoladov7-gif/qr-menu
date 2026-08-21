/* QR Menu — manager hall bridge. Venue is captured from the actual manager Vue state. */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_BRIDGE_V3__) return;
window.__QR_MANAGER_HALL_BRIDGE_V3__=true;
function loadDirect(){if(window.QRManagerHall&&window.QRManagerHall.open)return;if(document.querySelector('script[data-qr-manager-hall-direct]'))return;var s=document.createElement('script');s.src='/js/manager-hall-direct.js?v=3';s.async=false;s.setAttribute('data-qr-manager-hall-direct','1');s.onload=hookManager;document.head.appendChild(s);}
function remember(v){if(v&&v.id){window.__QR_SELECTED_VENUE__=v;try{localStorage.setItem('qr_selected_venue_id',String(v.id));}catch(e){}return v;}return null;}
function proxyVenue(p){var seen=[];while(p&&seen.indexOf(p)<0){seen.push(p);try{var x=p.proxy||p.ctx||p;if(x&&x.venue&&x.venue.id)return remember(x.venue);if(x&&x.selectedVenue&&x.selectedVenue.id)return remember(x.selectedVenue);}catch(e){}p=p.parent;}return null;}
function findProxies(){var out=[];var all=document.querySelectorAll('*');for(var i=0;i<all.length;i++){var el=all[i];try{if(el.__vue_app__&&el.__vue_app__._instance)out.push(el.__vue_app__._instance);if(el.__vueParentComponent)out.push(el.__vueParentComponent);}catch(e){}}if(window.__managerVue)out.push(window.__managerVue);return out;}
function findVenue(){if(window.__QR_SELECTED_VENUE__&&window.__QR_SELECTED_VENUE__.id)return window.__QR_SELECTED_VENUE__;var ps=findProxies();for(var i=0;i<ps.length;i++){var v=proxyVenue(ps[i]);if(v)return v;try{var x=ps[i].proxy||ps[i];if(x&&typeof x.getCurrentVenue==='function'){v=x.getCurrentVenue();if(v&&v.id)return remember(v);}}catch(e){}}return null;}
function hookManager(){findProxies().forEach(function(p){try{var x=p.proxy||p;if(!x||x.__qrHallHooked)return;if(typeof x.selectVenue==='function'){var original=x.selectVenue;x.selectVenue=function(v){var r=original.apply(this,arguments);remember(v);return r;};x.__qrHallHooked=true;}if(x.venue&&x.venue.id)remember(x.venue);}catch(e){}});}
function openFromCurrent(){hookManager();var v=findVenue();if(v&&window.QRManagerHall){window.QRManagerHall.open(v);return true;}return false;}
function boot(){loadDirect();hookManager();var attempts=0;var timer=setInterval(function(){hookManager();if(++attempts>120)clearInterval(timer);},250);document.addEventListener('click',function(ev){var el=ev.target;while(el&&el!==document.body){var text=(el.textContent||'').trim();var hall=el.matches&&(el.matches('[data-manager-hall-tab]')||el.matches('[data-tab="hall"]'));if(hall||text==='Зал / Столы'||text==='🪑 Зал / Столы'){setTimeout(function(){if(!openFromCurrent())setTimeout(function(){if(!openFromCurrent())alert('Не удалось определить выбранное заведение. Выберите заведение в кабинете управляющего и повторите.');},500);},0);break;}el=el.parentElement;}},true);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
