// Supabase public browser client. Staff pages are additionally wrapped below so they use RPC only.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseGZzb3pkcnlxcm5seHpsYmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzAzMzgsImV4cCI6MjEwMjIwNjMzOH0.Ray02ePv1_EXMStpfaWWhw2BlRdOuTMniY8Ws1Ps0F8';
window.db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
(function(){
 const path=location.pathname.toLowerCase();
 const type=path.includes('courier')?'courier':path.includes('waiter')?'waiter':path.includes('cook')?'cook':null;
 if(!type)return;
 const real=window.db;
 let slug='';
 const sessionKey='qr_staff_'+type;
 function chain(table){
   const state={table,action:'select',filters:{},payload:null};
   const api={
     select:function(){state.action='select';return api},
     update:function(v){state.action='update';state.payload=v;return api},
     eq:function(k,v){state.filters[k]=v;if(k==='slug')slug=v;return api},
     in:function(k,v){state.filters[k]={in:v};return api},
     order:function(){return api},limit:function(){return api},
     maybeSingle:function(){return execute(true)},
     then:function(resolve,reject){return execute(false).then(resolve,reject)},
     catch:function(reject){return execute(false).catch(reject)}
   };
   async function execute(single){
     const saved=JSON.parse(localStorage.getItem(sessionKey)||'null');
     if(table==='venues'&&state.action==='select'){
       const {data,error}=await real.rpc('staff_venue_by_slug',{p_slug:state.filters.slug||slug});
       return {data:single?(data||null):(data?[data]:[]),error};
     }
     if(['cooks','couriers','waiters'].includes(table)&&state.action==='select'){
       const {data,error}=await real.rpc('staff_login',{p_type:type,p_slug:slug||'',p_pin:state.filters.pin||''});
       if(error)return {data:null,error};
       return {data:{id:data.staffId,name:data.staffName,venue_id:data.venueId},error:null};
     }
     if(table==='orders'&&state.action==='select'){
       if(!saved?.token)return {data:[],error:new Error('invalid_session')};
       const fn=state.filters.__history?'staff_history_json':'staff_orders_json';
       const {data,error}=await real.rpc(fn,{p_token:saved.token});
       let rows=data||[];
       if(state.filters.venue_id)rows=rows.filter(o=>o.venue_id===state.filters.venue_id);
       if(state.filters.order_type)rows=rows.filter(o=>o.order_type===state.filters.order_type);
       if(state.filters.status?.in)rows=rows.filter(o=>state.filters.status.in.includes(o.status));
       if(state.filters.courier_name)rows=rows.filter(o=>o.courier_name===state.filters.courier_name);
       if(state.filters.waiter_name)rows=rows.filter(o=>o.waiter_name===state.filters.waiter_name);
       return {data:rows,error};
     }
     if(table==='orders'&&state.action==='update'){
       if(!saved?.token)return {data:null,error:new Error('invalid_session')};
       const id=state.filters.id; const status=state.payload?.status;
       const {data,error}=await real.rpc('staff_update_order',{p_token:saved.token,p_order_id:id,p_status:status});
       return {data,error};
     }
     return {data:null,error:new Error('direct_staff_table_access_blocked')};
   }
   return api;
 }
 window.db={from:chain,rpc:real.rpc.bind(real),auth:real.auth,storage:real.storage};
})();
