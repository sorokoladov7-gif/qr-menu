/* QR-Menu — меню заведения + импорт PDF/фото/сайта + выбор создания заведения */
(function(){
  'use strict';
  if (window.__QR_MANAGER_MENU_V2__) return;
  window.__QR_MANAGER_MENU_V2__ = true;

  var PDFJS_SRC='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var OCR_WORKER=null;

  function clean(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];}); }
  function slug(v){ return clean(v).toLowerCase().replace(/[^a-zа-яё0-9]+/giu,'-').replace(/^-|-$/g,'').slice(0,70); }
  function isCategory(s){ return /^(закуски|салаты?|супы?|горяч(?:ие|ее)\s+блюда|пицца|суши|роллы?|бургеры?|десерты?|напитки?|завтраки?|гарниры?|паста|стейки?|соусы?|мангал|гриль|основные блюда|детское меню|барная карта|бар|кофе|кофейная карта)$/iu.test(clean(s)); }
  function parsePrice(s){
    var text=String(s||''),m=text.match(/(?:^|\s)(\d{1,3}(?:[ .]\d{3})*|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)(?:\s|$)/iu);
    if(!m)m=text.match(/(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)\s*(\d{1,3}(?:[ .]\d{3})*|\d{1,6})(?:[.,]\d{1,2})?/iu);
    if(m){var n=Number(String(m[1]).replace(/[ .]/g,''));return n>0&&n<1000000?n:0;}
    var tail=text.match(/(?:^|\s)(\d{2,5}(?:[ .]\d{3})?)\s*$/u);
    if(tail&&!/^\d+(?:[.,]\d+)?\s*(?:г|гр|кг|мл|л|см|шт)\.?$/iu.test(text)){var x=Number(String(tail[1]).replace(/[ .]/g,''));if(x>=30&&x<=99999)return x;}
    return 0;
  }
  function stripPrice(s){ return clean(String(s||'').replace(/(?:\d{1,3}(?:[ .]\d{3})*|\d{1,6})(?:[.,]\d{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)|(?:₽|руб(?:лей|ля|ль)?\.?|р\.?|RUB)\s*(?:\d{1,3}(?:[ .]\d{3})*|\d{1,6})(?:[.,]\d{1,2})?|\s(?:\d{2,5}(?:[ .]\d{3})?)\s*$/giu,'')); }
  function loadScript(src,id){ return new Promise(function(resolve,reject){ if(document.getElementById(id)) return resolve(); var s=document.createElement('script'); s.id=id; s.src=src; s.onload=resolve; s.onerror=function(){reject(new Error('Не удалось загрузить библиотеку распознавания'));}; document.head.appendChild(s); }); }
  async function loadPdfJs(){ if(window.pdfjsLib)return window.pdfjsLib; await loadScript(PDFJS_SRC,'qr-menu-pdfjs-v311'); if(!window.pdfjsLib)throw new Error('PDF.js не загрузился'); window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER; return window.pdfjsLib; }
  async function getOcrWorker(){
    if(OCR_WORKER)return OCR_WORKER;
    if(!window.Tesseract || typeof window.Tesseract.createWorker!=='function') await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','qr-menu-tesseract-v5');
    if(!window.Tesseract || typeof window.Tesseract.createWorker!=='function') throw new Error('OCR не загрузился');
    OCR_WORKER=await window.Tesseract.createWorker('rus+eng');
    return OCR_WORKER;
  }
  async function ocrCanvas(canvas){
    var worker=await getOcrWorker(),r=await worker.recognize(canvas),words=(r.data&&r.data.words)||[],rows=[];
    words.forEach(function(w){
      var t=clean(w.text);if(!t)return;var b=w.bbox||{},x=Number(b.x0||0),y=Number(b.y0||0),ww=Math.max(1,Number(b.x1||x)-x),hh=Math.max(9,Number(b.y1||y)-Number(b.y0||y));
      var row=rows.find(function(a){return Math.abs(a.y-y)<12;});
      if(!row){row={y:y,h:hh,items:[]};rows.push(row);}
      row.items.push({text:t,x:x,y:y,w:ww,h:hh});row.h=Math.max(row.h,hh);
    });
    rows.forEach(function(r){r.items.sort(function(a,b){return a.x-b.x;});r.text=r.items.map(function(x){return x.text;}).join(' ');r.x=r.items[0].x;r.right=r.items[r.items.length-1].x+r.items[r.items.length-1].w;});
    return rows.sort(function(a,b){return a.y-b.y;});
  }
  function textRows(items,viewport){
    var rows=[];(items||[]).forEach(function(it){var t=clean(it.str);if(!t)return;var tr=it.transform||[],x=Number(tr[4]||0)*viewport.scale,y=viewport.height-Number(tr[5]||0)*viewport.scale,w=Number(it.width||0)*viewport.scale,h=Math.max(9,Math.abs(Number(tr[3]||10))*viewport.scale),row=rows.find(function(r){return Math.abs(r.y-y)<Math.max(9,h*.8);});if(!row){row={y:y,h:h,items:[]};rows.push(row);}row.items.push({text:t,x:x,y:y,w:w,h:h});row.h=Math.max(row.h,h);});rows.forEach(function(r){r.items.sort(function(a,b){return a.x-b.x;});r.text=r.items.map(function(x){return x.text;}).join(' ');r.x=Math.min.apply(null,r.items.map(function(x){return x.x;}));r.right=Math.max.apply(null,r.items.map(function(x){return x.x+x.w;}));});return rows.sort(function(a,b){return a.y-b.y;});
  }
  function crop(canvas,x,y,w,h){
    if(!canvas||!canvas.width||!canvas.height)return null;var sx=Math.max(0,Math.floor(x-28)),sy=Math.max(0,Math.floor(y-100)),ex=Math.min(canvas.width,Math.ceil(x+w+28)),ey=Math.min(canvas.height,Math.ceil(y+h+70));
    if(ex-sx<180){sx=Math.max(0,Math.floor(x-90));ex=Math.min(canvas.width,sx+240);} if(ey-sy<120)ey=Math.min(canvas.height,sy+170);var cw=ex-sx,ch=ey-sy;if(cw<=0||ch<=0)return null;
    var out=document.createElement('canvas'),tw=600,th=Math.min(480,Math.max(190,Math.round(ch*(tw/cw))));out.width=tw;out.height=th;out.getContext('2d').drawImage(canvas,sx,sy,cw,ch,0,0,tw,th);return out.toDataURL('image/jpeg',0.72);
  }
  function rowsToProducts(rows,width,canvas){
    var products=[],used={},category='main',hasL=rows.some(function(r){return r.x<width*.43;}),hasR=rows.some(function(r){return r.x>width*.55;}),two=hasL&&hasR;
    function add(name,desc,price,row){name=clean(name);if(!name||name.length<2||name.length>220||isCategory(name)||!price)return;if(/^(меню|каталог|цены|карта меню|страница|состав)$/iu.test(name))return;var key=name.toLowerCase();if(used[key])return;used[key]=1;var x=row.x||0,w=Math.max(200,(row.right||x+220)-x);if(two){if(x<width*.5){x=0;w=width*.5;}else{x=width*.5;w=width*.5;}}products.push({name:name,description:clean(desc)||null,price:price,category:category||'main',image_url:crop(canvas,x,row.y,w,row.h),is_available:true,applies_to:'all'});}
    rows.forEach(function(row,i){var txt=row.text,price=parsePrice(txt);if(!price){if(isCategory(txt))category=slug(txt)||txt;return;}var name=stripPrice(txt),desc='';if(name.length>100){var parts=name.split(/\s+[—–-]\s+|\s{2,}/);if(parts.length>1){name=parts.shift();desc=parts.join(' ');}else{name=name.slice(0,180);}}if(!name&&i)name=rows[i-1].text;if(/^(от|всего|цена|стоимость)$/iu.test(name)&&i)name=rows[i-1].text;add(name,desc,price,row);});
    return products;
  }
  function blobFromDataUrl(dataUrl){return fetch(dataUrl).then(function(r){return r.blob();});}
  function imageElement(file){return new Promise(function(resolve,reject){var u=URL.createObjectURL(file),img=new Image();img.onload=function(){URL.revokeObjectURL(u);resolve(img);};img.onerror=function(){URL.revokeObjectURL(u);reject(new Error('Не удалось прочитать изображение'));};img.src=u;});}
  async function parseImage(file){
    var img=await imageElement(file),scale=Math.min(2.2,2600/Math.max(img.width,img.height));scale=Math.max(1.4,scale);var canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);var rows=await ocrCanvas(canvas);return rowsToProducts(rows,canvas.width,canvas);
  }
  async function parsePdf(file,status){
    var pdfjs=await loadPdfJs(),buf=await file.arrayBuffer(),doc=await pdfjs.getDocument({data:buf}).promise,all=[],seen={},ocrCount=0,max=Math.min(doc.numPages||0,60);
    for(var p=1;p<=max;p++){var page=await doc.getPage(p),vp=page.getViewport({scale:2.1}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;var rows=textRows((await page.getTextContent()).items||[],vp),items=rowsToProducts(rows,canvas.width,canvas);if(!items.length){items=rowsToProducts(await ocrCanvas(canvas),canvas.width,canvas);ocrCount++;}items.forEach(function(x){var k=x.name.toLowerCase();if(!seen[k]){seen[k]=1;x.page=p;all.push(x);}});if(status)status.textContent='Распознаю PDF: страница '+p+' из '+max+(ocrCount?' · OCR':'')+'…';}
    return {products:all,pages:doc.numPages,ocrPages:ocrCount,name:clean(file.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' '))||'Меню'};
  }
  function renderImportCard(root){
    if(root.querySelector('#qr-menu-import-block-v2'))return root.querySelector('#qr-menu-import-block-v2');
    var block=document.createElement('div');block.id='qr-menu-import-block-v2';block.className='glass card';block.style.cssText='margin-bottom:16px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.045);';
    block.innerHTML='<div class="spread" style="gap:12px;align-items:flex-start"><div><h3 style="margin:0">📥 Импорт меню</h3><div class="muted" style="font-size:12px;margin-top:4px">Загрузите готовое меню. Система распознает позиции и добавит их как обычные блюда.</div></div><span id="qr-menu-import-count-v2" class="badge2">0</span></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px"><button id="qr-menu-import-pdf-v2" class="btn btn-ghost" type="button">📄 PDF меню</button><button id="qr-menu-import-photo-v2" class="btn btn-ghost" type="button">📷 Фото меню</button><button id="qr-menu-import-site-v2" class="btn btn-ghost" type="button">🌐 С сайта</button></div><input id="qr-menu-import-pdf-input-v2" type="file" accept="application/pdf,.pdf" hidden><input id="qr-menu-import-photo-input-v2" type="file" accept="image/*" multiple hidden><div id="qr-menu-import-status-v2" class="muted" style="margin-top:11px;font-size:12px"></div><div id="qr-menu-import-preview-v2" style="margin-top:10px"></div><div class="row" style="margin-top:10px"><button id="qr-menu-import-save-v2" class="btn btn-primary" type="button" style="display:none">✅ Добавить в меню</button><button id="qr-menu-import-clear-v2" class="btn btn-ghost" type="button" style="display:none">Очистить</button></div>';
    var menu=document.querySelector('.menu-compact');if(menu&&menu.parentNode)menu.parentNode.insertBefore(block,menu);else root.insertBefore(block,root.firstChild);return block;
  }
  async function persistImages(items,venueId){
    for(var i=0;i<items.length;i++){var x=items[i];if(!x.image_url||String(x.image_url).indexOf('data:image/')!==0)continue;var blob=await blobFromDataUrl(x.image_url),fn=venueId+'/'+Date.now()+'-'+i+'.jpg',r=await db.storage.from('menu-images').upload(fn,blob,{cacheControl:'3600',upsert:true,contentType:'image/jpeg'});if(!r.error)x.image_url=db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;}
    return items;
  }
  async function insertProducts(vm,items){
    if(!vm.venue||!items.length)throw new Error('Нет распознанных позиций');
    if(!vm.perms.products&&!vm.perms.addons)throw new Error('Нет прав на добавление позиций');
    var limit=vm.currentPlan?Number(vm.currentPlan.max_products||0):0,available=limit?Math.max(0,limit-vm.products.length):items.length;if(!available)throw new Error('Лимит позиций меню исчерпан');if(items.length>available)items=items.slice(0,available);
    vm.importStatus='Сохраняю '+items.length+' позиций…';await persistImages(items,vm.venue.id);
    var rows=items.map(function(i){return{venue_id:vm.venue.id,name:i.name,description:i.description||null,price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,is_available:true,applies_to:i.applies_to||'all'};});
    for(var start=0;start<rows.length;start+=50){var r=await db.from('products').insert(rows.slice(start,start+50));if(r.error)throw r.error;}
    await vm.loadProducts();return items.length;
  }
  function renderPreview(block,items){
    var p=block.querySelector('#qr-menu-import-preview-v2'),count=block.querySelector('#qr-menu-import-count-v2'),save=block.querySelector('#qr-menu-import-save-v2'),clear=block.querySelector('#qr-menu-import-clear-v2');count.textContent=items.length;p.innerHTML=items.slice(0,20).map(function(x){return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+esc(x.name)+'</span><b>'+Number(x.price||0).toLocaleString('ru-RU')+' ₽</b></div>';}).join('')+(items.length>20?'<div class="muted" style="font-size:11px;margin-top:6px">и ещё '+(items.length-20)+'…</div>':'');save.style.display=items.length?'inline-block':'none';clear.style.display=items.length?'inline-block':'none';
  }
  function bindImportBlock(vm,block){
    if(block.__bound)return;block.__bound=true;vm.importStatus='';
    var status=block.querySelector('#qr-menu-import-status-v2'),save=block.querySelector('#qr-menu-import-save-v2'),clear=block.querySelector('#qr-menu-import-clear-v2'),pdf=block.querySelector('#qr-menu-import-pdf-input-v2'),photos=block.querySelector('#qr-menu-import-photo-input-v2');
    var setStatus=function(t,err){status.textContent=t||'';status.style.color=err?'#fca5a5':'';};
    block.querySelector('#qr-menu-import-pdf-v2').onclick=function(){if(vm.importBusy)return;pdf.click();};
    block.querySelector('#qr-menu-import-photo-v2').onclick=function(){if(vm.importBusy)return;photos.click();};
    block.querySelector('#qr-menu-import-site-v2').onclick=function(){var u=prompt('Адрес сайта заведения:','https://');if(!u||u==='https://')return;vm.importBusy=true;setStatus('Анализирую сайт…');fetch('/api/import-site?url='+encodeURIComponent(u),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}).then(function(r){return r.json().catch(function(){return null;}).then(function(d){if(!d||!r.ok||d.ok===false)throw new Error((d&&(d.error||d.message))||'Ошибка HTTP '+r.status);return d;});}).then(function(d){vm.importItems=(d.products||[]).map(function(x){return{name:x.name,description:x.description||null,price:Number(x.price)||0,category:x.category||'main',image_url:x.image_url||null};});renderPreview(block,vm.importItems);setStatus('✓ Найдено позиций: '+vm.importItems.length);}).catch(function(e){setStatus('Ошибка: '+e.message,true);}).finally(function(){vm.importBusy=false;});};
    pdf.onchange=async function(){var f=pdf.files&&pdf.files[0];pdf.value='';if(!f)return;vm.importBusy=true;setStatus('Подготавливаю PDF…');try{var d=await parsePdf(f,status);vm.importItems=d.products;renderPreview(block,vm.importItems);setStatus('✓ Распознано позиций: '+vm.importItems.length+(d.ocrPages?' · OCR страниц: '+d.ocrPages:''));}catch(e){vm.importItems=[];renderPreview(block,[]);setStatus('Ошибка чтения PDF: '+e.message,true);}finally{vm.importBusy=false;}};
    photos.onchange=async function(){var fs=Array.prototype.slice.call(photos.files||[]);photos.value='';if(!fs.length)return;vm.importBusy=true;vm.importItems=[];try{for(var i=0;i<fs.length;i++){setStatus('Распознаю фото '+(i+1)+' из '+fs.length+'…');var arr=await parseImage(fs[i]);vm.importItems=vm.importItems.concat(arr);}renderPreview(block,vm.importItems);setStatus('✓ Распознано позиций: '+vm.importItems.length);}catch(e){vm.importItems=[];renderPreview(block,[]);setStatus('Ошибка распознавания фото: '+e.message,true);}finally{vm.importBusy=false;}};
    save.onclick=async function(){if(!vm.importItems.length||vm.importBusy)return;vm.importBusy=true;save.disabled=true;setStatus('Добавляю позиции в меню…');try{var n=await insertProducts(vm,vm.importItems.slice());vm.importItems=[];renderPreview(block,[]);setStatus('✓ Добавлено в меню: '+n);vm.showToast('Импортировано позиций: '+n);}catch(e){setStatus('Ошибка импорта: '+e.message,true);}finally{vm.importBusy=false;save.disabled=false;}};
    clear.onclick=function(){vm.importItems=[];renderPreview(block,[]);setStatus('');};
  }

  var menuMixin={
    data:function(){return{products:[],showModal:false,editing:null,pform:{name:'',description:'',price:0,category:'main',image_url:'',applies_to:'all'},detailProduct:null,importItems:[],importBusy:false,importStatus:'',createVenueMode:'choice'};},
    computed:{modalTitle:function(){return this.editing?'Редактировать':'Новое блюдо';}},
    methods:{
      prepareCreateVenueModal:function(){
        var self=this;
        self.createVenueMode='choice';
        self.newVenueForm.template=null;
        self.formError='';
        return Promise.resolve().then(function(){
          return new Promise(function(resolve){
            self.$nextTick(function(){
              var root=document.getElementById('app'),modal=root&&root.querySelector('.modal');
              if(!modal){resolve();return;}
              var content=modal.firstElementChild;
              if(!content){resolve();return;}
              var grid=content.querySelector('.template-grid'),preview=content.querySelector('.template-preview');
              if(!grid){resolve();return;}
              grid.id='qr-template-grid-v11';
              if(preview)preview.id='qr-template-preview-v11';
              var oldChoice=content.querySelector('#qr-create-mode-choice-v1');
              if(oldChoice)oldChoice.remove();
              var choice=document.createElement('div');choice.id='qr-create-mode-choice-v1';choice.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0;';
              choice.innerHTML='<button type="button" data-create-mode="template" style="text-align:left;padding:18px;border-radius:14px;border:1px solid rgba(99,102,241,.35);background:rgba(99,102,241,.08);color:#fff;cursor:pointer"><div style="font-size:22px;margin-bottom:6px">🍽️</div><b style="font-size:15px">Из шаблона</b><div style="font-size:11px;color:#9ca3af;margin-top:4px">Готовое меню с блюдами и ценами</div></button><button type="button" data-create-mode="manual" style="text-align:left;padding:18px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;cursor:pointer"><div style="font-size:22px;margin-bottom:6px">🛠️</div><b style="font-size:15px">Настрою сам(а)</b><div style="font-size:11px;color:#9ca3af;margin-top:4px">Только название заведения — меню добавите сами</div></button>';
              grid.parentNode.insertBefore(choice,grid);
              var title=content.querySelector('h3');if(title)title.textContent='Новое заведение';
              var intro=title&&title.nextElementSibling;if(intro&&intro.tagName==='P')intro.textContent='Выберите способ создания заведения. Шаблон добавит готовое меню, ручная настройка создаст пустое меню.';
              var setMode=function(mode){
                self.createVenueMode=mode;
                if(mode==='manual')self.newVenueForm.template=null;
                var onTemplate=mode==='template';
                Array.prototype.forEach.call(choice.querySelectorAll('button[data-create-mode]'),function(b){var on=b.getAttribute('data-create-mode')===mode;b.style.borderColor=on?'#8b5cf6':'rgba(255,255,255,.12)';b.style.background=on?'rgba(99,102,241,.14)':'rgba(255,255,255,.04)';});
                grid.style.display=onTemplate?'':'none';
                if(preview)preview.style.display=onTemplate?'':'none';
                var catalog=content.querySelector('.manager-template-catalog');if(catalog)catalog.style.display=onTemplate?'':'none';
                var label=Array.prototype.slice.call(content.querySelectorAll('label')).find(function(x){return/шаблон ниши/i.test(x.textContent||'');});if(label)label.style.display=onTemplate?'':'none';
                if(onTemplate){self.$nextTick(function(){if(typeof self.decorateVenueTemplateCards==='function')self.decorateVenueTemplateCards();});}
              };
              Array.prototype.forEach.call(choice.querySelectorAll('button[data-create-mode]'),function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-create-mode'));});});
              setMode('choice');
              resolve();
            });
          });
        });
      },
      createVenue:function(){
        var self=this,mode=this.createVenueMode||'choice';
        self.formError='';
        if(mode==='choice'){self.formError='Выберите способ создания: «Из шаблона» или «Настрою сам(а)»';return;}
        if(!this.newVenueForm.name||!this.newVenueForm.slug){self.formError='Заполните название и код заведения';return;}
        if(!this.canCreateVenue){self.formError='Лимит заведений';return;}
        var template=mode==='template'?this.selectedVenueTemplate:null;
        if(mode==='template'&&!template){self.formError='Выберите шаблон';return;}
        if(template&&this.currentPlan&&this.currentPlan.max_products&&template.products.length>this.currentPlan.max_products){self.formError='В выбранном тарифе недостаточно места для шаблона ('+template.products.length+' позиций).';return;}
        self.busy=true;
        var planId=(this.managerSubscription&&this.managerSubscription.plan_id)||(this.currentPlan&&this.currentPlan.id)||null;
        var subscriptionEnd=(this.managerSubscription&&this.managerSubscription.current_period_end)||this.subscriptionEnd||null;
        if(!planId&&Array.isArray(this.plans)&&this.venue&&this.venue.plan)planId=this.venue.plan;
        if(!planId)planId='start';
        if(!subscriptionEnd){var e=new Date();e.setDate(e.getDate()+10);subscriptionEnd=e.toISOString();}
        var makeSlug=typeof window.slugify==='function'?window.slugify:slug;
        var code=makeSlug(this.newVenueForm.slug);
        if(!code){self.formError='Некорректный slug';self.busy=false;return;}
        var items=template&&Array.isArray(template.products)?template.products:[];
        db.rpc('create_venue_for_manager',{p_name:this.newVenueForm.name.trim(),p_slug:code,p_plan:planId,p_subscription_end:subscriptionEnd,p_products:items}).then(function(r){if(r.error)throw r.error;return r.data;}).then(function(venue){
          self.showCreateVenue=false;
          self.newVenueForm={name:'',slug:'',template:null};
          self.templateSearchQuery='';
          self.createVenueMode='choice';
          return self.loadMyVenues().then(function(){self.selectVenue(venue);self.showToast(mode==='template'?'Заведение создано из шаблона: '+template.name+' · '+items.length+' позиций добавлено':'Заведение создано. Пустое меню готово к настройке');});
        }).catch(function(err){console.error('createVenue error:',err);self.formError='Ошибка: '+(err.message||String(err));}).finally(function(){self.busy=false;});
      },
      loadProducts:function(){var self=this;return db.from('products').select('*').eq('venue_id',this.venue.id).order('created_at').then(function(r){self.products=r.data||[];self.$nextTick(function(){var root=document.querySelector('[data-menu-root]')||document.querySelector('div[v-if="tab===\\'menu\\'"]')||document.getElementById('app');if(root){var block=renderImportCard(root);bindImportBlock(self,block);}});});},
      openAdd:function(){if(!this.perms.products&&!this.perms.addons){this.showToast('Нет прав: добавление запрещено админом','error');return;}if(this.currentPlan&&this.products.length>=this.currentPlan.max_products){this.showToast('Лимит позиций','error');return;}this.editing=null;this.pform={name:'',description:'',price:0,category:'main',image_url:'',applies_to:'all'};this.formError='';this.showModal=true;},
      openEdit:function(p){if(p.category==='addon'&&!this.perms.addons){this.showToast('Нет прав на дополнения','error');return;}this.editing=p;this.pform={name:p.name,description:p.description||'',price:Number(p.price)||0,category:p.category,image_url:p.image_url||'',applies_to:p.applies_to||'all'};this.formError='';this.showModal=true;},
      closeModal:function(){this.showModal=false;this.pform={};},
      saveProduct:function(){var self=this;if(!this.pform.name){this.formError='Введите название';return;}self.busy=true;var row={name:this.pform.name,description:this.pform.description||null,price:Number(this.pform.price)||0,category:this.pform.category,image_url:this.pform.image_url||null,applies_to:this.pform.applies_to||'all'},p;if(this.editing)p=db.from('products').update(row).eq('id',this.editing.id);else{row.venue_id=this.venue.id;row.is_available=true;p=db.from('products').insert(row);}p.then(function(r){if(r.error)throw r.error;self.showModal=false;self.loadProducts().then(function(){self.showToast('Сохранено');});}).catch(function(e){self.formError='Ошибка: '+e.message;}).finally(function(){self.busy=false;});},
      uploadImage:function(ev){var self=this,f=ev.target.files[0];if(!f)return;self.uploading=true;self.resizeImage(f,900,.85).then(function(blob){var fn=self.venue.id+'/'+Date.now()+'.jpg';return db.storage.from('menu-images').upload(fn,blob,{cacheControl:'3600',upsert:true,contentType:'image/jpeg'}).then(function(r){if(r.error)throw r.error;self.pform.image_url=db.storage.from('menu-images').getPublicUrl(fn).data.publicUrl;});}).catch(function(e){self.showToast('Ошибка: '+e.message,'error');}).finally(function(){self.uploading=false;ev.target.value='';});},
      delProduct:function(p){if(!confirm('Удалить «'+p.name+'»?'))return;var self=this;db.from('products').delete().eq('id',p.id).then(function(){self.loadProducts();self.showToast('Удалено');});},
      toggleAvail:function(p){var self=this;db.from('products').update({is_available:!p.is_available}).eq('id',p.id).then(function(){self.loadProducts();});},
      showProductDetail:function(product){this.detailProduct=product;},closeProductDetail:function(){this.detailProduct=null;}
    }
  };
  window.__QR_MANAGER_MENU_MIXIN__=menuMixin;
})();