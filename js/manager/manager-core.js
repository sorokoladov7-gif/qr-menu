/* QR-Menu — общие данные и методы управляющего */
(function(){
  'use strict';
  if (window.__QR_MANAGER_CORE__) return;
  window.__QR_MANAGER_CORE__ = true;

  var coreMixin = {
    data: function() {
      return { ready:false,busy:false,geoBusy:false,geoError:'',uploading:false,uploadingLogo:false,loadError:'',profile:null,toast:null,timer:null,DEFAULT_IMG:window.DEFAULT_IMG||"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>"};
    },
    computed:{profileName:function(){return this.profile?this.profile.display_name:'';}},
    methods:{
      fmt:function(v){return window.fmt(v);},fmtDate:function(d){return window.fmtDate(d);},statusName:function(s){return window.statusName(s);},statusColor:function(s){return window.statusColor(s);},categoryLabel:function(c){return window.categoryLabel(c);},esc:function(s){return window.esc(s);},slugify:function(v){return window.slugify(v);},norm:function(s){return window.norm(s);},copyText:function(t){window.copyText(t,this.showToast);},
      showToast:function(text,type){type=type||'ok';this.toast={text:text,type:type};var self=this;clearTimeout(this._t);this._t=setTimeout(function(){self.toast=null;},2500);},
      resizeImage:function(file,mw,q){return new Promise(function(res,rej){var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas'),w=img.width,h=img.height;if(w>mw){h=Math.round(h*mw/w);w=mw;}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);canvas.toBlob(function(b){b?res(b):rej(new Error('Ошибка сжатия'));},'image/jpeg',q);};img.onerror=function(){rej(new Error('Не удалось загрузить изображение'));};img.src=e.target.result;};reader.onerror=function(){rej(new Error('Ошибка чтения файла'));};reader.readAsDataURL(file);});},
      logout:function(){try{db.auth.signOut();}catch(e){}if(this.timer)clearInterval(this.timer);location.href='/index.html';},
      init:async function(){var self=this;self.loadError='';self.ready=false;try{if(typeof db==='undefined')throw new Error('Supabase не подключен');if(typeof requireAuth!=='function')throw new Error('Функция requireAuth не найдена. Проверьте app.js');var profile=await requireAuth(['manager','admin']);self.profile=profile;if(!profile){self.ready=true;return;}await db.from('profiles').update({last_login_at:new Date().toISOString()}).eq('id',profile.id);var planResult=await db.from('plans').select('*').order('price');if(planResult.error)throw planResult.error;self.plans=planResult.data||[];if(typeof self.loadVenueTemplates==='function')await self.loadVenueTemplates();if(typeof self.loadMyVenues==='function')await self.loadMyVenues();self.ready=true;}catch(e){console.error('[Manager] init:',e);self.loadError=e&&e.message?e.message:String(e);self.ready=true;}}
    }
  };
  window.__QR_MANAGER_CORE_MIXIN__=coreMixin;

  function addIntegrationsLink(){
    if(!/\/manager\.html$/i.test(location.pathname))return;
    var tabs=document.querySelector('.tabs');
    if(!tabs||tabs.querySelector('[data-qr-integrations-link]'))return;
    var link=document.createElement('a');
    link.href='/integrations.html';
    link.textContent='🔗 Интеграции';
    link.setAttribute('data-qr-integrations-link','1');
    link.className='qr-integrations-tab';
    link.style.cssText='display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;';
    tabs.appendChild(link);
  }
  function initIntegrationsLink(){addIntegrationsLink();var attempts=0;var timer=setInterval(function(){addIntegrationsLink();attempts++;if(document.querySelector('[data-qr-integrations-link]')||attempts>=40)clearInterval(timer);},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initIntegrationsLink,{once:true});else initIntegrationsLink();

  /* Надёжный fallback UI для настроек доставки.
     manager-settings.js раньше искал v-if после компиляции Vue, но Vue 3 удаляет этот атрибут.
     Поэтому добавляем блок в уже отрисованный контейнер настроек независимо от состояния шаблона. */
  function mountDeliveryFallback(){
    if(!/\/manager\.html$/i.test(location.pathname))return;
    var root=document.getElementById('app'),vm=window.__managerVue;
    if(!root||!vm||vm.tab!=='settings'||root.querySelector('[data-qr-delivery-fallback]'))return;
    var boxes=Array.prototype.slice.call(root.querySelectorAll('div.glass.card'));
    var box=boxes.find(function(el){var t=el.textContent||'';return /Название/.test(t)&&/Адрес/.test(t);});
    if(!box){box=boxes.find(function(el){return /Настройки/.test(el.textContent||'')&&el.querySelector('input');});}
    if(!box)return;
    var wrap=document.createElement('div');wrap.setAttribute('data-qr-delivery-fallback','1');wrap.className='glass card';wrap.style.cssText='margin-top:18px;border-color:rgba(99,102,241,.35);max-width:100%';
    wrap.innerHTML='<h4 style="margin:0 0 6px">🚚 Интеграции доставки</h4><div class="muted" style="font-size:12px;margin-bottom:14px">Подключите существующие аккаунты служб доставки. Клиент не выбирает службу — используется основная по приоритету.</div><div data-df-cards></div><div class="field" style="margin-top:14px"><label>⭐ Основная служба для клиентов</label><select data-df-primary><option value="">Первый включённый по приоритету</option></select></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-primary" data-df-save>Сохранить интеграции доставки</button><button class="btn btn-ghost" data-df-refresh>Обновить</button></div><div class="muted" data-df-status style="font-size:11px;margin-top:8px"></div>';
    box.parentNode.insertBefore(wrap,box.nextSibling);
    renderDeliveryFallback(vm,wrap);
  }
  function renderDeliveryFallback(vm,wrap){
    var cards=vm.deliveryProviderCards||[],host=wrap.querySelector('[data-df-cards]');if(!host)return;host.innerHTML='';
    cards.forEach(function(p){
      var c=document.createElement('div');c.style.cssText='margin-top:10px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)';
      c.innerHTML='<div class="spread" style="gap:10px;align-items:center"><b>'+p.icon+' '+p.name+'</b><label style="display:flex;gap:7px;align-items:center;font-size:12px"><input type="checkbox" data-en> Включить</label></div><div class="row" style="gap:10px;flex-wrap:wrap;margin-top:9px"><div class="field"><label>Приоритет</label><input data-pr type="number" min="1" max="999" step="1"></div><div class="field" style="min-width:190px"><label>Цена для клиента</label><select data-mode><option value="provider">Цена службы</option><option value="provider_plus_percent">Цена службы + %</option><option value="fixed">Фиксированная цена</option></select></div><div class="field" data-markup-wrap><label>Наценка, %</label><input data-markup type="number" min="0" max="1000" step="0.5"></div><div class="field" data-fixed-wrap style="display:none"><label>Цена, ₽</label><input data-fixed type="number" min="0" step="1"></div></div>'+(p.external?'<div class="field" style="margin-top:9px"><label>API-токен существующего аккаунта</label><input data-token type="password" autocomplete="new-password" placeholder="Оставьте пустым, если уже сохранён"></div>':'<div class="muted" style="font-size:11px;margin-top:8px">Используется тариф доставки заведения из настроек выше.</div>')+'<div data-err class="muted" style="font-size:11px;margin-top:6px"></div>';
      var en=c.querySelector('[data-en]');en.checked=!!p.enabled;en.onchange=function(){p.enabled=en.checked;};
      var pr=c.querySelector('[data-pr]');pr.value=Number(p.priority||100);pr.oninput=function(){p.priority=Math.max(1,Math.min(999,Number(this.value)||100));};
      var mode=c.querySelector('[data-mode]');mode.value=p.pricing_mode||'provider_plus_percent';
      var mw=c.querySelector('[data-markup-wrap]'),fw=c.querySelector('[data-fixed-wrap]');
      var mk=c.querySelector('[data-markup]');mk.value=Number(p.markup_percent||0);mk.oninput=function(){p.markup_percent=Math.max(0,Math.min(1000,Number(this.value)||0));};
      var fx=c.querySelector('[data-fixed]');fx.value=Number(p.fixed_fee||0);fx.oninput=function(){p.fixed_fee=Math.max(0,Number(this.value)||0);};
      function toggle(){var fixed=mode.value==='fixed',markup=mode.value==='provider_plus_percent';mw.style.display=markup?'':'none';fw.style.display=fixed?'':'none';p.pricing_mode=mode.value;}
      mode.onchange=toggle;toggle();
      var token=c.querySelector('[data-token]');if(token)token.oninput=function(){p.api_token=token.value;};
      var err=c.querySelector('[data-err]');if(p.connected)err.innerHTML='<span style="color:#6ee7b7">✓ Подключение сохранено</span>';if(p.last_error)err.textContent=p.last_error;
      host.appendChild(c);
    });
    var primary=wrap.querySelector('[data-df-primary]');primary.innerHTML='<option value="">Первый включённый по приоритету</option>';
    cards.filter(function(p){return p.enabled;}).sort(function(a,b){return Number(a.priority||100)-Number(b.priority||100);}).forEach(function(p){var o=document.createElement('option');o.value=p.id;o.textContent=p.icon+' '+p.name;primary.appendChild(o);});
    primary.value=vm.deliveryPrimaryProvider||'';primary.onchange=function(){vm.deliveryPrimaryProvider=primary.value;};
    wrap.querySelector('[data-df-save]').onclick=function(){if(typeof vm.saveDeliverySettings==='function')vm.saveDeliverySettings();};
    wrap.querySelector('[data-df-refresh]').onclick=function(){if(typeof vm.loadDeliverySettings==='function')vm.loadDeliverySettings().then(function(){renderDeliveryFallback(vm,wrap);});};
  }
  function watchDeliveryFallback(){var attempts=0,timer=setInterval(function(){mountDeliveryFallback();var vm=window.__managerVue;if(vm&&vm.tab==='settings'&&document.querySelector('[data-qr-delivery-fallback]')===null){if(attempts>120)clearInterval(timer);}attempts++;if(attempts>180)clearInterval(timer);},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchDeliveryFallback,{once:true});else watchDeliveryFallback();
})();
