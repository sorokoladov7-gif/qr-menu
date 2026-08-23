(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname))return;
if(window.__designRuntimeLoaded)return;
window.__designRuntimeLoaded=true;

function hex(v,f){return /^#[0-9a-f]{6}$/i.test(String(v||''))?v:f}
function apply(v){
  if(!v)return;
  var d=v.design_settings||{},root=document.documentElement,body=document.body;
  var brand=hex(d.brand_color,v.brand_color||'#6366f1');
  var button=hex(d.button_color,'#8b5cf6');
  var header=hex(d.header_color,'#ffffff');
  root.style.setProperty('--brand',brand);
  root.style.setProperty('--design-button',button);
  root.style.setProperty('--design-header',header);
  root.style.setProperty('--design-card-radius',(Number(d.card_radius)||18)+'px');
  root.style.setProperty('--design-button-radius',(Number(d.button_radius)||12)+'px');
  var font=d.font_family||'Plus+Jakarta+Sans';
  var old=document.getElementById('design-runtime-font');
  if(old)old.remove();
  var link=document.createElement('link');
  link.id='design-runtime-font';link.rel='stylesheet';
  link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(font).replace(/%2B/g,'+')+':wght@400;600;700;800&display=swap';
  document.head.appendChild(link);
  body.style.fontFamily=font.replace(/\+/g,' ')+',sans-serif';
  var hero=document.querySelector('.hero');
  if(hero){hero.style.display=d.hero_enabled===false?'none':'';hero.style.background=heroBg(d,brand,header)}
  document.querySelectorAll('.dish').forEach(function(x){
    x.style.borderRadius=(Number(d.card_radius)||18)+'px';
    if(d.card_style==='flat'){x.style.background='transparent';x.style.border='1px solid rgba(148,163,184,.18)'}
    else if(d.card_style==='bold'){x.style.background='linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.02))';x.style.border='1px solid '+brand+'66'}
    else if(d.card_style==='soft'){x.style.background='rgba(255,255,255,.045)';x.style.border='1px solid rgba(255,255,255,.08)'}
    else{x.style.background='rgba(255,255,255,.035)';x.style.border='1px solid rgba(255,255,255,.08)';x.style.backdropFilter='blur(10px)'}
  });
  document.querySelectorAll('.add-btn').forEach(function(x){
    x.style.borderRadius=(Number(d.button_radius)||12)+'px';
    x.style.background=d.button_style==='solid'?button:d.button_style==='outline'?'transparent':'linear-gradient(90deg,'+brand+','+button+')';
    if(d.button_style==='outline'){x.style.border='1px solid '+button;x.style.color=button}else{x.style.border='none';x.style.color='#fff'}
  });
  document.querySelectorAll('.chip.on').forEach(function(x){x.style.background='linear-gradient(90deg,'+brand+','+button+')'});
  document.querySelectorAll('.price-pill').forEach(function(x){x.style.background='linear-gradient(90deg,'+brand+','+button+')'});
  var top=document.querySelector('.topbar');
  if(top)top.style.borderColor=brand+'33';
}
function heroBg(d,b,h){
  if(d.hero_style==='dark')return 'linear-gradient(135deg,#020617,'+b+')';
  if(d.hero_style==='warm')return 'linear-gradient(135deg,'+b+','+h+')';
  if(d.hero_style==='minimal')return h;
  return 'linear-gradient(135deg,'+b+','+b+'aa,#8b5cf6)';
}
function boot(){
  var n=0,t=setInterval(function(){
    var app=document.getElementById('app'),inst=app&&app.__vue_app__&&app.__vue_app__._instance,proxy=inst&&inst.proxy;
    if(proxy&&proxy.venue){apply(proxy.venue);clearInterval(t)}
    if(++n>80)clearInterval(t);
  },250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

(function installCanonicalOrderBridge(){
  var tries=0;
  function install(){
    if(window.db&&typeof window.db.rpc==='function'&&!window.__canonicalOrderBridge){
      var originalRpc=window.db.rpc.bind(window.db);
      window.db.rpc=function(name,args,options){
        if(name==='create_public_order'&&args&&typeof args==='object'){
          var a=Object.assign({},args);
          var operationKey=a.p_operation_key||((window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random()));
          var clientTotal=Number(a.p_total_price)||0;
          var deliveryFee=Number(a.p_delivery_fee)||0;
          delete a.p_total_price;delete a.p_delivery_fee;
          a.p_delivery_lat=a.p_delivery_lat==null?null:a.p_delivery_lat;
          a.p_delivery_lng=a.p_delivery_lng==null?null:a.p_delivery_lng;
          a.p_operation_key=operationKey;a.p_client_total=clientTotal;a.p_delivery_fee=deliveryFee;
          return originalRpc('create_public_order_canonical',a,options);
        }
        return originalRpc(name,args,options);
      };
      window.__canonicalOrderBridge=true;return;
    }
    if(++tries<100)setTimeout(install,50);
  }
  install();
})();

(function loadCustomerOrderStatus(){
  function load(){
    if(document.querySelector('script[data-customer-order-status]'))return;
    var s=document.createElement('script');s.src='/js/customer-order-status.js?v=1';s.async=false;s.setAttribute('data-customer-order-status','1');document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
})();
