(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname))return;
if(window.__designRuntimeLoaded)return;
window.__designRuntimeLoaded=true;

function hex(v,f){return /^#[0-9a-f]{6}$/i.test(String(v||''))?v:f}
function apply(v){
 if(!v)return;
 var d=v.design_settings||{},root=document.documentElement,body=document.body;
 var brand=hex(d.brand_color,v.brand_color||'#6366f1'),button=hex(d.button_color,'#8b5cf6'),header=hex(d.header_color,'#ffffff');
 root.style.setProperty('--brand',brand);root.style.setProperty('--design-button',button);root.style.setProperty('--design-header',header);
 root.style.setProperty('--design-card-radius',(Number(d.card_radius)||18)+'px');root.style.setProperty('--design-button-radius',(Number(d.button_radius)||12)+'px');
 var font=d.font_family||'Plus+Jakarta+Sans',old=document.getElementById('design-runtime-font');if(old)old.remove();
 var link=document.createElement('link');link.id='design-runtime-font';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(font).replace(/%2B/g,'+')+':wght@400;600;700;800&display=swap';document.head.appendChild(link);body.style.fontFamily=font.replace(/\+/g,' ')+',sans-serif';
 var hero=document.querySelector('.hero');if(hero){hero.style.display=d.hero_enabled===false?'none':'';hero.style.background=heroBg(d,brand,header)}
 document.querySelectorAll('.dish').forEach(function(x){x.style.borderRadius=(Number(d.card_radius)||18)+'px';if(d.card_style==='flat'){x.style.background='transparent';x.style.border='1px solid rgba(148,163,184,.18)'}else if(d.card_style==='bold'){x.style.background='linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.02))';x.style.border='1px solid '+brand+'66'}else if(d.card_style==='soft'){x.style.background='rgba(255,255,255,.045)';x.style.border='1px solid rgba(255,255,255,.08)'}else{x.style.background='rgba(255,255,255,.035)';x.style.border='1px solid rgba(255,255,255,.08)';x.style.backdropFilter='blur(10px)'}});
 document.querySelectorAll('.add-btn').forEach(function(x){x.style.borderRadius=(Number(d.button_radius)||12)+'px';x.style.background=d.button_style==='solid'?button:d.button_style==='outline'?'transparent':'linear-gradient(90deg,'+brand+','+button+')';if(d.button_style==='outline'){x.style.border='1px solid '+button;x.style.color=button}else{x.style.border='none';x.style.color='#fff'}});
 document.querySelectorAll('.chip.on').forEach(function(x){x.style.background='linear-gradient(90deg,'+brand+','+button+')'});document.querySelectorAll('.price-pill').forEach(function(x){x.style.background='linear-gradient(90deg,'+brand+','+button+')'});var top=document.querySelector('.topbar');if(top)top.style.borderColor=brand+'33';
}
function heroBg(d,b,h){if(d.hero_style==='dark')return 'linear-gradient(135deg,#020617,'+b+')';if(d.hero_style==='warm')return 'linear-gradient(135deg,'+b+','+h+')';if(d.hero_style==='minimal')return h;return 'linear-gradient(135deg,'+b+','+b+'aa,#8b5cf6)'}
function boot(){var n=0,t=setInterval(function(){var app=document.getElementById('app'),inst=app&&app.__vue_app__&&app.__vue_app__._instance,proxy=inst&&inst.proxy;if(proxy&&proxy.venue){apply(proxy.venue);clearInterval(t)}if(++n>80)clearInterval(t)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

/* Canonical order creation bridge. */
(function installCanonicalOrderBridge(){var tries=0;function install(){if(window.db&&typeof window.db.rpc==='function'&&!window.__canonicalOrderBridge){var originalRpc=window.db.rpc.bind(window.db);window.db.rpc=function(name,args,options){if(name==='create_public_order'&&args&&typeof args==='object'){var a=Object.assign({},args),operationKey=a.p_operation_key||((window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random())),clientTotal=Number(a.p_total_price)||0,deliveryFee=Number(a.p_delivery_fee)||0;delete a.p_total_price;delete a.p_delivery_fee;a.p_delivery_lat=a.p_delivery_lat==null?null:a.p_delivery_lat;a.p_delivery_lng=a.p_delivery_lng==null?null:a.p_delivery_lng;a.p_operation_key=operationKey;a.p_client_total=clientTotal;a.p_delivery_fee=deliveryFee;return originalRpc('create_public_order_canonical',a,options)}return originalRpc(name,args,options)};window.__canonicalOrderBridge=true;installOrderReadBridge(originalRpc);return}if(++tries<100)setTimeout(install,50)}
function installOrderReadBridge(originalRpc){if(window.__canonicalOrderReadBridge)return;var originalFrom=window.db.from.bind(window.db);window.db.from=function(table){if(table!=='orders')return originalFrom(table);var real=originalFrom(table),reading=false,venueId=null,phone=null;var bridge={select:function(){reading=true;return bridge},eq:function(column,value){if(reading){if(column==='venue_id')venueId=value;if(column==='customer_phone')phone=value;return bridge}return real.eq(column,value)},order:function(){return bridge},limit:function(){return bridge},maybeSingle:function(){if(!reading)return real.maybeSingle();if(!venueId||!phone)return Promise.resolve({data:null,error:null});return originalRpc('customer_track_order_json',{p_venue_id:venueId,p_customer_phone:phone}).then(function(r){var data=r&&r.data;if(Array.isArray(data))data=data[0]||null;return{data:data,error:r&&r.error||null}})},update:function(values){return real.update(values)},insert:function(values){return real.insert(values)},delete:function(){return real.delete()}};return bridge};window.__canonicalOrderReadBridge=true}
install();})();

(function loadCustomerOrderStatus(){function load(src,key){if(document.querySelector('script['+key+']'))return;var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(key,'1');document.head.appendChild(s)}load('/js/customer-order-status.js?v=3','data-customer-order-status');load('/js/customer-order-live.js?v=3','data-customer-order-live-v3')})();
})();