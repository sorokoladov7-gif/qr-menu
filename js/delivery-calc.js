/**
 * QR Menu — delivery quote engine.
 * Public quote is calculated server-side so the client cannot change the provider price or markup.
 */
(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname)) return;

window.geocodeAddress = async function(address){
  try{
    const url='https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(address);
    const r=await fetch(url,{headers:{'Accept-Language':'ru'}});
    const d=await r.json();
    if(d&&d[0]) return {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};
    return null;
  }catch(e){ console.warn('geocode error',e); return null; }
};

window.quoteDelivery = async function(venueId,address,lat,lng,cartTotal){
  try{
    if(window.db&&window.db.functions&&typeof window.db.functions.invoke==='function'){
      const r=await window.db.functions.invoke('delivery-quote',{body:{venue_id:venueId,customer_address:address,customer_lat:lat,customer_lng:lng,cart_total:Number(cartTotal)||0}});
      if(r.error) throw r.error;
      return r.data||{ok:false,error:'empty_quote'};
    }
    return {ok:false,error:'delivery_quote_function_unavailable'};
  }catch(e){
    console.warn('delivery quote error',e);
    return {ok:false,error:e&&e.message?e.message:'delivery_quote_failed'};
  }
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
    if(!x||!x.venue||x.__deliveryQuoteBound) return;
    x.__deliveryQuoteBound=true;
    clearInterval(n);

    x.deliveryQuoteId=null;
    x.deliveryProvider=null;
    x.deliveryProviderFee=null;
    x.deliveryFee=null;

    const run=async function(){
      if(x.form&&x.form.type!=='delivery') return;
      const address=String(x.form&&x.form.address||'').trim();
      if(address.length<8){x.calculatedDeliveryFee=null;x.deliveryFee=null;x.deliveryQuoteId=null;x.deliveryProvider=null;return;}
      x.deliveryCalcBusy=true;x.deliveryCalcError='';
      try{
        const geo=await geocodeAddress(address);
        if(!geo) throw new Error('Адрес не найден');
        const res=await quoteDelivery(x.venue.id,address,geo.lat,geo.lng,Number(x.cartTotal)||0);
        if(!res||!res.ok) throw new Error(res&&res.error==='too_far'?'Слишком далеко для доставки':res&&res.error==='provider_not_connected'?'Служба доставки не подключена':res&&res.error==='provider_api_not_available'?'Для выбранной службы пока не подключён API':(res&&res.error)||'Не удалось рассчитать доставку');
        x.calculatedDeliveryFee=Number(res.fee)||0;
        x.deliveryFee=Number(res.fee)||0;
        x.deliveryQuoteId=res.quote_id||null;
        x.deliveryProvider=res.provider||null;
        x.deliveryProviderFee=res.provider_fee!=null?Number(res.provider_fee):null;
        x.deliveryDistance=res.distance_km!=null?Number(res.distance_km):null;
        x.deliveryCalcError='';
      }catch(e){x.calculatedDeliveryFee=null;x.deliveryFee=null;x.deliveryQuoteId=null;x.deliveryProvider=null;x.deliveryProviderFee=null;x.deliveryCalcError=e.message||String(e);}
      finally{x.deliveryCalcBusy=false;}
    };

    x.calcDeliveryFee=run;
    let timer=null;
    const findAddr=()=>document.querySelector('input[placeholder*="дрес"],input[name="address"]');
    const attach=()=>{
      const inp=findAddr();
      if(!inp||inp.__deliveryQuoteBound) return;
      inp.__deliveryQuoteBound=true;
      inp.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,650);});
    };
    attach();
    new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
  },300);
  setTimeout(function(){clearInterval(n);},15000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
