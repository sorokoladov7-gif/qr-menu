(function(){
'use strict';
if(!/\/menu\.html$/i.test(location.pathname)) return;
if(window.__customerOrderLiveV4Loaded) return;
window.__customerOrderLiveV4Loaded=true;

/* Customer tracking is RPC-only. Never allow the public menu to read orders via REST. */
(function installOrderReadGuard(){
  function install(){
    if(!window.db || typeof window.db.rpc!=='function' || typeof window.db.from!=='function') return false;
    if(window.__customerOrderReadGuardV4) return true;
    var originalFrom=window.db.from.bind(window.db);
    var originalRpc=window.db.rpc.bind(window.db);
    window.db.from=function(table){
      if(table!=='orders') return originalFrom(table);
      var state={venueId:null,phone:null};
      var chain={
        select:function(){return chain;},
        eq:function(k,v){if(k==='venue_id')state.venueId=v;if(k==='customer_phone')state.phone=v;return chain;},
        order:function(){return chain;},
        limit:function(){return chain;},
        maybeSingle:function(){return run();},
        single:function(){return run();},
        then:function(a,b){return run().then(a,b);},
        catch:function(a){return run().catch(a);}
      };
      function run(){
        var phone=String(state.phone||localStorage.getItem('last_phone')||'').trim();
        var venue=state.venueId||localStorage.getItem('last_venue_id');
        if(!venue||!phone)return Promise.resolve({data:null,error:{message:'tracking_context_missing'}});
        return originalRpc('customer_track_order_json',{p_venue_id:venue,p_customer_phone:phone}).then(function(r){
          var d=r&&r.data;
          if(Array.isArray(d))d=d[0]||null;
          return {data:d,error:r&&r.error||null};
        });
      }
      return chain;
    };
    window.__customerOrderReadGuardV4=true;
    return true;
  }
  var tries=0, timer=setInterval(function(){if(install()||++tries>120)clearInterval(timer);},50);
  install();
})();

var timer=null,hookTimer=null,hookedVm=null,venueId=null,lastPhone='';
var LABELS={new:['🆕','Заказ принят','Мы получили заказ и скоро начнём готовить'],changed:['⚠️','Заказ изменён','Повар изменил состав заказа'],cooking:['👨‍🍳','Готовится','Повар уже готовит ваш заказ'],ready:['✅','Готов','Заказ готов — можно забирать'],delivery:['🚗','В доставке','Курьер направляется к вам'],done:['🎉','Выполнен','Спасибо за заказ!'],cancelled:['❌','Отменён','Заказ был отменён']};
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function getVm(){var a=document.getElementById('app'),i=a&&a.__vue_app__&&a.__vue_app__._instance;return i&&i.proxy||null;}
function ctx(vm){var p=String(localStorage.getItem('last_phone')||'').trim();if(!p&&vm&&vm.form)p=String(vm.form.phone||'').trim();var v=vm&&vm.venue;if(v&&v.id)venueId=v.id;if(!p)p=lastPhone;if(!venueId)venueId=localStorage.getItem('last_venue_id')||null;if(p)lastPhone=p;return{venueId:venueId,phone:p,vm:vm};}
function panel(){var p=document.getElementById('customer-live-order');if(p)return p;if(!document.body)return null;p=document.createElement('div');p.id='customer-live-order';p.style.cssText='position:fixed;left:50%;bottom:82px;transform:translateX(-50%);z-index:2147483647;width:min(560px,calc(100% - 28px));background:rgba(15,23,42,.98);border:1px solid rgba(129,140,248,.55);border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.5);padding:16px;color:#fff;backdrop-filter:blur(14px);font-family:inherit;display:none;';document.body.appendChild(p);return p;}
function render(o){if(!o||!o.status)return;var p=panel();if(!p)return;var l=LABELS[o.status]||['📦','Статус заказа','Заказ обрабатывается'];var st=['new','cooking','ready','done'],idx=st.indexOf(o.status);if(o.status==='delivery')idx=2;if(o.status==='cancelled')idx=-1;var h='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-size:12px;color:#94a3b8">Заказ №'+esc(o.order_number)+'</div><div style="font-size:22px;font-weight:800;margin-top:2px">'+l[0]+' '+esc(l[1])+'</div></div><button type="button" id="customer-live-close" style="border:0;background:rgba(255,255,255,.08);color:#cbd5e1;border-radius:9px;padding:7px 10px;cursor:pointer">✕</button></div><div style="font-size:13px;color:#cbd5e1;margin-top:7px">'+esc(l[2])+'</div>';if(o.status!=='cancelled'){h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:14px">';['Принят','Готовится','Готов','Выдан'].forEach(function(x,i){h+='<div style="height:6px;border-radius:99px;background:'+(i<=idx?'#6366f1':'rgba(255,255,255,.12)')+'"></div>';});h+='</div>';}h+='<div style="display:flex;justify-content:space-between;margin-top:11px;font-size:13px;color:#94a3b8"><span>Обновляется автоматически</span><b style="color:#fff">'+Number(o.total_price||0).toLocaleString('ru-RU')+' ₽</b></div>';p.innerHTML=h;p.style.display='block';var c=document.getElementById('customer-live-close');if(c)c.onclick=function(){p.style.display='none';};}
function fetchOrder(vm){var c=ctx(vm);if(!c.venueId||!c.phone||!window.db||typeof window.db.rpc!=='function')return Promise.resolve();localStorage.setItem('last_phone',c.phone);localStorage.setItem('last_venue_id',String(c.venueId));return window.db.rpc('customer_track_order_json',{p_venue_id:c.venueId,p_customer_phone:c.phone}).then(function(r){if(r&&r.error){console.error('[customer-order-live-v4]',r.error);return;}var o=r&&r.data;if(Array.isArray(o))o=o[0]||null;if(o&&o.id){try{vm.tracking=o;vm.trackSearched=true;if(vm.view!=='tracking')vm.view='tracking';}catch(e){}render(o);}}).catch(function(e){console.error('[customer-order-live-v4]',e);});}
function hook(vm){if(!vm||hookedVm===vm)return;hookedVm=vm;vm.trackOrder=function(){return fetchOrder(vm);};vm.startTrackingTimer=function(){if(vm.trackTimer)clearInterval(vm.trackTimer);vm.trackTimer=setInterval(function(){if(vm.view==='tracking')fetchOrder(vm);},3000);};if(ctx(vm).phone)fetchOrder(vm);}
function boot(){var n=0;function h(){var vm=getVm();if(vm)hook(vm);if(++n<120)hookTimer=setTimeout(h,250);}h();timer=setInterval(function(){var vm=getVm();if(vm){hook(vm);if(ctx(vm).phone)fetchOrder(vm);}},3000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
