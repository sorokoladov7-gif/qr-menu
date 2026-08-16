// Browser Supabase client.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const baseDb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
window.db=baseDb;

(function(){
  const path=location.pathname.toLowerCase();
  const isMenu=/\/menu\.html$/i.test(path);
  const isStaff=/(cook|courier|waiter)\.html$/i.test(path);
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

  // IMPORTANT: the special orders proxy is used only by menu.html.
  // Staff pages must use the normal Supabase query builder, otherwise their
  // orders queries are incorrectly interpreted as customer tracking queries.
  window.db={from:function(table){return isMenu&&table==='orders'?menuChain(table):oldFrom(table)},rpc:rpc,auth:real.auth,storage:real.storage};

  // QR table: resolve by token directly. This does not depend on Vue or venue loading order.
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

  // Staff table badges. Staff pages already load orders normally and the orders
  // contain table_id. We resolve the table number from venue_tables and inject
  // a visible badge into each order card. This works for cook, waiter and courier.
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

    try{return await staffTablePending[key]}
    finally{delete staffTablePending[key]}
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
    document.querySelectorAll('.wcard').forEach(function(card){ addStaffTableBadge(card); });
  }

  if(isStaff){
    // The badge is deliberately independent of staff session tokens.
    // Kitchen/courier/waiter pages use their existing PIN/session logic.
    setInterval(addStaffBadges,1500);
    new MutationObserver(addStaffBadges).observe(document.body,{childList:true,subtree:true});
    addStaffBadges();
  }
})();
