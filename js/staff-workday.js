/* QR-SETKA staff workday controls: shared by cook/waiter. */
(function(){
  'use strict';
  if(window.__QR_STAFF_WORKDAY__) return;
  window.__QR_STAFF_WORKDAY__=true;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
  function token(){return localStorage.getItem('staff_token')||'';}
  function inject(){
    if(!document.body || !token()) return;
    var top=document.querySelector('.topbar,.top');
    if(!top || document.getElementById('qr-staff-workday-btn')) return;
    var b=document.createElement('button');
    b.id='qr-staff-workday-btn'; b.type='button'; b.textContent='🧹 Закрыть день';
    b.style.cssText='border:0;border-radius:10px;padding:9px 12px;background:#7f1d1d;color:#fff;font-weight:800;cursor:pointer;margin-right:8px';
    var logout=top.querySelector('button.btn-ghost,button.btn');
    if(logout) top.insertBefore(b,logout); else top.appendChild(b);
    b.onclick=async function(){
      if(!confirm('Закрыть рабочий день?\n\nИстория этого сотрудника и текущие счётчики будут сброшены, но данные останутся в архиве управляющего.')) return;
      b.disabled=true; b.textContent='⏳ Закрываем...';
      try{
        var r=await window.db.rpc('reset_staff_workday',{p_token:token()});
        if(r.error){
          var msg=r.error.message||'Не удалось закрыть день';
          if(msg.indexOf('active_orders_exist:')===0){
            alert('Нельзя закрыть день: есть незавершённые заказы ('+msg.split(':')[1]+').');
          } else alert(msg);
          b.disabled=false; b.textContent='🧹 Закрыть день'; return;
        }
        alert('Рабочий день закрыт. Архив статистики сохранён.');
        location.reload();
      }catch(e){alert(e.message||'Ошибка закрытия дня');b.disabled=false;b.textContent='🧹 Закрыть день';}
    };
  }
  var tries=0, timer=setInterval(function(){inject(); if(++tries>60) clearInterval(timer);},500);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject); else inject();
})();
