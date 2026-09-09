/* QRChick — canonical AI extension for the manager recipe workspace. */
(function(){
  'use strict';

  /* manager-recipes.js uses __QR_RECEPT_AI_LOADED__ as a loader marker.
     Do not reuse that marker here or the extension will self-cancel. */
  if (window.__QR_RECEPT_AI_BOOTED__) return;
  window.__QR_RECEPT_AI_BOOTED__ = true;

  var state = function(){ return window.__QR_MANAGER_RECIPES_STATE__ || {}; };
  var root = function(){ return document.querySelector('.recipe-tab-container[data-qr-sections="1"]') || document.querySelector('.recipe-tab-container'); };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>\"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]; }); };
  var norm = function(v){ return String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim(); };

  function status(text,error){
    var a=document.getElementById('qrReceptAiStatus');
    var b=document.getElementById('ocrStatus');
    if(a){ a.textContent=text||''; a.style.color=error?'#fca5a5':''; }
    if(b && error) b.textContent=text||'';
  }

  function rpc(name,args){
    if(!window.db || !window.db.rpc) return Promise.reject(new Error('DB'));
    return window.db.rpc(name,args).then(function(r){ if(r.error) throw r.error; return r.data; });
  }

  function products(){ return (state().products || []).filter(function(x){ return x && x.id && x.name; }); }
  function product(id){ return products().find(function(x){ return String(x.id)===String(id); }) || null; }
  function localIngredient(name){
    var n=norm(name); if(!n) return null;
    return (state().ingredients || []).find(function(x){
      var z=norm(x.name); return z===n || z.indexOf(n)>=0 || n.indexOf(z)>=0;
    }) || null;
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
      return fetch('/api/manager-ai-propose',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},
        body:JSON.stringify({feature:'recipes',mode:mode,message:message||'',context:context||'',image:image||null})
      });
    }).then(function(r){
      return r.json().then(function(d){
        if(!r.ok || d.ok===false) throw new Error('AI');
        return d;
      });
    });
  }

  function parseObject(value){
    if(value && typeof value==='object') return value;
    var text=String(value||'').trim().replace(/^```json/i,'').replace(/```$/,'').trim();
    try { return JSON.parse(text); } catch(e) {
      var a=text.indexOf('{'), b=text.lastIndexOf('}');
      if(a>=0 && b>a) try { return JSON.parse(text.slice(a,b+1)); } catch(_) {}
    }
    return {};
  }

  function aiResult(d){
    if(d && d.result && typeof d.result==='object') return d.result;
    if(d && d.analysis && typeof d.analysis==='object') return d.analysis;
    return parseObject(d && d.answer);
  }

  function catalog(names,limit){
    var s=state();
    if(!s.venueId || !names || !names.length) return Promise.resolve([]);
    return rpc('manager_recipe_catalog_for_venue',{p_venue_id:s.venueId,p_product_names:names,p_limit:limit||80});
  }

  function ingredientCatalog(names,limit){
    var s=state();
    if(!s.venueId || !names || !names.length) return Promise.resolve([]);
    return rpc('manager_ingredient_catalog_for_venue',{p_venue_id:s.venueId,p_product_names:names,p_limit:limit||300});
  }

  function recipeMatchResult(d){
    var r=aiResult(d);
    return {
      selected_recipe_id:r.selected_recipe_id||null,
      confidence:Math.max(0,Math.min(1,Number(r.confidence||0))),
      reason:String(r.reason||'')
    };
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
    return '<ol style="margin:6px 0 0 20px">'+v.map(function(x){
      return '<li>'+esc(stepText(x))+(x&&x.minutes!=null?' <span class="muted">('+esc(x.minutes)+' мин)</span>':'')+'</li>';
    }).join('')+'</ol>';
  }

  function panel(title,sub){
    return '<div class="qrchick-panel" style="margin:0 0 14px;padding:13px;border:1px solid rgba(99,102,241,.3);border-radius:14px;background:rgba(99,102,241,.08)">'+
      '<div style="display:flex;gap:10px;align-items:center">'+
        '<img src="/assets/img/qrchick-avatar.svg" alt="QRChick" style="width:46px;height:46px;border-radius:50%">'+
        '<div><b>QRChick</b><div class="muted" style="font-size:11px">'+esc(title)+'</div><div class="muted" style="font-size:10px">'+esc(sub)+'</div></div>'+
      '</div><div class="qrchick-body" style="margin-top:10px"></div></div>';
  }

  function ensurePanel(sec,title,sub){
    if(!sec || !state().baseLoaded) return null;
    var p=sec.querySelector('.qrchick-panel'), venue=state().venueId||'none';
    if(!p){ sec.insertAdjacentHTML('afterbegin',panel(title,sub)); p=sec.querySelector('.qrchick-panel'); }
    if(p.dataset.venue!==venue){ p.dataset.venue=venue; p.dataset.ready=''; }
    return p;
  }

  function refreshLocalIngredients(){
    return rpc('manager_ingredient_list',{p_venue_id:state().venueId}).then(function(list){
      state().ingredients=Array.isArray(list)?list:[];
      return list;
    });
  }

  function saveRecipe(p,items,out){
    var chosen=items.filter(function(x){ return x.checked; }).map(function(x){ return x.item; });
    if(!chosen.length){ status('Выберите ингредиенты.',true); return; }
    status('QRChick сохраняет рецептуру…');
    chosen.reduce(function(q,x){
      return q.then(function(){
        return localIngredient(x.name) ? null : rpc('manager_ingredient_upsert',{
          p_venue_id:state().venueId,
          p_name:x.name,
          p_unit:x.unit||'g',
          p_purchase_quantity:1,
          p_purchase_price:0,
          p_id:null
        });
      });
    },Promise.resolve()).then(refreshLocalIngredients).then(function(){
      var rows=chosen.map(function(x){
        var l=localIngredient(x.name);
        return l?{ingredient_id:l.id,quantity:Number(x.quantity)||1,note:'QRChick · внутренняя БД'}:null;
      }).filter(Boolean);
      return rpc('manager_product_recipe_save',{p_venue_id:state().venueId,p_product_id:p.id,p_rows:rows});
    }).then(function(){
      status('Рецептура сохранена.');
      if(out) out.innerHTML='<div class="qrchick-result"><b>✅ Рецептура сохранена</b><div class="muted" style="margin-top:5px">Блюдо: '+esc(p.name)+'</div></div>';
      window.dispatchEvent(new CustomEvent('qr-recipes-data-changed'));
    }).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); });
  }

  function renderRecipeResult(p,cands,match,out){
    var rr=match && match.selected_recipe_id ? cands.find(function(x){ return String(x.recipe_id)===String(match.selected_recipe_id); }) : null;
    if(!rr){ out.innerHTML='<div class="muted">Подходящая рецептура не найдена.</div>'; return; }
    if(match.confidence && match.confidence<0.55){
      out.innerHTML='<div class="muted">Совпадение недостаточно уверенное. Выберите другое блюдо или используйте поиск вручную.</div>';
      return;
    }
    var arr=(rr.ingredients||[]).map(function(item){ return {item:item,checked:true}; });
    out.innerHTML='<div class="qrchick-result">'+
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">'+
        '<div><b>'+esc(rr.recipe_name)+'</b><div class="muted" style="font-size:10px">'+esc(rr.matched_product_name||p.name)+(match.confidence?' · уверенность '+Math.round(match.confidence*100)+'%':'')+'</div></div>'+ 
        '<button class="btn btn-primary btn-sm" id="qrcSaveRecipe">💾 Сохранить рецептуру</button>'+ 
      '</div>'+ 
      '<div style="margin-top:8px;display:grid;gap:5px">'+
        arr.map(function(x,i){ return '<label><input type="checkbox" data-qrc-r="'+i+'" checked> '+esc(x.item.name)+' — '+esc(x.item.quantity)+' '+esc(x.item.unit||'')+'</label>'; }).join('')+
      '</div>'+ 
      '<div style="margin-top:8px">'+(rr.description?'<div style="font-size:11px">'+esc(rr.description)+'</div>':'')+stepsHtml(rr.steps)+'</div>'+ 
    '</div>';
    out.querySelectorAll('[data-qrc-r]').forEach(function(cb){ cb.onchange=function(){ arr[Number(cb.dataset.qrcR)].checked=cb.checked; }; });
    var save=out.querySelector('#qrcSaveRecipe');
    if(save) save.onclick=function(){ saveRecipe(p,arr,out); };
  }

  function findRecipe(p,out){
    if(!p||!out) return;
    out.innerHTML='<div class="muted">🔎 QRChick ищет рецептуру блюда в базе…</div>';
    catalog([p.name],80).then(function(cands){
      if(!cands.length) throw new Error('NO_CANDIDATES');
      return ai('recipe_match',
        'Сопоставь блюдо меню с лучшей записью из кандидатов. Верни только JSON: {"selected_recipe_id":string|null,"confidence":number,"reason":string}. Используй только ID из CANDIDATES. При слабом совпадении selected_recipe_id=null.',
        JSON.stringify({product:p,candidates:cands})
      ).then(function(d){ renderRecipeResult(p,cands,recipeMatchResult(d),out); });
    }).catch(function(){ out.innerHTML='<div style="color:#fca5a5">Ошибка системы. Обратитесь к администратору платформы.</div>'; });
  }

  function recipeBlock(){
    var r=root(),sec=r&&r.querySelector('[data-section="recipes"]'),s=state();
    if(!sec||!s.baseLoaded) return;
    var p=ensurePanel(sec,'Рецептуры блюд','Выберите блюдо — QRChick автоматически найдёт подходящую рецептуру во внутренней БД.');
    if(!p||p.dataset.ready==='1') return;
    p.dataset.ready='1';
    var b=p.querySelector('.qrchick-body');
    b.innerHTML='<div style="display:grid;gap:7px">'+products().map(function(x){
      return '<button type="button" class="btn btn-ghost btn-sm" data-qrc-find="'+esc(x.id)+'" style="justify-content:flex-start;text-align:left">🍽️ '+esc(x.name)+'</button>';
    }).join('')+'</div><div id="qrcRecipeResult" style="margin-top:10px"><div class="muted">Выберите блюдо — поиск запустится автоматически.</div></div>';
    b.querySelectorAll('[data-qrc-find]').forEach(function(x){
      x.onclick=function(){ findRecipe(product(x.dataset.qrcFind),b.querySelector('#qrcRecipeResult')); };
    });
  }

  function searchTech(p,out){
    if(!p||!out) return;
    out.innerHTML='<div class="muted">🔎 QRChick ищет техкарту для «'+esc(p.name)+'»…</div>';
    catalog([p.name],80).then(function(cands){
      if(!cands.length) throw new Error('NO');
      return ai('recipe_match',
        'Найди лучшую техкарту для блюда меню. Верни только JSON: {"selected_recipe_id":string|null,"confidence":number,"reason":string}. Используй только ID из CANDIDATES.',
        JSON.stringify({product:p,candidates:cands})
      ).then(function(d){
        var m=recipeMatchResult(d);
        var rr=m.selected_recipe_id&&cands.find(function(x){ return String(x.recipe_id)===String(m.selected_recipe_id); });
        if(!rr||(m.confidence&&m.confidence<0.55)){
          out.innerHTML='<div class="muted">Уверенного совпадения для «'+esc(p.name)+'» не найдено.</div>';
          return;
        }
        out.innerHTML='<div class="qrchick-result">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">'+
            '<div><b>'+esc(rr.recipe_name)+'</b><div class="muted" style="font-size:10px">'+esc([rr.category,rr.cuisine,rr.difficulty].filter(Boolean).join(' · '))+'</div></div>'+ 
            '<button type="button" class="btn btn-primary btn-sm" data-qrc-add-tech="'+esc(rr.recipe_id)+'">➕ Добавить техкарту</button>'+ 
          '</div>'+ 
          '<div style="font-size:11px;margin-top:6px">'+esc(rr.description||'')+'</div>'+stepsHtml(rr.steps)+
        '</div>';
        var add=out.querySelector('[data-qrc-add-tech]');
        if(add) add.onclick=function(){
          add.disabled=true; add.textContent='Сохранение…';
          rpc('manager_tech_card_import_global_recipe',{p_venue_id:state().venueId,p_product_id:p.id,p_recipe_id:rr.recipe_id}).then(function(){
            status('Техкарта добавлена.');
            state().techLoaded=false;
            refreshTechCards().then(techEnhance);
          }).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); add.disabled=false; add.textContent='➕ Добавить техкарту'; });
        };
      });
    }).catch(function(){ out.innerHTML='<div style="color:#fca5a5">Ошибка системы. Обратитесь к администратору платформы.</div>'; });
  }

  function catalogBlock(){
    var r=root(),sec=r&&r.querySelector('[data-section="catalog"]'),s=state();
    if(!sec||!s.baseLoaded) return;
    var old=document.getElementById('catalogList'); if(old) old.style.display='none';
    var p=ensurePanel(sec,'Поиск техкарт по блюдам меню','Для каждого блюда есть отдельная кнопка поиска. QRChick ищет во внутренней базе и даёт «Добавить техкарту».');
    if(!p||p.dataset.ready==='1') return;
    p.dataset.ready='1';
    var b=p.querySelector('.qrchick-body');
    b.innerHTML=products().map(function(x){
      return '<div style="padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:9px;margin-bottom:6px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>'+esc(x.name)+'</b><button type="button" class="btn btn-primary btn-sm" data-qrc-tech="'+esc(x.id)+'">🔎 Искать техкарту</button></div>'+
        '<div data-qrc-tech-result="'+esc(x.id)+'" style="margin-top:8px"></div>'+
      '</div>';
    }).join('');
    b.querySelectorAll('[data-qrc-tech]').forEach(function(x){
      x.onclick=function(){ var row=x.closest('div').parentElement; var out=row&&row.querySelector('[data-qrc-tech-result]'); searchTech(product(x.dataset.qrcTech),out); };
    });
  }

  function editLocalIngredient(local){
    if(!local) return;
    var name=prompt('Название ингредиента:',local.name||'');
    if(name===null) return;
    name=name.trim(); if(!name) return;
    var price=Number(prompt('Закупочная цена:',local.purchase_price||0));
    if(!Number.isFinite(price)||price<0) return;
    rpc('manager_ingredient_upsert',{
      p_venue_id:state().venueId,
      p_name:name,
      p_unit:local.unit,
      p_purchase_quantity:Number(local.purchase_quantity||1),
      p_purchase_price:price,
      p_id:local.id
    }).then(function(){ return refreshLocalIngredients(); }).then(function(){ status('Ингредиент изменён.'); window.dispatchEvent(new CustomEvent('qr-recipes-data-changed')); }).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); });
  }

  function addOrEditCandidate(item,addButton){
    var existing=localIngredient(item.name);
    if(existing){ editLocalIngredient(existing); return; }
    addButton.disabled=true;
    addButton.textContent='Сохранение…';
    rpc('manager_ingredient_upsert',{
      p_venue_id:state().venueId,
      p_name:item.name,
      p_unit:item.unit||'g',
      p_purchase_quantity:1,
      p_purchase_price:0,
      p_id:null
    }).then(function(){
      return refreshLocalIngredients();
    }).then(function(){
      addButton.textContent='Добавлен';
      addButton.disabled=true;
      var edit=addButton.parentElement && addButton.parentElement.querySelector('[data-qrc-edit-i]');
      if(edit) edit.disabled=false;
      status('Ингредиент добавлен.');
      window.dispatchEvent(new CustomEvent('qr-recipes-data-changed'));
    }).catch(function(){
      addButton.disabled=false; addButton.textContent='➕ Добавить';
      status('Ошибка системы. Обратитесь к администратору платформы.',true);
    });
  }

  function ingredientsBlock(){
    var r=root(),sec=r&&r.querySelector('[data-section="ingredients"]'),s=state();
    if(!sec||!s.baseLoaded) return;
    var old=document.getElementById('ingredientsDbList'); if(old) old.style.display='none';
    var p=ensurePanel(sec,'Поиск ингредиентов','QRChick автоматически анализирует блюда меню и предлагает подходящие ингредиенты из внутренней базы.');
    if(!p||p.dataset.ready==='1') return;
    p.dataset.ready='1';
    var b=p.querySelector('.qrchick-body');
    b.innerHTML='<div class="muted">🔎 QRChick анализирует меню и подбирает ингредиенты…</div>';
    ingredientCatalog(products().map(function(x){ return x.name; }),300).then(function(cands){
      return ai('recipe_match',
        'Сопоставь ингредиенты внутренней БД с меню. Верни только JSON: {"selected_ingredient_ids":string[],"confidence":number,"reason":string}. Используй только ID из CANDIDATES.',
        JSON.stringify({menu:products(),candidates:cands})
      ).then(function(d){
        var r=aiResult(d),chosen=Array.isArray(r.selected_ingredient_ids)?r.selected_ingredient_ids:[],by={};
        cands.forEach(function(x){ by[String(x.id)]=x; });
        var list=(chosen.length?chosen.map(function(id){ return by[String(id)]; }).filter(Boolean):cands.slice(0,120));
        b.innerHTML=list.length?list.map(function(x){
          var l=localIngredient(x.name);
          return '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:9px;margin-bottom:5px">'+
            '<span><b>'+esc(x.name)+'</b><span class="muted"> · '+esc(x.unit||'')+'</span><small class="muted" style="display:block">'+esc(x.matched_recipe_name||x.category||'')+'</small></span>'+ 
            '<span style="display:flex;gap:6px;flex-wrap:wrap">'+
              '<button type="button" class="btn btn-primary btn-sm" data-qrc-add-i="'+esc(x.id)+'" '+(l?'disabled':'')+'>'+(l?'Добавлен':'➕ Добавить')+'</button>'+ 
              '<button type="button" class="btn btn-ghost btn-sm" data-qrc-edit-i="'+esc(x.id)+'">✏️ Изменить</button>'+ 
            '</span>'+ 
          '</div>';
        }).join(''):'<div class="muted">Подходящих ингредиентов не найдено.</div>';
        b.querySelectorAll('[data-qrc-add-i]').forEach(function(btn){
          btn.onclick=function(){ var z=by[btn.dataset.qrcAddI]; if(z) addOrEditCandidate(z,btn); };
        });
        b.querySelectorAll('[data-qrc-edit-i]').forEach(function(btn){
          btn.onclick=function(){ var z=by[btn.dataset.qrcEditI], l=localIngredient(z&&z.name); if(l) editLocalIngredient(l); else status('Сначала добавьте этот ингредиент, затем его можно изменить.',true); };
        });
      });
    }).catch(function(){ b.innerHTML='<div style="color:#fca5a5">Ошибка системы. Обратитесь к администратору платформы.</div>'; });
  }

  function compress(file){
    return new Promise(function(resolve,reject){
      var fr=new FileReader();
      fr.onerror=reject;
      fr.onload=function(){
        var img=new Image(); img.onerror=reject;
        img.onload=function(){
          var max=1800, scale=Math.min(1,max/Math.max(img.width,img.height));
          var c=document.createElement('canvas');
          c.width=Math.max(1,Math.round(img.width*scale));
          c.height=Math.max(1,Math.round(img.height*scale));
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          resolve(c.toDataURL('image/jpeg',.84));
        };
        img.src=fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function showVision(data,file){
    var p=document.getElementById('ocrPanel'); if(p) p.hidden=false;
    var text=document.getElementById('ocrText'); if(text) text.textContent=JSON.stringify(data||{},null,2);
    window.__QRCHICK_LAST_TECH__=data;
    window.__QRCHICK_LAST_FILE__=file;
    var sel=document.getElementById('ocrProduct');
    if(sel) sel.innerHTML=products().map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>'; }).join('');
    var stx=document.getElementById('ocrStatus'); if(stx) stx.textContent='QRChick распознал техкарту. Проверьте данные и выберите блюдо.';
    var acts=document.getElementById('qrTechAiActions');
    if(!acts&&p){ acts=document.createElement('div'); acts.id='qrTechAiActions'; acts.style.marginTop='10px'; p.appendChild(acts); }
    if(acts) acts.innerHTML='<button type="button" class="btn btn-primary" id="qrSaveAiTech">💾 Сохранить техкарту</button>';
    var btn=document.getElementById('qrSaveAiTech');
    if(btn) btn.onclick=function(){ saveVision(sel&&sel.value?product(sel.value):products()[0],data,file); };
  }

  function saveVision(p,data,file){
    if(!p){ status('Выберите блюдо.',true); return; }
    status('Сохраняем техкарту…');
    rpc('manager_tech_card_ai_create',{
      p_venue_id:state().venueId,
      p_product_id:p.id,
      p_file_name:file&&file.name||('Техкарта: '+((data&&data.recipe_name)||p.name)),
      p_ocr_text:JSON.stringify(data||{},null,2),
      p_recipe_data:data||{}
    }).then(function(){
      status('Техкарта сохранена.');
      state().techLoaded=false;
      return refreshTechCards();
    }).then(techEnhance).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); });
  }

  function photoUpload(){
    var f=document.getElementById('techFiles');
    if(!f||f.__qrcVision) return;
    f.__qrcVision=true;
    /* One canonical handler: QRChick owns photo processing in this extension. */
    f.onchange=function(){
      var files=Array.prototype.slice.call(f.files||[]); f.value='';
      if(!files.length) return;
      var file=files[0];
      status('QRChick анализирует фотографию техкарты…');
      compress(file).then(function(dataUrl){
        var m=dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
        if(!m) throw new Error('IMAGE');
        return ai('recipe_image_analyze',
          'Проанализируй фото техкарты как профессиональную производственную карточку. Сохрани все видимые поля, таблицы, количества, технологию и температуры. Не выдумывай отсутствующие данные.',
          JSON.stringify({venue_id:state().venueId,menu:products().map(function(p){ return {id:p.id,name:p.name,category:p.category}; })}),
          {mime_type:m[1],data:m[2]}
        );
      }).then(function(d){ showVision(aiResult(d),file); }).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); });
    };
  }

  function refreshTechCards(){
    var s=state();
    if(!s.venueId) return Promise.resolve([]);
    return window.db.from('manager_tech_cards').select('id,product_id,file_name,file_path,file_url,ocr_text,status,created_at,title,source_type,global_recipe_id,recipe_data').eq('venue_id',s.venueId).order('created_at',{ascending:false}).then(function(r){
      if(r.error) throw r.error;
      s.techCards=r.data||[]; s.techLoaded=true;
      renderTechCardsSafe();
      return s.techCards;
    });
  }

  function renderTechCardsSafe(){
    var box=document.getElementById('techList'); if(!box) return;
    var cards=state().techCards||[];
    box.innerHTML=cards.length?cards.map(function(t){
      return '<div class="tech-card">'+
        (t.file_url?'<img src="'+esc(t.file_url)+'" alt="" onerror="this.style.display=\'none\'">':'')+
        '<b>'+esc(t.title||t.file_name||'Техкарта')+'</b>'+ 
        '<div class="muted">'+esc(t.status==='processed'?'Распознано':'Загружено')+'</div>'+ 
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+ 
          '<button type="button" class="btn btn-ghost btn-sm" data-tech="'+esc(t.id)+'">Открыть</button>'+ 
          '<button type="button" class="btn btn-ghost btn-sm" data-qrc-edit-tech="'+esc(t.id)+'">✏️ Изменить</button>'+ 
        '</div>'+ 
      '</div>';
    }).join(''):'<div class="muted">Техкарт пока нет.</div>';
    box.querySelectorAll('[data-tech]').forEach(function(b){
      b.onclick=function(){ var t=state().techCards.find(function(x){ return String(x.id)===String(b.dataset.tech); }); if(t && typeof window.showOcr==='function') window.showOcr(t.ocr_text||'',t); else { var modal=document.getElementById('ocrPanel'); if(modal) modal.hidden=false; var txt=document.getElementById('ocrText'); if(txt) txt.textContent=t&&t.ocr_text||'Текст не распознан'; } };
    });
  }

  function editTech(t){
    if(!t) return;
    var title=prompt('Название техкарты:',t.title||t.file_name||'Техкарта');
    if(title===null) return;
    title=title.trim(); if(!title) return;
    rpc('manager_tech_card_update',{
      p_tech_card_id:t.id,
      p_title:title,
      p_file_name:title
    }).then(function(){ return refreshTechCards(); }).then(techEnhance).then(function(){ status('Техкарта изменена.'); }).catch(function(){ status('Ошибка системы. Обратитесь к администратору платформы.',true); });
  }

  function techEnhance(){
    var box=document.getElementById('techList'); if(!box) return;
    box.querySelectorAll('[data-qrc-edit-tech]').forEach(function(btn){
      if(btn.__qrcBound) return; btn.__qrcBound=true;
      btn.onclick=function(ev){ ev.stopPropagation(); var t=(state().techCards||[]).find(function(x){ return String(x.id)===String(btn.dataset.qrcEditTech); }); if(t) editTech(t); };
    });
  }

  function refreshActive(){
    var r=root(),s=state(); if(!r||!s.baseLoaded) return;
    var active=r.querySelector('.qr-recipe-subnav [data-section].on');
    var n=active?active.dataset.section:'recipes';
    if(n==='recipes') recipeBlock();
    else if(n==='catalog') catalogBlock();
    else if(n==='ingredients') ingredientsBlock();
    else if(n==='tech') { refreshTechCards().then(techEnhance).catch(function(){}); }
  }

  function observe(){
    if(window.__QR_RECEPT_AI_OBSERVER__) return;
    window.__QR_RECEPT_AI_OBSERVER__=true;
    var observer=new MutationObserver(function(){ refreshActive(); });
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('manager-venue-selected',function(){ setTimeout(refreshActive,0); });
    window.addEventListener('qr-recipes-data-changed',function(){ setTimeout(refreshActive,0); });
  }

  function boot(){ photoUpload(); observe(); refreshActive(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();