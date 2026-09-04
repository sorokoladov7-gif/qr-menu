(function(){
  'use strict';

  const DB_NAME='qrmenu-offline-v3';
  const QUEUE='queue';
  const RESPONSES='responses';
  let dbp=null;

  function open(){
    if(dbp)return dbp;
    dbp=new Promise((res,rej)=>{
      const r=indexedDB.open(DB_NAME,2);
      r.onupgradeneeded=()=>{
        const d=r.result;
        if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:'id',autoIncrement:true});
        if(!d.objectStoreNames.contains(RESPONSES))d.createObjectStore(RESPONSES,{keyPath:'key'});
      };
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>rej(r.error);
    });
    return dbp;
  }

  async function add(item){
    const d=await open();
    return new Promise((res,rej)=>{
      const tx=d.transaction(QUEUE,'readwrite');
      const req=tx.objectStore(QUEUE).add({...item,createdAt:Date.now()});
      tx.oncomplete=()=>res(req.result);
      tx.onerror=()=>rej(tx.error);
    });
  }
  async function all(){
    const d=await open();
    return new Promise((res,rej)=>{const r=d.transaction(QUEUE,'readonly').objectStore(QUEUE).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  }
  async function remove(id){
    const d=await open();
    return new Promise((res,rej)=>{const tx=d.transaction(QUEUE,'readwrite');tx.objectStore(QUEUE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});
  }
  function key(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}

  async function digest(value){
    try{
      const bytes=new TextEncoder().encode(value);
      const hash=await crypto.subtle.digest('SHA-256',bytes);
      return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
    }catch(e){return encodeURIComponent(value).slice(0,180);}
  }

  async function responseKey(request){
    const auth=request.headers.get('authorization')||'';
    return digest(request.url+'|'+auth);
  }

  async function saveResponse(request,response){
    if(!response||!response.ok)return;
    const type=(response.headers.get('content-type')||'').toLowerCase();
    if(!/json|text|javascript|xml/.test(type))return;
    try{
      const body=await response.clone().text();
      const key=await responseKey(request);
      const d=await open();
      await new Promise((res,rej)=>{
        const tx=d.transaction(RESPONSES,'readwrite');
        tx.objectStore(RESPONSES).put({key,url:request.url,contentType:type,body,savedAt:Date.now()});
        tx.oncomplete=res;tx.onerror=()=>rej(tx.error);
      });
    }catch(e){}
  }

  async function cachedResponse(request){
    try{
      const key=await responseKey(request),d=await open();
      const item=await new Promise((res,rej)=>{const r=d.transaction(RESPONSES,'readonly').objectStore(RESPONSES).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
      if(!item)return null;
      return new Response(item.body,{status:200,headers:{'content-type':item.contentType||'application/json','x-qr-offline':'1','x-qr-offline-saved':String(item.savedAt)}});
    }catch(e){return null;}
  }

  function installFetchCache(){
    if(window.__qrOfflineFetchInstalled)return;
    const nativeFetch=window.fetch.bind(window);
    window.__qrOfflineFetchInstalled=true;
    window.fetch=async function(input,init){
      const request=new Request(input,init);
      if(request.method!=='GET')return nativeFetch(input,init);
      const url=new URL(request.url,location.href);
      const isSupabase=/\.supabase\.co$/i.test(url.hostname);
      const isSameOrigin=url.origin===location.origin;
      const isAuth=/\/auth\/v1\//i.test(url.pathname);
      if((!isSupabase&&!isSameOrigin)||isAuth)return nativeFetch(input,init);
      try{
        const response=await nativeFetch(input,init);
        if(response.ok)saveResponse(request,response);
        if(response.ok)return response;
        const cached=await cachedResponse(request);
        return cached||response;
      }catch(e){
        const cached=await cachedResponse(request);
        if(cached)return cached;
        throw e;
      }
    };
  }

  function renderStatus(){
    if(document.getElementById('qr-offline-status'))return;
    const el=document.createElement('div');
    el.id='qr-offline-status';
    el.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:100000;display:none;padding:7px 12px;border-radius:999px;background:#7f1d1d;color:#fff;border:1px solid rgba(255,255,255,.18);font:700 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none';
    el.textContent='Нет соединения — работаем с сохранёнными данными';
    document.body&&document.body.appendChild(el);
    const update=()=>{el.style.display=navigator.onLine?'none':'block';};
    window.addEventListener('online',update);window.addEventListener('offline',update);update();
  }

  async function flush(){
    if(!navigator.onLine||!window.db||typeof window.db.rpc!=='function')return;
    const items=await all();
    for(const item of items){
      try{
        const r=await window.db.rpc(item.rpc,item.args);
        if(r&&r.error)throw r.error;
        await remove(item.id);
      }catch(e){console.warn('[OfflineSync] retry failed',item.rpc,e);break;}
    }
  }

  installFetchCache();
  window.addEventListener('online',()=>setTimeout(flush,250));
  window.OfflineSync={add,all,remove,flush,key,saveResponse,cachedResponse,isOffline:()=>!navigator.onLine};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderStatus,{once:true});else renderStatus();
  setTimeout(flush,1200);
})();
