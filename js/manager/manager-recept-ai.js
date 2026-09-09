/* QRChick — canonical AI extension for the manager recipe workspace. */
(function(){
  'use strict';
  if (window.__QR_RECEPT_AI_LOADED__) return;
  window.__QR_RECEPT_AI_LOADED__ = true;

  var state = function(){ return window.__QR_MANAGER_RECIPES_STATE__ || {}; };
  var root = function(){ return document.querySelector('.recipe-tab-container[data-qr-sections="1"]') || document.querySelector('.recipe-tab-container'); };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>\"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]; }); };
  var norm = function(v){ return String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim(); };
  var status = function(t,e){ var a=document.getElementById('qrReceptAiStatus'), b=document.getElementById('ocrStatus'); if(a){a.textContent=t;a.style.color=e?'#fca5a5':'';} if(b && e){b.textContent=t;} };
  function rpc(name,args){
    if(!window.db) return Promise.reject(new Error('DB'));
    return window.db.rpc(name,args).then(function(r){ if(r.error) throw r.error; return r.data; });
  }
  function products(){ return (state().products || []).filter(function(x){ return x && x.id && x.name; }); }
  function product(id){ return products().find(function(x){ return String(x.id)===String(id); }) || null; }
  function localIngredient(name){
    var n=norm(name); if(!n) return null;
    return (state().ingredients || []).find(function(x){ var z=norm(x.name); return z===n || z.indexOf(n)>=0 || n.indexOf(z)>=0; }) || null;
  }
  function token(){
    return db.auth.getSession().then(function(r){
      if(r.error) throw r.error;
      var t=r.data && r.data.session && r.data.session.access_token;
      if(!t) throw new Error('AUTH');
      return t;
    });
  }
  function ai(mode,message,context,image){
    return token().then(function(t){
      return fetch('/api/manager-ai-propose',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({feature:'recipes',mode:mode,message:message||'',context:context||'',image:image||null})});
    }).then(function(r){ return r.json().then(function(d){ if(!r.ok || d.ok===false) throw new Error('AI'); return d; }); });
  }
  function catalog(names,limit){
    var s=state(); if(!s.venueId || !names || !names.length) return Promise.resolve([]);
    return rpc('manager_recipe_catalog_for_venue',{p_venue_id:s.venueId,p_product_names:names,p_limit:limit||60});
  }
  function ingredientCatalog(names,limit){
    var s=state(); if(!s.venueId || !names || !names.length) return Promise.resolve([]);
    return rpc('manager_ingredient_catalog_for_venue',{p_venue_id:s.venueId,p_product_names:names,p_limit:limit||250});
  }
  function recipeMatchResult(d){
    var r=d && d.result && typeof d.result==='object' ? d.result : {};
    return {selected_recipe_id:r.selected_recipe_id||null,confidence:Math.max(0,Math.min(1,Number(r.confidence||0))),reason:String(r.reason||'')};
  }
  function stepText(x){
    if(typeof x==='string') return x;
    if(!x || typeof x!=='object') return '';
    if(typeof x.text_ru==='string') return x.text_ru;
    if(typeof x.text==='string') return x.text;
    if(x.text && typeof x.text==='object') return x.text.ru || x.text.en || '';
    if(typeof x.description==='string') return x.description;
    return '';
  }
  function stepsHtml(v){
    v=Array.isArray(v)?v:[];
    if(!v.length) return '<div class="muted">Технология не заполнена.</div>';
    return '<ol style="margin:6px 0 0 20px">'+v.map(function(x){ return '<li>'+esc(stepText(x))+(x&&x.minutes!=null?' <span class="muted">('+esc(x.minutes)+' мин)</span>':'')+'</li>'; }).join('')+'</ol>';
  }
  function panel(title,sub){
    return '<div class="qrchick-panel" style="margin:0 0 14px;padding:13px;border:1px solid rgba(99,102,241,.3);border-radius:14px;background:rgba(99,102,241,.08)"><div style="display:flex;gap:10px;align-items:center"><img src="/assets/img/qrchick-avatar.svg" alt="QRChick" style="width:46px;height:46px;border-radius:50%"><div><b>QRChick</b><div class="muted" style="font-size:11px">'+esc(title)+'</div><div class="muted" style="font-size:10px">'+esc(sub)+'</div></div></div><div class="qrchick-body" style="margin-top:10px"></div></div>';
  }
  function ensurePanel(sec,title,sub){
    if(!sec || !state().baseLoaded) return null;
    var p=sec.querySelector('.qrchick-panel'), venue=state().venueId||'none';
    if(!p){ sec.insertAdjacentHTML('afterbegin',panel(title,sub)); p=sec.querySelector('.qrchick-panel'); }
    if(p.dataset.venue!==venue){ p.dataset.venue=venue; p.dataset.ready=''; }
    return p;
  }
  function saveRecipe(p,items){
    var chosen=items.filter(function(x){ return x.checked; }).map(function(x){ return x.item; });
    if(!chosen.length){ status('Выберите ингредиенты.',true); return; }
    status('QRChick сохраняет рецептуру…');
    chosen.reduce(function(q,x){
      return q.then(function(){
        return localIngredient(x.name) ? null : rpc('manager_ingredient_upsert',{p_venue_id:state().venueId,p_name:x.name,p_unit:x.unit||'g',p_purchase_quantity:1,p_purchase_price:0,p_id:null});
      });
    },Promise.resolve()).then(function(){
      return rpc('manager_ingredient_list',{p_venue_id:state().venueId});
    }).then(function(list){
      state().ingredients=Array.isArray(list)?list:[];
      var rows=chosen.map(function(x){ var l=localIngredient(x.name); return l?{ingredient_id:l.id,quantity:Number(x.quantity)||1,note:'QRChick · внутренняя БД'}:null; }).filter(Boolean);
      return rpc('manager_product_recipe_save',{p_venue_id:state().venueId,p_product_id:p.id,p_rows:rows});
    }).then(function(){ status('Рецептура сохранена.'); }).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); });
  }
  function renderRecipeResult(p,cands,match,out){
    var rr=match && match.selected_recipe_id ? cands.find(function(x){ return String(x.recipe_id)===String(match.selected_recipe_id); }) : null;
    if(!rr){ out.innerHTML='<div class="muted">Подходящая рецептура не найдена.</div>'; return; }
    if(match.confidence && match.confidence < 0.55){ out.innerHTML='<div class="muted">Совпадение недостаточно уверенное. Выберите другой вариант из базы блюд.</div>'; return; }
    var arr=(rr.ingredients||[]).map(function(item){ return {item:item,checked:true}; });
    out.innerHTML='<div class="qrchick-result"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>'+esc(rr.recipe_name)+'</b><div class="muted" style="font-size:10px">'+esc(rr.matched_product_name||p.name)+(match.confidence?' · уверенность '+Math.round(match.confidence*100)+'%':'')+'</div></div><button class="btn btn-primary btn-sm" id="qrcSaveRecipe">💾 Сохранить рецептуру</button></div><div style="margin-top:8px;display:grid;gap:5px">'+arr.map(function(x,i){ return '<label><input type="checkbox" data-qrc-r="'+i+'" checked> '+esc(x.item.name)+' — '+esc(x.item.quantity)+' '+esc(x.item.unit||'')+'</label>'; }).join('')+'</div><div style="margin-top:8px">'+(rr.description?'<div style="font-size:11px">'+esc(rr.description)+'</div>':'')+stepsHtml(rr.steps)+'</div></div>';
    document.getElementById('qrcSaveRecipe').onclick=function(){ saveRecipe(p,arr); };
  }
  function recipeBlock(){
    var r=root(), sec=r&&r.querySelector('[data-section="recipes"]'), s=state();
    if(!sec || !s.baseLoaded) return;
    var p=ensurePanel(sec,'Рецептуры блюда','Выберите блюдо — QRChick сопоставит рецептуру только с кандидатами из внутренней БД.');
    if(!p || p.dataset.ready==='1') return;
    p.dataset.ready='1';
    var b=p.querySelector('.qrchick-body');
    b.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap">'+products().map(function(x){return '<button class="btn btn-ghost btn-sm" data-qrc-find="'+esc(x.id)+'">'+esc(x.name)+'</button>';}).join('')+'</div><div id="qrcRecipeResult" style="margin-top:10px"><div class="muted">Выберите блюдо.</div></div>';
    b.querySelectorAll('[data-qrc-find]').forEach(function(x){ x.onclick=function(){ findRecipe(product(x.dataset.qrcFind)); }; });
  }
  function findRecipe(p){
    var out=document.getElementById('qrcRecipeResult'); if(!p || !out) return;
    out.innerHTML='<div class="muted">QRChick ищет подходящую рецептуру…</div>';
    catalog([p.name],80).then(function(cands){
      if(!cands.length) throw new Error('NO_CANDIDATES');
      return ai('recipe_match','Сопоставь блюдо меню с лучшей записью из кандидатов. Верни только JSON: {"selected_recipe_id":string|null,"confidence":number,"reason":string}. При слабом совпадении selected_recipe_id=null.',JSON.stringify({product:p,candidates:cands}));
    }).then(function(d){ renderRecipeResult(p,JSON.parse(JSON.stringify([])),recipeMatchResult(d),out); }).catch(function(){
      /* Повторный проход нужен только чтобы получить кандидатов для отображения; он не записывает ничего в БД. */
      catalog([p.name],80).then(function(cands){
        ai('recipe_match','Сопоставь блюдо меню с лучшей записью из кандидатов. Верни только JSON: {"selected_recipe_id":string|null,"confidence":number,"reason":string}.',JSON.stringify({product:p,candidates:cands})).then(function(d){ renderRecipeResult(p,cands,recipeMatchResult(d),out); }).catch(function(){ out.innerHTML='<div style="color:#fca5a5">Ошибка системы. Обратитесь к администратору платформы.</div>'; });
      }).catch(function(){ out.innerHTML='<div class="muted">Подходящая рецептура не найдена.</div>'; });
    });
  }
  function catalogBlock(){
    var r=root(),sec=r&&r.querySelector('[data-section="catalog"]),s=state(); if(!sec||!s.baseLoaded)return;
    var old=document.getElementById('catalogList'); if(old) old.style.display='none';
    var p=ensurePanel(sec,'Поиск техкарт','QRChick ищет техкарту по внутреннему каталогу и позволяет импортировать её в выбранное блюдо.');
    if(!p||p.dataset.ready==='1')return; p.dataset.ready='1';
    var b=p.querySelector('.qrchick-body');
    b.innerHTML=products().map(function(x){return '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:9px;margin-bottom:6px"><b>'+esc(x.name)+'</b><button class="btn btn-primary btn-sm" data-qrc-tech="'+esc(x.id)+'">🔎 Искать</button></div>';}).join('')+'<div id="qrcTechResult" style="margin-top:8px"></div>';
    b.querySelectorAll('[data-qrc-tech]').forEach(function(x){x.onclick=function(){searchTech(product(x.dataset.qrcTech));};});
  }
  function searchTech(p){
    var out=document.getElementById('qrcTechResult'); if(!p||!out)return;
    out.innerHTML='<div class="muted">QRChick сопоставляет техкарту…</div>';
    catalog([p.name],80).then(function(cands){
      if(!cands.length) throw new Error('NO');
      return ai('recipe_match','Найди лучшую техкарту для блюда меню. Верни только JSON: {"selected_recipe_id":string|null,"confidence":number,"reason":string}.',JSON.stringify({product:p,candidates:cands})).then(function(d){
        var m=recipeMatchResult(d),rr=m.selected_recipe_id&&cands.find(function(x){return String(x.recipe_id)===String(m.selected_recipe_id);});
        if(!rr || (m.confidence && m.confidence<0.55)){out.innerHTML='<div class="muted">Уверенного совпадения не найдено.</div>';return;}
        out.innerHTML='<div class="qrchick-result"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>'+esc(rr.recipe_name)+'</b><div class="muted" style="font-size:10px">'+esc([rr.category,rr.cuisine,rr.difficulty].filter(Boolean).join(' · '))+'</div></div><button class="btn btn-primary btn-sm" data-qrc-add-tech="'+esc(rr.recipe_id)+'">➕ Добавить техкарту</button></div><div style="font-size:11px;margin-top:6px">'+esc(rr.description||'')+'</div>'+stepsHtml(rr.steps)+'</div>';
        out.querySelector('[data-qrc-add-tech]').onclick=function(){ rpc('manager_tech_card_import_global_recipe',{p_venue_id:state().venueId,p_product_id:p.id,p_recipe_id:rr.recipe_id}).then(function(){status('Техкарта добавлена.');state().techLoaded=false;}).catch(function(){status('Ошибка системы. Обратитесь к администратору платформы.',true);}); };
      });
    }).catch(function(){out.innerHTML='<div style="color:#fca5a5">Ошибка системы. Обратитесь к администратору платформы.</div>';});
  }
  function ingredientsBlock(){
    var r=root(),sec=r&&r.querySelector('[data-section="ingredients"]'),s=state(); if(!sec||!s.baseLoaded)return;
    var old=document.getElementById('ingredientsDbList'); if(old)old.style.display='none';
    var p=ensurePanel(sec,'Поиск ингредиентов','QRChick подбирает ингредиенты по текущему меню и внутреннему словарю.'); if(!p||p.dataset.ready==='1')return; p.dataset.ready='1';
    var b=p.querySelector('.qrchick-body'); b.innerHTML='<div class="muted">QRChick анализирует меню…</div>';
    ingredientCatalog(products().map(function(x){return x.name}),300).then(function(cands){
      return ai('recipe_match','Сопоставь ингредиенты внутренней БД с меню. Верни только JSON: {"selected_ingredient_ids":string[],"confidence":number,"reason":string}. Используй только ID из кандидатов.',JSON.stringify({menu:products(),candidates:cands})).then(function(d){
        var r=d&&d.result&&typeof d.result==='object'?d.result:{}, chosen=Array.isArray(r.selected_ingredient_ids)?r.selected_ingredient_ids:[], by={}; cands.forEach(function(x){by[String(x.id)]=x;});
        var list=(chosen.length?chosen.map(function(id){return by[String(id)]}).filter(Boolean):cands.slice(0,120));
        b.innerHTML=list.length?list.map(function(x){var l=localIngredient(x.name);return '<div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:9px;margin-bottom:5px"><span><b>'+esc(x.name)+'</b><span class="muted"> · '+esc(x.unit||'')+'</span><small class="muted" style="display:block">'+esc(x.matched_recipe_name||x.category||'')+'</small></span><button class="btn btn-primary btn-sm" data-qrc-add-i="'+esc(x.id)+'" '+(l?'disabled':'')+'>'+(l?'Добавлен':'➕ Добавить')+'</button></div>';}).join(''):'<div class="muted">Подходящих ингредиентов не найдено.</div>';
        b.querySelectorAll('[data-qrc-add-i]').forEach(function(btn){btn.onclick=function(){var z=by[btn.dataset.qrcAddI];if(!z)return;rpc('manager_ingredient_upsert',{p_venue_id:s.venueId,p_name:z.name,p_unit:z.unit||'g',p_purchase_quantity:1,p_purchase_price:0,p_id:null}).then(function(){btn.disabled=true;btn.textContent='Добавлен';status('Ингредиент добавлен.');}).catch(function(){status('Ошибка системы. Обратитесь к администратору платформы.',true);});};});
      });
    }).catch(function(){b.innerHTML='<div style="color:#fca5a5">Ошибка системы. Обратитесь к администратору платформы.</div>';});
  }
  function compress(file){
    return new Promise(function(resolve,reject){var fr=new FileReader();fr.onerror=reject;fr.onload=function(){var img=new Image();img.onerror=reject;img.onload=function(){var max=1800,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.84));};img.src=fr.result;};fr.readAsDataURL(file);});
  }
  function showVision(data,file){
    var p=document.getElementById('ocrPanel'); if(p)p.hidden=false;
    var text=document.getElementById('ocrText'); if(text)text.textContent=JSON.stringify(data||{},null,2);
    window.__QRCHICK_LAST_TECH__=data; window.__QRCHICK_LAST_FILE__=file;
    var sel=document.getElementById('ocrProduct'); if(sel)sel.innerHTML=products().map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>';}).join('');
    var stx=document.getElementById('ocrStatus'); if(stx)stx.textContent='Анализ завершён. Проверьте данные и выберите блюдо.';
    var acts=document.getElementById('qrTechAiActions'); if(!acts&&p){acts=document.createElement('div');acts.id='qrTechAiActions';acts.style.marginTop='10px';p.appendChild(acts);} if(acts)acts.innerHTML='<button type="button" class="btn btn-primary" id="qrSaveAiTech">💾 Сохранить техкарту</button>';
    var btn=document.getElementById('qrSaveAiTech'); if(btn)btn.onclick=function(){saveVision(sel&&sel.value?product(sel.value):products()[0],data,file);};
  }
  function saveVision(p,data,file){
    if(!p){status('Выберите блюдо.',true);return;}
    status('Сохраняем техкарту…');
    rpc('manager_tech_card_ai_create',{p_venue_id:state().venueId,p_product_id:p.id,p_file_name:file&&file.name||('Техкарта: '+(data&&data.recipe_name||p.name)),p_ocr_text:JSON.stringify(data||{},null,2),p_recipe_data:data||{}}).then(function(){status('Техкарта сохранена.');state().techLoaded=false;}).catch(function(){status('Ошибка системы. Обратитесь к администратору платформы.',true);});
  }
  function photoUpload(){
    var f=document.getElementById('techFiles'); if(!f||f.__qrcVision)return; f.__qrcVision=true;
    f.addEventListener('change',function(){var files=Array.prototype.slice.call(this.files||[]);this.value='';if(!files.length)return;var file=files[0];status('QRChick анализирует фотографию техкарты…');compress(file).then(function(dataUrl){var m=dataUrl.match(/^data:([^;]+);base64,(.*)$/s);return ai('recipe_image_analyze','Проанализируй фото техкарты как профессиональную производственную карточку. Сохрани все видимые поля, таблицы, количества, технологию и температуры.',JSON.stringify({venue_id:state().venueId,menu:products().map(function(p){return{id:p.id,name:p.name,category:p.category};})}),{mime_type:m[1],data:m[2]});}).then(function(d){showVision(d.analysis||d.result||d,file);}).catch(function(){status('Ошибка системы. Обратитесь к администратору платформы.',true);});});
  }
  function techEnhance(){
    var box=document.getElementById('techList'); if(!box)return;
    box.querySelectorAll('[data-tech]').forEach(function(btn){
      var card=btn.closest('.tech-card'); if(!card||card.querySelector('[data-qrc-edit]'))return;
      var t=(state().techCards||[]).find(function(x){return String(x.id)===String(btn.dataset.tech);}); if(!t)return;
      var e=document.createElement('button'); e.className='btn btn-ghost btn-sm'; e.dataset.qrcEdit='1'; e.textContent='Изменить';
      e.onclick=function(ev){ev.stopPropagation();var n=prompt('Название техкарты:',t.title||t.file_name||'Техкарта');if(n===null)return;rpc('manager_tech_card_update',{p_tech_card_id:t.id,p_title:String(n).trim()||t.title||t.file_name,p_file_name:String(n).trim()||t.file_name}).then(function(){status('Техкарта изменена.');}).catch(function(){status('Ошибка системы. Обратитесь к администратору платформы.',true);});};
      card.appendChild(e);
    });
  }
  function refreshActive(){
    var r=root(),s=state(); if(!r||!s.baseLoaded)return;
    var active=r.querySelector('.qr-recipe-subnav [data-section].on'); if(!active)return;
    var n=active.dataset.section;
    if(n==='recipes') recipeBlock(); else if(n==='catalog') catalogBlock(); else if(n==='ingredients') ingredientsBlock(); else if(n==='tech') techEnhance();
  }
  function boot(){
    photoUpload();
    if(window.__QR_RECEPT_AI_OBSERVER__)return;
    window.__QR_RECEPT_AI_OBSERVER__=true;
    var observer=new MutationObserver(function(){refreshActive();});
    observer.observe(document.body,{childList:true,subtree:true});
    refreshActive();
    window.addEventListener('manager-venue-selected',function(){setTimeout(refreshActive,0);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
