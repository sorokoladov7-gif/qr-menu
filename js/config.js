// Browser Supabase client.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const baseDb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
window.db=baseDb;

(function(){
  const path=location.pathname.toLowerCase();
  if(!path.endsWith('/menu.html')&&!path.endsWith('menu.html')) return;
  const real=baseDb;
  const oldFrom=real.from.bind(real);
  const oldRpc=real.rpc.bind(real);

  async function resolveQrTable(venueId){
    const token=new URLSearchParams(location.search).get('table');
    if(!token||!venueId) return null;
    if(window.__qrTable&&window.__qrTable.qr_token===token) return window.__qrTable;
    const {data,error}=await oldFrom('venue_tables').select('id,venue_id,table_number,name,qr_token,is_active').eq('venue_id',venueId).eq('qr_token',token).maybeSingle();
    if(!error&&data){window.__qrTable=data;return data;}
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
        const {data,error}=await oldRpc('customer_track_order_json',{
          p_venue_id:venueId,
          p_customer_phone:String(phone).trim()
        });
        if(error) return {data:null,error};
        return {data:single?(data||null):(data?[data]:[]),error:null};
      }
      if(table==='orders'&&state.action==='update'){
        const phone=localStorage.getItem('last_phone')||'';
        return oldRpc('customer_change_order_status',{
          p_order_id:state.filters.id,
          p_customer_phone:phone,
          p_status:state.payload&&state.payload.status
        });
      }
      if(table==='orders'&&state.action==='insert'){
        let payload=state.payload;
        const venueId=payload&&payload.venue_id;
        const token=new URLSearchParams(location.search).get('table');
        if(token&&venueId){
          const t=await resolveQrTable(venueId);
          if(t&&t.is_active!==false){
            if(Array.isArray(payload)) payload=payload.map(function(row){return Object.assign({},row,{table_id:row.table_id||t.id});});
            else payload=Object.assign({},payload,{table_id:payload.table_id||t.id});
            window.__qrTable=t;
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
      if(token) args=Object.assign({},args,{p_table_token:token});
    }
    return oldRpc(name,args,options);
  }

  window.db={
    from:function(table){
      if(table==='orders') return menuChain(table);
      return oldFrom(table);
    },
    rpc:rpc,
    auth:real.auth,
    storage:real.storage
  };

  // Resolve and expose the QR table immediately, independent of Vue.
  async function bootQrTable(){
    const token=new URLSearchParams(location.search).get('table');
    const slug=new URLSearchParams(location.search).get('venue');
    if(!token||!slug) return;
    const v=await oldFrom('venues').select('id').eq('slug',String(slug).trim().toLowerCase()).maybeSingle();
    if(v.error||!v.data) return;
    await resolveQrTable(v.data.id);
    if(window.__qrTable){
      localStorage.setItem('qr_table_id',window.__qrTable.id);
      localStorage.setItem('qr_table_number',String(window.__qrTable.table_number));
      localStorage.setItem('qr_table_name',window.__qrTable.name||('Стол '+window.__qrTable.table_number));
    }
  }
  bootQrTable();
})();

// Visible customer table badge.
(function(){
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  function render(){
    var t=window.__qrTable;if(!t)return;
    var hero=document.querySelector('.hero');
    if(!hero)return;
    var b=document.getElementById('qr-table-fixed-badge');
    if(!b){
      b=document.createElement('div');
      b.id='qr-table-fixed-badge';
      b.style.cssText='display:block;margin:10px 0;padding:12px 14px;border-radius:12px;background:rgba(99,102,241,.2);border:1px solid rgba(129,140,248,.45);color:#fff;font-weight:800;text-align:center;position:relative;z-index:50';
      hero.insertAdjacentElement('afterend',b);
    }
    b.textContent='🪑 '+(t.name||('Стол '+t.table_number));
  }
  var tries=0;
  var timer=setInterval(function(){render();if(++tries>40)clearInterval(timer)},500);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
  new MutationObserver(render).observe(document.body,{childList:true,subtree:true});
})();

// Staff table display: use the authoritative staff_orders_json response when a staff token exists.
(function(){
  if(!/\/(cook|courier|waiter)\.html$/i.test(location.pathname)) return;
  function getSession(){
    var key=/waiter\.html$/i.test(location.pathname)?'waiter_session':/courier\.html$/i.test(location.pathname)?'courier_session':'cook_session';
    try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}
  }
  function label(t){return t?'🪑 '+(t.name||('Стол '+t.table_number)):'📦 Без стола'}
  function findCards(){
    var cards=document.querySelectorAll('.wcard');
    cards.forEach(function(card){
      if(card.querySelector('.qr-table-fixed'))return;
      var head=card.querySelector('.spread');
      if(!head)return;
      var m=String(head.textContent||'').match(/№\s*(\d+)/);if(!m)return;
      var no=m[1];
      var o=(window.__staffTableOrders||[]).find(function(x){return String(x.order_number)===String(no)});
      if(!o)return;
      var badge=document.createElement('div');badge.className='qr-table-fixed';badge.textContent=label(o.table_number!=null?{table_number:o.table_number,name:o.table_name}:null);badge.style.cssText='margin:8px 0;padding:9px 12px;border-radius:11px;background:rgba(99,102,241,.18);border:1px solid rgba(129,140,248,.4);color:#fff;font-weight:800';
      head.insertAdjacentElement('afterend',badge);
    });
  }
  async function load(){
    var s=getSession();if(!s||!s.token)return;
    var r=await baseDb.rpc('staff_orders_json',{p_token:s.token});
    if(!r.error&&Array.isArray(r.data))window.__staffTableOrders=r.data;
    findCards();
  }
  setInterval(load,2500);load();
  new MutationObserver(findCards).observe(document.body,{childList:true,subtree:true});
})();

// Manager cabinet: table/QR management is embedded directly into manager.html.
(function(){
  if(!/\/manager\.html$/i.test(location.pathname)) return;
  function load(){
    if(document.querySelector('script[data-manager-tables]')) return;
    var s=document.createElement('script');s.src='js/manager-tables.js';s.setAttribute('data-manager-tables','1');document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();

// Customer QR-table flow: reads ?table=TOKEN and routes table orders through create_public_order RPC.
(function(){
  if(!/\/menu\.html$/i.test(location.pathname)) return;
  function load(){
    if(document.querySelector('script[data-menu-table-flow]')) return;
    var s=document.createElement('script');s.src='js/menu-table-flow.js';s.setAttribute('data-menu-table-flow','1');document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();

// Staff cabinets: show the table attached to each order when the order came from a QR table.
(function(){
  if(!/\/(cook|courier|waiter)\.html$/i.test(location.pathname)) return;
  function load(){
    if(document.querySelector('script[data-staff-table-flow]')) return;
    var s=document.createElement('script');s.src='js/staff-table-flow.js';s.setAttribute('data-staff-table-flow','1');document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load); else load();
})();