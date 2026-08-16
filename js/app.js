window.fmt = function(n){ return Number(n||0).toLocaleString('ru-RU'); };
window.statusName = function(s){ return {new:'Новый',cooking:'Готовится',ready:'Готов',delivery:'В доставке',done:'Завершён',cancelled:'Отменён',changed:'Изменён'}[s]||s; };
window.statusColor = function(s){ return {new:'#60a5fa',cooking:'#fbbf24',ready:'#34d399',delivery:'#a78bfa',done:'#64748b',cancelled:'#f87171',changed:'#fb923c'}[s]||'#64748b'; };
window.categoryLabel = function(c){ return ({main:'🍽 Блюдо',drink:'🥤 Напиток',addon:'🧂 Доп',breakfast:'🍳 Завтрак',salad:'🥗 Салат',soup:'🍲 Суп',dessert:'🍰 Десерт',sauce:'🌶 Соус',snack:'🥨 Закуска',hot:'🔥 Горячее',bbq:'🥩 Гриль'}[c]||'🍽 Блюдо'); };
window.normPhone = function(p){ return (p||'').replace(/[^\d+]/g,''); };
window.SBP_PHONE = '89053204350';
window.DEFAULT_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>";

/* QR TABLE TOKEN: автоматически передаём стол из URL в create_public_order(). */
(function(){
  try{
    if(window.db && typeof window.db.rpc==='function'){
      var originalRpc=window.db.rpc.bind(window.db);
      window.db.rpc=function(fn,args){
        if(fn==='create_public_order' && args && typeof args==='object'){
          var token=new URLSearchParams(location.search).get('table');
          if(token && !args.p_table_token) args.p_table_token=token.trim();
        }
        return originalRpc(fn,args);
      };
    }
  }catch(e){ console.warn('QR table RPC patch:',e); }
})();

function safeRedirect(fallbackUrl, reason) {
  var last = parseInt(sessionStorage.getItem('last_redirect') || '0', 10), now = Date.now();
  if (now - last < 3000) {
    document.body.innerHTML = '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:30px;background:#1f2937;color:#fff;border-radius:16px"><h2 style="color:#f87171">⚠️ Проблема с профилем</h2><p>Ваш email авторизован, но профиль не найден в базе данных.</p><p><b>Причина:</b> '+(reason||'неизвестно')+'</p><button onclick="sessionStorage.clear();location.reload()" style="margin-top:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px">🔄 Очистить и попробовать снова</button></div>';
    return;
  }
  sessionStorage.setItem('last_redirect',String(now)); location.href=fallbackUrl;
}
async function requireAuth(roles){
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session){safeRedirect('index.html','нет активной сессии');return null;}
    const {data:profile,error}=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(error){console.error('Profile fetch error:',error);safeRedirect('index.html','ошибка чтения профиля: '+error.message);return null;}
    if(!profile){const {data:newProfile,error:insertError}=await db.from('profiles').insert({id:session.user.id,email:session.user.email,display_name:session.user.user_metadata?.display_name||session.user.email,role:'manager'}).select().single();if(insertError||!newProfile){safeRedirect('index.html','профиль не найден и не создан. Выполните SQL в Supabase');return null;}return newProfile;}
    if(roles&&roles.length&&roles.indexOf(profile.role)===-1){safeRedirect('index.html','нет доступа: нужна роль '+roles.join('/')+', у вас '+profile.role);return null;}
    return profile;
  }catch(e){console.error(e);safeRedirect('index.html','исключение: '+e.message);return null;}
}
async function logout(){try{await db.auth.signOut();}catch(e){}sessionStorage.clear();location.href='index.html';}

(function(){
'use strict';
var tableCache={},busy={};
function css(){
 if(document.getElementById('qr-table-display-css'))return;
 var s=document.createElement('style');s.id='qr-table-display-css';s.textContent='.qr-table-badge{display:block!important;box-sizing:border-box!important;margin:8px 0!important;padding:9px 12px!important;border-radius:11px!important;background:rgba(99,102,241,.18)!important;border:1px solid rgba(129,140,248,.38)!important;color:#e0e7ff!important;font-size:14px!important;font-weight:800!important;line-height:1.3!important}.qr-table-menu{display:block!important;box-sizing:border-box!important;margin:12px 0!important;padding:12px 14px!important;border-radius:13px!important;background:linear-gradient(135deg,rgba(99,102,241,.22),rgba(139,92,246,.12))!important;border:1px solid rgba(129,140,248,.4)!important;color:#fff!important;font-weight:800!important;text-align:center!important}.qr-table-floating{position:sticky!important;top:8px!important;z-index:30!important}';document.head.appendChild(s);
}
function getVue(){var el=document.getElementById('app');if(!el)return null;try{return el.__vueParentComponent?.proxy||el.__vue_app__?._instance?.proxy||null;}catch(e){return null;}}
function session(){var p=location.pathname.toLowerCase(),k=p.indexOf('waiter')>=0?'waiter_session':p.indexOf('courier')>=0?'courier_session':'cook_session';try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function orderNumberFromCard(card){var b=card.querySelector('.spread b');var m=b&&String(b.textContent||'').match(/№\s*(\d+)/);return m?m[1]:null;}
async function tableById(id,venueId){if(!id)return null;var key=String(id);if(tableCache[key])return tableCache[key];if(busy[key])return null;busy[key]=1;try{var q=db.from('venue_tables').select('id,table_number,name,venue_id').eq('id',id);if(venueId)q=q.eq('venue_id',venueId);var r=await q.maybeSingle();if(!r.error&&r.data)tableCache[key]=r.data;return r.data||null;}catch(e){return null}finally{delete busy[key];}}
function label(t){if(!t)return '📦 Без стола';var n=t.table_number!=null?'Стол '+t.table_number:(t.name||'Стол');return '🪑 '+(t.name&&t.name!==n?t.name:n);}
async function staff(){
 var x=getVue();if(!x)return;var orders=Array.isArray(x.orders)?x.orders:[];var s=session();var venueId=s&&s.venueId;
 document.querySelectorAll('.wcard').forEach(async function(card){var no=orderNumberFromCard(card);if(!no)return;var o=orders.find(function(v){return String(v.order_number)===String(no);});if(!o)return;var t=o.table_id?await tableById(o.table_id,venueId):null;var text=label(t);var old=card.querySelector('.qr-table-badge');if(old){old.textContent=text;return;}var badge=document.createElement('div');badge.className='qr-table-badge';badge.textContent=text;var head=card.querySelector('.spread');if(head)head.insertAdjacentElement('afterend',badge);});
}
async function client(){
 var x=getVue();if(!x||!x.venue)return;
 var venueId=x.venue.id;
 var token=new URLSearchParams(location.search).get('table');
 if(token){
   var r=await db.from('venue_tables').select('id,table_number,name,venue_id').eq('venue_id',venueId).eq('qr_token',token).maybeSingle();
   if(!r.error&&r.data){
     window.__qrTable=r.data;
     var host=document.querySelector('.hero');if(host&&!document.querySelector('.qr-table-menu')){var b=document.createElement('div');b.className='qr-table-menu qr-table-floating';b.textContent='🪑 '+(r.data.name||('Стол '+r.data.table_number));host.insertAdjacentElement('afterend',b);}
   }
 }
 var tr=x.tracking;if(tr&&tr.id){var t=null;if(tr.table_id)t=await tableById(tr.table_id,venueId);if(!t&&tr.table_number!=null)t={table_number:tr.table_number,name:tr.table_name};var card=document.querySelector('.order-card');if(card){var old=card.querySelector('.qr-table-badge');var b=old||document.createElement('div');b.className='qr-table-badge';b.textContent=label(t);if(!old){var sp=card.querySelector('.spread');if(sp)sp.insertAdjacentElement('afterend',b);}}}
}
function run(){css();var p=location.pathname.toLowerCase();if(p.endsWith('/menu.html')||p.endsWith('menu.html'))client();if(/\/(cook|waiter|courier)\.html$/i.test(p))staff();}
function start(){run();new MutationObserver(run).observe(document.body,{childList:true,subtree:true});setInterval(run,1500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();