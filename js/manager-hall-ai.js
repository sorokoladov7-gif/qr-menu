/* QR Menu — manager compatibility bootstrap v20. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V20__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V20__=true;

  function publish(app){
    try{
      window.__QR_MANAGER_VUE_APP__=app;
      window.__managerVue=(app&&app._instance&&app._instance.proxy)||null;
      window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
    }catch(e){console.warn('[QR Manager] publish:',e);}
  }

  function patchDb(){
    try{
      if(!window.db||typeof window.db.rpc!=='function'||window.db.__QR_CANONICAL_CREATE_VENUE__)return;
      var originalRpc=window.db.rpc.bind(window.db);
      window.db.__QR_CANONICAL_CREATE_VENUE__=true;
      function normProducts(items){return(Array.isArray(items)?items:[]).map(function(i){return{name:String(i.name||'').trim(),description:i.description==null?null:String(i.description),price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,applies_to:i.applies_to||'all',is_available:i.is_available!==false};});}
      function sameTemplateProducts(a,b){a=normProducts(a);b=normProducts(b);if(!a.length||a.length!==b.length)return false;var aa=a.map(JSON.stringify).sort(),bb=b.map(JSON.stringify).sort();for(var i=0;i<aa.length;i++)if(aa[i]!==bb[i])return false;return true;}
      async function resolveTemplateId(products){var r=await window.db.from('menu_templates').select('id,products').eq('is_active',true);if(r.error)throw r.error;var list=r.data||[],found=list.find(function(t){return sameTemplateProducts(products,t.products);});if(found)return found.id;var incoming=normProducts(products).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\n');found=list.find(function(t){var current=normProducts(t.products).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\n');return current&&current===incoming;});if(found)return found.id;throw new Error('Не удалось определить шаблон каталога. Обновите шаблоны меню.');}
      window.db.rpc=function(fn,args,options){if(fn!=='create_venue_for_manager'||!args||!args.p_products)return originalRpc(fn,args,options);return resolveTemplateId(args.p_products).then(function(templateId){return originalRpc('create_venue_from_template',{p_template_id:templateId,p_name:args.p_name,p_slug:args.p_slug,p_plan:args.p_plan||'start',p_subscription_end:args.p_subscription_end},options);});};
    }catch(e){console.warn('[QR Manager] canonical venue RPC patch:',e);}
  }

  function patchVue(Vue){
    if(!Vue||typeof Vue.createApp!=='function'||Vue.__QR_MANAGER_PATCH_V20__)return;
    Vue.__QR_MANAGER_PATCH_V20__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      if(options&&typeof options==='object'){
        options.computed=options.computed||{};
        /* Единственный источник лимита — подписка управляющего, загруженная subscription-owner bridge. */
        options.computed.canCreateVenue=function(){
          var s=this.managerSubscription;
          var valid=!!(s&&['trialing','active'].indexOf(s.status)!==-1&&s.current_period_end&&new Date(s.current_period_end)>=new Date());
          if(!valid)return false;
          var p=this.plans&&this.plans.find(function(x){return x.id===s.plan_id;});
          var limit=p&&Number(p.max_venues);
          if(!Number.isFinite(limit)||limit<1)return false;
          var used=Array.isArray(this.myVenues)?this.myVenues.length:0;
          return used<limit;
        };
        options.computed.venueLimit=function(){var s=this.managerSubscription,p=this.plans&&this.plans.find(function(x){return s&&x.id===s.plan_id;});return p&&Number(p.max_venues)||0;};
        options.computed.venueLimitUsed=function(){return Array.isArray(this.myVenues)?this.myVenues.length:0;};
        options.computed.venueLimitRemaining=function(){return Math.max(0,this.venueLimit-this.venueLimitUsed);};
      }
      var app=original.apply(this,arguments),originalMount=app.mount;
      app.mount=function(){var result=originalMount.apply(this,arguments);publish(this);return result;};
      return app;
    };
  }

  function ingredientControls(){
    if(window.__QR_MANAGER_INGREDIENT_CONTROLS_V4__)return;
    window.__QR_MANAGER_INGREDIENT_CONTROLS_V4__=true;
    var style=document.createElement('style');style.textContent='.qr-ingredient-actions{display:flex!important;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-left:auto;padding-left:10px}.qr-ingredient-actions button{display:inline-flex!important;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#eef2ff;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:11px;line-height:1}.qr-ingredient-actions .qr-edit{color:#8fc7ff}.qr-ingredient-actions .qr-delete{color:#ff9a9a}.qr-ingredient-actions .qr-add{color:#7ee7a8}.qr-ingredient-edit-back{position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:16px}.qr-ingredient-edit-box{width:min(440px,calc(100vw - 32px));background:#151922;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.5)}';document.head.appendChild(style);
    function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
    function venueId(){try{return localStorage.getItem('manager_venue_id')||localStorage.getItem('selectedVenueId')||'';}catch(e){return '';}}
    function notify(text,error){try{if(window.__managerRecipeMsg){window.__managerRecipeMsg(text,error);return;}}catch(e){}console[error?'error':'log']('[QR Manager] '+text);}
    function unitOptions(selected){return[['g','г'],['kg','кг'],['ml','мл'],['l','л'],['pcs','шт']].map(function(u){return '<option value="'+u[0]+'" '+(u[0]===selected?'selected':'')+'>'+u[1]+'</option>';}).join('');}
    function closeEditor(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}
    function localRefresh(){var id=venueId();if(id)window.dispatchEvent(new CustomEvent('manager-venue-selected',{detail:{id:id}}));}
    function editLocal(item){var back=document.createElement('div');back.className='qr-ingredient-edit-back';back.innerHTML='<div class="qr-ingredient-edit-box"><h3>Изменить ингредиент</h3><label>Название</label><input id="qri-name" value="'+esc(item.name)+'"><label>Единица измерения</label><select id="qri-unit">'+unitOptions(item.unit||'g')+'</select><label>Закупочное количество</label><input id="qri-qty" type="number" min="0.001" step="0.001" value="'+Number(item.purchase_quantity||1)+'"><label>Закупочная цена</label><input id="qri-price" type="number" min="0" step="0.01" value="'+Number(item.purchase_price||0)+'"><div class="qr-ingredient-edit-actions"><button type="button" id="qri-cancel">Отмена</button><button type="button" class="primary" id="qri-save">Сохранить</button></div></div>';document.body.appendChild(back);back.querySelector('#qri-cancel').onclick=function(){closeEditor(back);};back.onclick=function(e){if(e.target===back)closeEditor(back);};back.querySelector('#qri-save').onclick=function(){var name=back.querySelector('#qri-name').value.trim(),unit=back.querySelector('#qri-unit').value,qty=Number(back.querySelector('#qri-qty').value),price=Number(back.querySelector('#qri-price').value);if(!name){notify('Введите название ингредиента.',true);return;}if(!(qty>0)){notify('Закупочное количество должно быть больше нуля.',true);return;}if(!Number.isFinite(price)||price<0){notify('Некорректная закупочная цена.',true);return;}var btn=this;btn.disabled=true;window.db.rpc('manager_ingredient_upsert',{p_venue_id:venueId(),p_name:name,p_unit:unit,p_purchase_quantity:qty,p_purchase_price:price,p_id:item.id}).then(function(){closeEditor(back);notify('Ингредиент изменён.');setTimeout(localRefresh,200);}).catch(function(e){btn.disabled=false;notify('Ошибка изменения: '+(e.message||e),true);});};}
    function deleteLocal(item){if(!window.confirm('Удалить ингредиент «'+item.name+'»?\n\nЕсли он используется в рецептуре, база данных не позволит удалить его.'))return;window.db.rpc('manager_ingredient_delete',{p_venue_id:venueId(),p_ingredient_id:item.id}).then(function(){notify('Ингредиент удалён.');setTimeout(localRefresh,200);}).catch(function(e){notify('Не удалось удалить ингредиент: '+(e.message||e),true);});}
    function editGlobal(item){var back=document.createElement('div');back.className='qr-ingredient-edit-back';back.innerHTML='<div class="qr-ingredient-edit-box"><h3>Изменить глобальный ингредиент</h3><label>Название</label><input id="qrg-name" value="'+esc(item.name)+'"><label>Единица измерения</label><select id="qrg-unit">'+unitOptions(item.unit||'g')+'</select><label>Категория</label><input id="qrg-cat" value="'+esc(item.category||'')+'"><div class="qr-ingredient-edit-actions"><button type="button" id="qrg-cancel">Отмена</button><button type="button" class="primary" id="qrg-save">Сохранить</button></div></div>';document.body.appendChild(back);back.querySelector('#qrg-cancel').onclick=function(){closeEditor(back);};back.onclick=function(e){if(e.target===back)closeEditor(back);};back.querySelector('#qrg-save').onclick=function(){var name=back.querySelector('#qrg-name').value.trim(),unit=back.querySelector('#qrg-unit').value,category=back.querySelector('#qrg-cat').value.trim();if(!name){notify('Введите название ингредиента.',true);return;}var btn=this;btn.disabled=true;window.db.rpc('manager_global_ingredient_update',{p_id:item.id,p_name:name,p_unit:unit,p_category:category}).then(function(){closeEditor(back);notify('Глобальный ингредиент изменён.');setTimeout(refreshGlobal,250);}).catch(function(e){btn.disabled=false;notify('Ошибка изменения: '+(e.message||e),true);});};}
    function deleteGlobal(item){if(!window.confirm('Удалить глобальный ингредиент «'+item.name+'»?\n\nЕсли он используется в стандартных техкартах, база данных не позволит удалить его.'))return;window.db.rpc('manager_global_ingredient_delete',{p_id:item.id}).then(function(){notify('Глобальный ингредиент удалён.');setTimeout(refreshGlobal,250);}).catch(function(e){notify('Не удалось удалить глобальный ингредиент: '+(e.message||e),true);});}
    function addGlobal(item){var id=venueId();if(!id){notify('Не выбрано заведение.',true);return;}window.db.rpc('manager_ingredient_upsert',{p_venue_id:id,p_name:item.name,p_unit:item.unit,p_purchase_quantity:1,p_purchase_price:0,p_id:null}).then(function(){notify('Ингредиент добавлен в ингредиенты заведения.');setTimeout(localRefresh,200);}).catch(function(e){notify('Не удалось добавить ингредиент: '+(e.message||e),true);});}
    function fetchLocal(cb){var id=venueId();if(!id){cb([]);return;}window.db.rpc('manager_ingredient_list',{p_venue_id:id}).then(function(data){cb(Array.isArray(data)?data:[]);}).catch(function(e){console.warn('[QR Manager] local ingredients:',e);cb([]);});}
    function fetchGlobal(cb){window.db.from('global_ingredient_catalog').select('id,name,unit,category').eq('is_active',true).order('name').then(function(res){cb(res.error?[]:(res.data||[]));}).catch(function(e){console.warn('[QR Manager] global ingredients:',e);cb([]);});}
    function enhanceLocal(){var root=document.getElementById('ingredients');if(!root)return;var domRows=[].slice.call(root.querySelectorAll('.ingredient-row'));if(!domRows.length)return;fetchLocal(function(list){domRows.forEach(function(row){if(row.querySelector('.qr-ingredient-actions'))return;var nameEl=row.querySelector('b');if(!nameEl)return;var name=(nameEl.textContent||'').trim(),item=list.find(function(x){return String(x.name||'').trim()===name;});if(!item)return;var actions=document.createElement('div');actions.className='qr-ingredient-actions';var edit=document.createElement('button');edit.type='button';edit.className='qr-edit';edit.textContent='Изменить';edit.onclick=function(e){e.preventDefault();e.stopPropagation();editLocal(item);};var del=document.createElement('button');del.type='button';del.className='qr-delete';del.textContent='Удалить';del.onclick=function(e){e.preventDefault();e.stopPropagation();deleteLocal(item);};actions.appendChild(edit);actions.appendChild(del);row.appendChild(actions);});});}
    function enhanceGlobal(){var root=document.getElementById('global-ingredients');if(!root)return;fetchGlobal(function(list){var rows=[].slice.call(root.querySelectorAll('.ingredient-row'));rows.forEach(function(row){if(row.querySelector('.qr-ingredient-actions'))return;var nameEl=row.querySelector('b');if(!nameEl)return;var name=(nameEl.textContent||'').trim(),item=list.find(function(x){return String(x.name||'').trim()===name;});if(!item)return;var actions=document.createElement('div');actions.className='qr-ingredient-actions';var edit=document.createElement('button');edit.type='button';edit.className='qr-edit';edit.textContent='Изменить';edit.onclick=function(e){e.preventDefault();e.stopPropagation();editGlobal(item);};var del=document.createElement('button');del.type='button';del.className='qr-delete';del.textContent='Удалить';del.onclick=function(e){e.preventDefault();e.stopPropagation();deleteGlobal(item);};var add=document.createElement('button');add.type='button';add.className='qr-add';add.textContent='Добавить';add.onclick=function(e){e.preventDefault();e.stopPropagation();addGlobal(item);};actions.appendChild(edit);actions.appendChild(del);actions.appendChild(add);row.appendChild(actions);});});}
    var observer=new MutationObserver(function(){enhanceLocal();enhanceGlobal();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(function(){enhanceLocal();enhanceGlobal();},500);
  }

  patchDb();
  if(window.Vue)patchVue(window.Vue);else{var d=Object.getOwnPropertyDescriptor(window,'Vue');if(!d||d.configurable!==false){var value;Object.defineProperty(window,'Vue',{configurable:true,enumerable:true,get:function(){return value;},set:function(v){value=v;patchVue(v);}});}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ingredientControls);else ingredientControls();
})();
