(function(){
  'use strict';
  const DB_NAME='qrmenu-offline-v4',QUEUE='queue',RESPONSES='responses';
  let dbp=null;
  function open(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,3);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:'id',autoIncrement:true});if(!d.objectStoreNames.contains(RESPONSES))d.createObjectStore(RESPONSES,{keyPath:'key'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});return dbp;}
  async function add(item){const d=await open();return new Promise((res,rej)=>{const tx=d.transaction(QUEUE,'readwrite'),q=tx.objectStore(QUEUE),req=q.add({...item,createdAt:Date.now()});tx.oncomplete=()=>res(req.result);tx.onerror=()=>rej(tx.error);});}
  async function all(){const d=await open();return new Promise((res,rej)=>{const r=d.transaction(QUEUE,'readonly').objectStore(QUEUE).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  async function remove(id){const d=await open();return new Promise((res,rej)=>{const tx=d.transaction(QUEUE,'readwrite');tx.objectStore(QUEUE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
  function key(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}
  async function digest(v){try{const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){return encodeURIComponent(v).slice(0,180);}}
  async function responseKey(request){return digest(request.url+'|'+(request.headers.get('authorization')||''));}
  async function saveResponse(request,response){if(!response||!response.ok)return;const type=(response.headers.get('content-type')||'').toLowerCase();if(!/json|text|javascript|xml/.test(type))return;try{const body=await response.clone().text(),k=await responseKey(request),d=await open();await new Promise((res,rej)=>{const tx=d.transaction(RESPONSES,'readwrite');tx.objectStore(RESPONSES).put({key:k,url:request.url,contentType:type,body:body,savedAt:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}catch(e){}}
  async function cachedResponse(request){try{const d=await open(),k=await responseKey(request),item=await new Promise((res,rej)=>{const r=d.transaction(RESPONSES,'readonly').objectStore(RESPONSES).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});if(!item)return null;return new Response(item.body,{status:200,headers:{'content-type':item.contentType||'application/json','x-qr-offline':'1','x-qr-offline-saved':String(item.savedAt)}});}catch(e){return null;}}
  function installFetchCache(){if(window.__qrOfflineFetchInstalled)return;const nativeFetch=window.fetch.bind(window);window.__qrOfflineFetchInstalled=true;window.fetch=async function(input,init){const request=new Request(input,init);if(request.method!=='GET')return nativeFetch(input,init);const url=new URL(request.url,location.href),isSupabase=/\.supabase\.co$/i.test(url.hostname),isSame=url.origin===location.origin,isAuth=/\/auth\/v1\//i.test(url.pathname);if((!isSupabase&&!isSame)||isAuth)return nativeFetch(input,init);try{const response=await nativeFetch(input,init);if(response.ok)saveResponse(request,response);if(response.ok)return response;return (await cachedResponse(request))||response;}catch(e){const cached=await cachedResponse(request);if(cached)return cached;throw e;}};}

  const RPC_WRITE=new Set(['create_public_order','create_public_order_v2','create_public_order_canonical','staff_update_order','customer_change_order_status','cook_start_table_session','cook_release_table','waiter_start_table_session','waiter_release_table']);
  const RPC_READ=new Set(['staff_orders_json','staff_history_json','cook_get_table_dashboard','waiter_get_dashboard','staff_table_board','get_waiter_calls','cook_recipe_catalog','customer_track_order_json','staff_venue_by_slug']);
  function installRpcBridge(){
    if(window.__qrOfflineRpcInstalled||!window.db||typeof window.db.rpc!=='function')return !!window.__qrOfflineRpcInstalled;
    const nativeRpc=window.db.rpc.bind(window.db);
    window.db.rpc=async function(name,args,options){
      if(navigator.onLine){
        try{const r=await nativeRpc(name,args,options);if(r&&!r.error&&RPC_READ.has(name)){saveRpc(name,args,r.data);}return r;}catch(e){throw e;}
      }
      if(RPC_WRITE.has(name)){
        await add({operation:'rpc',rpc:name,args:args||{},type:'write'});
        return {data:{offline:true,queued:true,operation_key:key()},error:null};
      }
      if(RPC_READ.has(name)){const data=await getRpc(name,args);if(data!==null)return {data:data,error:null};}
      return {data:null,error:new Error('offline_data_unavailable')};
    };
    window.__qrOfflineRpcInstalled=true;return true;
  }
  async function saveRpc(name,args,data){try{const d=await open(),k=await digest('rpc|'+name+'|'+JSON.stringify(args||{}));await new Promise((res,rej)=>{const tx=d.transaction(RESPONSES,'readwrite');tx.objectStore(RESPONSES).put({key:k,url:'rpc:'+name,contentType:'application/json',body:JSON.stringify(data),savedAt:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}catch(e){}}
  async function getRpc(name,args){try{const d=await open(),k=await digest('rpc|'+name+'|'+JSON.stringify(args||{})),item=await new Promise((res,rej)=>{const r=d.transaction(RESPONSES,'readonly').objectStore(RESPONSES).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});return item?JSON.parse(item.body):null;}catch(e){return null;}}

  async function flush(){if(!navigator.onLine||!window.db)return;const items=await all();for(const item of items){try{let r;if(item.operation==='update')r=await window.db.from(item.table).update(item.payload).eq('id',item.filters.id);else r=await window.db.rpc(item.rpc,item.args);if(r&&r.error)throw r.error;await remove(item.id);}catch(e){console.warn('[OfflineSync] retry failed',item,e);break;}}}
  function renderStatus(){if(!document.body||document.getElementById('qr-offline-status'))return;const el=document.createElement('div');el.id='qr-offline-status';el.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:100000;display:none;padding:7px 12px;border-radius:999px;background:#7f1d1d;color:#fff;border:1px solid rgba(255,255,255,.18);font:700 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none';el.textContent='Нет соединения — работаем с сохранёнными данными';document.body.appendChild(el);const update=()=>{el.style.display=navigator.onLine?'none':'block';};window.addEventListener('online',update);window.addEventListener('offline',update);update();}
  installFetchCache();
  const waitRpc=setInterval(()=>{if(installRpcBridge())clearInterval(waitRpc);},100);setTimeout(()=>clearInterval(waitRpc),10000);
  window.addEventListener('online',()=>setTimeout(flush,300));
  window.OfflineSync={add,all,remove,flush,key,saveResponse,cachedResponse,isOffline:()=>!navigator.onLine};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderStatus,{once:true});else renderStatus();
  setTimeout(flush,1500);
})();
