// Browser Supabase client. Public catalog reads remain direct; manager, staff and customer mutations use server RPCs.
const SUPABASE_URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1bGZzb3pkcnlxcm5seHpsYmx0Iiwic2h1cCI6InVseGZzb3pkcnlxcm5seHpsYmx0IiwicmVmIjoidWx4ZnNvemRyeXFybmx4emxibHQiLCJyb2xlIjoiYW5vbiJ9';
const baseDb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);window.db=baseDb;
(function(){
 const path=location.pathname.toLowerCase();
 const staffType=path.includes('courier')?'courier':path.includes('waiter')?'waiter':path.includes('cook')?'cook':null;
 const isMenu=path.endsWith('/menu.html')||path.endsWith('menu.html');
 const isManager=path.endsWith('/manager.html')||path.endsWith('manager.html');
 const real=baseDb;
 if(staffType){
   const secureKey='qr_staff_'+staffType,legacyKey=staffType+'_session';let slug='',lastToken='';
   const originalSet=localStorage.setItem.bind(localStorage),originalRemove=localStorage.removeItem.bind(localStorage);
   localStorage.setItem=function(k,v){if(k===legacyKey&&lastToken){try{const x=JSON.parse(v);x.token=lastToken;originalSet(secureKey,JSON.stringify(x))}catch(e){}}return originalSet(k,v)};
   localStorage.removeItem=function(k){if(k===legacyKey)originalRemove(secureKey);return originalRemove(k)};
   function chain(table){const state={table,action:'select',filters:{},payload:null};const api={select:function(){returning=true;return api},insert:function(v){state.action='insert';state.payload=v;return api},update:function(v){state.action='update';state.payload=v;return api},eq:function(k,v){state.filters[k]=v;if(k==='slug')slug=v;return api},in:function(k,v){state.filters[k]={in:v};return api},order:function(){return api},limit:function(){return api},maybeSingle:function(){return execute(true)},single:function(){return execute(true)},then:function(a,b){return execute(false).then(a,b)},catch:function(a){return execute(false).catch(a)}};let returning=false;
     async function execute(single){const saved=JSON.parse(localStorage.getItem(secureKey)||'null');
       if(table==='venues'&&state.action==='select'){const {data,error}=await real.rpc('staff_venue_by_slug',{p_slug:state.filters.slug||slug});return{data:single?(data||null):(data?[data]:[]),error};}
       if(['cooks','couriers','waiters'].includes(table)&&state.action==='select'){const {data,error}=await real.rpc('staff_login',{p_type:staffType,p_slug:slug,p_pin:state.filters.pin||''});if(error)return{data:null,error};lastToken=data.token;originalSet(secureKey,JSON.stringify(data));return{data:{id:data.staffId,name:data.staffName,venue_id:data.venueId},error:null};}
       if(table==='orders'&&state.action==='select'){if(!saved?.token)return{data:[],error:new Error('invalid_session')};const history=!!(state.filters.courier_name||state.filters.waiter_name||state.filters.cook_name);const {data,error}=await real.rpc(history?'staff_history_json':'staff_orders_json',{p_token:saved.token});let rows=data||[];if(state.filters.venue_id)rows=rows.filter(o=>o.venue_id===state.filters.venue_id);if(state.filters.order_type)rows=rows.filter(o=>o.order_type===state.filters.order_type);if(state.filters.status?.in)rows=rows.filter(o=>state.filters.status.in.includes(o.status));if(state.filters.courier_name)rows=rows.filter(o=>o.courier_name===state.filters.courier_name);if(state.filters.waiter_name)rows=rows.filter(o=>o.waiter_name===state.filters.waiter_name);if(state.filters.cook_name)rows=rows.filter(o=>o.cook_name===state.filters.cook_name);return{data:rows,error};}
       if(table==='orders'&&state.action==='update'){if(!saved?.token)return{data:null,error:new Error('invalid_session')};const {data,error}=await real.rpc('staff_update_order',{p_token:saved.token,p_order_id:state.filters.id,p_status:state.payload?.status});return{data,error};}
       if(['cooks','couriers','waiters'].includes(table)&&state.action==='update')return{data:null,error:null};
       return{data:null,error:new Error('direct_staff_table_access_blocked')};
     }return api;
   }
   window.db={from:chain,rpc:real.rpc.bind(real),auth:real.auth,storage:real.storage};return;
 }
 if(isManager){
   let pending=null;
   function managerChain(table){const state={action:'select',payload:null,filters:{}};let returning=false;const api={select:function(){returning=true;return api},insert:function(v){state.action='insert';state.payload=v;return api},update:function(v){state.action='update';state.payload=v;return api},eq:function(k,v){state.filters[k]=v;return api},in:function(k,v){state.filters[k]={in:v};return api},order:function(){return api},limit:function(){return api},maybeSingle:function(){return execute(true)},single:function(){return execute(true)},then:function(a,b){return execute(false).then(a,b)},catch:function(a){return execute(false).catch(a)}};
     async function execute(single){
       if(table==='venues'&&state.action==='insert'){const id=crypto.randomUUID();pending={id,...state.payload};return{data:{...pending},error:null};}
       if(table==='subscriptions'&&state.action==='insert')return{data:state.payload,error:null};
       if(table==='manager_venues'&&state.action==='insert')return{data:state.payload,error:null};
       if(table==='products'&&state.action==='insert'&&pending){const rows=Array.isArray(state.payload)?state.payload:[];const end=pending.subscription_end;const profileId=(await real.auth.getUser()).data.user?.id;const {data,error}=await real.rpc('create_venue_for_manager_v2',{p_venue_id:pending.id,p_name:pending.name,p_slug:pending.slug,p_plan:pending.plan||'start',p_subscription_end:end,p_products:rows.map(x=>({name:x.name,description:x.description||null,price:Number(x.price)||0,category:x.category||'main',image_url:x.image_url||null,applies_to:x.applies_to||'all',is_available:x.is_available!==false})),p_manager_id:profileId||null});pending=null;return{data,error};}
       return real.from(table)[state.action==='select'?'select':state.action](state.payload||'*');
     }return api;
   }
   const oldFrom=real.from.bind(real);window.db={from:function(table){if(['venues','subscriptions','manager_venues','products'].includes(table))return managerChain(table);return oldFrom(table)},rpc:real.rpc.bind(real),auth:real.auth,storage:real.storage};return;
 }
 if(isMenu){
   let pendingOrder=null;
   function menuChain(table){const state={table,action:'select',filters:{},payload:null};const api={select:function(){returning=true;return api},insert:function(v){state.action='insert';state.payload=v;return api},update:function(v){state.action='update';state.payload=v;return api},eq:function(k,v){state.filters[k]=v;return api},in:function(k,v){state.filters[k]={in:v};return api},order:function(){return api},limit:function(){return api},maybeSingle:function(){return execute(true)},single:function(){return execute(true)},then:function(a,b){return execute(false).then(a,b)},catch:function(a){return execute(false).catch(a)}};let returning=false;
     async function execute(single){
       if(table==='orders'&&state.action==='insert'){const id=crypto.randomUUID();pendingOrder={id,...state.payload};return{data:{...pendingOrder},error:null};}
       if(table==='order_items'&&state.action==='insert'){if(!pendingOrder)return{data:null,error:new Error('order_context_missing')};const items=(state.payload||[]).map(x=>({product_id:x.product_id,qty:x.qty}));const {data,error}=await real.rpc('customer_create_order',{p_order_id:pendingOrder.id,p_venue_id:pendingOrder.venue_id,p_customer_name:pendingOrder.customer_name,p_customer_phone:pendingOrder.customer_phone,p_order_type:pendingOrder.order_type,p_delivery_address:pendingOrder.delivery_address,p_comment:pendingOrder.comment,p_payment_method:pendingOrder.payment_method,p_items:items});return{data,error};}
       if(table==='order_addons'&&state.action==='insert'){const rows=state.payload||[];const {data,error}=await real.rpc('customer_add_order_addons',{p_order_id:pendingOrder?.id,p_addons:rows});pendingOrder=null;return{data,error};}
       if(table==='orders'&&state.action==='select'){const phone=state.filters.customer_phone||localStorage.getItem('last_phone')||'';const venue=state.filters.venue_id;if(venue&&phone){const {data,error}=await real.rpc('customer_track_order_json',{p_venue_id:venue,p_customer_phone:phone});return{data:single?(data||null):(data?[data]:[]),error};}return{data:null,error:new Error('tracking_context_missing')};}
       if(table==='orders'&&state.action==='update'){const phone=localStorage.getItem('last_phone')||'';const {data,error}=await real.rpc('customer_change_order_status',{p_order_id:state.filters.id,p_customer_phone:phone,p_status:state.payload?.status});return{data,error};}
       return real.from(table)[state.action==='select'?'select':state.action](state.payload||'*');
     }return api;
   }
   const oldFrom=real.from.bind(real);window.db={from:function(table){if(['orders','order_items','order_addons'].includes(table))return menuChain(table);return oldFrom(table)},rpc:real.rpc.bind(real),auth:real.auth,storage:real.storage};return;
 }
})();
