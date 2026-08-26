/* QR Menu — manager SBP/YooKassa settings. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_PAYMENT_SETTINGS_V1__) return;
  window.__QR_MANAGER_PAYMENT_SETTINGS_V1__=true;
  var state={accounts:null,open:false},modal=null,button=null;
  function app(){return window.__QR_MANAGER_VUE_APP__||null;}
  function currentVenue(){var v=window.__managerCurrentVenue||window.__managerSelectedVenue;if(v&&v.id)return v;var a=app();return a&&a._instance&&a._instance.proxy&&a._instance.proxy.venue?a._instance.proxy.venue:null;}
  function getAuthClient(){
    var candidates=[window.db,window.supabaseClient,window.supabase,window.sb,window.client];
    for(var i=0;i<candidates.length;i++){
      var c=candidates[i];
      if(c&&c.auth&&typeof c.auth.getSession==='function') return c;
    }
    return null;
  }
  function tokenFromStorage(){
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i),raw=localStorage.getItem(key);
        if(!key||!raw||key.indexOf('sb-')!==0||key.indexOf('-auth-token')===-1) continue;
        var parsed=JSON.parse(raw);
        if(parsed&&parsed.access_token)return parsed.access_token;
        if(Array.isArray(parsed)&&parsed[0]&&parsed[0].access_token)return parsed[0].access_token;
      }
    }catch(e){console.warn('[QR SBP] local session lookup failed',e);}
    return null;
  }
  async function sessionToken(){
    var c=getAuthClient();
    if(c){
      try{var r=await c.auth.getSession();var token=r&&r.data&&r.data.session&&r.data.session.access_token;if(token)return token;}catch(e){console.warn('[QR SBP] getSession failed',e);}
    }
    return tokenFromStorage();
  }
  async function api(method,body){var token=await sessionToken();if(!token)throw new Error('Сессия управляющего не найдена. Войдите в кабинет заново.');var o={method:method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}};if(body)o.body=JSON.stringify(body);var r=await fetch('/api/payments/yookassa/accounts',o),d={};try{d=await r.json();}catch(e){}if(!r.ok||d.ok===false)throw new Error(d.error||d.message||('HTTP '+r.status));return d;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function accountForVenue(id){var a=state.accounts,row=(a&&a.venues||[]).find(function(x){return x.venue_id===id;});return row?row.account:null;}
  function activeShared(){return !!(state.accounts&&state.accounts.shared&&state.accounts.shared.status==='active');}
  function ensureUi(){
    if(!(button&&modal)){
      var tabs=document.querySelector('.tabs');
      if(tabs&&!document.querySelector('[data-manager-payment-tab]')){button=document.createElement('button');button.type='button';button.setAttribute('data-manager-payment-tab','1');button.textContent='💳 СБП';button.style.cssText='background:linear-gradient(90deg,#10b981,#059669);color:#fff;font-weight:800;';button.onclick=open;tabs.appendChild(button);}
      if(!modal){modal=document.createElement('div');modal.className='modal';modal.style.display='none';modal.innerHTML='<div class="glass box" style="max-width:760px;width:95%;max-height:90vh;overflow:auto"><div class="spread"><h3 style="margin:0">💳 СБП / ЮKassa</h3><button class="btn btn-ghost btn-sm" data-pay-close>×</button></div><p class="muted" style="font-size:13px">Подключите ЮKassa для приёма оплаты заказов по СБП. Секретные данные хранятся только на сервере.</p><div data-pay-content></div></div>';document.body.appendChild(modal);modal.addEventListener('click',function(e){if(e.target===modal)close();});modal.querySelector('[data-pay-close]').onclick=close;}
    }
  }
  function close(){if(modal){modal.style.display='none';state.open=false;}}
  function open(){ensureUi();state.open=true;modal.style.display='flex';refresh().catch(showError);}
  function showError(e){var c=modal&&modal.querySelector('[data-pay-content]');if(c)c.innerHTML='<div class="msg error">Ошибка: '+esc(e.message||e)+'</div>';}
  function render(){
    var c=modal.querySelector('[data-pay-content]'),v=currentVenue(),a=state.accounts;if(!v||!a){c.innerHTML='<div class="muted">Выберите заведение.</div>';return;}
    var own=accountForVenue(v.id),shared=a.shared,html='';
    html+='<div class="glass card" style="margin:12px 0;border-color:rgba(99,102,241,.35)"><b>Текущее заведение</b><div style="font-size:18px;margin-top:5px">'+esc(v.name||'Заведение')+'</div><div class="muted" style="font-size:12px">Отдельный СБП имеет приоритет. Если он выключен или отсутствует — используется общий.</div></div>';
    html+='<div class="glass card" style="margin-bottom:12px"><div class="spread"><div><b>🏪 СБП только для этого заведения</b><div class="muted" style="font-size:12px">Отдельный магазин ЮKassa</div></div><span class="badge '+(own&&own.status==='active'?'b-ready':'b-cancelled')+'">'+(own?(own.status==='active'?'Включён':'Выключен'):'Не подключён')+'</span></div>';
    if(own){html+='<div style="margin-top:10px;font-size:13px">'+esc(own.account_name||'ЮKassa')+' · '+esc(own.merchant_id||own.shop_id||'')+'</div><div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn '+(own.status==='active'?'btn-ghost':'btn-green')+' btn-sm" data-pay-action="'+(own.status==='active'?'disable':'enable')+'" data-pay-id="'+own.id+'">'+(own.status==='active'?'Выключить':'Включить')+'</button>'+(shared&&shared.status==='active'?'<button class="btn btn-ghost btn-sm" data-pay-use-shared="'+own.id+'">Использовать общий</button>':'')+'</div>';}else html+='<button class="btn btn-primary" data-pay-connect="venue">🔗 Подключить ЮKassa для этого заведения</button>';
    html+='</div>';
    html+='<div class="glass card" style="margin-bottom:12px;border-color:rgba(16,185,129,.35)"><div class="spread"><div><b>🌐 Один СБП для всех заведений</b><div class="muted" style="font-size:12px">Все ваши заведения используют один магазин ЮKassa</div></div><span class="badge '+(shared&&shared.status==='active'?'b-ready':'b-cancelled')+'">'+(shared?(shared.status==='active'?'Включён':'Выключен'):'Не подключён')+'</span></div>';
    if(shared)html+='<div style="margin-top:10px;font-size:13px">'+esc(shared.account_name||'ЮKassa')+' · '+esc(shared.merchant_id||shared.shop_id||'')+'</div><div class="row" style="margin-top:10px"><button class="btn '+(shared.status==='active'?'btn-ghost':'btn-green')+' btn-sm" data-pay-action="'+(shared.status==='active'?'disable':'enable')+'" data-pay-id="'+shared.id+'">'+(shared.status==='active'?'Выключить':'Включить')+'</button></div>';
    else html+='<button class="btn btn-green" data-pay-connect="shared">🔗 Подключить один СБП для всех</button>';
    html+='<div class="muted" style="font-size:11px;margin-top:10px">Отдельный активный СБП заведения → общий активный СБП.</div></div>';
    html+='<div class="glass card"><b>Заведения управляющего</b><table class="tbl" style="margin-top:8px"><tr><th>Заведение</th><th>Режим</th><th>Статус</th></tr>';
    (a.venues||[]).forEach(function(row){var ac=row.account,mode=ac&&ac.status==='active'?'Отдельный':(activeShared()?'Общий':'Нет');html+='<tr><td>'+esc(row.venue_id)+'</td><td>'+mode+'</td><td><span class="badge '+(mode==='Нет'?'b-cancelled':'b-ready')+'">'+(mode==='Нет'?'СБП выключен':'СБП работает')+'</span></td></tr>';});
    html+='</table></div>';c.innerHTML=html;
    c.querySelectorAll('[data-pay-connect]').forEach(function(el){el.onclick=function(){connect(el.getAttribute('data-pay-connect'));};});
    c.querySelectorAll('[data-pay-action]').forEach(function(el){el.onclick=function(){changeStatus(el.getAttribute('data-pay-id'),el.getAttribute('data-pay-action'));};});
    c.querySelectorAll('[data-pay-use-shared]').forEach(function(el){el.onclick=function(){useShared(el.getAttribute('data-pay-use-shared'));};});
  }
  async function refresh(){state.accounts=await api('GET');if(state.open)render();}
  async function connect(scope){
    var v=currentVenue();if(!v||!v.id){alert('Сначала выберите заведение.');return;}
    try{var token=await sessionToken();if(!token)throw new Error('Сессия управляющего не найдена. Войдите в кабинет заново.');var r=await fetch('/api/payments/yookassa/connect',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({venue_id:v.id,scope:scope})});var d=await r.json();if(!r.ok||!d.authorization_url)throw new Error(d.error||'Не удалось начать подключение ЮKassa');location.href=d.authorization_url;}catch(e){showError(e);}
  }
  async function changeStatus(id,action){try{await api('PATCH',{account_id:id,action:action});await refresh();}catch(e){showError(e);}}
  async function useShared(id){if(!confirm('Выключить отдельный СБП этого заведения и использовать общий?'))return;try{await api('PATCH',{account_id:id,action:'disable'});await refresh();}catch(e){showError(e);}}
  function watch(){ensureUi();var last=null;setInterval(function(){var v=currentVenue(),id=v&&v.id;if(id!==last){last=id;if(button)button.style.display=id?'':'none';if(state.open)refresh().catch(showError);}ensureUi();},700);}
  window.addEventListener('qr-manager-vue-ready',function(){setTimeout(watch,50);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();
