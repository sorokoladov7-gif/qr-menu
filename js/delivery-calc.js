/**
 * delivery-calc.js — динамическая стоимость доставки по расстоянию.
 * Геокодинг адреса через бесплатный Nominatim (OpenStreetMap).
 * Подключать в menu.html ПОСЛЕ config.js.
 */
(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname)) return;

// Геокодинг: адрес → координаты
window.geocodeAddress = async function(address){
  try{
    const url='https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(address);
    const r=await fetch(url,{headers:{'Accept-Language':'ru'}});
    const d=await r.json();
    if(d&&d[0]) return {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};
    return null;
  }catch(e){ console.warn('geocode error',e); return null; }
};

// Расчёт стоимости через RPC
window.calcDeliveryFee = async function(venueId, lat, lng){
  try{
    const r=await db.rpc('calc_delivery_fee',{p_venue_id:venueId,p_lat:lat,p_lng:lng});
    if(r.error) throw r.error;
    return r.data; // {ok, distance_km, fee} или {ok:false,error:'too_far'}
  }catch(e){ console.warn('calc fee error',e); return {ok:false}; }
};

function getVM(){
  const app=document.getElementById('app');
  if(!app) return null;
  try{
    if(app.__vueParentComponent&&app.__vueParentComponent.proxy) return app.__vueParentComponent.proxy;
    if(app.__vue_app__&&app.__vue_app__._instance&&app.__vue_app__._instance.proxy) return app.__vue_app__._instance.proxy;
  }catch(e){}
  return null;
}

function bind(){
  const n=setInterval(function(){
    const x=getVM();
    if(!x||!x.venue||x.__deliveryCalcBound) return;
    x.__deliveryCalcBound=true;
    clearInterval(n);

    let timer=null;
    const findAddr=()=>document.querySelector('input[placeholder*="дрес"],input[name="address"]');
    const attach=()=>{
      const inp=findAddr();
      if(!inp||inp.__bound) return;
      inp.__bound=true;
      inp.addEventListener('input',function(){
        clearTimeout(timer);
        const val=inp.value.trim();
        if(val.length<8){ x.deliveryFee=null; x.deliveryDistance=null; x.msg=''; return; }
        timer=setTimeout(async function(){
          x.msg='📍 Считаем доставку...';
          const geo=await geocodeAddress(val);
          if(!geo){ x.msg='Адрес не найден'; x.deliveryFee=null; return; }
          const res=await calcDeliveryFee(x.venue.id,geo.lat,geo.lng);
          if(!res.ok){ x.msg=res.error==='too_far'?'❌ Слишком далеко для доставки':'Ошибка расчёта'; x.deliveryFee=null; return; }
          x.deliveryFee=res.fee;
          x.deliveryDistance=res.distance_km;
          x.msg='';
        },700); // debounce
      });
    };
    attach();
    new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
  },400);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
else bind();
})();
