/* QR Menu — unified menu import UI. Server is the only parser for PDF/photo/site. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_UNIFIED__) return;
  window.__QR_MANAGER_SITE_IMPORT_UNIFIED__=true;
  window.QRManagerSiteImport={mount:function(){},unmount:function(){}};

  var API='/api/menu/import';
  var BUCKET='menu-images';
  var MAX_FILE=10*1024*1024;

  function vm(){return window.__managerVue||null;}
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function key(v){return clean(v).toLowerCase().replace(/[ё]/g,'е');}
  function esc(v){return String(v==null?'':v).replace(/[&<>\\\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;',"'":'&#39;'}[c];});}
  function block(){return document.querySelector('#qr-menu-import-block-v2');}
  function setStatus(text,error){var b=block(),el=b&&b.querySelector('#qr-menu-import-status-v2');if(el){el.textContent=text||'';el.style.color=error?'#fca5a5':'';}}
  function decodeExp(token){try{var p=String(token||'').split('.')[1];if(!p)return 0;p=p.replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return Number(JSON.parse(atob(p)).exp||0);}catch(e){return 0;}}
  async function token(force){try{var s=await db.auth.getSession(),session=s&&s.data&&s.data.session,t=session&&session.access_token||'';if(!force&&t&&(!decodeExp(t)||decodeExp(t)>Date.now()/1000+90))return t;var r=await db.auth.refreshSession(),fresh=r&&r.data&&r.data.session;return fresh&&fresh.access_token||'';}catch(e){return '';}}
  async function request(payload){var t=await token(false);if(!t)throw new Error('AUTH_REQUIRED');var headers={'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+t};var r=await fetch(API,{method:'POST',headers:headers,credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)});var d=await r.json().catch(function(){return null;});if(r.status===401){t=await token(true);if(t){headers.Authorization='Bearer '+t;r=await fetch(API,{method:'POST',headers:headers,credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)});d=await r.json().catch(function(){return null;});}}if(!r.ok||!d||d.ok===false){var e=new Error(d&&d.error&&d.error.message||('HTTP '+r.status));e.code=d&&d.error&&d.error.code||'';e.status=r.status;throw e;}return d;}
  async function uploadTemp(file,v){
    if(!db||!db.storage)throw new Error('Storage недоступен');
    var id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(36).slice(2));
    var safe=clean(file.name||'menu').replace(/[^a-zа-яё0-9._-]/giu,'-').slice(-120)||'menu';
    var path='imports/'+(v&&v.userId?v.userId:'session')+'/'+id+'-'+safe;
    var up=await db.storage.from(BUCKET).upload(path,file,{cacheControl:'300',upsert:false,contentType:file.type||'application/octet-stream'});
    if(up.error)throw up.error;
    var pub=db.storage.from(BUCKET).getPublicUrl(path);var url=pub&&pub.data&&pub.data.publicUrl;if(!url){await db.storage.from(BUCKET).remove([path]).catch(function(){});throw new Error('Не удалось получить URL загруженного файла');}
    return {url:url,path:path};
  }
  async function deleteTemp(path){if(!path||!db||!db.storage)return;try{await db.storage.from(BUCKET).remove([path]);}catch(e){}}

  function normalizeMenu(data){
    var menu=data&&data.menu||{};var categories=Array.isArray(menu.categories)?menu.categories:[];var out=[];var seen={};
    categories.forEach(function(c){
      var cn=clean(c&&c.name)||'Основные блюда';
      (Array.isArray(c&&c.items)?c.items:[]).forEach(function(i){
        var name=clean(i&&i.name);if(!name)return;
        var item={name:name,description:clean(i&&i.description),price:i&&i.price!=null&&i.price!==''?Number(i.price):null,category:cn,unit:clean(i&&i.unit),weight:i&&i.weight!=null?Number(i.weight):null,image_url:i&&i.image_url?String(i.image_url):null,allergens:Array.isArray(i&&i.allergens)?i.allergens:[],tags:Array.isArray(i&&i.tags)?i.tags:[],is_available:i&&i.available!==false,applies_to:'all'};
        var k=key(cn)+'::'+key(name);
        if(seen[k]){
          if(seen[k].price==null&&item.price!=null)seen[k].price=item.price;
          if(!seen[k].description&&item.description)seen[k].description=item.description;
          return;
        }
        seen[k]=item;out.push(item);
      });
    });
    return out;
  }

  function mergeImportResult(v,data,label){
    var next=normalizeMenu(data);var current=Array.isArray(v.importItems)?v.importItems:[];var map={};current.forEach(function(x){map[key(x.category)+'::'+key(x.name)]=x;});
    next.forEach(function(x){var k=key(x.category)+'::'+key(x.name);if(map[k]){if(map[k].price==null&&x.price!=null)map[k].price=x.price;if(!map[k].description&&x.description)map[k].description=x.description;}else{map[k]=x;current.push(x);}});
    v.importItems=current.filter(function(x){return x&&x.name;});
    var warnings=Array.isArray(v.importWarnings)?v.importWarnings.slice():[];
    (Array.isArray(data&&data.warnings)?data.warnings:[]).forEach(function(w){var text=clean(w);if(text&&!warnings.some(function(x){return key(x)===key(text);}))warnings.push(label?label+': '+text:text);});
    v.importWarnings=warnings;
    return next.length;
  }

  function inputValue(v){return v==null?'':String(v);}
  function render(items,warnings){
    var b=block();if(!b)return;var p=b.querySelector('#qr-menu-import-preview-v2'),count=b.querySelector('#qr-menu-import-count-v2'),save=b.querySelector('#qr-menu-import-save-v2'),clear=b.querySelector('#qr-menu-import-clear-v2');if(!p)return;items=items||[];
    count.textContent=String(items.length);
    var html='<div style="display:grid;gap:8px;max-height:560px;overflow:auto">';
    items.forEach(function(x,i){html+='<div data-import-row="'+i+'" style="padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(0,0,0,.08)"><div style="display:grid;grid-template-columns:minmax(150px,2fr) minmax(110px,1fr) minmax(110px,1fr);gap:7px"><input data-field="name" value="'+esc(inputValue(x.name))+'" placeholder="Блюдо"><input data-field="price" type="number" min="0" step="0.01" value="'+esc(inputValue(x.price))+'" placeholder="Цена"><input data-field="category" value="'+esc(inputValue(x.category))+'" placeholder="Категория"></div><input data-field="description" value="'+esc(inputValue(x.description))+'" placeholder="Описание" style="width:100%;margin-top:7px;box-sizing:border-box"><div style="display:flex;gap:7px;margin-top:7px;flex-wrap:wrap"><input data-field="unit" value="'+esc(inputValue(x.unit))+'" placeholder="ед. (шт/г/мл/порция)" style="max-width:180px"><input data-field="weight" type="number" min="0" step="0.01" value="'+esc(inputValue(x.weight))+'" placeholder="Вес/объём" style="max-width:150px"><button type="button" class="btn btn-danger btn-sm" data-remove-import="'+i+'">Удалить</button></div></div>';});
    html+='</div>';
    if(warnings&&warnings.length){html+='<div style="margin-top:10px;padding:10px;border:1px solid rgba(251,191,36,.3);border-radius:10px;background:rgba(251,191,36,.08)"><b>⚠ Предупреждения</b>'+warnings.map(function(w){return '<div class="muted" style="font-size:12px;margin-top:4px">'+esc(w)+'</div>';}).join('')+'</div>';}
    p.innerHTML=html;save.style.display=items.length?'inline-block':'none';clear.style.display=items.length?'inline-block':'none';
  }
  function syncFromDom(v){var b=block(),rows=b&&b.querySelectorAll('[data-import-row]');if(!rows)return;var items=[];Array.prototype.forEach.call(rows,function(row,idx){var x=(v.importItems||[])[idx]||{};x.name=clean((row.querySelector('[data-field="name"]')||{}).value);x.price=(row.querySelector('[data-field="price"]')||{}).value===''?null:Number((row.querySelector('[data-field="price"]')||{}).value);x.category=clean((row.querySelector('[data-field="category"]')||{}).value)||'Основные блюда';x.description=clean((row.querySelector('[data-field="description"]')||{}).value);x.unit=clean((row.querySelector('[data-field="unit"]')||{}).value).toLowerCase();x.weight=(row.querySelector('[data-field="weight"]')||{}).value===''?null:Number((row.querySelector('[data-field="weight"]')||{}).value);items.push(x);});v.importItems=items.filter(function(x){return x.name;});}
  function setBusy(v,busy){v.importBusy=!!busy;var b=block();if(!b)return;Array.prototype.forEach.call(b.querySelectorAll('button,input'),function(x){x.disabled=!!busy;});}
  function validateForSave(v){syncFromDom(v);var bad=(v.importItems||[]).filter(function(x){return !x.name||x.price==null||!Number.isFinite(Number(x.price))||Number(x.price)<0||!x.category;});if(bad.length)throw new Error('Перед сохранением укажите цену и категорию для всех позиций.');}

  async function save(v){
    validateForSave(v);var items=v.importItems||[];
    if(!items.length)throw new Error('Нет позиций для сохранения');
    if(!v.venue)throw new Error('Не выбрано заведение');
    if(v.perms&&!v.perms.products&&!v.perms.addons)throw new Error('Нет прав на добавление позиций');
    var limit=v.currentPlan?Number(v.currentPlan.max_products||0):0;var available=limit?Math.max(0,limit-v.products.length):items.length;
    if(!available)throw new Error('Лимит позиций меню исчерпан');
    if(items.length>available)items=items.slice(0,available);
    var existing=Array.isArray(v.products)?v.products:[];var existingKeys={};existing.forEach(function(p){existingKeys[key(p.category)+'::'+key(p.name)]=true;});
    var fresh=[];var skipped=0;
    items.forEach(function(x){var k=key(x.category)+'::'+key(x.name);if(existingKeys[k]){skipped++;return;}existingKeys[k]=true;fresh.push(x);});
    if(!fresh.length)throw new Error('Все импортированные позиции уже есть в меню.');
    setStatus('Сохраняю '+fresh.length+' новых позиций…');
    for(var i=0;i<fresh.length;i+=50){var rows=fresh.slice(i,i+50).map(function(x){return{venue_id:v.venue.id,name:x.name,description:x.description||null,price:Number(x.price),category:x.category||'Основные блюда',image_url:x.image_url||null,is_available:x.is_available!==false,applies_to:'all'};});var r=await db.from('products').insert(rows);if(r.error)throw r.error;}
    if(typeof v.loadProducts==='function')await v.loadProducts();v.importItems=[];render([],[]);setStatus('✓ Меню сохранено: '+fresh.length+' новых позиций'+(skipped?' · пропущено дублей: '+skipped:''));
  }

  async function startFile(file,v){
    if(!file)return;if(file.size>MAX_FILE)throw new Error('Файл превышает лимит 10 МБ.');
    var mime=String(file.type||'').toLowerCase();var ok=(mime==='application/pdf'||mime==='image/jpeg'||mime==='image/png'||mime==='image/webp'||/\.pdf$/i.test(file.name)||/\.(jpe?g|png|webp)$/i.test(file.name));
    if(!ok)throw new Error('Поддерживаются только PDF, JPG, PNG и WEBP.');
    var temp=await uploadTemp(file,v);try{
      setStatus(mime==='application/pdf'||/\.pdf$/i.test(file.name)?'🤖 Qrchick анализирует весь PDF целиком…':'🤖 Qrchick анализирует изображение…');
      var data=await request({source:'file',language:'ru',file:{url:temp.url,temp_path:temp.path,name:file.name,mime:file.type,size:file.size}});
      var added=mergeImportResult(v,data,file.name);render(v.importItems,v.importWarnings);setStatus('✓ Qrchick обработал '+file.name+': '+added+' позиций · всего подготовлено '+v.importItems.length+(v.importWarnings.length?' · есть предупреждения':''));
    }finally{await deleteTemp(temp.path);}
  }

  async function startUrl(url,v){url=clean(url);if(!/^https?:\/\//i.test(url))throw new Error('Укажите корректную ссылку http/https.');setStatus('🤖 Qrchick анализирует сайт…');var data=await request({source:'url',language:'ru',url:url});mergeImportResult(v,data,'Сайт');render(v.importItems,v.importWarnings);setStatus(v.importItems.length?'✓ Qrchick завершил анализ сайта: '+v.importItems.length+' позиций':'⚠ Qrchick не нашёл меню. Укажите прямую ссылку на страницу меню.',!v.importItems.length);if(data.menu&&data.menu.venue_name)v.importVenue={name:data.menu.venue_name};}

  document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('#qr-menu-import-pdf-v2,#qr-menu-import-photo-v2,#qr-menu-import-site-v2,#qr-menu-import-save-v2,#qr-menu-import-clear-v2,[data-remove-import]'):null;if(!t)return;var b=t.closest('#qr-menu-import-block-v2'),v=vm();if(!b||!v)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(v.importBusy)return;
    if(t.id==='qr-menu-import-save-v2'){setBusy(v,true);save(v).catch(function(err){setStatus(err.message||String(err),true);}).finally(function(){setBusy(v,false);});return;}
    if(t.id==='qr-menu-import-clear-v2'){v.importItems=[];v.importWarnings=[];render([],[]);setStatus('');return;}
    if(t.hasAttribute('data-remove-import')){syncFromDom(v);var idx=Number(t.getAttribute('data-remove-import'));v.importItems.splice(idx,1);render(v.importItems,v.importWarnings||[]);return;}
    if(t.id==='qr-menu-import-site-v2'){var url=window.prompt('Адрес сайта или прямой PDF:','https://');if(url&&url!=='https://'){setBusy(v,true);startUrl(url,v).catch(function(err){setStatus(err.message||String(err),true);}).finally(function(){setBusy(v,false);});}return;}
    var input=b.querySelector(t.id==='qr-menu-import-pdf-v2'?'#qr-menu-import-pdf-input-v2':'#qr-menu-import-photo-input-v2');if(input)input.click();
  },true);

  document.addEventListener('change',function(e){var input=e.target;if(!input||!input.closest)return;var b=input.closest('#qr-menu-import-block-v2'),v=vm();if(!b||!v)return;if(input.id!=='qr-menu-import-pdf-input-v2'&&input.id!=='qr-menu-import-photo-input-v2')return;e.stopPropagation();e.stopImmediatePropagation();var files=Array.prototype.slice.call(input.files||[]);input.value='';if(!files.length||v.importBusy)return;var work=input.id==='qr-menu-import-pdf-input-v2'?[files[0]]:files;setBusy(v,true);(async function(){try{v.importItems=[];v.importWarnings=[];render([],[]);for(var i=0;i<work.length;i++){setStatus('⏳ Qrchick обрабатывает файл '+(i+1)+' из '+work.length+'…');await startFile(work[i],v);if(i<work.length-1){setStatus('✓ Qrchick обработал файл '+(i+1)+'. Продолжаю…');}}}catch(err){setStatus(err.message||String(err),true);}finally{setBusy(v,false);}})();},true);

  document.addEventListener('input',function(e){var t=e.target;if(!t||!t.closest)return;var row=t.closest('[data-import-row]'),v=vm();if(!row||!v)return;var idx=Number(row.getAttribute('data-import-row'));var x=v.importItems&&v.importItems[idx];if(!x)return;var f=t.getAttribute('data-field');if(f==='name'||f==='category'||f==='description'||f==='unit')x[f]=clean(t.value);else if(f==='price'||f==='weight')x[f]=t.value===''?null:Number(t.value);},true);
})();
