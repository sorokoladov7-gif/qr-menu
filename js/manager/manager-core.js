/* QR-Menu — общие данные и методы управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CORE__)return;
  window.__QR_MANAGER_CORE__=true;

  var coreMixin={
    data:function(){return{ready:false,busy:false,geoBusy:false,geoError:'',uploading:false,uploadingLogo:false,loadError:'',profile:null,toast:null,timer:null,DEFAULT_IMG:window.DEFAULT_IMG||"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>"};},
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

  function addIntegrationsLink(){if(!/\/manager\.html$/i.test(location.pathname))return;var tabs=document.querySelector('.tabs');if(!tabs||tabs.querySelector('[data-qr-integrations-link]'))return;var link=document.createElement('a');link.href='/integrations.html';link.textContent='🔗 Интеграции';link.setAttribute('data-qr-integrations-link','1');link.className='qr-integrations-tab';link.style.cssText='display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;';tabs.appendChild(link);}
  function initIntegrationsLink(){addIntegrationsLink();var attempts=0,timer=setInterval(function(){addIntegrationsLink();attempts++;if(document.querySelector('[data-qr-integrations-link]')||attempts>=40)clearInterval(timer);},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initIntegrationsLink,{once:true});else initIntegrationsLink();

  /* Vue 3 removes v-if attributes after mounting. The delivery UI module historically
     used that attribute as its mount point, so restore a stable marker on the real
     settings card before manager-settings tries to inject the delivery panel. */
  function restoreDeliverySettingsMount(){
    if(!/\/manager\.html$/i.test(location.pathname))return;
    var vm=window.__managerVue;
    if(!vm||vm.tab!=='settings')return;
    var root=document.getElementById('app');
    if(!root)return;
    if(root.querySelector('[data-qr-delivery-settings]'))return;
    var cards=root.querySelectorAll('.glass.card');
    for(var i=0;i<cards.length;i++){
      var text=(cards[i].textContent||'').replace(/\s+/g,' ');
      if(text.indexOf('Фактический адрес заведения')!==-1){
        cards[i].setAttribute('v-if',"tab==='settings'");
        cards[i].setAttribute('data-qr-settings-panel','1');
        return;
      }
    }
  }
  function watchDeliverySettingsMount(){
    var attempts=0;
    var timer=setInterval(function(){
      restoreDeliverySettingsMount();
      attempts++;
      if(document.querySelector('[data-qr-delivery-settings]')||attempts>=120)clearInterval(timer);
    },250);
    setTimeout(function(){clearInterval(timer);},30000);
  }

  function normalizeDeliveryCards(vm){
    var ids=['yandex','delivery','samokat','custom'];
    var cards=vm.deliveryProviderCards||[];
    cards.forEach(function(p,i){if(ids[i]){p.id=ids[i];p.provider=ids[i];}});
    return cards;
  }

  function installSettingsPersistencePatch(vm){
    if(!vm||vm.__qrSettingsPersistencePatch)return;
    vm.__qrSettingsPersistencePatch=true;
    var originalLoad=vm.loadDeliverySettings;
    if(typeof originalLoad==='function'){
      vm.loadDeliverySettings=function(){
        var self=this;
        return Promise.resolve(originalLoad.apply(this,arguments)).then(function(result){
          var cards=normalizeDeliveryCards(self);
          var enabled=cards.filter(function(p){return p.enabled;}).sort(function(a,b){return Number(a.priority||100)-Number(b.priority||100);});
          self.deliveryPrimaryProvider=enabled.length?enabled[0].id:'';
          return result;
        });
      };
    }

    var originalSaveVenue=vm.saveVenue;
    if(typeof originalSaveVenue==='function'){
      vm.saveVenue=function(){
        var self=this,venueId=self.venue&&self.venue.id;
        if(!venueId){return originalSaveVenue.apply(this,arguments);}
        var f=self.vform||{},lat=Number(f.latitude),lng=Number(f.longitude);
        var hasLat=Number.isFinite(lat),hasLng=Number.isFinite(lng);
        var payload={
          p_venue_id:venueId,
          p_address:String(f.address==null?'':f.address).trim()||null,
          p_latitude:hasLat?lat:null,
          p_longitude:hasLng?lng:null,
          p_delivery_enabled:typeof f.delivery_enabled==='boolean'?f.delivery_enabled:null,
          p_delivery_min_order:Math.max(0,Number(f.delivery_min_order)||0),
          p_delivery_min_order_free:Math.max(0,Number(f.delivery_min_order_free)||0),
          p_delivery_base_fee:Math.max(0,Number(f.delivery_base_fee)||0),
          p_delivery_rate_per_km:Math.max(0,Number(f.delivery_rate_per_km)||0),
          p_delivery_max_km:Math.max(0,Number(f.delivery_max_km)||0)
        };
        return db.rpc('manager_save_venue_settings',payload).then(function(r){
          if(r.error)throw r.error;
          var v=r.data&&r.data.venue?r.data.venue:null;
          if(v){self.venue=v;self.vform=Object.assign({},self.vform,{address:v.address||'',latitude:v.latitude!=null?Number(v.latitude):(v.lat!=null?Number(v.lat):null),longitude:v.longitude!=null?Number(v.longitude):(v.lng!=null?Number(v.lng):null),delivery_min_order:Number(v.delivery_min_order||0),delivery_min_order_free:Number(v.delivery_min_order_free||0),delivery_base_fee:Number(v.delivery_base_fee!=null?v.delivery_base_fee:(v.delivery_base_price||0)),delivery_rate_per_km:Number(v.delivery_rate_per_km!=null?v.delivery_rate_per_km:(v.delivery_per_km||0)),delivery_max_km:Number(v.delivery_max_km||0)});}
          return originalSaveVenue.apply(self,arguments);
        }).catch(function(e){
          console.error('[Manager] manager_save_venue_settings:',e);
          self.showToast('Ошибка сохранения настроек заведения: '+(e.message||String(e)),'error');
          throw e;
        });
      };
    }
  }

  function watchSettingsPersistence(){var attempts=0,timer=setInterval(function(){var vm=window.__managerVue;if(vm){installSettingsPersistencePatch(vm);watchDeliverySettingsMount();if(vm.__qrSettingsPersistencePatch||attempts>120)clearInterval(timer);}attempts++;if(attempts>180)clearInterval(timer);},250);}
  window.addEventListener('qr-manager-vue-ready',function(){watchSettingsPersistence();watchDeliverySettingsMount();},{once:true});
  if(window.__managerVue){watchSettingsPersistence();watchDeliverySettingsMount();}
})();