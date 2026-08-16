// Browser Supabase client.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';
const baseDb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
window.db=baseDb;

// Public customer tracking/order flow uses SECURITY DEFINER RPCs instead of direct RLS-protected orders access.
(function(){
  const path=location.pathname.toLowerCase();
  if(!path.endsWith('/menu.html')&&!path.endsWith('menu.html')) return;
  const real=baseDb;
  const oldFrom=real.from.bind(real);
  const oldRpc=real.rpc.bind(real);

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