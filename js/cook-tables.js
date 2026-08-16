(function(){
  'use strict';
  if(!/\/cook\.html$/i.test(location.pathname)) return;
  var panel=null,timer=null,loading=false;
  function getSession(){try{return JSON.parse(localStorage.getItem('cook_session')||'null');}catch(e){return null;}}
  function ensurePanel(){
    if(panel&&document.body.contains(panel)) return panel;
    var wrap=document.querySelector('#app .wrap');
    if(!wrap) return null;
    var stats=wrap.querySelector('.stats-grid');
    if(!stats) return null;
    panel=document.createElement('section');
    panel.id='cook-table-control';
    panel.className='glass card';
    panel.style.margin='0 0 18px';
    stats.insertAdjacentElement('afterend',panel);
    return panel;
  }
  function css(){
    if(document.getElementById('cook-table-control-css')) return;
    var s=document.createElement('style');s.id='cook-table-control-css';
    s.textContent='#cook-table-control .ct-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}#cook-table-control .ct-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}#cook-table-control .ct-table{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03)}#cook-table-control .ct-free{border-color:rgba(52,211,153,.28)}#cook-table-control .ct-occupied{border-color:rgba(248,113,113,.38)}#cook-table-control .ct-status{font-size:11px;font-weight:800;padding:4px 8px;border-radius:99px}#cook-table-control .ct-free .ct-status{background:rgba(52,211,153,.14);color:#6ee7b7}#cook-table-control .ct-occupied .ct-status{background:rgba(248,113,113,.14);color:#fca5a5}#cook-table-control .ct-meta{font-size:11px;color:#94a3b8;margin-top:7px}#cook-table-control .ct-actions{display:flex;gap:7px;margin-top:9px}#cook-table-control .ct-actions button{flex:1}';
    document.head.appendChild(s);
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){return Number(v||0).toLocaleString('ru-RU');}
  function minutes(v){if(!v)return '';var m=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/60000));return m<60?m+' мин':Math.floor(m/60)+' ч '+(m%60)+' мин';}
  async function refresh(){
    var s=getSession();
    if(!s||!s.token||typeof window.db==='undefined'||!window.db||typeof window.db.rpc!=='function') return;
    var p=ensurePanel();
    if(!p||loading) return;
    loading=true;
    try{
      var r=await window.db.rpc('cook_get_dashboard',{p_token:s.token});
      if(r.error) throw r.error;
      var d=r.data||{};
      if(Array.isArray(d)) d=d[0]||{};
      if(d.dashboard) d=d.dashboard;
      var waiterCount=Number(d.waiter_count||0);
      if(waiterCount>0){p.style.display='none';return;}
      p.style.display='block';
      var tables=Array.isArray(d.tables)?d.tables:[];
      var html='<div class="ct-head"><div><h4 style="margin:0">🪑 Столы</h4><div class="muted" style="font-size:12px;margin-top:3px">Официант не назначен — занятость столов контролирует кухня.</div></div><button class="btn btn-ghost btn-sm" id="ct-refresh">↻</button></div>';
      if(!tables.length){
        html+='<div class="muted">Столы ещё не настроены.</div>';
      }else{
        html+='<div class="ct-grid">';
        tables.forEach(function(t){
          var occ=t.occupancy_status==='occupied',sess=t.session;
          html+='<div class="ct-table '+(occ?'ct-occupied':'ct-free')+'"><div class="spread"><b>Стол '+esc(t.table_number)+'</b><span class="ct-status">'+(occ?'ЗАНЯТ':'СВОБОДЕН')+'</span></div>'+(t.name?'<div class="muted" style="font-size:12px;margin-top:4px">'+esc(t.name)+'</div>':'')+(occ?'<div class="ct-meta">Посадка: '+minutes(t.occupied_since)+' · Заказов: '+(sess?sess.order_count:0)+' · '+fmt(sess?sess.total_price:0)+' ₽</div>':'<div class="ct-meta">Гости ещё не сидят</div>')+'<div class="ct-actions">'+(occ?'<button class="btn btn-green btn-sm" data-ct-release="'+esc(t.id)+'">✓ Освободить</button>':'<button class="btn btn-primary btn-sm" data-ct-start="'+esc(t.id)+'">🪑 Посадить гостей</button>')+'</div></div>';
        });
        html+='</div>';
      }
      p.innerHTML=html;
      var rb=p.querySelector('#ct-refresh');if(rb)rb.addEventListener('click',refresh);
      p.querySelectorAll('[data-ct-start]').forEach(function(b){b.addEventListener('click',async function(){await action('cook_start_table_session',b.getAttribute('data-ct-start'));});});
      p.querySelectorAll('[data-ct-release]').forEach(function(b){b.addEventListener('click',async function(){if(confirm('Гости действительно ушли со стола?'))await action('cook_release_table',b.getAttribute('data-ct-release'));});});
    }catch(e){console.error('cook table control:',e);p.style.display='none';}
    finally{loading=false;}
  }
  async function action(fn,id){
    var s=getSession();if(!s||!s.token||!window.db)return;
    try{var r=await window.db.rpc(fn,{p_token:s.token,p_table_id:id});if(r.error)throw r.error;await refresh();}
    catch(e){alert(e&&e.message?e.message:'Не удалось изменить состояние стола');}
  }
  function start(){
    css();
    refresh();
    if(timer)clearInterval(timer);
    timer=setInterval(refresh,2000);
    new MutationObserver(function(){refresh();}).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.addEventListener('beforeunload',function(){if(timer)clearInterval(timer);});
})();
