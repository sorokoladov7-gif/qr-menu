// Browser Supabase client.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1bHhmczB6ZHJ5cXJubHh6bGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzAzMzgsImV4cCI6MjEwMjIwNjMzOH0.Ray02ePv1_EXMStpfaWWhw2BlRdOuTMniY8Ws1Ps0F8';
const baseDb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
window.db=baseDb;

// Public customer tracking must use the SECURITY DEFINER RPC instead of
// selecting from orders directly (RLS intentionally blocks public SELECT).
(function(){
  const path=location.pathname.toLowerCase();
  if(!path.endsWith('/menu.html')&&!path.endsWith('menu.html')) return;
  const real=baseDb;
  const oldFrom=real.from.bind(real);
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
        const normalized=String(phone).trim();
        const {data,error}=await real.rpc('customer_track_order_json',{
          p_venue_id:venueId,
          p_customer_phone:normalized
        });
        if(error) return {data:null,error};
        // RPC returns one JSON object or null.
        return {data:single?(data||null):(data?[data]:[]),error:null};
      }
      if(table==='orders'&&state.action==='update'){
        const phone=localStorage.getItem('last_phone')||'';
        return real.rpc('customer_change_order_status',{
          p_order_id:state.filters.id,
          p_customer_phone:phone,
          p_status:state.payload&&state.payload.status
        });
      }
      return oldFrom(table)[state.action](state.payload||'*');
    }
    return api;
  }
  window.db={
    from:function(table){
      if(table==='orders') return menuChain(table);
      return oldFrom(table);
    },
    rpc:real.rpc.bind(real),
    auth:real.auth,
    storage:real.storage
  };
})();
