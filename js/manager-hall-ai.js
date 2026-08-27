/* QR Menu — manager compatibility bootstrap v18. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_BOOTSTRAP_V18__) return;
  window.__QR_MANAGER_HALL_BOOTSTRAP_V18__=true;

  function publish(app){
    try{
      window.__QR_MANAGER_VUE_APP__=app;
      window.__managerVue=(app&&app._instance&&app._instance.proxy)||null;
      window.dispatchEvent(new CustomEvent('qr-manager-vue-ready'));
    }catch(e){console.warn('[QR Menu] publish Vue:',e);}
  }

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
        var list=r.data||[],found=list.find(function(t){return sameTemplateProducts(products,t.products);});
        if(found)return found.id;
        var incoming=normProducts(products).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\\n');
        found=list.find(function(t){var current=normProducts(t.products).map(function(x){return x.name+'|'+x.price+'|'+x.category;}).sort().join('\\n');return current&&current===incoming;});
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
    if(!Vue||typeof Vue.createApp!=='function'||Vue.__QR_MANAGER_PATCH_V18__)return;
    Vue.__QR_MANAGER_PATCH_V18__=true;
    var original=Vue.createApp;
    Vue.createApp=function(options){
      if(options&&typeof options==='object'){
        options.computed=options.computed||{};
        options.computed.canCreateVenue=function(){var p=this.plans&&this.plans.find(function(x){return x.id==='start'});return this.myVenues.length<(p?p.max_venues:1);};
        options.methods=options.methods||{};
        var previousCreateVenue=options.methods.createVenue;
        options.methods.createVenue=function(){return previousCreateVenue?previousCreateVenue.apply(this,arguments):undefined;};
      }
      var app=original.apply(this,arguments),originalMount=app.mount;
      app.mount=function(){var result=originalMount.apply(this,arguments);publish(this);return result;};
      return app;
    };
  }

  function initIngredientEditor(){
    if(window.__QR_MANAGER_INGREDIENT_EDITOR_V3__)return;
    window.__QR_MANAGER_INGREDIENT_EDITOR_V3__=true;

    var style=document.createElement('style');
    style.textContent=
      '.qr-ing-actions{display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap}.qr-ing-actions button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);color:inherit;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px}.qr-ing-actions .edit{color:#8fc7ff}.qr-ing-actions .del{color:#ff8d8d}.qr-ing-actions .use{color:#6ee7b7}.qr-ing-editor-back{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:15px}.qr-ing-editor{width:min(430px,calc(100vw - 30px));background:#171a20;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.45)}.qr-ing-editor h3{margin:0 0 14px}.qr-ing-editor label{display:block;font-size:12px;opacity:.75;margin:10px 0 5px}.qr-ing-editor input,.qr-ing-editor select{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#0f1115;color:inherit}.qr-ing-editor .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.qr-ing-editor button{padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);cursor:pointer}.qr-ing-editor .primary{background:#2d7ff9;color:#fff;border-color:#2d7ff9}.qr-ing-editor .danger{background:#7f1d1d;color:#fff;border-color:#7f1d1d}.qr-ing-disabled{opacity:.5;cursor:not-allowed!important}.qr-global-row-actions{display:flex;gap:6px;align-items:center;margin-left:auto}
      +'.ingredient-row{justify-content:space-between;min-width:0}.ingredient-row>div:first-child{min-width:0}.ingredient-row .muted{white-space:nowrap}' ;
    document.head.appendChild(style);

    function getVenueId(){try{return localStorage.getItem('manager_venue_id')||localStorage.getItem('selectedVenueId')||''}catch(e){return ''}}
    function toast(text,error){var fn=window.__managerRecipeMsg||window.showToast;if(typeof fn==='function')try{fn(text,error);return}catch(e){}if(error)console.error(text);else console.log(text)}
    function refreshLocal(){var id=getVenueId();if(!id)return;window.dispatchEvent(new CustomEvent('manager-venue-selected',{detail:{id:id}}));}
    function closeEditor(back){if(back&&back.parentNode)back.remove()}
    function unitOptions(selected){return ['g','kg','ml','l','pcs'].map(function(u){var label={g:'г',kg:'кг',ml:'мл',l:'л',pcs:'шт'}[u];return '<option value="'+u+'" '+(u===selected?'selected':'')+'>'+label+'</option>'}).join('')}

    function openLocalEditor(item){
      var back=document.createElement('div');back.className='qr-ing-editor-back';
      back.innerHTML='<div class="qr-ing-editor"><h3>Редактировать ингредиент</h3><label>Название</label><input id="qrIngName"><label>Единица</label><select id="qrIngUnit">'+unitOptions(item.unit||'g')+'</select><label>Закупочное количество</label><input id="qrIngQty" type="number" min=".001" step=".001"><label>Закупочная цена</label><input id="qrIngPrice" type="number" min="0" step=".01"><div class="actions"><button type="button" id="qrIngCancel">Отмена</button><button type="button" class="primary" id="qrIngSave">Сохранить</button></div></div>';
      document.body.appendChild(back);
      back.querySelector('#qrIngName').value=item.name||'';
      back.querySelector('#qrIngUnit').value=item.unit||'g';
      back.querySelector('#qrIngQty').value=Number(item.purchase_quantity||1);
      back.querySelector('#qrIngPrice').value=Number(item.purchase_price||0);
      back.querySelector('#qrIngCancel').onclick=function(){closeEditor(back)};
      back.onclick=function(e){if(e.target===back)closeEditor(back)};
      back.querySelector('#qrIngSave').onclick=function(){
        var name=back.querySelector('#qrIngName').value.trim(),unit=back.querySelector('#qrIngUnit').value,qty=Number(back.querySelector('#qrIngQty').value),price=Number(back.querySelector('#qrIngPrice').value);
        if(!name){toast('Введите название ингредиента.',true);return}
        if(!(qty>0)){toast('Количество должно быть больше нуля.',true);return}
        if(!Number.isFinite(price)||price<0){toast('Некорректная цена.',true);return}
        var btn=this;btn.disabled=true;
        window.db.rpc('manager_ingredient_upsert',{p_venue_id:getVenueId(),p_name:name,p_unit:unit,p_purchase_quantity:qty,p_purchase_price:price,p_id:item.id})
        .then(function(){closeEditor(back);toast('Ингредиент изменён.');setTimeout(refreshLocal,150)})
        .catch(function(e){btn.disabled=false;toast('Ошибка изменения: '+(e.message||e),true)})
      };
    }

    function deleteLocal(item){
      if(!confirm('Удалить ингредиент «'+item.name+'»?\n\nЕсли он используется в рецептуре, база данных может запретить удаление.'))return;
      window.db.rpc('manager_ingredient_delete',{p_venue_id:getVenueId(),p_ingredient_id:item.id})
      .then(function(){toast('Ингредиент удалён.');setTimeout(refreshLocal,150)})
      .catch(function(e){toast('Не удалось удалить ингредиент: '+(e.message||e),true)})
    }

    function openGlobalEditor(item){
      var back=document.createElement('div');back.className='qr-ing-editor-back';
      back.innerHTML='<div class="qr-ing-editor"><h3>Редактировать ингредиент</h3><label>Название</label><input id="qrGlobalName"><label>Единица</label><select id="qrGlobalUnit">'+unitOptions(item.unit||'g')+'</select><label>Категория</label><input id="qrGlobalCategory" placeholder="Например: Овощи"><div class="actions"><button type="button" id="qrGlobalCancel">Отмена</button><button type="button" class="primary" id="qrGlobalSave">Сохранить</button></div></div>';
      document.body.appendChild(back);
      back.querySelector('#qrGlobalName').value=item.name||'';
      back.querySelector('#qrGlobalUnit').value=item.unit||'g';
      back.querySelector('#qrGlobalCategory').value=item.category||'';
      back.querySelector('#qrGlobalCancel').onclick=function(){closeEditor(back)};
      back.onclick=function(e){if(e.target===back)closeEditor(back)};
      back.querySelector('#qrGlobalSave').onclick=function(){
        var name=back.querySelector('#qrGlobalName').value.trim(),unit=back.querySelector('#qrGlobalUnit').value,category=back.querySelector('#qrGlobalCategory').value.trim();
        if(!name){toast('Введите название ингредиента.',true);return}
        var btn=this;btn.disabled=true;
        window.db.rpc('manager_global_ingredient_update',{p_id:item.id,p_name:name,p_unit:unit,p_category:category})
        .then(function(){closeEditor(back);toast('Глобальный ингредиент изменён.');setTimeout(enhanceGlobal,250)})
        .catch(function(e){btn.disabled=false;toast('Ошибка изменения: '+(e.message||e),true)})
      };
    }

    function deleteGlobal(item){
      if(!confirm('Удалить глобальный ингредиент «'+item.name+'»?\n\nЕсли он используется в стандартных рецептурах, удаление будет отклонено базой данных.'))return;
      window.db.rpc('manager_global_ingredient_delete',{p_id:item.id})
      .then(function(){toast('Глобальный ингредиент удалён.');setTimeout(enhanceGlobal,250)})
      .catch(function(e){toast('Не удалось удалить ингредиент: '+(e.message||e),true)})
    }

    function addGlobalToLocal(item){
      var id=getVenueId();if(!id)return;
      window.db.rpc('manager_ingredient_upsert',{p_venue_id:id,p_name:item.name,p_unit:item.unit,p_purchase_quantity:1,p_purchase_price:0,p_id:null})
      .then(function(){toast('Ингредиент добавлен в ингредиенты заведения.');setTimeout(refreshLocal,150)})
      .catch(function(e){toast('Не удалось добавить ингредиент: '+(e.message||e),true)})
    }

    function enhanceLocal(){
      var root=document.getElementById('ingredients');if(!root)return;
      var rows=Array.prototype.slice.call(root.querySelectorAll('.ingredient-row'));if(!rows.length)return;
      window.db.rpc('manager_ingredient_list',{p_venue_id:getVenueId()}).then(function(data){
        var list=Array.isArray(data)?data:[];
        rows.forEach(function(row){
          if(row.querySelector('.qr-ing-actions'))return;
          var nameEl=row.querySelector('b');if(!nameEl)return;
          var name=(nameEl.textContent||'').trim();
          var item=list.find(function(x){return String(x.name||'').trim()===name});if(!item)return;
          var actions=document.createElement('span');actions.className='qr-ing-actions';
          var edit=document.createElement('button');edit.className='edit';edit.type='button';edit.textContent='Изменить';edit.onclick=function(e){e.preventDefault();e.stopPropagation();openLocalEditor(item)};
          var del=document.createElement('button');del.className='del';del.type='button';del.textContent='Удалить';del.onclick=function(e){e.preventDefault();e.stopPropagation();deleteLocal(item)};
          actions.appendChild(edit);actions.appendChild(del);row.appendChild(actions);
        });
      }).catch(function(e){console.warn('[QR Manager] local ingredient controls:',e)})
    }

    function enhanceGlobal(){
      var root=document.getElementById('ingredientsDbList');if(!root)return;
      var rows=Array.prototype.slice.call(root.querySelectorAll('.ingredient-row'));if(!rows.length)return;
      window.db.from('global_ingredient_catalog').select('id,name,unit,category').eq('is_active',true).order('name').then(function(res){
        if(res.error)throw res.error;
        var list=res.data||[];
        rows.forEach(function(row){
          var old=row.querySelector('.qr-global-row-actions');if(old)old.remove();
          var nameEl=row.querySelector('b');if(!nameEl)return;
          var name=(nameEl.textContent||'').trim();
          var item=list.find(function(x){return String(x.name||'').trim()===name});if(!item)return;
          var actions=document.createElement('span');actions.className='qr-ing-actions qr-global-row-actions';
          var use=document.createElement('button');use.className='use';use.type='button';use.textContent='Добавить';use.title='Добавить в ингредиенты заведения';use.onclick=function(e){e.preventDefault();e.stopPropagation();addGlobalToLocal(item)};
          var edit=document.createElement('button');edit.className='edit';edit.type='button';edit.textContent='Изменить';edit.onclick=function(e){e.preventDefault();e.stopPropagation();openGlobalEditor(item)};
          var del=document.createElement('button');del.className='del';del.type='button';del.textContent='Удалить';del.onclick=function(e){e.preventDefault();e.stopPropagation();deleteGlobal(item)};
          actions.appendChild(use);actions.appendChild(edit);actions.appendChild(del);row.appendChild(actions);
        });
      }).catch(function(e){console.warn('[QR Manager] global ingredient controls:',e)})
    }

    function enhance(){enhanceLocal();enhanceGlobal()}
    var observer=new MutationObserver(function(){enhance()});observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(enhance,300);setTimeout(enhance,1200);setTimeout(enhance,2500);setTimeout(enhance,5000);
  }

  function init(){
    try{if(window.Vue)patchVue(window.Vue);}catch(e){console.warn('[QR Menu] Vue patch:',e);}
    patchDb();setTimeout(patchDb,0);setTimeout(patchDb,100);setTimeout(patchDb,500);
    setTimeout(initIngredientEditor,200);setTimeout(initIngredientEditor,1000);
  }
  init();

  function load(src,key){
    if(document.querySelector('script['+key+']'))return;
    var s=document.createElement('script');s.src=src;s.async=false;s.setAttribute(key,'1');s.onerror=function(){console.error('[QR Manager] failed to load '+src);};document.head.appendChild(s);
  }
  load('/js/manager-hall.js?v=5','data-manager-hall-single-v18');
  load('/js/manager-subscription-owner.js?v=6','data-manager-subscription-owner-v18');
  load('/js/manager-create-venue-flow.js?v=10','data-manager-create-venue-flow-v18');
  load('/js/manager-personnel-final.js?v=6','data-manager-personnel-final-v18');
  load('/js/manager-payment-settings.js?v=1','data-manager-payment-settings-v18');
  load('/js/manager-permissions-bridge.js?v=2','data-manager-permissions-bridge-v18');
  load('/js/manager-site-import.js?v=2','data-manager-site-import-v18');
  load('/js/manager-instruction-tab-v2.js?v=6','data-manager-instruction-tab-v6');
})();
