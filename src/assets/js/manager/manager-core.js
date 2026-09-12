/* QR-Menu — общие данные и методы управляющего */
(function(){
  'use strict';
  if(window.__QR_MANAGER_CORE__)return;

  var AI_FEATURES=['assistant','menu_analysis','menu_import','analytics','recipes','chef','staff','marketing','settings','engineer'];
  var coreMixin={
    data:function(){return{ready:false,busy:false,geoBusy:false,geoError:'',uploading:false,uploadingLogo:false,loadError:'',profile:null,plans:[],toast:null,timer:null,DEFAULT_IMG:window.DEFAULT_IMG||"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='%231f2937'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='30'>🍽</text></svg>"};},
    computed:{profileName:function(){return this.profile?this.profile.display_name:'';},aiPlan:function(){var s=this.managerSubscription,p=this.plans||[];return s?p.find(function(x){return x.id===s.plan_id;})||null:null;},aiFeatures:function(){var s=this.managerSubscription;if(s&&s.status==='trialing'&&s.current_period_end&&new Date(s.current_period_end)>=new Date())return AI_FEATURES.reduce(function(a,k){a[k]=true;return a;},{});var p=this.aiPlan;return p&&p.ai_features&&typeof p.ai_features==='object'?p.ai_features:{};},aiEnabled:function(){var s=this.managerSubscription;if(s&&s.status==='trialing'&&s.current_period_end&&new Date(s.current_period_end)>=new Date())return true;var f=this.aiFeatures;return AI_FEATURES.some(function(k){return f[k]===true;});}},
    methods:{
      fmt:function(v){return window.fmt(v);},fmtDate:function(d){return window.fmtDate(d);},statusName:function(s){return window.statusName(s);},statusColor:function(s){return window.statusColor(s);},categoryLabel:function(c){return window.categoryLabel(c);},esc:function(s){return window.esc(s);},slugify:function(v){return window.slugify(v);},norm:function(s){return window.norm(s);},copyText:function(t){window.copyText(t,this.showToast);},
      showToast:function(text,type){type=type||'ok';this.toast={text:text,type:type};var self=this;clearTimeout(this._t);this._t=setTimeout(function(){self.toast=null;},2500);},
      aiFeatureEnabled:function(feature){feature=String(feature||'').trim();if(!feature)return false;var s=this.managerSubscription,p=this.aiPlan;if(!s||!p||['active','trialing'].indexOf(s.status)===-1||!s.current_period_end||new Date(s.current_period_end)<new Date())return false;if(s.status==='trialing')return true;return p.ai_enabled===true&&this.aiFeatures[feature]===true;},
      requireAIFeature:function(feature){if(this.aiFeatureEnabled(feature))return true;this.showToast('Функция ИИ не включена в вашем тарифе.','error');return false;},
      resizeImage:function(file,mw,q){return new Promise(function(res,rej){var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var canvas=document.createElement('canvas'),w=img.width,h=img.height;if(w>mw){h=Math.round(h*mw/w);w=mw;}canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);canvas.toBlob(function(b){b?res(b):rej(new Error('Ошибка сжатия'));},'image/jpeg',q);};img.onerror=function(){rej(new Error('Не удалось загрузить изображение'));};img.src=e.target.result;};reader.onerror=function(){rej(new Error('Ошибка чтения файла'));};reader.readAsDataURL(file);});},
      logout:function(){try{db.auth.signOut();}catch(e){}if(this.timer)clearInterval(this.timer);location.href='/src/pages/guest/index.html';},
      init:async function(){var self=this;self.loadError='';self.ready=false;try{if(typeof db==='undefined')throw new Error('Supabase не подключен');if(typeof requireAuth!=='function')throw new Error('Функция requireAuth не найдена. Проверьте app.js');var profile=await requireAuth(['manager','admin']);self.profile=profile;if(!profile){self.ready=true;return;}await db.from('profiles').update({last_login_at:new Date().toISOString()}).eq('id',profile.id);var planResult=await db.from('plans').select('*').order('price');if(planResult.error)throw planResult.error;self.plans=planResult.data||[];if(typeof self.loadVenueTemplates==='function')await self.loadVenueTemplates();if(typeof self.loadMyVenues==='function')await self.loadMyVenues();self.ready=true;}catch(e){console.error('[Manager] init:',e);self.loadError=e&&e.message?e.message:String(e);self.ready=true;}}
    }
  };
  window.__QR_MANAGER_CORE_MIXIN__=coreMixin;
  window.__QR_MANAGER_AI_FEATURES__=AI_FEATURES.slice();

  async function runManagerAction(action){
    if(!action||typeof action!=='object')throw new Error('Некорректное действие');
    if(!window.db||!window.db.auth)throw new Error('Supabase клиент не найден');
    var sessionResult=await window.db.auth.getSession(),session=sessionResult&&sessionResult.data&&sessionResult.data.session,token=session&&session.access_token;
    if(!token)throw new Error('Сессия управляющего не найдена');
    var response=await fetch('/api/manager-ai-action',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({feature:'assistant',action:action})});
    var data=await response.json().catch(function(){return{};});
    if(!response.ok||!data.ok)throw new Error(data.error||'Не удалось выполнить действие');
    return data.result;
  }
  window.__QR_RUN_MANAGER_ACTION__=runManagerAction;

  function installCanonicalRpcBridge(){
    if(!window.db||typeof window.db.rpc!=='function'||window.db.__QR_MANAGER_RPC_BRIDGE__)return;
    try{
      var original=window.db.rpc.bind(window.db);window.db.__QR_MANAGER_RPC_BRIDGE__=true;
      window.db.rpc=function(name,args,options){
        if(name==='manager_ingredient_upsert'&&args&&args.p_venue_id){
          var type=args.p_id?'update_ingredient':'create_ingredient',payload={venue_id:args.p_venue_id,name:args.p_name,unit:args.p_unit,purchase_quantity:args.p_purchase_quantity,purchase_price:args.p_purchase_price};
          if(args.p_id)payload.id=args.p_id;
          return runManagerAction({type:type,payload:payload}).then(function(result){return{data:result,error:null};});
        }
        if(name==='manager_ingredient_delete'&&args&&args.p_venue_id&&args.p_ingredient_id){
          return runManagerAction({type:'delete_ingredient',payload:{venue_id:args.p_venue_id,id:args.p_ingredient_id}}).then(function(result){return{data:result,error:null};});
        }
        if(name==='manager_product_recipe_save'&&args&&args.p_venue_id&&args.p_product_id){
          return runManagerAction({type:'save_recipe',payload:{venue_id:args.p_venue_id,product_id:args.p_product_id,rows:Array.isArray(args.p_rows)?args.p_rows:[]}}).then(function(result){return{data:result,error:null};});
        }
        if(name==='manager_recipe_auto_sync')return Promise.reject(new Error('manager_recipe_auto_sync недоступен для authenticated manager client'));
        return original(name,args,options);
      };
    }catch(e){console.warn('[QR Manager] canonical RPC bridge:',e);}
  }

  function installProductMutationBridge(){
    if(!window.db||typeof window.db.from!=='function'||window.db.__QR_MANAGER_PRODUCT_MUTATION_BRIDGE__)return;
    try{
      var originalFrom=window.db.from.bind(window.db);window.db.__QR_MANAGER_PRODUCT_MUTATION_BRIDGE__=true;
      window.db.from=function(table){
        var builder=originalFrom(table);
        if(table!=='products'||!builder)return builder;
        if(typeof builder.insert==='function'){
          builder.insert=function(values){
            var rows=Array.isArray(values)?values.slice():[values];
            if(!rows[0]||typeof rows[0]!=='object')return Promise.reject(new Error('PRODUCT_PAYLOAD_INVALID'));
            return Promise.all(rows.map(function(row){return runManagerAction({type:'create_product',payload:Object.assign({},row)});})).then(function(result){return{data:result,error:null};}).catch(function(error){return{data:null,error:error};});
          };
        }
        function mutationBridge(type,values){
          var filters=[];
          var executed=false;
          function execute(){
            if(executed)return Promise.resolve({data:null,error:null});
            executed=true;
            var id=null,venueId=null;
            filters.forEach(function(f){if(f.field==='id')id=String(f.value);if(f.field==='venue_id')venueId=String(f.value);});
            var vm=window.__managerVue||null,canonicalVenue=vm&&vm.venue&&vm.venue.id?String(vm.venue.id):venueId;
            if(!canonicalVenue)throw new Error('Заведение не выбрано');
            if(!id)throw new Error('Товар не выбран');
            if(venueId&&venueId!==canonicalVenue)throw new Error('VENUE_ACCESS_DENIED');
            var payload={venue_id:canonicalVenue,id:id};
            if(type==='update_product')payload=Object.assign(payload,values||{});
            return runManagerAction({type:type,payload:payload}).then(function(result){return{data:result,error:null};}).catch(function(error){return{data:null,error:error};});
          }
          var q={
            eq:function(field,value){filters.push({field:String(field),value:value});return q;},
            select:function(){return q;},
            then:function(resolve,reject){return execute().then(resolve,reject);},
            catch:function(reject){return execute().catch(reject);},
            finally:function(fn){return execute().finally(fn);}
          };
          return q;
        }
        if(typeof builder.update==='function')builder.update=function(values){return mutationBridge('update_product',Object.assign({},values||{}));};
        if(typeof builder.delete==='function')builder.delete=function(){return mutationBridge('delete_product',{});};
        return builder;
      };
    }catch(e){console.warn('[QR Manager] product mutation bridge:',e);}
  }

  function addIntegrationsLink(){if(!/(?:^|\/)manager\.html$/i.test(location.pathname))return;var tabs=document.querySelector('.tabs');if(!tabs||tabs.querySelector('[data-qr-integrations-link]'))return;var link=document.createElement('a');link.href='/src/pages/manager/integrations.html';link.textContent='🔗 Интеграции';link.setAttribute('data-qr-integrations-link','1');link.className='qr-integrations-tab';link.style.cssText='display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;';tabs.appendChild(link);}
  function initIntegrationsLink(){addIntegrationsLink();var attempts=0,timer=setInterval(function(){addIntegrationsLink();attempts++;if(document.querySelector('[data-qr-integrations-link]')||attempts>=40)clearInterval(timer);},250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initIntegrationsLink,{once:true});else initIntegrationsLink();
  function restoreDeliverySettingsMount(){if(!/(?:^|\/)manager\.html$/i.test(location.pathname))return;var vm=window.__managerVue;if(!vm||vm.tab!=='settings')return;var root=document.getElementById('app');if(!root)return;if(root.querySelector('[data-qr-delivery-settings]'))return;var cards=root.querySelectorAll('.glass.card');for(var i=0;i<cards.length;i++){var text=(cards[i].textContent||'').replace(/\s+/g,' ');if(text.indexOf('Фактический адрес заведения')!==-1){cards[i].setAttribute('v-if',"tab==='settings'");cards[i].setAttribute('data-qr-settings-panel','1');return;}}}
  function watchDeliverySettingsMount(){var attempts=0,timer=setInterval(function(){restoreDeliverySettingsMount();attempts++;if(document.querySelector('[data-qr-delivery-settings]')||attempts>=120)clearInterval(timer);},250);setTimeout(function(){clearInterval(timer);},30000);}
  function normalizeDeliveryCards(vm){var ids=['yandex','delivery','samokat','custom'];var cards=vm.deliveryProviderCards||[];cards.forEach(function(p,i){if(ids[i]){p.id=ids[i];p.provider=ids[i];}});return cards;}
  function installSettingsPersistencePatch(vm){if(!vm||vm.__qrSettingsPersistencePatch)return;vm.__qrSettingsPersistencePatch=true;var originalLoad=vm.loadDeliverySettings;if(typeof originalLoad==='function'){vm.loadDeliverySettings=function(){var self=this;return Promise.resolve(originalLoad.apply(this,arguments)).then(function(result){var cards=normalizeDeliveryCards(self),enabled=cards.filter(function(p){return p.enabled;}).sort(function(a,b){return Number(a.priority||100)-Number(b.priority||100);});self.deliveryPrimaryProvider=enabled.length?enabled[0].id:'';return result;});};}var originalSaveVenue=vm.saveVenue;if(typeof originalSaveVenue==='function'){vm.saveVenue=function(){var self=this,venueId=self.venue&&self.venue.id;if(!venueId)return originalSaveVenue.apply(this,arguments);var f=self.vform||{},lat=Number(f.latitude),lng=Number(f.longitude),hasLat=Number.isFinite(lat),hasLng=Number.isFinite(lng),patch={address:String(f.address==null?'':f.address).trim()||null,latitude:hasLat?lat:null,longitude:hasLng?lng:null,delivery_enabled:typeof f.delivery_enabled==='boolean'?f.delivery_enabled:null,delivery_min_order:Math.max(0,Number(f.delivery_min_order)||0),delivery_min_order_free:Math.max(0,Number(f.delivery_min_order_free)||0),delivery_base_fee:Math.max(0,Number(f.delivery_base_fee)||0),delivery_rate_per_km:Math.max(0,Number(f.delivery_rate_per_km)||0),delivery_max_km:Math.max(0,Number(f.delivery_max_km)||0)};return runManagerAction({type:'update_delivery_settings',payload:Object.assign({venue_id:venueId},patch)}).then(function(){self.venue=Object.assign({},self.venue,patch);self.vform=Object.assign({},self.vform,Object.assign({},patch,{address:patch.address||''}));self.showToast('Настройки доставки сохранены.');return self.venue;}).catch(function(e){console.error('[Manager] venue settings:',e);self.showToast('Ошибка сохранения настроек заведения: '+(e.message||String(e)),'error');throw e;});};}}
  function watchSettingsPersistence(){var attempts=0,timer=setInterval(function(){var vm=window.__managerVue;if(vm){installSettingsPersistencePatch(vm);watchDeliverySettingsMount();if(vm.__qrSettingsPersistencePatch||attempts>120)clearInterval(timer);}attempts++;if(attempts>180)clearInterval(timer);},250);}
  window.addEventListener('qr-manager-vue-ready',function(){watchSettingsPersistence();watchDeliverySettingsMount();installCanonicalRpcBridge();installProductMutationBridge();},{once:true});
  if(window.__managerVue){watchSettingsPersistence();watchDeliverySettingsMount();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){installCanonicalRpcBridge();installProductMutationBridge();},{once:true});else{installCanonicalRpcBridge();installProductMutationBridge();}
})();
