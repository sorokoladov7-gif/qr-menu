/* QR Menu — Manager Hall. Single source of truth (Enhanced 2D). */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_SINGLE__)return;window.__QR_MANAGER_HALL_SINGLE__=true;
var S={venue:null,tables:[],root:null,zoom:1,busy:false,moves:[]},qrPromise=null;
function db(){return window.db||null}function rpc(n,a){var c=db();return c&&c.rpc?c.rpc(n,a):Promise.reject(new Error('Supabase client не найден'))}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function venueFromVue(){
    try{
        if(window.__managerVue &&
           window.__managerVue.venue &&
           window.__managerVue.venue.id){
            return window.__managerVue.venue;
        }

        var a=document.getElementById('app');
        var i=a &&
              a.__vue_app__ &&
              a.__vue_app__._instance;

        if(i &&
           i.proxy &&
           i.proxy.venue &&
           i.proxy.venue.id){
            return i.proxy.venue;
        }

        return null;
    }catch(e){
        return null;
    }
}
async function venue(){var v=venueFromVue();if(v)return v;var c=db(),s=null;try{s=localStorage.getItem('manager_venue_id')||localStorage.getItem('selectedVenueId')}catch(e){}if(!c||!s)return null;var q=uuid(s)?await c.from('venues').select('id,name,slug,logo_url').eq('id',s).maybeSingle():await c.from('venues').select('id,name,slug,logo_url').eq('slug',s).maybeSingle();return q.error?null:q.data}
function css(){if(document.getElementById('qmh-css'))return;var x=document.createElement('style');x.id='qmh-css';x.textContent=`
#qr-manager-hall-final{
  position:fixed;
  inset:0;
  z-index:99990;
  background:#0b1424;
  color:#eef2ff;
  overflow:auto;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  padding:16px;
  box-sizing:border-box;
}
.qmh-in{max-width:1500px;margin:auto;}
.qmh-head,.qmh-actions,.qmh-card-actions,.qmh-qr-actions,.qmh-edit-row,.qmh-order-actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.qmh-head{align-items:center;justify-content:space-between;}
.qmh-btn{
  border:none;
  background:linear-gradient(145deg,#1e2a44,#141e32);
  color:#eef2ff;
  border-radius:12px;
  padding:10px 16px;
  font-weight:700;
  cursor:pointer;
  box-shadow:0 4px 12px rgba(0,0,0,.3);
  transition:all .2s ease;
}
.qmh-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.4);}
.qmh-btn:active{transform:scale(.96);}
.qmh-btn:disabled{opacity:.5;pointer-events:none;}
.qmh-primary{background:linear-gradient(145deg,#6366f1,#4f46e5);color:#fff;}
.qmh-primary:hover{background:linear-gradient(145deg,#818cf8,#6366f1);}
.qmh-danger{background:linear-gradient(145deg,#ef4444,#b91c1c);color:#fff;}
.qmh-danger:hover{background:linear-gradient(145deg,#f87171,#dc2626);}
.qmh-board-wrap{
  overflow:auto;
  border-radius:20px;
  background:rgba(15,23,42,.6);
  backdrop-filter:blur(4px);
  border:1px solid rgba(255,255,255,.06);
  margin-top:12px;
  box-shadow:inset 0 0 60px rgba(0,0,0,.5);
}
.qmh-board{
  position:relative;
  width:1400px;
  height:720px;
  background:radial-gradient(circle at 20% 30%, #1a2742, #0b1424);
  background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
  background-size:40px 40px;
  transform-origin:top left;
}
/* Анимация появления столов */
@keyframes tableAppear{
  0%{opacity:0;transform:scale(.5) rotate(-5deg);}
  60%{opacity:1;transform:scale(1.05) rotate(1deg);}
  100%{opacity:1;transform:scale(1) rotate(0);}
}
.qmh-table{
  position:absolute;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  cursor:grab;
  user-select:none;
  touch-action:none;
  border:2px solid rgba(255,255,255,.15);
  box-sizing:border-box;
  font-weight:700;
  font-size:13px;
  color:#fff;
  text-shadow:0 2px 8px rgba(0,0,0,.6);
  transition:box-shadow .3s, transform .2s, border-color .3s;
  animation:tableAppear .5s cubic-bezier(.34,1.56,.64,1) both;
  will-change:transform,opacity;
}
.qmh-table:hover{transform:scale(1.05);z-index:10;box-shadow:0 8px 40px rgba(0,0,0,.6);}
/* Формы столов */
.qmh-round{width:100px;height:100px;border-radius:50%;}
.qmh-square{width:110px;height:110px;border-radius:16px;}
.qmh-rectangle{width:170px;height:90px;border-radius:16px;}
/* Статусы с градиентами */
.qmh-table.free{
  border-color:#34d399;
  background:radial-gradient(circle at 30% 30%, rgba(52,211,153,.25), rgba(16,185,129,.05));
  box-shadow:0 0 30px rgba(52,211,153,.15);
}
.qmh-table.occupied{
  border-color:#f87171;
  background:radial-gradient(circle at 30% 30%, rgba(248,113,113,.25), rgba(220,38,38,.05));
  box-shadow:0 0 40px rgba(248,113,113,.2);
  animation:pulseRed 2s infinite;
}
@keyframes pulseRed{
  0%,100%{box-shadow:0 0 20px rgba(248,113,113,.2);}
  50%{box-shadow:0 0 60px rgba(248,113,113,.5), inset 0 0 30px rgba(248,113,113,.1);}
}
.qmh-table.reserved{
  border-color:#fbbf24;
  background:radial-gradient(circle at 30% 30%, rgba(251,191,36,.25), rgba(217,119,6,.05));
  box-shadow:0 0 40px rgba(251,191,36,.2);
  animation:glowYellow 2.5s ease-in-out infinite;
}
@keyframes glowYellow{
  0%,100%{box-shadow:0 0 20px rgba(251,191,36,.15);}
  50%{box-shadow:0 0 70px rgba(251,191,36,.4), inset 0 0 30px rgba(251,191,36,.1);}
}
.qmh-table .table-icon{
  font-size:22px;
  line-height:1;
  margin-bottom:2px;
}
.qmh-table .table-number{
  font-size:15px;
  font-weight:800;
  letter-spacing:.5px;
}
.qmh-table .table-detail{
  font-size:10px;
  opacity:.8;
  margin-top:2px;
}
.qmh-small{font-size:11px;color:#94a3b8;}
.qmh-stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
  margin-top:12px;
}
.qmh-stat,.qmh-card,.qmh-session{
  background:linear-gradient(145deg,rgba(30,41,59,.8),rgba(15,23,42,.6));
  backdrop-filter:blur(4px);
  border:1px solid rgba(255,255,255,.08);
  border-radius:16px;
  padding:14px 18px;
  box-shadow:0 4px 20px rgba(0,0,0,.2);
  transition:all .2s;
}
.qmh-stat:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.3);}
.qmh-stat .stat-value{font-size:24px;font-weight:800;background:linear-gradient(135deg,#eef2ff,#a5b4fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.qmh-stat .stat-label{font-size:11px;color:#94a3b8;margin-top:2px;}
.qmh-cards{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:14px;
  margin-top:16px;
}
.qmh-card{
  padding:16px;
  transition:all .2s;
  cursor:pointer;
}
.qmh-card:hover{transform:translateY(-4px);border-color:rgba(99,102,241,.5);box-shadow:0 12px 40px rgba(0,0,0,.3);}
.qmh-card .card-title{font-size:16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;}
.qmh-card .card-status{font-size:12px;padding:3px 10px;border-radius:999px;font-weight:600;}
.qmh-card .card-status.free{background:rgba(52,211,153,.2);color:#34d399;}
.qmh-card .card-status.occupied{background:rgba(248,113,113,.2);color:#f87171;}
.qmh-card .card-status.reserved{background:rgba(251,191,36,.2);color:#fbbf24;}
.qmh-modal{
  position:fixed;
  inset:0;
  z-index:100000;
  background:rgba(0,0,0,.7);
  backdrop-filter:blur(6px);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
}
.qmh-box{
  width:min(700px,100%);
  max-height:90vh;
  overflow:auto;
  background:linear-gradient(145deg,#1e293b,#0f172a);
  border-radius:24px;
  padding:24px;
  border:1px solid rgba(255,255,255,.08);
  box-shadow:0 24px 80px rgba(0,0,0,.6);
}
.qmh-box h2{margin-top:0;color:#eef2ff;}
.qmh-field{margin:12px 0;}
.qmh-field label{display:block;font-size:12px;color:#94a3b8;margin-bottom:5px;}
.qmh-field input,.qmh-field select,.qmh-field textarea{
  width:100%;
  box-sizing:border-box;
  padding:10px 14px;
  background:rgba(11,16,32,.8);
  color:#eef2ff;
  border:1px solid rgba(255,255,255,.12);
  border-radius:12px;
  transition:border .2s;
}
.qmh-field input:focus,.qmh-field select:focus,.qmh-field textarea:focus{
  border-color:#6366f1;
  outline:none;
}
.qmh-error{display:none;color:#fecaca;background:rgba(127,29,29,.5);padding:10px;border-radius:10px;margin:10px 0;}
.qmh-qr{background:#fff;border-radius:16px;padding:10px;width:180px;height:180px;box-sizing:border-box;margin:10px auto;box-shadow:0 8px 30px rgba(0,0,0,.3);}
.qmh-qr svg{width:100%;height:100%;}
.qmh-qr-url{font-size:10px;color:#94a3b8;word-break:break-all;text-align:center;margin-top:6px;}
.qmh-auto-number{padding:10px 14px;border-radius:12px;background:rgba(11,16,32,.8);border:1px solid rgba(255,255,255,.12);color:#60a5fa;font-weight:700;}
.qmh-status-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:16px;}
.qmh-session{background:rgba(11,16,32,.6);margin-top:12px;}
.qmh-order{background:rgba(11,16,32,.6);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:14px;margin-top:10px;}
.qmh-order-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}
.qmh-order-item{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);}
.qmh-product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;max-height:360px;overflow:auto;}
.qmh-product{background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.08);color:#eef2ff;border-radius:14px;padding:12px;text-align:left;cursor:pointer;transition:all .2s;}
.qmh-product:hover{transform:translateY(-2px);border-color:#6366f1;box-shadow:0 8px 24px rgba(0,0,0,.3);}
.qmh-cart{background:rgba(11,16,32,.6);border-radius:14px;padding:14px;margin-top:12px;}
.qmh-cart-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);}
@media(max-width:700px){
  .qmh-stats{grid-template-columns:repeat(2,1fr);}
  .qmh-status-actions{grid-template-columns:1fr;}
  .qmh-board{width:1100px;height:650px;}
  .qmh-cart-row{grid-template-columns:1fr auto;}
  .qmh-cart-row .qmh-qty{grid-column:2;}
}
`;
document.head.appendChild(x);}
function loadQR(){if(window.qrcode)return Promise.resolve();if(qrPromise)return qrPromise;qrPromise=new Promise(function(ok,no){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.min.js';s.onload=ok;s.onerror=function(){no(new Error('Не удалось загрузить генератор QR-кодов'))};document.head.appendChild(s)});return qrPromise}
function qr(t){var u=location.origin+'/menu.html?venue='+encodeURIComponent(S.venue.slug||'')+'&table='+encodeURIComponent(t.number)+'&token='+encodeURIComponent(t.qr||'');try{var q=window.qrcode(0,'M');q.addData(u);q.make();return{url:u,svg:q.createSvgTag({cellSize:4,margin:2,scalable:true})}}catch(e){return{url:u,svg:''}}}
function norm(t){return{id:t.id,number:t.table_number,name:t.name||'',shape:['round','square','rectangle'].indexOf(t.shape)>=0?t.shape:'round',seats:+t.seats||4,x:+(t.pos_x==null?80:t.pos_x),y:+(t.pos_y==null?80:t.pos_y),qr:t.qr_token||'',status:t.occupancy_status||'free',guests:+(t.guest_count==null?t.session_guest_count:t.guest_count)||0,orders:+t.open_order_count||0,allOrders:+t.order_count||0,total:+t.total_amount||0,sessionId:t.current_session_id||'',sessionStarted:t.session_started_at||'',guestName:t.guest_name||'',guestPhone:t.guest_phone||'',reservedUntil:t.reserved_until||'',reservedNote:t.reserved_note||''}}
function si(t){return t.status==='occupied'?['Занят','occupied']:t.status==='reserved'?['Резерв','reserved']:['Свободен','free']}
async function fetchTables(){var r=await rpc('manager_table_board',{p_venue_id:S.venue.id});if(r.error)throw new Error(r.error.message||'Не удалось загрузить столы');var a=Array.isArray(r.data)?r.data:r.data&&r.data.tables||[];return a.map(norm)}
async function load(){try{S.tables=await fetchTables();render()}catch(e){var b=S.root&&S.root.querySelector('#qmh-board');if(b)b.innerHTML='<div style="padding:40px;color:#fecaca"><b>Не удалось загрузить столы</b><div>'+esc(e.message||e)+'</div></div>'}}
function render(){var r=S.root;if(!r)return;var b=r.querySelector('#qmh-board'),c=r.querySelector('#qmh-cards'),st=r.querySelector('#qmh-stats');b.innerHTML='';c.innerHTML='';var f=0,o=0,z=0;S.tables.forEach(function(t){if(si(t)[1]==='free')f++;else if(si(t)[1]==='occupied')o++;else z++});st.innerHTML='<div class="qmh-stat"><div class="stat-value">'+S.tables.length+'</div><div class="stat-label">Всего</div></div><div class="qmh-stat"><div class="stat-value" style="background:linear-gradient(135deg,#34d399,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">'+f+'</div><div class="stat-label">Свободно</div></div><div class="qmh-stat"><div class="stat-value" style="background:linear-gradient(135deg,#f87171,#dc2626);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">'+o+'</div><div class="stat-label">Занято</div></div><div class="qmh-stat"><div class="stat-value" style="background:linear-gradient(135deg,#fbbf24,#d97706);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">'+z+'</div><div class="stat-label">Резерв</div></div>';if(!S.tables.length)b.innerHTML='<div style="padding:80px;text-align:center;color:#94a3b8;font-size:18px;">🪑 Столов пока нет.<br><br>Нажмите «＋ Добавить стол».</div>';S.tables.forEach(function(t,idx){var q=si(t),e=document.createElement('div');e.className='qmh-table qmh-'+t.shape+' '+q[1];e.style.left=t.x+'px';e.style.top=t.y+'px';e.style.animationDelay=(idx*0.05)+'s';// иконка стола
var icon=t.shape==='round'?'🪑':t.shape==='square'?'▣':'▭';e.innerHTML='<div class="table-icon">'+icon+'</div><div class="table-number">'+esc(t.number)+'</div><div class="table-detail">'+t.guests+'/'+t.seats+' мест</div>';drag(e,t);b.appendChild(e);var card=document.createElement('div');card.className='qmh-card';var statusLabel=q[0];var statusClass=q[1];card.innerHTML='<div class="card-title"><span>Стол '+esc(t.number)+'</span><span class="card-status '+statusClass+'">'+statusLabel+'</span></div><div style="margin:6px 0;font-size:13px;">'+t.seats+' мест · Гостей: '+t.guests+'</div><div class="qmh-small">Открытых заказов: '+t.orders+' · Сессия: '+t.allOrders+'<br>Сумма: '+t.total.toLocaleString('ru-RU')+' ₽</div><div class="qmh-card-actions" style="margin-top:10px;"><button class="qmh-btn qmh-primary btn-sm" data-control>Управление</button><button class="qmh-btn btn-sm" data-edit>✏️ Редактировать</button></div>'+(t.qr?'<div class="qmh-small" style="margin-top:8px;">✅ QR закреплён</div>':'');card.querySelector('[data-control]').onclick=function(){control(t)};card.querySelector('[data-edit]').onclick=function(){edit(t)};c.appendChild(card)});b.style.transform='scale('+S.zoom+')';qrCards()}
function drag(e,t){e.onpointerdown=function(ev){var sx=ev.clientX,sy=ev.clientY,ox=t.x,oy=t.y,moved=false;e.setPointerCapture(ev.pointerId);e.style.transition='none';e.onpointermove=function(me){var dx=(me.clientX-sx)/S.zoom,dy=(me.clientY-sy)/S.zoom;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;t.x=Math.max(10,Math.min(1300,ox+dx));t.y=Math.max(10,Math.min(650,oy+dy));e.style.left=t.x+'px';e.style.top=t.y+'px'};e.onpointerup=function(){e.onpointermove=null;e.style.transition='';if(moved){var p=rpc('manager_move_table',{p_venue_id:S.venue.id,p_table_id:t.id,p_x:Math.round(t.x),p_y:Math.round(t.y)});S.moves.push(p);p.then(function(){S.moves=S.moves.filter(function(x){return x!==p})}).catch(function(err){S.moves=S.moves.filter(function(x){return x!==p});console.error('[QR Hall] move failed',err)})}else control(t)}}}
async function refresh(){if(S.busy)return;S.busy=true;var b=S.root&&S.root.querySelector('#qmh-refresh');if(b)b.disabled=true;try{if(S.moves.length)await Promise.all(S.moves.slice());await load()}finally{S.busy=false;if(b)b.disabled=false}}
async function nextNumber(){var r=await rpc('manager_next_table_number',{p_venue_id:S.venue.id});if(r.error)throw new Error(r.error.message||'Не удалось определить номер');return Number(r.data)}
async function create(a){var n=await nextNumber(),r=await rpc('manager_create_table',{p_venue_id:S.venue.id,p_number:n,p_name:a.name,p_shape:a.shape,p_seats:a.seats,p_x:a.x,p_y:a.y});if(r.error&&String(r.error.message).indexOf('table_number_exists')>=0){n=await nextNumber();r=await rpc('manager_create_table',{p_venue_id:S.venue.id,p_number:n,p_name:a.name,p_shape:a.shape,p_seats:a.seats,p_x:a.x,p_y:a.y})}return r}
function modal(h){var m=document.createElement('div');m.className='qmh-modal';m.innerHTML=h;document.body.appendChild(m);return m}
function edit(t){var c=!t,d=t||{name:'',shape:'round',seats:4},m=modal('<div class="qmh-box"><h2 style="margin-top:0">'+(c?'Добавить стол':'Редактировать стол')+'</h2>'+(c?'<div class="qmh-field"><label>Номер</label><div class="qmh-auto-number" id="num">Определяется автоматически…</div></div>':'')+'<div class="qmh-field"><label>Название</label><input id="name" value="'+esc(d.name)+'"></div><div class="qmh-field"><label>Форма</label><select id="shape"><option value="round">Круглый</option><option value="square">Квадратный</option><option value="rectangle">Прямоугольный</option></select></div><div class="qmh-field"><label>Мест</label><input id="seats" type="number" min="1" max="100" value="'+d.seats+'"></div><div class="qmh-error" id="err"></div><div class="qmh-edit-row"><button class="qmh-btn" id="cancel">Отмена</button>'+(c?'':'<button class="qmh-btn qmh-danger" id="delete">🗑 Удалить</button>')+'<button class="qmh-btn qmh-primary" id="save">'+(c?'Создать стол':'Сохранить')+'</button></div></div>');m.querySelector('#shape').value=d.shape;m.querySelector('#cancel').onclick=function(){m.remove()};if(!c)m.querySelector('#delete').onclick=function(){del(t,m)};if(c)nextNumber().then(function(n){if(m.isConnected)m.querySelector('#num').textContent='Стол '+n}).catch(function(e){showErr(m,e)});m.querySelector('#save').onclick=async function(){if(S.busy)return;S.busy=true;try{var seats=+m.querySelector('#seats').value,name=m.querySelector('#name').value.trim()||null,shape=m.querySelector('#shape').value;if(!Number.isInteger(seats)||seats<1||seats>100)throw new Error('Количество мест: от 1 до 100.');var r=c?await create({name:name||('Стол '+await nextNumber()),shape:shape,seats:seats,x:100+(S.tables.length%5)*180,y:100+Math.floor(S.tables.length/5)*130}):await rpc('manager_update_table',{p_table_id:t.id,p_venue_id:S.venue.id,p_number:t.number,p_name:name,p_shape:shape,p_seats:seats,p_active:true});if(r.error)throw new Error(r.error.message||'Не удалось сохранить');m.remove();await load()}catch(e){showErr(m,e)}finally{S.busy=false}}}
function showErr(m,e){var x=m.querySelector('#err');if(x){x.textContent=e.message||String(e);x.style.display='block'}}
async function del(t,m){if(!confirm('Удалить стол '+t.number+'? История заказов сохраняется.'))return;try{var r=await rpc('manager_delete_table',{p_venue_id:S.venue.id,p_table_id:t.id});if(r.error)throw new Error(r.error.message||'Не удалось удалить');m.remove();await load()}catch(e){alert(e.message||'Не удалось удалить')}}
function isoLocal(d){var p=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}
function control(t){var q=si(t),m=modal('<div class="qmh-box"><h2 style="margin:0">Стол '+esc(t.number)+'</h2><div style="margin-top:6px"><strong>'+q[0]+'</strong> · '+t.seats+' мест</div><div class="qmh-session">'+(t.sessionId?'<b>Текущая сессия</b><div class="qmh-small">Начало: '+esc(new Date(t.sessionStarted).toLocaleString('ru-RU'))+'</div><div>Гостей: <b>'+t.guests+'</b></div>'+(t.guestName?'<div>Гость: '+esc(t.guestName)+'</div>':'')+(t.guestPhone?'<div>Телефон: '+esc(t.guestPhone)+'</div>':'')+'<div>Заказов: <b>'+t.allOrders+'</b> · Открытых: <b>'+t.orders+'</b></div><div>Сумма: <b>'+t.total.toLocaleString('ru-RU')+' ₽</b></div>':'<span class="qmh-small">Активной сессии нет.</span>')+'</div><div class="qmh-status-actions">'+((q[1]==='free'||q[1]==='reserved')?'<button class="qmh-btn qmh-primary" id="seat">👥 Посадить гостей</button>':'')+(q[1]!=='occupied'?'<button class="qmh-btn" id="reserve">📅 Зарезервировать</button>':'')+(q[1]==='occupied'?'<button class="qmh-btn qmh-primary" id="free">✓ Освободить</button>':'')+(t.sessionId?'<button class="qmh-btn" id="session">📋 Текущая сессия</button>':'')+'</div><div class="qmh-edit-row"><button class="qmh-btn" id="edit">✏️ Редактировать</button><button class="qmh-btn" id="close">Закрыть</button></div></div>');m.querySelector('#close').onclick=function(){m.remove()};m.querySelector('#edit').onclick=function(){m.remove();edit(t)};if(m.querySelector('#seat'))m.querySelector('#seat').onclick=function(){seat(t,m)};if(m.querySelector('#reserve'))m.querySelector('#reserve').onclick=function(){reserve(t,m)};if(m.querySelector('#free'))m.querySelector('#free').onclick=function(){release(t,m)};if(m.querySelector('#session'))m.querySelector('#session').onclick=function(){session(t)}}
function seat(t,parent){var m=modal('<div class="qmh-box"><h2>Посадить гостей — стол '+esc(t.number)+'</h2><div class="qmh-field"><label>Количество</label><input id="count" type="number" min="1" max="'+t.seats+'" value="1"></div><div class="qmh-field"><label>Имя</label><input id="name"></div><div class="qmh-field"><label>Телефон</label><input id="phone"></div><div class="qmh-error" id="err"></div><div class="qmh-edit-row"><button class="qmh-btn" id="cancel">Отмена</button><button class="qmh-btn qmh-primary" id="ok">Посадить</button></div></div>');m.querySelector('#cancel').onclick=function(){m.remove()};m.querySelector('#ok').onclick=async function(){try{var n=+m.querySelector('#count').value;if(!Number.isInteger(n)||n<1||n>t.seats)throw new Error('Количество гостей: от 1 до '+t.seats+'.');var r=await rpc('manager_seat_table',{p_venue_id:S.venue.id,p_table_id:t.id,p_guest_count:n,p_guest_name:m.querySelector('#name').value.trim()||null,p_guest_phone:m.querySelector('#phone').value.trim()||null});if(r.error)throw new Error(r.error.message||'Не удалось посадить гостей');m.remove();if(parent)parent.remove();await load()}catch(e){showErr(m,e)}}}
function reserve(t,parent){var d=new Date(Date.now()+7200000),m=modal('<div class="qmh-box"><h2>Резерв — стол '+esc(t.number)+'</h2><div class="qmh-field"><label>До</label><input id="until" type="datetime-local" value="'+isoLocal(d)+'"></div><div class="qmh-field"><label>Имя</label><input id="name"></div><div class="qmh-field"><label>Телефон</label><input id="phone"></div><div class="qmh-field"><label>Комментарий</label><textarea id="note" rows="3"></textarea></div><div class="qmh-error" id="err"></div><div class="qmh-edit-row"><button class="qmh-btn" id="cancel">Отмена</button><button class="qmh-btn qmh-primary" id="ok">Зарезервировать</button></div></div>');m.querySelector('#cancel').onclick=function(){m.remove()};m.querySelector('#ok').onclick=async function(){try{var d2=new Date(m.querySelector('#until').value);if(isNaN(d2.getTime()))throw new Error('Укажите корректное время.');var r=await rpc('manager_set_table_status',{p_venue_id:S.venue.id,p_table_id:t.id,p_status:'reserved',p_reserved_until:d2.toISOString(),p_note:m.querySelector('#note').value.trim()||null});if(r.error)throw new Error(r.error.message||'Не удалось зарезервировать');var g=await rpc('manager_set_table_reservation_guest',{p_venue_id:S.venue.id,p_table_id:t.id,p_guest_name:m.querySelector('#name').value.trim()||null,p_guest_phone:m.querySelector('#phone').value.trim()||null});if(g.error)throw new Error(g.error.message||'Резерв создан, но данные гостя не сохранены');m.remove();if(parent)parent.remove();await load()}catch(e){showErr(m,e)}}}
async function release(t,parent){if(t.orders>0){alert('Нельзя освободить стол: есть открытые заказы. Сначала завершите их.');return}if(!confirm('Освободить стол '+t.number+'?'))return;try{var r=await rpc('manager_set_table_status',{p_venue_id:S.venue.id,p_table_id:t.id,p_status:'free',p_reserved_until:null,p_note:null});if(r.error)throw new Error(r.error.message||'Не удалось освободить');if(parent)parent.remove();await load()}catch(e){alert(e.message||'Не удалось освободить')}}
async function sessionData(t){var r=await rpc('manager_get_table_session_orders',{p_venue_id:S.venue.id,p_table_id:t.id});if(r.error)throw new Error(r.error.message||'Не удалось загрузить сессию');var d=r.data||{};if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}return d}
async function menuProducts(){var c=db();if(!c)throw new Error('Supabase client не найден');var r=await c.from('products').select('id,name,price,category,image_url,is_available').eq('venue_id',S.venue.id).eq('is_available',true).order('category').order('name');if(r.error)throw new Error(r.error.message||'Не удалось загрузить меню');return r.data||[]}
function money(v){return Number(v||0).toLocaleString('ru-RU')+' ₽'}
function orderHtml(o){var items=Array.isArray(o.items)?o.items:[];return '<div class="qmh-order"><div class="qmh-order-head"><div><b>Заказ №'+esc(o.order_number)+'</b><div class="qmh-small">'+esc(o.created_at?new Date(o.created_at).toLocaleString('ru-RU'):'')+' · '+esc(o.status||'')+'</div></div><b>'+money(o.total_price)+'</b></div>'+(items.length?items.map(function(i){return '<div class="qmh-order-item"><span>'+esc(i.name)+' × '+esc(i.qty)+'</span><span>'+money(Number(i.price)*Number(i.qty))+'</span></div>'}).join(''):'<div class="qmh-small">Позиции отсутствуют</div>')+(o.comment?'<div class="qmh-small" style="margin-top:7px">Комментарий: '+esc(o.comment)+'</div>':'')+'</div>'}
async function addSessionOrder(t,host){var products=[];var cart={};var m=modal('<div class="qmh-box"><h2 style="margin:0">Новый заказ — стол '+esc(t.number)+'</h2><div class="qmh-small" style="margin-top:5px">Добавление в текущую сессию, новая посадка не создаётся.</div><div class="qmh-field"><label>Товары</label><div id="products" class="qmh-product-grid"><div class="qmh-small">Загрузка меню…</div></div></div><div class="qmh-cart"><b>Заказ</b><div id="cart"><div class="qmh-small" style="margin-top:8px">Выберите товары.</div></div><div style="margin-top:10px;text-align:right"><b>Итого: <span id="total">0 ₽</span></b></div></div><div class="qmh-field"><label>Комментарий</label><textarea id="comment" rows="2"></textarea></div><div class="qmh-error" id="err"></div><div class="qmh-edit-row"><button class="qmh-btn" id="cancel">Отмена</button><button class="qmh-btn qmh-primary" id="send">Отправить на кухню</button></div></div>');function draw(){var box=m.querySelector('#cart'),ids=Object.keys(cart),total=0;if(!ids.length){box.innerHTML='<div class="qmh-small">Выберите товары.</div>';m.querySelector('#total').textContent='0 ₽';return}box.innerHTML=ids.map(function(id){var x=cart[id];total+=Number(x.price)*x.qty;return '<div class="qmh-cart-row"><span>'+esc(x.name)+'</span><span class="qmh-qty"><button class="qmh-btn" data-minus="'+id+'">−</button> '+x.qty+' <button class="qmh-btn" data-plus="'+id+'">＋</button></span><b>'+money(Number(x.price)*x.qty)+'</b></div>'}).join('');m.querySelector('#total').textContent=money(total);box.querySelectorAll('[data-minus]').forEach(function(b){b.onclick=function(){var id=b.dataset.minus;if(cart[id]){cart[id].qty--;if(cart[id].qty<=0)delete cart[id];draw()}}});box.querySelectorAll('[data-plus]').forEach(function(b){b.onclick=function(){var id=b.dataset.plus;if(cart[id]){cart[id].qty++;draw()}}})}function drawProducts(){var box=m.querySelector('#products');box.innerHTML=products.length?products.map(function(p){return '<button type="button" class="qmh-product" data-product="'+p.id+'"><b>'+esc(p.name)+'</b><strong style="display:block;margin-top:5px">'+money(p.price)+'</strong>'+(p.category?'<small>'+esc(p.category)+'</small>':'')+'</button>'}).join(''):'<div class="qmh-small">Доступных товаров нет.</div>';box.querySelectorAll('[data-product]').forEach(function(b){b.onclick=function(){var p=products.find(function(x){return x.id===b.dataset.product});if(!p)return;if(!cart[p.id])cart[p.id]={product_id:p.id,name:p.name,price:Number(p.price),qty:0};cart[p.id].qty++;draw()}})}m.querySelector('#cancel').onclick=function(){m.remove()};m.querySelector('#send').onclick=async function(){var ids=Object.keys(cart);if(!ids.length){showErr(m,new Error('Добавьте хотя бы один товар.'));return}var items=ids.map(function(id){return{product_id:id,qty:cart[id].qty}});var btn=m.querySelector('#send');btn.disabled=true;try{var r=await rpc('manager_create_session_order',{p_venue_id:S.venue.id,p_table_id:t.id,p_items:items,p_comment:m.querySelector('#comment').value.trim()||null,p_payment_method:'cash',p_operation_key:(window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random())});if(r.error)throw new Error(r.error.message||'Не удалось создать заказ');m.remove();if(host)host.remove();await load();setTimeout(function(){var nt=S.tables.find(function(x){return x.id===t.id});if(nt)session(nt)},0)}catch(e){btn.disabled=false;showErr(m,e)}};try{products=await menuProducts();drawProducts();draw()}catch(e){showErr(m,e)}}
async function session(t){var m=modal('<div class="qmh-box"><h2>Текущая сессия — стол '+esc(t.number)+'</h2><div id="session-body"><div class="qmh-small">Загрузка заказов…</div></div><div class="qmh-edit-row"><button class="qmh-btn qmh-primary" id="add-order">＋ Добавить заказ</button><button class="qmh-btn" id="refresh-session">↻ Обновить</button><button class="qmh-btn" id="close">Закрыть</button></div></div>');m.querySelector('#close').onclick=function(){m.remove()};m.querySelector('#add-order').onclick=function(){addSessionOrder(t,m)};m.querySelector('#refresh-session').onclick=function(){renderSession(m,t)};await renderSession(m,t)}
async function renderSession(m,t){var body=m.querySelector('#session-body');if(!body)return;body.innerHTML='<div class="qmh-small">Загрузка заказов…</div>';try{var d=await sessionData(t),orders=Array.isArray(d.orders)?d.orders:[],total=Number(d.total||0);body.innerHTML='<div class="qmh-session"><div>Сессия: <b>'+esc(d.session_id||t.sessionId||'—')+'</b></div><div>Начало: '+esc(t.sessionStarted?new Date(t.sessionStarted).toLocaleString('ru-RU'):'—')+'</div><div>Гостей: <b>'+t.guests+'</b></div><div>Заказов: <b>'+orders.length+'</b></div><div>Общая сумма: <b>'+money(total)+'</b></div></div>'+(orders.length?orders.map(orderHtml).join(''):'<div class="qmh-session"><div class="qmh-small">Заказов в текущей сессии пока нет.</div></div>')}catch(e){body.innerHTML='<div class="qmh-error" style="display:block">'+esc(e.message||e)+'</div>'}}
async function qrCards(){var cards=S.root&&S.root.querySelectorAll('.qmh-card');if(!cards||!cards.length)return;try{await loadQR()}catch(e){return}S.tables.forEach(function(t,i){if(!t.qr||!cards[i]||cards[i].querySelector('[data-qr]'))return;var q=qr(t),b=document.createElement('div');b.dataset.qr='1';b.innerHTML='<div class="qmh-qr">'+q.svg+'</div><div class="qmh-qr-url">'+esc(q.url)+'</div><div class="qmh-qr-actions"><button class="qmh-btn" data-open>Открыть</button><button class="qmh-btn" data-print>Печать QR</button></div>';cards[i].appendChild(b);b.querySelector('[data-open]').onclick=function(){window.open(q.url,'_blank')};b.querySelector('[data-print]').onclick=function(){var w=window.open('','_blank','width=600,height=700');if(!w)return;w.document.write('<html><body style="font-family:Arial;text-align:center;padding:30px"><h1>Стол '+esc(t.number)+'</h1>'+q.svg+'<p>'+esc(q.url)+'</p></body></html>');w.document.close();w.print()}})}
function close(){if(S.root){S.root.remove();S.root=null}}
function open(v){
  if(!v||!v.id)return;
  S.venue=v;
  S.zoom=1;
  S.moves=[];
  if(S.root)S.root.remove();
  css();
  var r=document.createElement('div');
  r.id='qr-manager-hall-final';
  S.root=r;
  r.innerHTML='<div class="qmh-in"><div class="qmh-head"><div><h2 style="margin:0">🪑 План зала</h2><div class="qmh-small">'+esc(v.name||'Заведение')+'</div></div><div class="qmh-actions"><button class="qmh-btn qmh-primary" id="add">＋ Добавить стол</button><button class="qmh-btn" id="refresh">↻ Обновить</button><button class="qmh-btn" id="minus">−</button><button class="qmh-btn" id="plus">＋</button><button class="qmh-btn" id="close">Закрыть</button></div></div><div class="qmh-stats" id="qmh-stats"></div><div class="qmh-board-wrap"><div class="qmh-board" id="qmh-board"></div></div><h3>Столы и QR-коды</h3><div class="qmh-cards" id="qmh-cards"></div></div>';
  document.body.appendChild(r);
  r.querySelector('#add').onclick=function(){edit(null)};
  r.querySelector('#refresh').onclick=refresh;
  r.querySelector('#minus').onclick=function(){S.zoom=Math.max(.6,S.zoom-.1);r.querySelector('#qmh-board').style.transform='scale('+S.zoom+')'};
  r.querySelector('#plus').onclick=function(){S.zoom=Math.min(1.5,S.zoom+.1);r.querySelector('#qmh-board').style.transform='scale('+S.zoom+')'};
  r.querySelector('#close').onclick=close;
  load();
}
// Новая функция – встраивание в контейнер
function renderIn(container, v){
  if(!v||!v.id) return;
  S.venue=v;
  S.zoom=1;
  S.moves=[];
  if(S.root)S.root.remove();
  css();
  var r=document.createElement('div');
  r.id='qr-manager-hall-final';
  S.root=r;
  r.innerHTML='<div class="qmh-in"><div class="qmh-head"><div><h2 style="margin:0">🪑 План зала</h2><div class="qmh-small">'+esc(v.name||'Заведение')+'</div></div><div class="qmh-actions"><button class="qmh-btn qmh-primary" id="add">＋ Добавить стол</button><button class="qmh-btn" id="refresh">↻ Обновить</button><button class="qmh-btn" id="minus">−</button><button class="qmh-btn" id="plus">＋</button><button class="qmh-btn" id="close">Закрыть</button></div></div><div class="qmh-stats" id="qmh-stats"></div><div class="qmh-board-wrap"><div class="qmh-board" id="qmh-board"></div></div><h3>Столы и QR-коды</h3><div class="qmh-cards" id="qmh-cards"></div></div>';
  container.innerHTML='';
  container.appendChild(r);
  r.style.position='relative';
  r.style.inset='auto';
  r.style.zIndex='1';
  r.style.background='transparent';
  r.style.padding='0';
  r.style.overflow='visible';
  r.style.backgroundColor='transparent';
  r.querySelector('#add').onclick=function(){edit(null)};
  r.querySelector('#refresh').onclick=refresh;
  r.querySelector('#minus').onclick=function(){S.zoom=Math.max(.6,S.zoom-.1);r.querySelector('#qmh-board').style.transform='scale('+S.zoom+')'};
  r.querySelector('#plus').onclick=function(){S.zoom=Math.min(1.5,S.zoom+.1);r.querySelector('#qmh-board').style.transform='scale('+S.zoom+')'};
  r.querySelector('#close').onclick=function(){ 
    try { if(window.__managerVue) window.__managerVue.tab='menu'; } catch(e){}
    close();
  };
  load();
}
function capture(app){if(!app||!app.mount||app.__qrHallWrapped)return app;app.__qrHallWrapped=true;var old=app.mount;app.mount=function(){var z=old.apply(this,arguments);try{var root=document.getElementById('app'),i=root&&root.__vue_app__&&root.__vue_app__._instance;if(i&&i.proxy){window.__managerVue=i.proxy;if(i.proxy.venue&&i.proxy.venue.id){window.__managerSelectedVenue=i.proxy.venue;try{localStorage.setItem('manager_venue_id',i.proxy.venue.id);localStorage.setItem('selectedVenueId',i.proxy.venue.id)}catch(e){}}}}catch(e){}return z};return app}
if(window.Vue&&window.Vue.createApp){var cc=window.Vue.createApp;window.Vue.createApp=function(){return capture(cc.apply(this,arguments))}}
// Глобальный обработчик клика закомментирован – используем Vue-вкладку
/*
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-manager-hall-tab]'):null;if(!b)return;setTimeout(async function(){var v=await venue();if(v)open(v);else console.error('[QR Hall] cannot resolve selected venue')},150)},true);
*/
window.QRManagerHall={open:open,close:close,renderIn:renderIn,resolveVenue:venue};
})();
