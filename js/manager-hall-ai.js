/* QR Menu — manager compatibility bootstrap v19. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V19__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V19__=true;

  function publish(app){
    try{
      window.__QR_MANAGER_VUE_APP__=app;
      window.__managerVue=(app&&app._instance&&app._instance.proxy)||null;
      window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
    }catch(e){console.warn('[QR Manager] publish:',e);}
  }

  /* Сохраняем существующую совместимость создания заведения. */
  function patchDb(){
    try{
      if(!window.db||typeof window.db.rpc!=='function'||window.db.__QR_CANONICAL_CREATE_VENUE__)return;
      var originalRpc=window.db.rpc.bind(window.db);
      window.db.__QR_CANONICAL_CREATE_VENUE__=true;
      function normProducts(items){
        return(Array.isArray(items)?items:[]).map(function(i){
          return{name:String(i.name||'').trim(),description:i.description==null?null:String(i.description),price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,applies_to:i.applies_to||'all',is_available:i.is_available!==false};
        });
      }
      function sameTemplateProducts(a,b){
        a=normProducts(a);b=normProducts(b);
        if(!a.length||a.length!==b.length)return false;
        var aa=a.map(function(x){return JSON.stringify(x);}).sort(),bb=b.map(function(x){return JSON.stringify(x);}).sort();
        for(var i=0;i<aa.length;i++)if(aa[i]!==bb[i])return false;
        return true;
      }
      async function resolveTemplateId(products){
        var r=await window.db.from('menu_templates').select('id,products').eq('is_active',true);
        if(r.error)throw r.error;
        var list=r.data||[];
        var found=list.find(function(t){return sameTemplateProducts(products,t.products);});
        if(found)return found.id;
        var incoming=normProducts(products).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\n');
        found=list.find(function(t){
          var current=normProducts(t.products).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\n');
          return current&&current===incoming;
        });
        if(found)return found.id;
        throw new Error('Не удалось определить шаблон каталога. Обновите шаблоны меню.');
      }
      window.db.rpc=function(fn,args,options){
        if(fn!=='create_venue_for_manager'||!args||!args.p_products)return originalRpc(fn,args,options);
        return resolveTemplateId(args.p_products).then(function(templateId){
          return originalRpc('create_venue_from_template',{p_template_id:templateId,p_name:args.p_name,p_slug:args.p_slug,p_plan:args.p_plan||'start',p_subscription_end:args.p_subscription_end},options);
        });
      };
    }catch(e){console.warn('[QR Manager] canonical venue RPC patch:',e);}
  }

  function patchVue(Vue){
    if(!Vue||typeof Vue.createApp!=='function'||Vue.__QR_MANAGER_PATCH_V19__)return;
    Vue.__QR_MANAGER_PATCH_V19__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      if(options&&typeof options==='object'){
        options.computed=options.computed||{};
        options.computed.canCreateVenue=function(){
          var p=this.plans&&this.plans.find(function(x){return x.id==='start'});
          return this.myVenues.length<(p?p.max_venues:1);
        };
        options.methods=options.methods||{};
        var previousCreateVenue=options.methods.createVenue;
        options.methods.createVenue=function(){return previousCreateVenue?previousCreateVenue.apply(this,arguments):undefined;};
      }
      var app=original.apply(this,arguments),originalMount=app.mount;
      app.mount=function(){var result=originalMount.apply(this,arguments);publish(this);return result;};
      return app;
    };
  }

  function ingredientControls(){
    if(window.__QR_MANAGER_INGREDIENT_CONTROLS_V4__)return;
    window.__QR_MANAGER_INGREDIENT_CONTROLS_V4__=true;

    var style=document.createElement('style');
    style.textContent='\
      .qr-ingredient-actions{display:flex!important;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-left:auto;padding-left:10px}\
      .qr-ingredient-actions button{display:inline-flex!important;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#eef2ff;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:11px;line-height:1}\
      .qr-ingredient-actions .qr-edit{color:#8fc7ff}\
      .qr-ingredient-actions .qr-delete{color:#ff9a9a}\
      .qr-ingredient-actions .qr-add{color:#7ee7a8}\
      .qr-ingredient-edit-back{position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:16px}\
      .qr-ingredient-edit-box{width:min(440px,calc(100vw - 32px));background:#151922;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.5)}\
      .qr-ingredient-edit-box h3{margin:0 0 14px}\
      .qr-ingredient-edit-box label{display:block;margin:10px 0 5px;font-size:12px;color:#aab4c5}\
      .qr-ingredient-edit-box input,.qr-ingredient-edit-box select{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#0e1117;color:#fff}\
      .qr-ingredient-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}\
      .qr-ingredient-edit-actions button{padding:9px 13px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer}\
      .qr-ingredient-edit-actions .primary{background:#2d7ff9;color:#fff;border-color:#2d7ff9}\
      .qr-ingredient-edit-actions .danger{background:#7f1d1d;color:#fff;border-color:#7f1d1d}\
    ';
    document.head.appendChild(style);

    function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
    function venueId(){try{return localStorage.getItem('manager_venue_id')||localStorage.getItem('selectedVenueId')||'';}catch(e){return ''}}
    function notify(text,error){
      try{
        if(window.__managerRecipeMsg) { window.__managerRecipeMsg(text,error); return; }
      }catch(e){}
      console[error?'error':'log']('[QR Manager] '+text);
    }
    function unitOptions(selected){
      var units=[['g','г'],['kg','кг'],['ml','мл'],['l','л'],['pcs','шт']];
      return units.map(function(u){return '<option value="'+u[0]+'" '+(u[0]===selected?'selected':'')+'>'+u[1]+'</option>';}).join('');
    }
    function closeEditor(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}
    function localRefresh(){
      var id=venueId();
      if(!id)return;
      window.dispatchEvent(new CustomEvent('manager-venue-selected',{detail:{id:id}}));
    }

    function editLocal(item){
      var back=document.createElement('div');
      back.className='qr-ingredient-edit-back';
      back.innerHTML='<div class="qr-ingredient-edit-box">\
        <h3>Изменить ингредиент</h3>\
        <label>Название</label><input id="qri-name" value="'+esc(item.name)+'">\
        <label>Единица измерения</label><select id="qri-unit">'+unitOptions(item.unit||'g')+'</select>\
        <label>Закупочное количество</label><input id="qri-qty" type="number" min="0.001" step="0.001" value="'+Number(item.purchase_quantity||1)+'">\
        <label>Закупочная цена</label><input id="qri-price" type="number" min="0" step="0.01" value="'+Number(item.purchase_price||0)+'">\
        <div class="qr-ingredient-edit-actions"><button type="button" id="qri-cancel">Отмена</button><button type="button" class="primary" id="qri-save">Сохранить</button></div>\
      </div>';
      document.body.appendChild(back);
      back.querySelector('#qri-cancel').onclick=function(){closeEditor(back);};
      back.onclick=function(e){if(e.target===back)closeEditor(back);};
      back.querySelector('#qri-save').onclick=function(){
        var name=back.querySelector('#qri-name').value.trim();
        var unit=back.querySelector('#qri-unit').value;
        var qty=Number(back.querySelector('#qri-qty').value);
        var price=Number(back.querySelector('#qri-price').value);
        if(!name){notify('Введите название ингредиента.',true);return;}
        if(!(qty>0)){notify('Закупочное количество должно быть больше нуля.',true);return;}
        if(!Number.isFinite(price)||price<0){notify('Некорректная закупочная цена.',true);return;}
        var btn=this;btn.disabled=true;
        window.db.rpc('manager_ingredient_upsert',{p_venue_id:venueId(),p_name:name,p_unit:unit,p_purchase_quantity:qty,p_purchase_price:price,p_id:item.id})
          .then(function(){closeEditor(back);notify('Ингредиент изменён.');setTimeout(localRefresh,200);})
          .catch(function(e){btn.disabled=false;notify('Ошибка изменения: '+(e.message||e),true);});
      };
    }

    function deleteLocal(item){
      if(!window.confirm('Удалить ингредиент «'+item.name+'»?\n\nЕсли он используется в рецептуре, база данных не позволит удалить его.'))return;
      window.db.rpc('manager_ingredient_delete',{p_venue_id:venueId(),p_ingredient_id:item.id})
        .then(function(){notify('Ингредиент удалён.');setTimeout(localRefresh,200);})
        .catch(function(e){notify('Не удалось удалить ингредиент: '+(e.message||e),true);});
    }

    function editGlobal(item){
      var back=document.createElement('div');
      back.className='qr-ingredient-edit-back';
      back.innerHTML='<div class="qr-ingredient-edit-box">\
        <h3>Изменить глобальный ингредиент</h3>\
        <label>Название</label><input id="qrg-name" value="'+esc(item.name)+'">\
        <label>Единица измерения</label><select id="qrg-unit">'+unitOptions(item.unit||'g')+'</select>\
        <label>Категория</label><input id="qrg-cat" value="'+esc(item.category||'')+'">\
        <div class="qr-ingredient-edit-actions"><button type="button" id="qrg-cancel">Отмена</button><button type="button" class="primary" id="qrg-save">Сохранить</button></div>\
      </div>';
      document.body.appendChild(back);
      back.querySelector('#qrg-cancel').onclick=function(){closeEditor(back);};
      back.onclick=function(e){if(e.target===back)closeEditor(back);};
      back.querySelector('#qrg-save').onclick=function(){
        var name=back.querySelector('#qrg-name').value.trim();
        var unit=back.querySelector('#qrg-unit').value;
        var category=back.querySelector('#qrg-cat').value.trim();
        if(!name){notify('Введите название ингредиента.',true);return;}
        var btn=this;btn.disabled=true;
        window.db.rpc('manager_global_ingredient_update',{p_id:item.id,p_name:name,p_unit:unit,p_category:category})
          .then(function(){closeEditor(back);notify('Глобальный ингредиент изменён.');setTimeout(refreshGlobal,250);})
          .catch(function(e){btn.disabled=false;notify('Ошибка изменения: '+(e.message||e),true);});
      };
    }

    function deleteGlobal(item){
      if(!window.confirm('Удалить глобальный ингредиент «'+item.name+'»?\n\nЕсли он используется в стандартных техкартах, база данных не позволит удалить его.'))return;
      window.db.rpc('manager_global_ingredient_delete',{p_id:item.id})
        .then(function(){notify('Глобальный ингредиент удалён.');setTimeout(refreshGlobal,250);})
        .catch(function(e){notify('Не удалось удалить ингредиент: '+(e.message||e),true);});
    }

    function addGlobal(item){
      var id=venueId();if(!id){notify('Не выбрано заведение.',true);return;}
      window.db.rpc('manager_ingredient_upsert',{p_venue_id:id,p_name:item.name,p_unit:item.unit,p_purchase_quantity:1,p_purchase_price:0,p_id:null})
        .then(function(){notify('Ингредиент добавлен в ингредиенты заведения.');setTimeout(localRefresh,200);})
        .catch(function(e){notify('Не удалось добавить ингредиент: '+(e.message||e),true);});
    }

    function fetchLocal(cb){
      var id=venueId();if(!id){cb([]);return;}
      window.db.rpc('manager_ingredient_list',{p_venue_id:id}).then(function(data){cb(Array.isArray(data)?data:[]);}).catch(function(e){console.warn('[QR Manager] local ingredients:',e);cb([]);});
    }
    function fetchGlobal(cb){
      window.db.from('global_ingredient_catalog').select('id,name,unit,category').eq('is_active',true).order('name').then(function(res){cb(res.error?[]:(res.data||[]));}).catch(function(e){console.warn('[QR Manager] global ingredients:',e);cb([]);});
    }

    function enhanceLocal(){
      var root=document.getElementById('ingredients');if(!root)return;
      var domRows=[].slice.call(root.querySelectorAll('.ingredient-row'));if(!domRows.length)return;
      fetchLocal(function(list){
        domRows.forEach(function(row){
          if(row.querySelector('.qr-ingredient-actions'))return;
          var nameEl=row.querySelector('b');if(!nameEl)return;
          var name=(nameEl.textContent||'').trim();
          var item=list.find(function(x){return String(x.name||'').trim()===name;});
          if(!item)return;
          var actions=document.createElement('div');actions.className='qr-ingredient-actions';
          var edit=document.createElement('button');edit.type='button';edit.className='qr-edit';edit.textContent='Изменить';edit.onclick=function(e){e.preventDefault();e.stopPropagation();editLocal(item);};
          var del=document.createElement('button');del.type='button';del.className='qr-delete';del.textContent='Удалить';del.onclick=function(e){e.preventDefault();e.stopPropagation();deleteLocal(item);};
          actions.appendChild(edit);actions.appendChild(del);row.appendChild(actions);
        });
      });
    }

    function refreshGlobal(){enhanceGlobal();}
    function enhanceGlobal(){
      var root=document.getElementById('ingredientsDbList');if(!root)return;
      var domRows=[].slice.call(root.querySelectorAll('.ingredient-row'));if(!domRows.length)return;
      fetchGlobal(function(list){
        domRows.forEach(function(row){
          var old=row.querySelector('.qr-global-controls');if(old)old.remove();
          var nameEl=row.querySelector('b');if(!nameEl)return;
          var name=(nameEl.textContent||'').trim();
          var item=list.find(function(x){return String(x.name||'').trim()===name;});if(!item)return;
          var actions=document.createElement('div');actions.className='qr-ingredient-actions qr-global-controls';
          var add=document.createElement('button');add.type='button';add.className='qr-add';add.textContent='Добавить';add.onclick=function(e){e.preventDefault();e.stopPropagation();addGlobal(item);};
          var edit=document.createElement('button');edit.type='button';edit.className='qr-edit';edit.textContent='Изменить';edit.onclick=function(e){e.preventDefault();e.stopPropagation();editGlobal(item);};
          var del=document.createElement('button');del.type='button';del.className='qr-delete';del.textContent='Удалить';del.onclick=function(e){e.preventDefault();e.stopPropagation();deleteGlobal(item);};
          actions.appendChild(add);actions.appendChild(edit);actions.appendChild(del);row.appendChild(actions);
        });
      });
    }

    function enhance(){enhanceLocal();enhanceGlobal();}
    var observer=new MutationObserver(function(){enhance();});
    observer.observe(document.body,{childList:true,subtree:true});
    setInterval(enhance,1200);
    enhance();
  }

  function init(){
    try{if(window.Vue)patchVue(window.Vue);}catch(e){console.warn('[QR Menu] Vue patch:',e);}
    patchDb();setTimeout(patchDb,0);setTimeout(patchDb,100);setTimeout(patchDb,500);
    setTimeout(ingredientControls,250);
    setTimeout(ingredientControls,1000);
  }
  init();

  function load(src,key){
    if(document.querySelector('script['+key+']'))return;
    var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(key,'1');
    s.onerror=function(){console.error('[QR Manager] failed to load '+src);};
    document.head.appendChild(s);
  }

  load('/js/manager-hall.js?v=5','data-manager-hall-single-v19');
  load('/js/manager-subscription-owner.js?v=6','data-manager-subscription-owner-v19');
  load('/js/manager-create-venue-flow.js?v=10','data-manager-create-venue-flow-v19');
  load('/js/manager-personnel-final.js?v=6','data-manager-personnel-final-v19');
  load('/js/manager-payment-settings.js?v=1','data-manager-payment-settings-v19');
  load('/js/manager-permissions-bridge.js?v=2','data-manager-permissions-bridge-v19');
  load('/js/manager-site-import.js?v=2','data-manager-site-import-v19');
  load('/js/manager-instruction-tab-v2.js?v=6','data-manager-instruction-tab-v6');
})();
