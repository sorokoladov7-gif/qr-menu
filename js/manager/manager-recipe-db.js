/* QR Menu — QRChick recipe/ingredient catalog backed by Supabase. */
(function(){
  'use strict';
  if(window.__QR_RECIPE_DB__)return;
  window.__QR_RECIPE_DB__=true;

  var section='';
  var searchTimer=null;
  var stateRef=function(){return window.__QR_MANAGER_RECIPES_STATE__||{};};
  var HIDDEN_RECIPE_KEY='qrchick_hidden_recipes_venue';
  var HIDDEN_ING_KEY='qrchick_hidden_ingredients_venue';

  function st(){return stateRef();}
  function norm(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim();}
  function products(){return (st().products||[]).map(function(x){return x&&x.name;}).filter(Boolean).slice(0,300);}
  function currentProductName(){var s=st(),p=(s.products||[]).find(function(x){return x.id===s.selected;});return p&&p.name||'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c];});}
  function root(){return document.querySelector('.recipe-tab-container[data-qr-sections="1"]')||document.querySelector('.recipe-tab-container');}
  function activeSection(){var r=root();if(!r)return section;var b=r.querySelector('.qr-recipe-subnav [data-section].on,.qr-recipe-subnav [data-section][aria-selected="true"]');return b?String(b.getAttribute('data-section')||''):section;}
  function remember(sectionName,id){var key=sectionName==='catalog'?HIDDEN_RECIPE_KEY:HIDDEN_ING_KEY;var venue=st().venueId||'none';var all={};try{all=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){all={};}all[venue]=Array.isArray(all[venue])?all[venue]:[];if(all[venue].indexOf(id)<0)all[venue].push(id);localStorage.setItem(key,JSON.stringify(all));}
  function remembered(sectionName,id){var key=sectionName==='catalog'?HIDDEN_RECIPE_KEY:HIDDEN_ING_KEY;var venue=st().venueId||'none';try{var all=JSON.parse(localStorage.getItem(key)||'{}')||{};return Array.isArray(all[venue])&&all[venue].indexOf(id)>=0;}catch(_){return false;}}
  function rpc(name,args){if(!window.db||typeof db.rpc!=='function')return Promise.reject(new Error('База данных недоступна'));return db.rpc(name,args).then(function(r){if(r.error)throw r.error;return r.data||[];});}
  function safeError(){return 'Ошибка системы. Обратитесь к администратору платформы.';}
  function setStatus(text,error){var e=document.getElementById('qrReceptAiStatus');if(e){e.textContent=text;e.style.color=error?'#fca5a5':'';}}
  function showSection(name){var r=root();if(!r)return;section=name;sessionStorage.setItem('qr_recipe_section',name);r.querySelectorAll('.qr-recipe-section').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-section')===name);});r.querySelectorAll('.qr-recipe-subnav [data-section]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-section')===name);x.setAttribute('aria-selected',String(x.getAttribute('data-section')===name));});if(name==='catalog')loadCatalog();if(name==='ingredients')loadIngredients();}
  function recipeSearch(names,limit){var s=st();if(!s.venueId)return Promise.resolve([]);return rpc('manager_recipe_catalog_for_venue',{p_venue_id:s.venueId,p_product_names:names,p_limit:limit||80}).then(function(rows){return Array.isArray(rows)?rows.filter(function(r){return !remembered('catalog',r.recipe_id);}):[];});}
  function ingredientSearch(names,limit){var s=st();if(!s.venueId)return Promise.resolve([]);return rpc('manager_ingredient_catalog_for_venue',{p_venue_id:s.venueId,p_product_names:names,p_limit:limit||160}).then(function(rows){return Array.isArray(rows)?rows.filter(function(r){return !remembered('ingredients',r.id);}):[];});}
  function selectedNames(query){var q=String(query||'').trim();if(q)return [q];return products();}

  function recipeRemove(id,name){var s=st();if(!s.venueId||!id)return;setStatus('Убираем «'+name+'» из предложений Qrchick для этого заведения…',false);rpc('manager_recipe_catalog_hide_for_venue',{p_venue_id:s.venueId,p_recipe_id:id}).then(function(){remember('catalog',id);loadCatalog();setStatus('Рецептура убрана из каталога этого заведения.',false);}).catch(function(e){console.error('[Qrchick Recipe DB] hide recipe',e);setStatus(safeError(),true);});}
  function ingredientRemove(id,name){var s=st();if(!s.venueId||!id)return;setStatus('Убираем «'+name+'» из предложений Qrchick для этого заведения…',false);rpc('manager_ingredient_catalog_hide_for_venue',{p_venue_id:s.venueId,p_ingredient_id:id}).then(function(){remember('ingredients',id);loadIngredients();setStatus('Ингредиент убран из каталога этого заведения.',false);}).catch(function(e){console.error('[Qrchick Ingredient DB] hide ingredient',e);setStatus(safeError(),true);});}

  function num(v){return v==null||v===''?'':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});}
  function minutes(v){return v==null||v===''?'':num(v)+' мин';}
  function temp(v){return v==null||v===''?'':num(v)+' °C';}
  function stepsArray(v){return Array.isArray(v)?v:[];}
  function stepText(v){
    if(typeof v==='string')return v;
    if(v&&typeof v==='object'){
      if(typeof v.text==='string')return v.text;
      if(v.text&&typeof v.text==='object')return v.text.ru||v.text.en||v.text.text||'';
      if(typeof v.description==='string')return v.description;
      if(v.description&&typeof v.description==='object')return v.description.ru||v.description.en||'';
      if(typeof v.instruction==='string')return v.instruction;
      if(v.instruction&&typeof v.instruction==='object')return v.instruction.ru||v.instruction.en||'';
    }
    return String(v||'');
  }
  function stepMinutes(v){return v&&v.minutes!=null?minutes(v.minutes):'';}

  function renderTechSteps(steps){
    if(!steps.length)return '<div class="muted">Технология приготовления не заполнена.</div>';
    return '<ol style="margin:0;padding-left:22px;display:grid;gap:7px">'+steps.map(function(s){var text=stepText(s),tm=stepMinutes(s);return '<li><span>'+esc(text)+'</span>'+(tm?'<span class="muted" style="margin-left:6px;font-size:10px">('+esc(tm)+')</span>':'')+'</li>';}).join('')+'</ol>';
  }

  function renderTechMeta(r){
    var cells=[];
    if(r.yield_quantity!=null)cells.push(['Выход',num(r.yield_quantity)+' '+esc(r.yield_unit||'')]);
    if(r.base_servings!=null)cells.push(['Порции',num(r.base_servings)]);
    if(r.prep_minutes!=null)cells.push(['Подготовка',minutes(r.prep_minutes)]);
    if(r.cook_minutes!=null)cells.push(['Приготовление',minutes(r.cook_minutes)]);
    if(r.cooking_temperature_c!=null)cells.push(['Температура',temp(r.cooking_temperature_c)]);
    if(r.finishing_temperature_c!=null)cells.push(['Финиш',temp(r.finishing_temperature_c)]);
    if(r.serving_temperature_c!=null)cells.push(['Подача',temp(r.serving_temperature_c)]);
    if(r.holding_temperature_c!=null)cells.push(['Выдача/хранение',temp(r.holding_temperature_c)]);
    if(r.storage_temperature_c!=null)cells.push(['Хранение',temp(r.storage_temperature_c)+(r.storage_hours!=null?' · '+num(r.storage_hours)+' ч':'')]);
    if(r.shelf_life_hours!=null)cells.push(['Срок реализации',num(r.shelf_life_hours)+' ч']);
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:7px;margin-top:10px">'+cells.map(function(x){return '<div style="padding:8px 9px;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:rgba(255,255,255,.02)"><div class="muted" style="font-size:10px">'+esc(x[0])+'</div><div style="font-size:12px;font-weight:600;margin-top:2px">'+x[1]+'</div></div>';}).join('')+'</div>';
  }

  function renderIngredients(ingredients){
    if(!ingredients.length)return '<div class="muted">Ингредиенты не заполнены.</div>';
    return '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid rgba(255,255,255,.08)">Ингредиент</th><th style="text-align:right;padding:6px;border-bottom:1px solid rgba(255,255,255,.08)">Брутто</th><th style="text-align:right;padding:6px;border-bottom:1px solid rgba(255,255,255,.08)">Нетто</th><th style="text-align:right;padding:6px;border-bottom:1px solid rgba(255,255,255,.08)">Потери</th></tr></thead><tbody>'+ingredients.map(function(x){var unit=x.unit||'';var gross=x.gross_quantity!=null?num(x.gross_quantity)+' '+esc(unit):'—';var net=x.net_quantity!=null?num(x.net_quantity)+' '+esc(unit):(x.quantity!=null?num(x.quantity)+' '+esc(unit):'—');var loss=x.loss_percent!=null?num(x.loss_percent)+' %':'—';return '<tr><td style="padding:6px;border-bottom:1px solid rgba(255,255,255,.05)"><b>'+esc(x.name||'')+'</b>'+(x.note||x.preparation_note?'<div class="muted" style="font-size:10px;margin-top:2px">'+esc(x.preparation_note||x.note)+'</div>':'')+'</td><td style="padding:6px;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">'+gross+'</td><td style="padding:6px;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">'+net+'</td><td style="padding:6px;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">'+loss+'</td></tr>';}).join('')+'</tbody></table></div>';
  }

  function renderRecipeRows(rows){
    var box=document.getElementById('catalogList');
    if(!box)return;
    var html='<div style="display:grid;gap:10px">';
    if(!rows.length){
      html+='<div class="muted">Qrchick не нашёл подходящих рецептур для меню этого заведения.</div>';
    }else{
      html+='<div class="muted" style="font-size:11px">Рецептуры загружаются из общей БД только по меню текущего заведения. Полный глобальный каталог в браузер не выгружается.</div>';
      html+=rows.map(function(r){
        var ing=Array.isArray(r.ingredients)?r.ingredients:[];
        var steps=stepsArray(r.steps);
        var timing=[minutes(r.prep_minutes),minutes(r.cook_minutes)].filter(Boolean).join(' + ');
        return '<details style="padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.01)">'+
          '<summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:10px;align-items:flex-start">'+
            '<span><b>'+esc(r.recipe_name||'Рецептура')+'</b><span class="muted" style="display:block;font-size:11px;margin-top:4px">'+esc([r.category,r.cuisine,r.difficulty].filter(Boolean).join(' · '))+(timing?' · '+esc(timing):'')+'</span><span class="muted" style="display:block;font-size:10px;margin-top:3px">Совпадение меню: '+esc(r.matched_product_name||'')+'</span></span>'+ 
            '<button type="button" class="btn btn-danger btn-sm" data-qr-remove-recipe="'+esc(r.recipe_id)+'" data-name="'+esc(r.recipe_name||'')+'">Удалить</button>'+
          '</summary>'+
          '<div style="margin-top:12px">'+
            (r.description?'<div style="font-size:12px;line-height:1.5;margin-bottom:10px">'+esc(r.description)+'</div>':'')+
            renderTechMeta(r)+
            '<div style="display:grid;gap:10px;margin-top:12px">'+
              '<section><div style="font-weight:700;font-size:12px;margin-bottom:6px">Ингредиенты</div>'+renderIngredients(ing)+'</section>'+ 
              '<section><div style="font-weight:700;font-size:12px;margin-bottom:6px">Технология приготовления</div><div style="font-size:12px;line-height:1.5">'+esc(r.technology||'')+'</div><div style="margin-top:8px">'+renderTechSteps(steps)+'</div></section>'+ 
              (r.equipment?'<section><div style="font-weight:700;font-size:12px;margin-bottom:5px">Оборудование и инвентарь</div><div class="muted" style="font-size:11px">'+esc(r.equipment)+'</div></section>':'')+
              (r.serving_description?'<section><div style="font-weight:700;font-size:12px;margin-bottom:5px">Подача</div><div class="muted" style="font-size:11px">'+esc(r.serving_description)+'</div></section>':'')+
              (r.plating_description?'<section><div style="font-weight:700;font-size:12px;margin-bottom:5px">Оформление</div><div class="muted" style="font-size:11px">'+esc(r.plating_description)+'</div></section>':'')+
              (r.quality_requirements?'<section><div style="font-weight:700;font-size:12px;margin-bottom:5px">Требования к качеству</div><div class="muted" style="font-size:11px">'+esc(r.quality_requirements)+'</div></section>':'')+
              (r.allergen_notes?'<section><div style="font-weight:700;font-size:12px;margin-bottom:5px">Аллергены/примечания</div><div class="muted" style="font-size:11px">'+esc(r.allergen_notes)+'</div></section>':'')+
            '</div>'+ 
          '</div>'+ 
        '</details>';
      }).join('');
    }
    html+='</div>';
    box.innerHTML=html;
    Array.prototype.forEach.call(box.querySelectorAll('[data-qr-remove-recipe]'),function(b){
      b.onclick=function(e){if(e&&e.stopPropagation)e.stopPropagation();recipeRemove(b.getAttribute('data-qr-remove-recipe'),b.getAttribute('data-name')||'рецептуру');};
    });
  }

  function renderIngredientRows(rows){var box=document.getElementById('ingredientsDbList');if(!box)return;var html='<div style="display:grid;gap:6px">';if(!rows.length){html+='<div class="muted">Qrchick не нашёл ингредиентов, связанных с меню этого заведения.</div>';}else{html+='<div class="muted" style="font-size:11px">Показаны только ингредиенты из найденных рецептур текущего меню.</div>';html+=rows.map(function(r){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid rgba(255,255,255,.07);border-radius:9px;align-items:center"><span><b>'+esc(r.name)+'</b>'+(r.matched_recipe_name?' <span class="muted">· '+esc(r.matched_recipe_name)+'</span>':'')+'<span class="muted" style="display:block;font-size:10px">'+esc(r.category||'')+'</span></span><div style="display:flex;gap:7px;align-items:center"><span class="muted">'+esc(r.unit||'')+'</span><button type="button" class="btn btn-danger btn-sm" data-qr-remove-ingredient="'+esc(r.id)+'" data-name="'+esc(r.name||'')+'">Удалить</button></div></div>';}).join('');}html+='</div>';box.innerHTML=html;Array.prototype.forEach.call(box.querySelectorAll('[data-qr-remove-ingredient]'),function(b){b.onclick=function(){ingredientRemove(b.getAttribute('data-qr-remove-ingredient'),b.getAttribute('data-name')||'ингредиент');};});}

  function loadCatalog(query){var names=selectedNames(query);if(!names.length){renderRecipeRows([]);return;}setStatus('Qrchick ищет рецептуры в базе данных только по меню этого заведения…',false);recipeSearch(names,100).then(function(rows){renderRecipeRows(rows);setStatus(rows.length?'Найдено '+rows.length+' подходящих рецептур в БД.':'Подходящих рецептур в БД не найдено.',false);}).catch(function(e){console.error('[Qrchick Recipe DB]',e);renderRecipeRows([]);setStatus(safeError(),true);});}
  function loadIngredients(query){var names=selectedNames(query);if(!names.length){renderIngredientRows([]);return;}setStatus('Qrchick ищет ингредиенты в базе данных по найденным рецептурам этого меню…',false);ingredientSearch(names,180).then(function(rows){renderIngredientRows(rows);setStatus(rows.length?'Найдено '+rows.length+' ингредиентов в БД.':'Подходящих ингредиентов в БД не найдено.',false);}).catch(function(e){console.error('[Qrchick Ingredient DB]',e);renderIngredientRows([]);setStatus(safeError(),true);});}

  function searchQuery(query){var names=selectedNames(query);if(!names.length)return Promise.resolve([]);return recipeSearch(names,60).then(function(results){return results.map(function(r){var ing=Array.isArray(r.ingredients)?r.ingredients:[];return{title:r.recipe_name||'Рецептура',url:'',snippet:[r.category,r.cuisine,r.description,ing.slice(0,8).map(function(x){return x.name+' '+(x.quantity==null?'':x.quantity)+' '+(x.unit||'');}).join(', ')].filter(Boolean).join(' · '),source:'QRChick DB',recipe:r};});});}

  function interceptLegacyCatalogState(){var s=st();if(!s)return;s.catalogLoaded=true;s.catalogLoading=false;s.catalog=[];s.catalogItems=[];s.globalIngredientsLoaded=true;s.globalIngredientsLoading=false;s.globalIngredients=[];}
  function bindSectionClicks(){var r=root();if(!r||r.__qrDbCapture)return;r.__qrDbCapture=true;r.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.qr-recipe-subnav [data-section]');if(!b)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();showSection(String(b.getAttribute('data-section')||'recipes'));},true);}
  function bindSearchInputs(){var c=document.getElementById('catalogSearch'),i=document.getElementById('ingredientsSearch');if(c&&!c.__qrDbBound){c.__qrDbBound=true;c.oninput=function(){clearTimeout(searchTimer);var q=this.value;searchTimer=setTimeout(function(){loadCatalog(q);},180);};}if(i&&!i.__qrDbBound){i.__qrDbBound=true;i.oninput=function(){clearTimeout(searchTimer);var q=this.value;searchTimer=setTimeout(function(){loadIngredients(q);},180);};}}
  function bindGlobal(){bindSectionClicks();bindSearchInputs();interceptLegacyCatalogState();}

  function patchFetch(){if(window.__QR_RECIPE_DB_FETCH__)return;var original=window.fetch;if(typeof original!=='function')return;window.__QR_RECIPE_DB_FETCH__=true;window.fetch=function(input,init){try{var url=typeof input==='string'?input:(input&&input.url)||'';if(!/\/api\/manager-ai(?:\?|$)/.test(url)||!init||String(init.method||'GET').toUpperCase()!=='POST')return original.apply(this,arguments);var body=JSON.parse(String(init.body||'{}'));if(body.feature!=='recipes')return original.apply(this,arguments);if(body.mode==='web_search'){return searchQuery(body.query||body.message).then(function(results){return new Response(JSON.stringify({ok:true,feature:'recipes',query:body.query||body.message,results:results,source:'supabase'}),{status:200,headers:{'Content-Type':'application/json'}});}).catch(function(){return new Response(JSON.stringify({ok:true,feature:'recipes',query:body.query||body.message,results:[],source:'supabase'}),{status:200,headers:{'Content-Type':'application/json'}});});}
        var ctx={};try{ctx=typeof body.context==='string'?JSON.parse(body.context||'{}'):(body.context||{});}catch(_){ctx={};}
        var pname=ctx.product&&ctx.product.name||currentProductName();
        if(!pname||!['catalog','ingredients'].includes(activeSection()))return Promise.resolve(new Response(JSON.stringify({ok:true,feature:'recipes',answer:'Откройте блок «База блюд» или «Ингредиенты», чтобы Qrchick выполнил поиск по базе данных текущего заведения.',actions:[],source:'supabase'}),{status:200,headers:{'Content-Type':'application/json'}}));
        return recipeSearch([pname],40).then(function(rows){var local=Array.isArray(ctx.ingredients&&ctx.ingredients.items)?ctx.ingredients.items:st().ingredients||[];var by=function(name){var n=norm(name),exact=local.find(function(x){return norm(x.name)===n;});if(exact)return exact;return local.find(function(x){var z=norm(x.name);return z&&n&&(z.indexOf(n)>=0||n.indexOf(z)>=0);});};var hit=rows[0],ings=hit&&Array.isArray(hit.ingredients)?hit.ingredients:[];var mapped=ings.map(function(x){var m=by(x.name);return m?{ingredient_id:m.id,quantity:Number(x.quantity)||0,note:'Общая база рецептур'}:null;}).filter(Boolean);return new Response(JSON.stringify({ok:true,feature:'recipes',answer:hit?'Найдена рецептура в базе данных. Проверьте состав перед сохранением.':'В базе данных подходящая рецептура не найдена.',actions:hit&&mapped.length?[{type:'save_recipe',title:'Применить найденную рецептуру',reason:'Источник: внутренняя база рецептур QR Menu.',payload:{product_id:ctx.product&&ctx.product.id||st().selected,rows:mapped}}]:[],source:'supabase'}),{status:200,headers:{'Content-Type':'application/json'}});}).catch(function(){return new Response(JSON.stringify({ok:true,feature:'recipes',answer:safeError(),actions:[],source:'supabase'}),{status:200,headers:{'Content-Type':'application/json'}});});
      }catch(e){return original.apply(this,arguments);} };}

  function boot(){patchFetch();bindGlobal();setInterval(bindGlobal,700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
