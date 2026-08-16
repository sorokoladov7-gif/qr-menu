// Browser Supabase client.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const baseDb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
window.db=baseDb;

(function(){
  const path=location.pathname.toLowerCase();
  const isMenu=/\/menu\.html$/i.test(path);
  const isStaff=/(cook|courier|waiter)\.html$/i.test(path);
  const isManager=/\/manager\.html$/i.test(path);
  const real=baseDb;
  const oldFrom=real.from.bind(real);
  const oldRpc=real.rpc.bind(real);

  async function resolveQrTable(venueId){
    const token=new URLSearchParams(location.search).get('table');
    if(!token) return null;
    if(window.__qrTable && window.__qrTable.qr_token===token) return window.__qrTable;
    let q=oldFrom('venue_tables').select('id,venue_id,table_number,name,qr_token,is_active').eq('qr_token',String(token).trim()).eq('is_active',true);
    if(venueId) q=q.eq('venue_id',venueId);
    const {data,error}=await q.maybeSingle();
    if(!error&&data){ window.__qrTable=data; return data; }
    return null;
  }

  function menuChain(table){
    const state={action:'select',filters:{},payload:null};
    const api={
      select:function(){state.action='select';return api},
      insert:function(v){state.action='insert';state.payload=v;return api},
      update:function(v){state.action='update';state.payload=v;return api},
      eq:function(k,v){state.filters[k]=v;return api},
      in:function(k,v){state.filters[k]={in:v};return api},
      order:function(){return api},
      limit:function(){return api},
      maybeSingle:function(){return execute(true)},
      single:function(){return execute(true)},
      then:function(a,b){return execute(false).then(a,b)},
      catch:function(a){return execute(false).catch(a)}
    };
    async function execute(single){
      if(table==='orders'&&state.action==='select'){
        const venueId=state.filters.venue_id;
        const phone=state.filters.customer_phone||localStorage.getItem('last_phone')||'';
        if(!venueId||!phone) return {data:null,error:new Error('tracking_context_missing')};
        const {data,error}=await oldRpc('customer_track_order_json',{p_venue_id:venueId,p_customer_phone:String(phone).trim()});
        if(error) return {data:null,error};
        return {data:single?(data||null):(data?[data]:[]),error:null};
      }
      if(table==='orders'&&state.action==='update'){
        const phone=localStorage.getItem('last_phone')||'';
        return oldRpc('customer_change_order_status',{p_order_id:state.filters.id,p_customer_phone:phone,p_status:state.payload&&state.payload.status});
      }
      if(table==='orders'&&state.action==='insert'){
        let payload=state.payload;
        const venueId=payload&&payload.venue_id;
        const token=new URLSearchParams(location.search).get('table');
        if(token&&venueId){
          const t=await resolveQrTable(venueId);
          if(t){
            if(Array.isArray(payload)) payload=payload.map(function(row){return Object.assign({},row,{table_id:row.table_id||t.id});});
            else payload=Object.assign({},payload,{table_id:payload.table_id||t.id});
          }
        }
        return oldFrom(table).insert(payload);
      }
      return oldFrom(table)[state.action](state.payload||'*');
    }
    return api;
  }

  function rpc(name,args,options){
    if(name==='create_public_order'&&args&&typeof args==='object'){
      const token=new URLSearchParams(location.search).get('table');
      if(token) args=Object.assign({},args,{p_table_token:String(token).trim()});
    }
    return oldRpc(name,args,options);
  }

  window.db={from:function(table){return isMenu&&table==='orders'?menuChain(table):oldFrom(table)},rpc:rpc,auth:real.auth,storage:real.storage};

  async function bootQrTable(){
    if(!isMenu)return;
    const token=new URLSearchParams(location.search).get('table');
    if(!token)return;
    const t=await resolveQrTable(null);
    if(!t)return;
    localStorage.setItem('qr_table_id',t.id);
    localStorage.setItem('qr_table_number',String(t.table_number));
    localStorage.setItem('qr_table_name',t.name||('Стол '+t.table_number));
    renderCustomerTable();
  }

  function renderCustomerTable(){
    const t=window.__qrTable;
    if(!t)return;
    let b=document.getElementById('qr-table-fixed-badge');
    if(!b){
      b=document.createElement('div');
      b.id='qr-table-fixed-badge';
      b.style.cssText='position:fixed;top:74px;right:14px;z-index:9999;display:block;padding:10px 14px;border-radius:999px;background:#4f46e5;color:#fff;font-weight:800;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.35)';
      document.body.appendChild(b);
    }
    b.textContent='🪑 '+(t.name||('Стол '+t.table_number));
  }

  if(isMenu){
    bootQrTable();
    let n=0; const timer=setInterval(function(){renderCustomerTable();if(++n>30)clearInterval(timer)},500);
  }

  const staffTableCache={};
  const staffTablePending={};
  async function resolveStaffOrderTable(orderNumber){
    const key=String(orderNumber||'');
    if(!key)return null;
    if(staffTableCache[key])return staffTableCache[key];
    if(staffTablePending[key])return staffTablePending[key];
    staffTablePending[key]=(async function(){
      const r=await oldFrom('orders').select('id,order_number,table_id').eq('order_number',key).maybeSingle();
      if(r.error||!r.data||!r.data.table_id)return null;
      const t=await oldFrom('venue_tables').select('id,table_number,name').eq('id',r.data.table_id).maybeSingle();
      if(t.error||!t.data)return null;
      staffTableCache[key]=t.data;
      return t.data;
    })();
    try{return await staffTablePending[key]}finally{delete staffTablePending[key]}
  }
  async function addStaffTableBadge(card){
    if(!card||card.querySelector('.qr-table-fixed'))return;
    const m=String(card.textContent||'').match(/№\s*(\d+)/);
    if(!m)return;
    const t=await resolveStaffOrderTable(m[1]);
    if(!t||card.querySelector('.qr-table-fixed'))return;
    const head=card.querySelector('.spread')||card.firstElementChild;
    if(!head)return;
    const badge=document.createElement('div');
    badge.className='qr-table-fixed';
    badge.textContent='🪑 '+(t.name||('Стол '+t.table_number));
    badge.style.cssText='margin:8px 0;padding:9px 12px;border-radius:11px;background:#4f46e5;color:#fff;font-weight:800;display:block;text-align:center';
    head.insertAdjacentElement('afterend',badge);
  }
  function addStaffBadges(){
    if(!isStaff)return;
    document.querySelectorAll('.wcard').forEach(function(card){addStaffTableBadge(card);});
  }
  if(isStaff){
    setInterval(addStaffBadges,1500);
    new MutationObserver(addStaffBadges).observe(document.body,{childList:true,subtree:true});
    addStaffBadges();
  }

  // ================================================================
  // MANAGER: full hall/table management
  // ================================================================
  function managerTables(){
    if(!isManager)return;
    const style=document.createElement('style');
    style.textContent=`
      #qrTablesPanel{display:none}.qt-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.qt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}.qt-stat{padding:14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}.qt-stat b{font-size:22px}.qt-hall{position:relative;min-height:420px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 20% 20%,rgba(99,102,241,.08),transparent 35%),rgba(255,255,255,.015);overflow:hidden;margin-bottom:14px}.qt-table{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;cursor:grab;user-select:none;touch-action:none;border:2px solid #6366f1;background:rgba(99,102,241,.18);color:#fff;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.22)}.qt-table:active{cursor:grabbing}.qt-table.free{border-color:#34d399;background:rgba(52,211,153,.14)}.qt-table.busy{border-color:#fbbf24;background:rgba(251,191,36,.16)}.qt-table.off{opacity:.38;border-color:#94a3b8;background:rgba(148,163,184,.12)}.qt-table small{display:block;font-size:9px;font-weight:600;opacity:.8}.qt-list{width:100%;border-collapse:collapse;font-size:13px}.qt-list th,.qt-list td{padding:9px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left}.qt-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px}.qt-box{width:min(520px,100%);background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px}.qt-field{margin:9px 0}.qt-field label{display:block;font-size:12px;color:#9ca3af;margin-bottom:5px}.qt-field input,.qt-field select{width:100%;box-sizing:border-box}.qt-qr{background:#fff;border-radius:12px;padding:8px;width:180px;height:180px;object-fit:contain}.qt-actions{display:flex;gap:6px;flex-wrap:wrap}.qt-muted{color:#9ca3af;font-size:12px}
      @media(max-width:650px){.qt-hall{min-height:520px}.qt-table{transform:scale(.9);transform-origin:center}.qt-list th:nth-child(3),.qt-list td:nth-child(3){display:none}}
    `;
    document.head.appendChild(style);

    let attempts=0;
    const wait=setInterval(function(){
      const app=document.querySelector('#app');
      const inst=app&&app.__vue_app__&&app.__vue_app__._instance;
      const vm=inst&&inst.proxy;
      const tabs=document.querySelector('.tabs');
      if(!vm||!tabs){if(++attempts>60)clearInterval(wait);return;}
      clearInterval(wait);
      initManagerTables(vm,tabs);
    },300);
  }

  function initManagerTables(vm,tabs){
    if(document.getElementById('qrTablesButton'))return;
    const btn=document.createElement('button');
    btn.id='qrTablesButton';btn.textContent='🪑 Столы';
    btn.className='';
    tabs.appendChild(btn);

    const panel=document.createElement('div');
    panel.id='qrTablesPanel';
    panel.innerHTML=`<div class="spread" style="margin-bottom:14px"><div><h3 style="margin:0">🪑 Зал и столы</h3><div class="qt-muted">Управление столами, местами, QR и занятостью.</div></div><button id="qtAdd" class="btn btn-primary btn-sm">+ Добавить стол</button></div><div id="qtStats" class="qt-stats"></div><div class="glass card"><div class="qt-toolbar"><button id="qtRefresh" class="btn btn-ghost btn-sm">↻ Обновить</button><button id="qtPrint" class="btn btn-ghost btn-sm">🖨 QR всех столов</button></div><div id="qtHall" class="qt-hall"></div><div class="qt-muted">Перетаскивайте столы по схеме. Положение сохраняется автоматически.</div></div><div class="glass card" style="margin-top:14px;overflow:auto"><table class="qt-list"><thead><tr><th>Стол</th><th>Мест</th><th>Состояние</th><th>QR</th><th></th></tr></thead><tbody id="qtRows"></tbody></table></div>`;
    const anchor=document.querySelector('.tabs');
    anchor.parentNode.insertBefore(panel,anchor.nextSibling);

    const modal=document.createElement('div');
    modal.id='qtModal';modal.className='qt-modal';modal.style.display='none';
    modal.innerHTML=`<div class="qt-box"><h3 id="qtTitle" style="margin-top:0">Добавить стол</h3><div class="qt-field"><label>Название</label><input id="qtName" placeholder="Стол 1"></div><div class="qt-field"><label>Номер</label><input id="qtNumber" type="number" min="1"></div><div class="qt-field"><label>Мест</label><input id="qtSeats" type="number" min="1" value="2"></div><div class="qt-field"><label>Форма</label><select id="qtShape"><option value="round">Круг</option><option value="square">Квадрат</option><option value="rect">Прямоугольник</option></select></div><div class="row" style="margin-top:16px"><button id="qtSave" class="btn btn-primary" style="flex:1">Сохранить</button><button id="qtCancel" class="btn btn-ghost">Отмена</button></div><div id="qtError" class="msg error" style="display:none;margin-top:10px"></div></div>`;
    document.body.appendChild(modal);

    let tables=[],editing=null,drag=null;
    function venueId(){return vm.venue&&vm.venue.id}
    function qrUrl(t){return location.origin+'/menu.html?table='+encodeURIComponent(t.qr_token)}
    function statusMap(){
      const out={};
      (vm.orders||[]).forEach(function(o){if(o.table_id&&['new','cooking','ready','delivery'].indexOf(o.status)>=0)out[o.table_id]=o;});
      return out;
    }
    function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c})}
    function tableSize(t){return t.shape==='rect'?[120,72]:t.shape==='square'?[82,82]:[82,82]}
    function draw(){
      const hall=document.getElementById('qtHall'),rows=document.getElementById('qtRows'),stats=document.getElementById('qtStats');
      if(!hall)return;hall.innerHTML='';rows.innerHTML='';
      const active=tables.filter(t=>t.is_active),busy=statusMap();
      stats.innerHTML=`<div class="qt-stat"><b>${tables.length}</b><div class="qt-muted">Всего столов</div></div><div class="qt-stat" style="border-color:#34d399"><b>${active.filter(t=>!busy[t.id]).length}</b><div class="qt-muted">Свободно</div></div><div class="qt-stat" style="border-color:#fbbf24"><b>${active.filter(t=>busy[t.id]).length}</b><div class="qt-muted">Занято</div></div><div class="qt-stat" style="border-color:#94a3b8"><b>${tables.filter(t=>!t.is_active).length}</b><div class="qt-muted">Отключено</div></div>`;
      tables.forEach(function(t){
        const el=document.createElement('div'),sz=tableSize(t),o=busy[t.id];
        el.className='qt-table '+(!t.is_active?'off':o?'busy':'free');el.style.width=sz[0]+'px';el.style.height=sz[1]+'px';el.style.left=(t.pos_x||20)+'px';el.style.top=(t.pos_y||20)+'px';el.innerHTML='🪑 '+esc(t.name||('Стол '+t.table_number))+'<small>'+t.seats+' мест'+(o?' · №'+esc(o.order_number):'')+'</small>';
        el.addEventListener('pointerdown',function(e){if(!t.is_active)return;drag={t:t,el:el,sx:e.clientX,sy:e.clientY,ox:t.pos_x||20,oy:t.pos_y||20,moved:false};el.setPointerCapture(e.pointerId)});
        el.addEventListener('pointermove',function(e){if(!drag||drag.t.id!==t.id)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;el.style.left=Math.max(0,drag.ox+dx)+'px';el.style.top=Math.max(0,drag.oy+dy)+'px'});
        el.addEventListener('pointerup',async function(){if(!drag||drag.t.id!==t.id)return;const d=drag;drag=null;if(d.moved){t.pos_x=Math.round(parseFloat(el.style.left));t.pos_y=Math.round(parseFloat(el.style.top));await db.from('venue_tables').update({pos_x:t.pos_x,pos_y:t.pos_y}).eq('id',t.id)}else openEdit(t)});
        hall.appendChild(el);
        const tr=document.createElement('tr');tr.innerHTML='<td><b>🪑 '+esc(t.name||('Стол '+t.table_number))+'</b><div class="qt-muted">№ '+t.table_number+'</div></td><td>'+t.seats+'</td><td>'+(t.is_active?(o?'<span class="badge b-cooking">Занят · №'+esc(o.order_number)+'</span>':'<span class="badge b-ready">Свободен</span>'):'<span class="badge">Отключён</span>')+'</td><td><button class="btn btn-ghost btn-sm" data-qr="'+t.id+'">QR</button></td><td><div class="qt-actions"><button class="btn btn-ghost btn-sm" data-edit="'+t.id+'">✏️</button><button class="btn btn-ghost btn-sm" data-toggle="'+t.id+'">'+(t.is_active?'Отключить':'Включить')+'</button><button class="btn btn-danger btn-sm" data-del="'+t.id+'">🗑</button></div></td>';
        rows.appendChild(tr);
      });
      rows.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(tables.find(t=>t.id===b.dataset.edit)));
      rows.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const t=tables.find(t=>t.id===b.dataset.toggle);await db.from('venue_tables').update({is_active:!t.is_active}).eq('id',t.id);load()});
      rows.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const t=tables.find(t=>t.id===b.dataset.del);if(confirm('Удалить '+(t.name||'стол')+'?')){const r=await db.from('venue_tables').delete().eq('id',t.id);if(r.error)alert(r.error.message);else load()}});
      rows.querySelectorAll('[data-qr]').forEach(b=>b.onclick=()=>showQr(tables.find(t=>t.id===b.dataset.qr)));
    }
    async function load(){const id=venueId();if(!id)return;const r=await db.from('venue_tables').select('*').eq('venue_id',id).order('table_number',{ascending:true});if(r.error){document.getElementById('qtHall').innerHTML='<div class="msg error">'+esc(r.error.message)+'</div>';return}tables=r.data||[];draw()}
    function openEdit(t){editing=t||null;document.getElementById('qtTitle').textContent=t?'Редактировать стол':'Добавить стол';document.getElementById('qtName').value=t?(t.name||''):'';document.getElementById('qtNumber').value=t?t.table_number:((tables.reduce((m,x)=>Math.max(m,Number(x.table_number)||0),0))+1);document.getElementById('qtSeats').value=t?(t.seats||2):2;document.getElementById('qtShape').value=t?(t.shape||'round'):'round';document.getElementById('qtError').style.display='none';modal.style.display='flex'}
    document.getElementById('qtCancel').onclick=()=>modal.style.display='none';document.getElementById('qtAdd').onclick=()=>openEdit(null);
    document.getElementById('qtSave').onclick=async()=>{const name=document.getElementById('qtName').value.trim()||('Стол '+document.getElementById('qtNumber').value);const number=Number(document.getElementById('qtNumber').value);const seats=Number(document.getElementById('qtSeats').value)||2;const shape=document.getElementById('qtShape').value;const err=document.getElementById('qtError');if(!number||number<1){err.textContent='Укажите номер стола';err.style.display='block';return}const payload={name,table_number:number,seats,shape};let r;if(editing){r=await db.from('venue_tables').update(payload).eq('id',editing.id)}else{payload.venue_id=venueId();payload.is_active=true;payload.pos_x=20+(tables.length%5)*120;payload.pos_y=20+Math.floor(tables.length/5)*100;payload.qr_token=crypto.randomUUID();r=await db.from('venue_tables').insert(payload)}if(r.error){err.textContent=r.error.message;err.style.display='block';return}modal.style.display='none';load()};
    document.getElementById('qtRefresh').onclick=load;document.getElementById('qtPrint').onclick=()=>{const html=tables.map(t=>'<div style="width:45%;display:inline-block;text-align:center;margin:20px"><h2>'+esc(t.name||('Стол '+t.table_number))+'</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data='+encodeURIComponent(qrUrl(t))+'"><p>'+qrUrl(t)+'</p></div>').join('');const w=window.open('','_blank');w.document.write('<html><body style="font-family:Arial">'+html+'</body></html>');w.document.close();w.focus();w.print()};
    function showQr(t){const w=window.open('','_blank');if(!w)return;w.document.write('<html><head><title>'+esc(t.name||'Стол')+'</title></head><body style="font-family:Arial;text-align:center;padding:30px"><h1>'+esc(t.name||('Стол '+t.table_number))+'</h1><img style="width:360px;height:360px" src="https://api.qrserver.com/v1/create-qr-code/?size=600x600&data='+encodeURIComponent(qrUrl(t))+'"><p>'+esc(qrUrl(t))+'</p><button onclick="print()">Печать</button></body></html>');w.document.close()}
    function syncVisibility(){panel.style.display=vm.tab==='tables'?'block':'none'}
    btn.onclick=function(){vm.tab='tables';syncVisibility();load()};
    tabs.querySelectorAll('button').forEach(function(b){if(b!==btn)b.addEventListener('click',()=>setTimeout(syncVisibility,0))});
    const obs=new MutationObserver(syncVisibility);obs.observe(tabs,{childList:true,subtree:true});
    syncVisibility();load();
  }
  if(isManager)managerTables();
})();