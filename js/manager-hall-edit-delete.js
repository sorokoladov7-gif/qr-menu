/* QR Menu — delete action inside the table edit dialog */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_EDIT_DELETE__) return;
  window.__QR_MANAGER_HALL_EDIT_DELETE__=true;

  function db(){return window.db||null;}
  function rpc(name,args){var c=db();if(!c||!c.rpc)return Promise.reject(new Error('Supabase client не найден'));return c.rpc(name,args);}
  function venue(){try{return window.__managerSelectedVenue||(window.__managerVue&&window.__managerVue.venue)||null;}catch(e){return null;}}
  function install(){
    var style=document.createElement('style');style.textContent='.qmh-card-actions [data-delete]{display:none!important}.qmh-edit-delete{background:#7f1d1d!important;border-color:#ef4444!important;color:#fff!important}';document.head.appendChild(style);
    var observer=new MutationObserver(function(){
      var modal=document.querySelector('#qr-manager-hall-final .qmh-modal');
      if(!modal||modal.querySelector('[data-edit-delete]'))return;
      var box=modal.querySelector('.qmh-box');var cancel=modal.querySelector('#qmc');var numberInput=modal.querySelector('#qmn');
      if(!box||!cancel||!numberInput)return;
      var title=box.querySelector('h2');
      if(!title||title.textContent.indexOf('Редактировать')===-1)return;
      var b=document.createElement('button');b.className='qmh-btn qmh-edit-delete';b.setAttribute('data-edit-delete','1');b.textContent='🗑 Удалить';b.style.marginRight='8px';
      cancel.parentNode.insertBefore(b,cancel);
      b.onclick=async function(){
        var v=venue();var number=Number(numberInput.value);
        if(!v||!v.id||!Number.isInteger(number)||number<1){alert('Не удалось определить стол');return;}
        b.disabled=true;b.textContent='Удаляем...';
        try{
          var board=await rpc('manager_table_board',{p_venue_id:v.id});if(board.error)throw new Error(board.error.message);
          var rows=Array.isArray(board.data)?board.data:(board.data&&board.data.tables)||[];var table=rows.find(function(t){return Number(t.table_number)===number;});
          if(!table)throw new Error('Стол не найден');
          var r=await rpc('manager_delete_table',{p_venue_id:v.id,p_table_id:table.id});if(r.error)throw new Error(r.error.message||'Не удалось удалить стол');
          modal.remove();
          var refresh=document.querySelector('#qr-manager-hall-final #qmh-refresh');if(refresh)refresh.click();
        }catch(e){b.disabled=false;b.textContent='🗑 Удалить';alert(e.message||'Не удалось удалить стол');}
      };
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
