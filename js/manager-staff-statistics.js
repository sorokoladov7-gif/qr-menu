/* QR-SETKA manager staff statistics — Vue-native integration. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_STAFF_STATS_V5__) return;
  window.__QR_MANAGER_STAFF_STATS_V5__=true;
  var appProxy=null, originalCreateApp=null, installed=false;
  var URL='https://ulxfsozdryqrnlxzlblt.supabase.co';
  var KEY='sb_publishable_9hmWZwV5WnfQHDK1ir36Pg_JIdHdwPq';

  function captureVue(Vue){
    if(!Vue || typeof Vue.createApp!=='function' || Vue.__QR_MANAGER_STAFF_STATS_V5__) return;
    Vue.__QR_MANAGER_STAFF_STATS_V5__=true;
    originalCreateApp=Vue.createApp;
    Vue.createApp=function(options){
      if(options && typeof options==='object'){
        var mounted=options.mounted;
        options.mounted=function(){
          try{appProxy=this;window.__QR_MANAGER_APP_PROXY__=this;}catch(e){}
          if(typeof mounted==='function') return mounted.apply(this,arguments);
        };
      }
      var app=originalCreateApp.apply(this,arguments);
      try{appProxy=app&&app._instance&&app._instance.proxy||appProxy;}catch(e){}
      return app;
    };
  }

  try{
    if(window.Vue) captureVue(window.Vue);
    else {
      var d=Object.getOwnPropertyDescriptor(window,'Vue');
      if(!d || d.configurable!==false){
        var value;
        Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;captureVue(v);}});
      }
    }
  }catch(e){console.warn('[QR Manager Staff] Vue bridge:',e);}

  function getProxy(){
    if(appProxy&&appProxy.venue) return appProxy;
    try{var root=document.querySelector('#app'),inst=root&&root.__vue_app__&&root.__vue_app__._instance;if(inst&&inst.proxy){appProxy=inst.proxy;return appProxy;}}catch(e){}
    return window.__QR_MANAGER_APP_PROXY__||null;
  }
  function getClient(){if(window.db&&window.db.rpc)return window.db;if(window.supabase&&window.supabase.createClient)return window.supabase.createClient(URL,KEY);return null;}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(n){return Number(n||0).toLocaleString('ru-RU');}
  function iso(d){return d.toISOString().slice(0,10);}

  async function load(days,venueId,body){
    body.innerHTML='<div style="text-align:center;color:#94a3b8;padding:30px">Загрузка…</div>';
    var to=new Date(),from=new Date();from.setDate(to.getDate()-days+1);
    var db=getClient();if(!db){body.innerHTML='<div style="color:#f87171">Supabase client не найден</div>';return;}
    var r=await db.rpc('manager_staff_statistics',{p_venue_id:venueId,p_from:iso(from),p_to:iso(to)});
    if(r.error){body.innerHTML='<div style="color:#f87171">'+esc(r.error.message||r.error)+'</div>';return;}
    var rows=Array.isArray(r.data)?r.data:[];
    if(!rows.length){body.innerHTML='<div style="text-align:center;color:#94a3b8;padding:30px">Нет данных за выбранный период</div>';return;}
    body.innerHTML=rows.map(function(d,i){
      var staff=Array.isArray(d.staff)?d.staff:[],groups={waiter:[],cook:[],courier:[]};
      staff.forEach(function(s){if(groups[s.staff_type])groups[s.staff_type].push(s);});
      function group(title,arr){if(!arr.length)return '<div style="margin-top:10px;color:#94a3b8">'+title+': данных нет</div>';return '<div style="margin-top:12px"><b>'+title+'</b>'+arr.map(function(s){return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+esc(s.staff_name||'Без имени')+'</span><span>'+fmt(s.orders_count)+' заказов · '+fmt(s.revenue)+' ₽</span></div>';}).join('')+'</div>';}
      return '<div style="border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;margin-bottom:10px"><button data-day="'+i+'" style="width:100%;text-align:left;border:0;background:rgba(255,255,255,.04);color:#fff;padding:14px;cursor:pointer"><b>'+new Date(d.business_date+'T12:00:00').toLocaleDateString('ru-RU')+'</b><span style="float:right">'+fmt(d.total_revenue)+' ₽ · '+fmt(d.total_orders)+' заказов</span></button><div data-panel="'+i+'" style="display:none;padding:12px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px"><div style="padding:10px;border-radius:10px;background:rgba(52,211,153,.08)"><b>'+fmt(d.completed_orders)+'</b><div style="color:#94a3b8;font-size:11px">Выдано</div></div><div style="padding:10px;border-radius:10px;background:rgba(248,113,113,.08)"><b>'+fmt(d.cancelled_orders)+'</b><div style="color:#94a3b8;font-size:11px">Отменено</div></div><div style="padding:10px;border-radius:10px;background:rgba(251,191,36,.08)"><b>'+fmt(d.avg_cooking_minutes)+' мин</b><div style="color:#94a3b8;font-size:11px">Ср. готовка</div></div></div>'+group('🤵 Официанты',groups.waiter)+group('👨‍🍳 Повара',groups.cook)+group('🚗 Курьеры',groups.courier)+'</div></div>';
    }).join('');
    body.querySelectorAll('[data-day]').forEach(function(b){b.onclick=function(){var p=body.querySelector('[data-panel="'+b.getAttribute('data-day')+'"]');if(p)p.style.display=p.style.display==='none'?'block':'none';};});
  }

  function open(){
    var vm=getProxy(),venue=vm&&vm.venue;
    if(!venue||!venue.id){alert('Сначала выберите заведение.');return;}
    var old=document.getElementById('qr-manager-staff-modal');if(old)old.remove();
    var m=document.createElement('div');m.id='qr-manager-staff-modal';m.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.86);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px';
    m.innerHTML='<div style="width:min(1100px,100%);max-height:94vh;overflow:auto;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px"><div style="display:flex;justify-content:space-between;align-items:center"><div><h2 style="margin:0">📊 Статистика персонала</h2><div style="color:#94a3b8;font-size:12px;margin-top:4px">'+esc(venue.name||'')+'</div></div><button id="qrm-close" style="border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:9px 12px">✕</button></div><div style="display:flex;gap:8px;margin:16px 0"><button class="qrm-period" data-days="7">7 дней</button><button class="qrm-period" data-days="30">30 дней</button><button class="qrm-period" data-days="90">90 дней</button></div><div id="qrm-body"></div></div>';
    document.body.appendChild(m);m.querySelector('#qrm-close').onclick=function(){m.remove();};m.onclick=function(e){if(e.target===m)m.remove();};
    m.querySelectorAll('.qrm-period').forEach(function(b){b.style.cssText='border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer';b.onclick=function(){load(Number(b.getAttribute('data-days')),venue.id,m.querySelector('#qrm-body'));};});
    load(7,venue.id,m.querySelector('#qrm-body'));
  }

  function install(){var tabs=document.querySelector('.tabs');if(!tabs)return;document.querySelectorAll('#qr-manager-staff-tab,#qr-manager-staff-tab-v4').forEach(function(x){x.remove();});if(document.getElementById('qr-manager-staff-tab-v5'))return;var b=document.createElement('button');b.id='qr-manager-staff-tab-v5';b.type='button';b.textContent='📊 Персонал';b.style.cssText='background:rgba(255,255,255,.06)';b.onclick=open;tabs.appendChild(b);}
  function boot(){install();var n=0,t=setInterval(function(){install();if(++n>30)clearInterval(t);},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
