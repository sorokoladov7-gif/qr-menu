/* QR Menu — single AI import controller for menu photos, PDFs and websites. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_COMPAT__) return;
  window.__QR_MANAGER_SITE_IMPORT_COMPAT__=true;
  window.QRManagerSiteImport={mount:function(){},unmount:function(){}};
  if(window.__QR_MENU_AI_IMPORT__) return;
  window.__QR_MENU_AI_IMPORT__=true;
  window.__QR_SINGLE_MENU_IMPORT_CONTROLLER__=true;

  var AI_API='/api/import-ai';
  var SITE_API='/api/import-site';
  var PDFJS_URL='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.mjs';
  var PDFJS_WORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.mjs';
  var pdfjsPromise=null;
  var PAGE_MAX_DATA_URL=1850000;
  var IMAGE_MAX_DATA_URL=1850000;

  function getVm(){return window.__managerVue||null;}
  function setStatus(block,text,isError){var el=block&&block.querySelector('#qr-menu-import-status-v2');if(el){el.textContent=text||'';el.style.color=isError?'#fca5a5':'';}}
  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  async function authToken(){try{var r=await db.auth.getSession();return r&&r.data&&r.data.session?r.data.session.access_token:'';}catch(e){return '';}}
  async function sendAi(payload){
    var headers={'Content-Type':'application/json','Accept':'application/json'};
    var token=await authToken();
    if(!token) throw new Error('AUTH_REQUIRED');
    headers.Authorization='Bearer '+token;
    var response=await fetch(AI_API,{method:'POST',credentials:'same-origin',headers:headers,body:JSON.stringify(payload),cache:'no-store'});
    var data=await response.json().catch(function(){return null;});
    if(!response.ok||!data||!data.ok){var err=new Error(data&&data.error&&data.error.message||('AI HTTP '+response.status));err.status=response.status;err.code=data&&data.error&&data.error.code||'';throw err;}
    return data;
  }
  async function sendSite(url){
    var headers={'Accept':'application/json'};
    var token=await authToken();
    if(!token) throw new Error('AUTH_REQUIRED');
    headers.Authorization='Bearer '+token;
    var response=await fetch(SITE_API+'?url='+encodeURIComponent(url),{credentials:'same-origin',headers:headers,cache:'no-store'});
    var data=await response.json().catch(function(){return null;});
    if(!response.ok||!data||data.ok===false){var err=new Error((data&&data.error&&data.error.message)||('SITE HTTP '+response.status));err.status=response.status;err.code=data&&data.error&&data.error.code||'';throw err;}
    return data;
  }
  function normalize(vm,items){
    return (Array.isArray(items)?items:[]).map(function(x,i){
      var imageUrl=String(x&&x.image_url||'').trim();
      var item={name:String(x&&x.name||'').replace(/\s+/g,' ').trim(),description:String(x&&x.description||'').replace(/\s+/g,' ').trim(),price:Number(x&&x.price)||0,category:String(x&&x.category||'Основные блюда').replace(/\s+/g,' ').trim()||'Основные блюда',image_url:/^https?:\/\//i.test(imageUrl)?imageUrl:'',is_available:x&&x.is_available!==false,applies_to:'all'};
      if(!item.image_url&&vm&&typeof vm.dishImageUrl==='function') item.image_url=vm.dishImageUrl(item,i+1);
      return item;
    }).filter(function(x){return x.name;});
  }
  function mergeUnique(items){
    var out=[],seen={};
    (items||[]).forEach(function(x){
      var key=(String(x.name||'').toLowerCase().replace(/\s+/g,' ').trim()+'|'+String(Number(x.price)||0));
      if(!x.name||seen[key])return;
      seen[key]=true;out.push(x);
    });
    return out;
  }
  function render(block,items){
    var preview=block&&block.querySelector('#qr-menu-import-preview-v2'),count=block&&block.querySelector('#qr-menu-import-count-v2'),save=block&&block.querySelector('#qr-menu-import-save-v2'),clear=block&&block.querySelector('#qr-menu-import-clear-v2');
    if(!preview||!count||!save||!clear)return;
    count.textContent=String((items||[]).length);
    preview.innerHTML=(items||[]).slice(0,30).map(function(x){return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+escapeHtml(x.name)+'</span><b>'+Number(x.price||0).toLocaleString('ru-RU')+' ₽</b></div>';}).join('')+((items||[]).length>30?'<div class="muted" style="font-size:11px;margin-top:6px">и ещё '+((items||[]).length-30)+'…</div>':'');
    save.style.display=(items||[]).length?'inline-block':'none';
    clear.style.display=(items||[]).length?'inline-block':'none';
  }
  function blobToDataUrl(blob){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result||''));};reader.onerror=function(){reject(new Error('IMAGE_READ_FAILED'));};reader.readAsDataURL(blob);});}
  function fileToImage(file){return new Promise(function(resolve,reject){var url=URL.createObjectURL(file),img=new Image();img.onload=function(){URL.revokeObjectURL(url);resolve(img);};img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('IMAGE_READ_FAILED'));};img.src=url;});}
  async function prepareImage(file,maxDataUrl){
    var img=await fileToImage(file);
    var maxEdge=2400,scale=Math.min(1,maxEdge/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    var ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(var attempt=0;attempt<6;attempt++){
      var quality=[0.82,0.74,0.66,0.58,0.5,0.42][attempt];
      var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/jpeg',quality);});
      if(!blob)continue;
      var data=await blobToDataUrl(blob);
      if(data.length<=maxDataUrl)return data;
      canvas.width=Math.max(700,Math.round(canvas.width*0.86));canvas.height=Math.max(900,Math.round(canvas.height*0.86));ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    }
    throw new Error('IMAGE_TOO_LARGE');
  }
  async function loadPdfJs(){
    if(pdfjsPromise)return pdfjsPromise;
    pdfjsPromise=import(PDFJS_URL).then(function(mod){if(!mod||!mod.getDocument)throw new Error('PDF_JS_LOAD_FAILED');mod.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return mod;}).catch(function(err){pdfjsPromise=null;throw err;});
    return pdfjsPromise;
  }
  async function pageText(page){
    try{var textContent=await page.getTextContent();return (textContent.items||[]).map(function(x){return String(x.str||'').trim();}).filter(Boolean).join(' ').replace(/\s+/g,' ').slice(0,24000);}catch(e){return '';}
  }
  async function renderPdfPage(page){
    var base=page.getViewport({scale:1}),maxW=1450,maxH=2050,scale=Math.min(maxW/base.width,maxH/base.height,1.45),canvas=document.createElement('canvas');
    for(var attempt=0;attempt<6;attempt++){
      var vp=page.getViewport({scale:scale});canvas.width=Math.max(1,Math.ceil(vp.width));canvas.height=Math.max(1,Math.ceil(vp.height));
      var ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport:vp,background:'white'}).promise;
      var quality=[0.78,0.7,0.62,0.54,0.46,0.4][attempt],blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/jpeg',quality);});
      if(blob){var data=await blobToDataUrl(blob);if(data.length<=PAGE_MAX_DATA_URL)return data;}
      scale*=0.84;
    }
    throw new Error('PDF_PAGE_TOO_LARGE');
  }
  function isRetryable(error){var status=Number(error&&error.status)||0,code=String(error&&error.code||'');return status===0||status===408||status===429||status===500||status===502||status===503||status===504||code==='GEMINI_TIMEOUT'||code==='AI_INVALID_JSON';}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  async function analyzePage(vm,pdfName,pageNo,total,page,block){
    var image=await renderPdfPage(page),context=await pageText(page),lastError=null;
    for(var attempt=1;attempt<=2;attempt++){
      try{
        setStatus(block,'🤖 Gemini: PDF — страница '+pageNo+' из '+total+' · попытка '+attempt+'…',false);
        return await sendAi({kind:'image',filename:(pdfName||'menu.pdf')+' — страница '+pageNo,data:image,context:context});
      }catch(error){
        lastError=error;
        if(!isRetryable(error)||attempt===2)break;
        await sleep(500*attempt);
      }
    }
    throw lastError||new Error('PDF_PAGE_ANALYSIS_FAILED');
  }
  async function importPdf(block,vm,file){
    var pdfjs=await loadPdfJs(),buffer=await file.arrayBuffer(),doc=await pdfjs.getDocument({data:buffer}).promise,total=Number(doc.numPages||0);
    if(!total)throw new Error('PDF_EMPTY');
    if(total>80)throw new Error('PDF_TOO_MANY_PAGES');
    var all=[],skipped=[];
    for(var pageNo=1;pageNo<=total;pageNo++){
      var page=null;
      try{
        page=await doc.getPage(pageNo);
        var result=await analyzePage(vm,file.name,pageNo,total,page,block);
        all=mergeUnique(all.concat(normalize(vm,result.products)));
        vm.importItems=all;render(block,all);
      }catch(error){
        skipped.push(pageNo);
        console.error('[QR Menu PDF page '+pageNo+']',error);
        vm.importItems=all;render(block,all);
        setStatus(block,'⚠ Страница '+pageNo+' пропущена, продолжаю. Уже найдено: '+all.length,false);
      }finally{if(page&&page.cleanup)page.cleanup();}
    }
    if(doc.destroy)await doc.destroy().catch(function(){});
    if(skipped.length)setStatus(block,'⚠ PDF обработан: '+(total-skipped.length)+' из '+total+' стр.; пропущены: '+skipped.join(', ')+'; найдено '+all.length+' позиций',true);
    else setStatus(block,'✓ Gemini обработал все '+total+' стр. и нашёл '+all.length+' позиций',false);
    return all;
  }
  async function importPhotos(block,vm,files){
    var all=[];
    for(var i=0;i<files.length;i++){
      var result=null,lastError=null,image=await prepareImage(files[i],IMAGE_MAX_DATA_URL);
      for(var attempt=1;attempt<=2;attempt++){
        try{setStatus(block,'🤖 Gemini: фото '+(i+1)+' из '+files.length+' · попытка '+attempt+'…',false);result=await sendAi({kind:'image',filename:files[i].name,data:image});break;}catch(error){lastError=error;if(!isRetryable(error)||attempt===2)break;await sleep(500*attempt);}
      }
      if(!result){console.error('[QR Menu photo]',lastError);setStatus(block,'⚠ Фото '+(i+1)+' пропущено, продолжаю…',true);continue;}
      all=mergeUnique(all.concat(normalize(vm,result.products)));vm.importItems=all;render(block,all);
    }
    setStatus(block,'✓ Gemini обработал '+files.length+' фото и нашёл '+all.length+' позиций',false);return all;
  }
  async function importSite(block,vm,url){
    setStatus(block,'🌐 ИИ анализирует сайт: '+url+'…',false);
    var data=await sendSite(url),items=normalize(vm,data.products);vm.importItems=mergeUnique(items);render(block,vm.importItems);
    if(data.venue)vm.importVenue=data.venue;
    var meta=data.meta||{};setStatus(block,'✓ Сайт: найдено '+vm.importItems.length+' позиций'+(meta.confidence?' · уверенность '+meta.confidence+'%':'')+(meta.validation?' · '+meta.validation:'').trim(),false);
  }
  document.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target.closest('#qr-menu-import-pdf-v2,#qr-menu-import-photo-v2,#qr-menu-import-site-v2'):null;
    if(!target)return;
    var block=target.closest('#qr-menu-import-block-v2'),vm=getVm();if(!block||!vm)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(vm.importBusy)return;
    if(target.id==='qr-menu-import-site-v2'){
      var url=prompt('Адрес сайта заведения:','https://');if(url&&url!=='https://'){vm.importBusy=true;importSite(block,vm,url.trim()).catch(function(err){console.error('[QR Menu site]',err);setStatus(block,'Ошибка сайта: '+(err.message||err),true);}).finally(function(){vm.importBusy=false;});}
      return;
    }
    var input=block.querySelector(target.id==='qr-menu-import-pdf-v2'?'#qr-menu-import-pdf-input-v2':'#qr-menu-import-photo-input-v2');if(input)input.click();
  },true);
  document.addEventListener('change',async function(e){
    var input=e.target;if(!input||!input.closest||!input.closest('#qr-menu-import-block-v2'))return;
    var block=input.closest('#qr-menu-import-block-v2'),vm=getVm();if(!block||!vm)return;
    e.stopPropagation();e.stopImmediatePropagation();
    if(input.id==='qr-menu-import-pdf-input-v2'){
      var file=input.files&&input.files[0];input.value='';if(!file||vm.importBusy)return;vm.importBusy=true;
      try{vm.importItems=[];render(block,[]);setStatus(block,'📄 Подготавливаю PDF для Gemini…',false);await importPdf(block,vm,file);}catch(error){console.error('[QR Menu PDF]',error);setStatus(block,'Ошибка PDF: '+(error.message||error),true);}finally{vm.importBusy=false;}
      return;
    }
    if(input.id==='qr-menu-import-photo-input-v2'){
      var files=Array.from(input.files||[]);input.value='';if(!files.length||vm.importBusy)return;vm.importBusy=true;
      try{vm.importItems=[];render(block,[]);await importPhotos(block,vm,files);}catch(error2){console.error('[QR Menu photo]',error2);setStatus(block,'Ошибка фото: '+(error2.message||error2),true);}finally{vm.importBusy=false;}
    }
  },true);
})();
