/* QR Menu — AI import bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_COMPAT__) return;
  window.__QR_MANAGER_SITE_IMPORT_COMPAT__=true;

  window.QRManagerSiteImport={mount:function(){},unmount:function(){}};
  if(window.__QR_MENU_AI_IMPORT__) return;
  window.__QR_MENU_AI_IMPORT__=true;

  var API='/api/import-ai';
  var PDFJS_URL='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.mjs';
  var PDFJS_WORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.mjs';
  var pdfjsPromise=null;

  function getVm(){return window.__managerVue||null;}
  function setStatus(block,text,isError){
    var el=block&&block.querySelector('#qr-menu-import-status-v2');
    if(el){el.textContent=text||'';el.style.color=isError?'#fca5a5':'';}
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  async function authToken(){
    try{
      var r=await db.auth.getSession();
      return r&&r.data&&r.data.session?r.data.session.access_token:'';
    }catch(e){return '';}
  }
  async function send(payload){
    var headers={'Content-Type':'application/json','Accept':'application/json'};
    var token=await authToken();
    if(token) headers.Authorization='Bearer '+token;
    var response=await fetch(API,{method:'POST',credentials:'same-origin',headers:headers,body:JSON.stringify(payload)});
    var data=await response.json().catch(function(){return null;});
    if(!response.ok||!data||!data.ok) throw new Error(data&&data.error&&data.error.message||('AI HTTP '+response.status));
    return data;
  }
  function fileData(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(String(reader.result||''));};
      reader.onerror=function(){reject(new Error('Не удалось прочитать файл'));};
      reader.readAsDataURL(file);
    });
  }
  function normalize(vm,items){
    return (Array.isArray(items)?items:[]).map(function(x,i){
      var imageUrl=String(x&&x.image_url||'').trim();
      var item={
        name:String(x&&x.name||'').trim(),
        description:String(x&&x.description||'').trim(),
        price:Number(x&&x.price)||0,
        category:String(x&&x.category||'Основные блюда').trim()||'Основные блюда',
        image_url:imageUrl.indexOf('http://')===0||imageUrl.indexOf('https://')===0?imageUrl:'',
        is_available:x&&x.is_available!==false,
        applies_to:'all'
      };
      if(!item.image_url&&vm&&typeof vm.dishImageUrl==='function') item.image_url=vm.dishImageUrl(item,i+1);
      return item;
    }).filter(function(x){return x.name;});
  }
  function dedupe(items){
    var seen={};
    return (items||[]).filter(function(x){
      var key=(String(x.name||'').toLowerCase().replace(/\s+/g,' ').trim()+'|'+String(x.price||0)).slice(0,400);
      if(!key||seen[key]) return false;
      seen[key]=true;
      return true;
    });
  }
  function render(block,items){
    var preview=block.querySelector('#qr-menu-import-preview-v2');
    var count=block.querySelector('#qr-menu-import-count-v2');
    var save=block.querySelector('#qr-menu-import-save-v2');
    var clear=block.querySelector('#qr-menu-import-clear-v2');
    if(!preview||!count||!save||!clear) return;
    count.textContent=String(items.length);
    preview.innerHTML=items.slice(0,30).map(function(x){
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+escapeHtml(x.name)+'</span><b>'+Number(x.price||0).toLocaleString('ru-RU')+' ₽</b></div>';
    }).join('')+(items.length>30?'<div class="muted" style="font-size:11px;margin-top:6px">и ещё '+(items.length-30)+'…</div>':'');
    save.style.display=items.length?'inline-block':'none';
    clear.style.display=items.length?'inline-block':'none';
  }
  async function run(block,vm,kind,payload){
    if(vm.importBusy) return;
    vm.importBusy=true;
    try{
      setStatus(block,'🤖 ИИ Gemini анализирует '+kind+'…',false);
      var data=await send(Object.assign({kind:kind},payload||{}));
      vm.importItems=normalize(vm,data.products);
      render(block,vm.importItems);
      setStatus(block,'✓ Gemini нашёл '+vm.importItems.length+' позиций',false);
    }catch(e){
      console.error('[QR Gemini import]',e);
      vm.importItems=[];
      render(block,[]);
      setStatus(block,'Ошибка AI: '+e.message,true);
    }finally{
      vm.importBusy=false;
    }
  }
  async function loadPdfJs(){
    if(pdfjsPromise) return pdfjsPromise;
    pdfjsPromise=import(PDFJS_URL).then(function(mod){
      if(!mod||!mod.getDocument) throw new Error('PDF_JS_LOAD_FAILED');
      mod.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
      return mod;
    }).catch(function(err){
      pdfjsPromise=null;
      throw err;
    });
    return pdfjsPromise;
  }
  async function renderPdfPage(page){
    var baseViewport=page.getViewport({scale:1});
    var maxWidth=1500;
    var maxHeight=2100;
    var scale=Math.min(maxWidth/baseViewport.width,maxHeight/baseViewport.height,1.65);
    var canvas=document.createElement('canvas');
    var ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:false});
    var dataUrl='';
    for(var attempt=0;attempt<4;attempt++){
      var viewport=page.getViewport({scale:scale});
      canvas.width=Math.max(1,Math.ceil(viewport.width));
      canvas.height=Math.max(1,Math.ceil(viewport.height));
      await page.render({canvasContext:ctx,viewport:viewport,background:'white'}).promise;
      dataUrl=canvas.toDataURL('image/jpeg',attempt===0?0.78:attempt===1?0.68:attempt===2?0.58:0.48);
      if(dataUrl.length<=3000000) break;
      scale*=0.78;
    }
    if(dataUrl.length>3300000) throw new Error('PDF_PAGE_TOO_LARGE');
    return dataUrl;
  }
  async function importPdf(block,vm,pdf){
    var pdfjs=await loadPdfJs();
    var buffer=await pdf.arrayBuffer();
    var documentRef=await pdfjs.getDocument({data:buffer}).promise;
    var total=documentRef.numPages;
    if(!total) throw new Error('PDF_EMPTY');
    if(total>80) throw new Error('PDF_TOO_MANY_PAGES');
    var all=[];
    for(var pageNo=1;pageNo<=total;pageNo++){
      setStatus(block,'🤖 Gemini: PDF — страница '+pageNo+' из '+total+'…',false);
      var page=await documentRef.getPage(pageNo);
      var image=await renderPdfPage(page);
      var result=await send({
        kind:'image',
        filename:(pdf.name||'menu.pdf')+' — страница '+pageNo,
        data:image
      });
      all=all.concat(normalize(vm,result.products));
      vm.importItems=dedupe(all);
      render(block,vm.importItems);
    }
    vm.importItems=dedupe(all);
    render(block,vm.importItems);
    setStatus(block,'✓ Gemini обработал '+total+' стр. и нашёл '+vm.importItems.length+' позиций',false);
  }

  document.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target.closest('#qr-menu-import-pdf-v2,#qr-menu-import-photo-v2,#qr-menu-import-site-v2'):null;
    if(!target) return;
    var block=target.closest('#qr-menu-import-block-v2');
    var vm=getVm();
    if(!block||!vm) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(target.id==='qr-menu-import-site-v2'){
      var url=prompt('Адрес сайта заведения:','https://');
      if(url&&url!=='https://') run(block,vm,'сайт',{url:url.trim()});
      return;
    }
    var input=block.querySelector(target.id==='qr-menu-import-pdf-v2'?'#qr-menu-import-pdf-input-v2':'#qr-menu-import-photo-input-v2');
    if(input) input.click();
  },true);

  document.addEventListener('change',async function(e){
    var input=e.target;
    if(!input||!input.closest||!input.closest('#qr-menu-import-block-v2')) return;
    var block=input.closest('#qr-menu-import-block-v2');
    var vm=getVm();
    if(!block||!vm) return;
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(input.id==='qr-menu-import-pdf-input-v2'){
      var pdf=input.files&&input.files[0];
      input.value='';
      if(!pdf||vm.importBusy) return;
      vm.importBusy=true;
      try{
        setStatus(block,'📄 Подготавливаю PDF для Gemini…',false);
        await importPdf(block,vm,pdf);
      }catch(err){
        console.error('[QR Gemini PDF]',err);
        vm.importItems=[];
        render(block,[]);
        var msg=err&&err.message?err.message:'Неизвестная ошибка';
        if(msg==='PDF_TOO_MANY_PAGES') msg='В PDF больше 80 страниц. Разбейте меню на несколько файлов.';
        if(msg==='PDF_PAGE_TOO_LARGE') msg='Не удалось сжать страницу PDF до допустимого размера.';
        setStatus(block,'Ошибка AI: '+msg,true);
      }finally{
        vm.importBusy=false;
      }
      return;
    }

    if(input.id==='qr-menu-import-photo-input-v2'){
      var files=Array.from(input.files||[]);
      input.value='';
      if(!files.length||vm.importBusy) return;
      vm.importBusy=true;
      try{
        var all=[];
        for(var i=0;i<files.length;i++){
          setStatus(block,'🤖 ИИ Gemini анализирует фото '+(i+1)+' из '+files.length+'…',false);
          var result=await send({kind:'image',filename:files[i].name,data:await fileData(files[i])});
          all=all.concat(normalize(vm,result.products));
        }
        vm.importItems=dedupe(all);
        render(block,vm.importItems);
        setStatus(block,'✓ Gemini нашёл '+vm.importItems.length+' позиций',false);
      }catch(err2){
        console.error('[QR Gemini photo]',err2);
        vm.importItems=[];
        render(block,[]);
        setStatus(block,'Ошибка AI: '+err2.message,true);
      }finally{
        vm.importBusy=false;
      }
    }
  },true);
})();
