/* Tab-local staff session isolation + existing shift controls. */
(function(){
  'use strict';
  var path=location.pathname.toLowerCase();
  var m=path.match(/\/(cook|waiter|courier)\.html$/i);
  if(!m)return;
  var role=m[1];
  var keys={staff_token:1,cook_token:1,waiter_token:1,courier_token:1,cook_session:1,waiter_session:1,courier_session:1,cook_login_context:1,waiter_login_context:1,courier_login_context:1,cook_tab:1,waiter_tab:1,courier_tab:1};
  function staffKey(k){return !!keys[k] || String(k).indexOf(role+'_')===0;}
  var g=Storage.prototype.getItem,s=Storage.prototype.setItem,r=Storage.prototype.removeItem;
  Storage.prototype.getItem=function(k){if(this===localStorage&&staffKey(k))return g.call(sessionStorage,k);return g.call(this,k)};
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&staffKey(k))return s.call(sessionStorage,k,v);return s.call(this,k,v)};
  Storage.prototype.removeItem=function(k){if(this===localStorage&&staffKey(k))return r.call(sessionStorage,k);return r.call(this,k)};
  function patchDb(){
    if(!window.db){setTimeout(patchDb,20);return;}
    if(window.__QR_STAFF_SESSION_PATCH__)return;
    window.__QR_STAFF_SESSION_PATCH__=true;
    var db=window.db, originalFrom=db.from.bind(db), originalRpc=db.rpc.bind(db);
    db.from=function(table){
      if(table!=='venues')return originalFrom(table);
      var q=originalFrom(table),slug=null,eq=q.eq.bind(q);
      q.eq=function(k,v){if(k==='slug')slug=String(v||'').trim().toLowerCase();return eq(k,v)};
      if(q.single){var single=q.single.bind(q);q.single=function(){return slug?originalRpc('staff_venue_by_slug',{p_slug:slug}):single()};}
      if(q.maybeSingle){var ms=q.maybeSingle.bind(q);q.maybeSingle=function(){return slug?originalRpc('staff_venue_by_slug',{p_slug:slug}):ms()};}
      return q;
    };
    db.rpc=function(name,args,options){
      if(name==='staff_login')args=Object.assign({},args||{},{p_type:role});
      return originalRpc(name,args,options);
    };
  }
  patchDb();
})();

/* QR-SETKA staff shift controls: shared by cook/waiter/courier. */
(function(){
  'use strict';
  if(window.__QR_STAFF_SHIFT__) return;
  window.__QR_STAFF_SHIFT__=true;
  var stopped=false;
  function loadPatch(){if(document.querySelector('script[data-qr-staff-ui-patch]'))return;var s=document.createElement('script');s.src='/js/staff-ui-patches.js?v=4';s.async=false;s.setAttribute('data-qr-staff-ui-patch','1');document.head.appendChild(s);}
  loadPatch();
  function token(){var m=location.pathname.match(/\/(cook|waiter|courier)\.html$/i);var role=m&&m[1];if(role){var rt=localStorage.getItem(role+'_token');if(rt)return rt;}return localStorage.getItem('staff_token')||'';}
  function top(){return document.querySelector('.topbar,.top');}
  function ensureStyle(){if(document.getElementById('qr-staff-shift-style'))return;var s=document.createElement('style');s.id='qr-staff-shift-style';s.textContent=''+'.qr-shift-chip{display:inline-flex;align-items:center;gap:7px;margin-right:8px;padding:8px 11px;border-radius:10px;font-size:12px;font-weight:800}'+'.qr-shift-open{background:rgba(5,150,105,.18);color:#6ee7b7;border:1px solid rgba(52,211,153,.25)}'+'.qr-shift-closed{background:rgba(245,158,11,.14);color:#fcd34d;border:1px solid rgba(251,191,36,.25)}'+'.qr-shift-btn{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer;margin-right:8px}'+'.qr-shift-open-btn{background:#047857;color:#fff}.qr-shift-close-btn{background:#991b1b;color:#fff}'+'.qr-shift-modal{position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px}'+'.qr-shift-box{width:min(460px,100%);background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.5);color:#fff}'+'.qr-shift-box h2{margin:0 0 8px}.qr-shift-muted{color:#94a3b8;font-size:13px;line-height:1.5}.qr-shift-actions{display:flex;gap:8px;margin-top:18px}.qr-shift-actions button{flex:1;border:0;border-radius:11px;padding:11px;font-weight:800;cursor:pointer}';document.head.appendChild(s);}
  async function getShift(){var r=await window.db.rpc('get_staff_shift',{p_token:token()});if(r.error)throw r.error;return r.data||{open:false};}
  function addButton(id,text,cls,fn){var t=top();if(!t||document.getElementById(id))return;var b=document.createElement('button');b.id=id;b.type='button';b.className='qr-shift-btn '+cls;b.textContent=text;b.onclick=fn;var logout=t.querySelector('button.btn-ghost,button.btn');if(logout)t.insertBefore(b,logout);else t.appendChild(b);}
  function remove(id){var el=document.getElementById(id);if(el)el.remove();}
  function render(shift){if(!token())return;ensureStyle();remove('qr-shift-open-btn');remove('qr-shift-close-btn');remove('qr-shift-chip');var t=top();if(!t)return;var chip=document.createElement('span');chip.id='qr-shift-chip';chip.className='qr-shift-chip '+(shift.open?'qr-shift-open':'qr-shift-closed');chip.textContent=shift.open?'🟢 Смена открыта':'🟠 Смена не открыта';var logout=t.querySelector('button.btn-ghost,button.btn');if(logout)t.insertBefore(chip,logout);else t.appendChild(chip);if(shift.open){unlock();addButton('qr-shift-close-btn','🔒 Закрыть смену','qr-shift-close-btn',closeShift);}else{addButton('qr-shift-open-btn','▶ Открыть смену','qr-shift-open-btn',openShift);lockInterface();}}
  function lockInterface(){var id='qr-shift-lock';if(document.getElementById(id))return;setTimeout(function(){if(document.getElementById(id)||!token())return;var layer=document.createElement('div');layer.id=id;layer.className='qr-shift-modal';layer.innerHTML='<div class="qr-shift-box"><h2>Смена не открыта</h2><div class="qr-shift-muted">Сначала откройте рабочую смену. После открытия появятся рабочие разделы текущей смены.</div><div class="qr-shift-actions"><button id="qr-shift-open-now" class="qr-shift-open-btn">▶ Открыть смену</button></div></div>';document.body.appendChild(layer);layer.querySelector('#qr-shift-open-now').onclick=openShift;},300);}
  function unlock(){var el=document.getElementById('qr-shift-lock');if(el)el.remove();}
  async function openShift(){var b=document.getElementById('qr-shift-open-btn')||document.getElementById('qr-shift-open-now');if(b)b.disabled=true;try{var r=await window.db.rpc('open_staff_shift',{p_token:token()});if(r.error){alert(r.error.message||'Не удалось открыть смену');return;}unlock();await refresh();}catch(e){alert(e.message||'Ошибка открытия смены');}finally{if(b)b.disabled=false;}}
  async function closeShift(){if(!confirm('Закрыть текущую смену?\n\nПеред закрытием система проверит незавершённые заказы. После закрытия текущая история и рабочие счётчики будут сброшены, архив управляющего сохранится.'))return;var b=document.getElementById('qr-shift-close-btn');if(b){b.disabled=true;b.textContent='⏳ Закрываем...';}try{var rr=await window.db.rpc('close_staff_shift',{p_token:token()});if(rr.error){var msg=rr.error.message||'Не удалось закрыть смену';if(msg.indexOf('active_orders_exist:')===0)alert('Нельзя закрыть смену: есть незавершённые заказы ('+msg.split(':')[1]+').');else if(msg==='shift_not_open')alert('Смена ещё не открыта.');else alert(msg);return;}alert('Смена закрыта. Статистика сохранена в архиве управляющего.');location.reload();}catch(e){alert(e.message||'Ошибка закрытия смены');}finally{if(b){b.disabled=false;b.textContent='🔒 Закрыть смену';}}}
  async function refresh(){if(stopped||!token())return;try{render(await getShift());}catch(e){var msg=String(e&&e.message||e||'');if(msg.toLowerCase().indexOf('permission denied for function get_staff_shift')!==-1||String(e&&e.code)==='42501'){stopped=true;console.warn('[QR Shift] get_staff_shift permission is not available yet; retry disabled until page reload.');}else console.warn('[QR Shift]',e);}}
  var tries=0;var timer=setInterval(function(){if(!stopped&&token()){refresh();if(++tries>80)clearInterval(timer);}},1500);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
