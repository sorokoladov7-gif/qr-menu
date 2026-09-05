/* QR Menu — manager AI control center. Ten tariff-gated AI functions. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_CENTER__)return;
  window.__QR_MANAGER_AI_CENTER__=true;

  var FEATURES=[
    ['assistant','ИИ-помощник','Общие вопросы, навигация и работа с возможностями платформы.'],
    ['menu_analysis','Анализ меню','Проверка структуры меню, категорий, цен и качества.'],
    ['menu_import','ИИ-импорт меню','Запуск существующего AI-импорта меню.'],
    ['analytics','ИИ-аналитика','Выводы по продажам, заказам и эффективности.'],
    ['recipes','ИИ-рецептуры','Создание и улучшение рецептур и техкарт.'],
    ['chef','ИИ-шеф','Рекомендации по блюдам, кухне и процессам.'],
    ['staff','ИИ-персонал','Анализ и рекомендации по персоналу.'],
    ['marketing','ИИ-маркетинг','Акции, тексты, предложения и продвижение.'],
    ['settings','ИИ-настройки','Помощь с настройками платформы и заведения.'],
    ['engineer','ИИ-инженер','Техническая диагностика и рекомендации по платформе.']
  ];

  function vm(){return window.__managerVue||null;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function allowed(v,feature){try{return !!v&&typeof v.hasAIFeature==='function'&&v.hasAIFeature(feature);}catch(e){return false;}}
  function context(v){
    var venue=v&&v.venue||{};
    var products=Array.isArray(v&&v.products)?v.products:[];
    var orders=Array.isArray(v&&v.orders)?v.orders:[];
    var staff={cooks:Array.isArray(v&&v.cooks)?v.cooks.length:0,couriers:Array.isArray(v&&v.couriers)?v.couriers.length:0,waiters:Array.isArray(v&&v.waiters)?v.waiters.length:0};
    return JSON.stringify({venue:{id:venue.id||null,name:venue.name||null,address:venue.address||null},products_count:products.length,products:products.slice(0,120),orders_count:orders.length,staff:staff,tab:v&&v.tab||null,plan:v&&v.currentPlan?v.currentPlan.name:null});
  }
  async function token(){
    if(!window.db||!db.auth)throw new Error('Supabase не подключен');
    var r=await db.auth.getSession();
    var t=r&&r.data&&r.data.session&&r.data.session.access_token;
    if(!t)throw new Error('Сессия управляющего не найдена');
    return t;
  }
  async function call(feature,message,v){
    if(!allowed(v,feature))throw new Error(v&&typeof v.aiFeatureError==='function'?v.aiFeatureError(feature):'Функция ИИ не включена в тариф');
    var t=await token();
    var r=await fetch('/api/manager-ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({feature:feature,message:String(message||'').trim().slice(0,8000),context:context(v)})});
    var data=await r.json().catch(function(){return{};});
    if(!r.ok||!data.ok)throw new Error(data.error||('HTTP_'+r.status));
    return data;
  }
  function openExistingImport(){
    var root=document.getElementById('app');
    if(!root)return false;
    var block=root.querySelector('#qr-menu-import-block-v2');
    if(!block)return false;
    var buttons=block.querySelectorAll('button');
    for(var i=0;i<buttons.length;i++){
      var text=(buttons[i].textContent||'').toLowerCase();
      if(text.indexOf('импорт')!==-1||text.indexOf('анализ')!==-1){buttons[i].click();return true;}
    }
    return false;
  }
  function install(){
    if(document.getElementById('qr-ai-feature-center'))return true;
    var v=vm();
    if(!v)return false;
    var root=document.createElement('div');
    root.id='qr-ai-feature-center';
    root.style.cssText='position:fixed;right:18px;bottom:18px;z-index:15000;font-family:inherit;';
    root.innerHTML='<button type="button" id="qr-ai-feature-fab" style="width:52px;height:52px;border-radius:50%;border:1px solid rgba(129,140,248,.45);background:rgba(20,24,33,.94);color:#fff;font-size:23px;box-shadow:0 10px 35px rgba(0,0,0,.35);cursor:pointer">✦</button>'+
      '<div id="qr-ai-feature-panel" style="display:none;position:absolute;right:0;bottom:62px;width:min(390px,calc(100vw - 28px));max-height:min(620px,calc(100vh - 100px));overflow:auto;background:rgba(15,18,26,.98);border:1px solid rgba(148,163,184,.22);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.5);padding:14px;backdrop-filter:blur(18px)">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><div><b style="font-size:16px">ИИ для управляющего</b><div style="font-size:11px;color:#94a3b8;margin-top:3px">Доступ определяется тарифом администратора</div></div><button type="button" id="qr-ai-feature-close" style="border:0;background:transparent;color:#94a3b8;font-size:20px;cursor:pointer">×</button></div>'+
      '<div id="qr-ai-feature-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:7px"></div>'+
      '<div id="qr-ai-feature-work" style="display:none;margin-top:12px;border-top:1px solid rgba(148,163,184,.14);padding-top:12px"></div>'+
      '</div>';
    document.body.appendChild(root);
    var fab=root.querySelector('#qr-ai-feature-fab'),panel=root.querySelector('#qr-ai-feature-panel'),buttons=root.querySelector('#qr-ai-feature-buttons'),work=root.querySelector('#qr-ai-feature-work');
    fab.onclick=function(){panel.style.display=panel.style.display==='none'?'block':'none';refresh();};
    root.querySelector('#qr-ai-feature-close').onclick=function(){panel.style.display='none';};

    function refresh(){
      var cur=vm();
      var any=false;
      buttons.innerHTML='';
      FEATURES.forEach(function(f){
        var ok=allowed(cur,f[0]);
        if(ok)any=true;
        var b=document.createElement('button');
        b.type='button';b.setAttribute('data-ai-feature',f[0]);
        b.style.cssText='text-align:left;border:1px solid rgba(148,163,184,.15);border-radius:10px;padding:9px;background:rgba(255,255,255,.035);color:#e5e7eb;cursor:pointer;font-size:11px;line-height:1.25;';
        b.innerHTML='<b>'+esc(f[1])+'</b><br><span style="color:#94a3b8">'+esc(f[2])+'</span>';
        if(!ok){b.style.opacity='.48';b.style.cursor='not-allowed';b.title=(cur&&typeof cur.aiFeatureError==='function'?cur.aiFeatureError(f[0]):'Функция не включена в тариф');}
        b.onclick=function(){
          if(!allowed(vm(),f[0])){if(vm()&&typeof vm().showToast==='function')vm().showToast(vm().aiFeatureError?vm().aiFeatureError(f[0]):'Функция ИИ не включена в тариф.','error');return;}
          if(f[0]==='menu_import'){
            if(!openExistingImport()&&vm()&&typeof vm().showToast==='function')vm().showToast('Блок ИИ-импорта меню не найден.','error');
            return;
          }
          openWork(f);
        };
        buttons.appendChild(b);
      });
      root.style.display=any?'block':'none';
      return any;
    }
    function openWork(f){
      work.style.display='block';
      work.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:7px">'+esc(f[1])+'</div>'+<div></div>;
    }
    return refresh();
  }

  function openWorkPanel(){
    var center=document.getElementById('qr-ai-feature-center');if(!center)return;
  }
  function boot(){
    var tries=0,timer=setInterval(function(){
      tries++;
      if(install()||tries>80){clearInterval(timer);}
    },250);
    window.addEventListener('qr-manager-vue-ready',function(){setTimeout(install,50);},{once:true});
  }
  boot();
})();
