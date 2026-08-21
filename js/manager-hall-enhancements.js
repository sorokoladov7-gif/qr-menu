/* QR Menu — manager hall enhancements: QR, delete, durable refresh */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_ENHANCEMENTS__) return;
  window.__QR_MANAGER_HALL_ENHANCEMENTS__ = true;

  var QR_SRC='https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.min.js';
  var observer=null;
  var qrReady=null;

  function db(){return window.db||null;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&#39;';});}
  function loadQr(){
    if(window.qrcode) return Promise.resolve();
    if(qrReady) return qrReady;
    qrReady=new Promise(function(resolve,reject){
      var s=document.createElement('script');s.src=QR_SRC;s.async=true;s.onload=function(){resolve();};s.onerror=function(){reject(new Error('Не удалось загрузить генератор QR-кодов'));};document.head.appendChild(s);
    });
    return qrReady;
  }
  function getVenue(){
    try{
      if(window.__managerSelectedVenue&&window.__managerSelectedVenue.id)return window.__managerSelectedVenue;
      if(window.__managerVue&&window.__managerVue.venue&&window.__managerVue.venue.id)return window.__managerVue.venue;
    }catch(e){}
    return null;
  }
  function rpc(name,args){var c=db();if(!c||!c.rpc)return Promise.reject(new Error('Supabase client не найден'));return c.rpc(name,args);}
  function qrUrl(venue,table){return location.origin+'/menu.html?venue='+encodeURIComponent(venue&&venue.slug?venue.slug:'')+'&table='+encodeURIComponent(table.number)+'&token='+encodeURIComponent(table.qr||'');}
  function qrSvg(text){if(!window.qrcode)return '';try{var qr=qrcode(0,'M');qr.addData(text);qr.make();return qr.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(e){return '<div style="color:#fca5a5;font-size:12px">QR не создан</div>';}}
  async function getTables(){var venue=getVenue();if(!venue||!venue.id)return {venue:null,tables:[]};var r=await rpc('manager_table_board',{p_venue_id:venue.id});if(r.error)throw new Error(r.error.message||'Не удалось загрузить столы');var rows=Array.isArray(r.data)?r.data:(r.data&&r.data.tables)||[];return {venue:venue,tables:rows};}
  function style(){if(document.getElementById('qmh-enh-css'))return;var s=document.createElement('style');s.id='qmh-enh-css';s.textContent='.qmh-qr{width:150px;height:150px;background:#fff;border-radius:12px;padding:8px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;margin:10px auto}.qmh-qr svg{width:100%;height:100%}.qmh-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.qmh-danger{background:#7f1d1d!important;border-color:#ef4444!important}.qmh-qr-url{font-size:10px;color:#94a3b8;word-break:break-all;margin-top:6px}.qmh-confirm{position:fixed;inset:0;z-index:100010;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px}.qmh-confirm-box{width:min(420px,100%);background:#111827;border:1px solid #ffffff18;border-radius:18px;padding:20px}.qmh-qr-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.qmh-mini{font-size:12px;padding:7px 10px}';document.head.appendChild(s);}
  function confirmDelete(table,venue){return new Promise(function(resolve){var m=document.createElement('div');m.className='qmh-confirm';m.innerHTML='<div class="qmh-confirm-box"><h3 style="margin-top:0">Удалить стол №'+esc(table.table_number)+'</h3><p class="qmh-small">Стол будет скрыт из активного зала. История заказов не удаляется.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="qmh-btn" id="no">Отмена</button><button class="qmh-btn qmh-danger" id="yes">Удалить</button></div></div>';document.body.appendChild(m);m.querySelector('#no').onclick=function(){m.remove();resolve(false);};m.querySelector('#yes').onclick=async function(){var b=this;b.disabled=true;b.textContent='Удаляем...';try{var r=await rpc('manager_delete_table',{p_venue_id:venue.id,p_table_id:table.id});if(r.error)throw new Error(r.error.message||'Не удалось удалить стол');m.remove();resolve(true);}catch(e){b.disabled=false;b.textContent='Удалить';alert(e.message||'Не удалось удалить стол');resolve(false);}};});}

  async function persistVisiblePositions(root){
    var venue=getVenue();if(!venue||!venue.id)return;
    var board=root.querySelector('#qmh-board');if(!board)return;
    var rows=await getTables();
    var els=board.querySelectorAll('.qmh-table');
    var jobs=[];
    for(var i=0;i<els.length;i++){
      var el=els[i];
      var m=(el.textContent||'').match(/№\s*(\d+)/);
      if(!m)continue;
      var number=m[1], row=null;
      for(var j=0;j<rows.tables.length;j++){if(String(rows.tables[j].table_number)===String(number)){row=rows.tables[j];break;}}
      if(!row)continue;
      var x=Math.round(parseFloat(el.style.left)||0),y=Math.round(parseFloat(el.style.top)||0);
      if(x===Number(row.pos_x||0)&&y===Number(row.pos_y||0))continue;
      jobs.push(rpc('manager_move_table',{p_venue_id:venue.id,p_table_id:row.id,p_x:x,p_y:y}));
    }
    if(jobs.length)await Promise.all(jobs);
  }

  function installDurableRefresh(){
    document.addEventListener('click',function(event){
      var target=event.target&&event.target.closest?event.target.closest('#qmh-refresh'):null;
      if(!target||target.__qmhBypass)return;
      var root=document.getElementById('qr-manager-hall-final');if(!root)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(root.__refreshBusy)return;
      root.__refreshBusy=true;target.disabled=true;
      persistVisiblePositions(root).catch(function(e){console.error('[QR Hall] position persist before refresh failed',e);}).finally(function(){
        target.disabled=false;root.__refreshBusy=false;target.__qmhBypass=true;target.click();setTimeout(function(){target.__qmhBypass=false;},0);
      });
    },true);
  }

  function addQrAndDelete(){
    var root=document.getElementById('qr-manager-hall-final');if(!root||root.__enhBusy)return;
    var venue=getVenue();if(!venue||!venue.id)return;
    var cards=root.querySelectorAll('.qmh-card');if(!cards.length)return;
    root.__enhBusy=true;
    getTables().then(function(data){return loadQr().then(function(){data.tables.forEach(function(table){
      var card=null;for(var i=0;i<cards.length;i++){var title=cards[i].querySelector('b');if(title&&title.textContent.replace(/[^0-9]/g,'')===String(table.table_number)){card=cards[i];break;}}
      if(!card||card.querySelector('[data-enh-qr]'))return;
      var url=qrUrl(venue,{number:table.table_number,qr:table.qr_token||''});
      var qr=document.createElement('div');qr.setAttribute('data-enh-qr','1');qr.innerHTML='<div class="qmh-qr">'+qrSvg(url)+'</div><div class="qmh-qr-url">'+esc(url)+'</div><div class="qmh-qr-actions"><button class="qmh-btn qmh-mini" data-qr-open>Открыть</button><button class="qmh-btn qmh-mini" data-qr-print>Печать QR</button></div>';
      var edit=card.querySelector('[data-edit]');if(edit&&edit.parentNode)edit.parentNode.insertBefore(qr,edit);else card.appendChild(qr);
      qr.querySelector('[data-qr-open]').onclick=function(){window.open(url,'_blank');};
      qr.querySelector('[data-qr-print]').onclick=function(){var w=window.open('','_blank','width=500,height=650');if(!w)return;w.document.write('<html><head><title>QR Стол '+esc(table.table_number)+'</title><style>body{font-family:Arial;text-align:center;padding:30px}svg{width:360px;height:360px}.url{font-size:12px;word-break:break-all;margin-top:15px}</style></head><body><h1>Стол №'+esc(table.table_number)+'</h1>'+qrSvg(url)+'<div class="url">'+esc(url)+'</div><script>window.onload=function(){setTimeout(function(){window.print()},250)};<\\/script></body></html>');w.document.close();};
      var actions=card.querySelector('.qmh-card-actions');if(!actions){actions=document.createElement('div');actions.className='qmh-card-actions';var editButton=card.querySelector('[data-edit]');if(editButton)actions.appendChild(editButton);card.appendChild(actions);}
      if(!actions.querySelector('[data-delete]')){var del=document.createElement('button');del.className='qmh-btn qmh-danger';del.setAttribute('data-delete','1');del.textContent='🗑 Удалить';del.onclick=async function(){var ok=await confirmDelete(table,venue);if(ok){var refresh=root.querySelector('#qmh-refresh');if(refresh)refresh.click();}};actions.appendChild(del);}
    });});}).catch(function(e){console.error('[QR Hall] enhancement error',e);}).finally(function(){root.__enhBusy=false;});
  }
  function watch(){style();var root=document.getElementById('qr-manager-hall-final');if(root&&!observer){observer=new MutationObserver(function(){if(root.__enhTimer)clearTimeout(root.__enhTimer);root.__enhTimer=setTimeout(addQrAndDelete,80);});observer.observe(root,{childList:true,subtree:true});}addQrAndDelete();}
  function install(){installDurableRefresh();var timer=setInterval(function(){if(document.getElementById('qr-manager-hall-final')){clearInterval(timer);watch();}},100);setTimeout(function(){clearInterval(timer);},30000);}
  install();
  window.QRManagerHallEnhancements={refresh:addQrAndDelete,persistPositions:function(){var root=document.getElementById('qr-manager-hall-final');return root?persistVisiblePositions(root):Promise.resolve();}};
})();
