/* QR Menu — AI import bridge. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_COMPAT__) return;
  window.__QR_MANAGER_SITE_IMPORT_COMPAT__=true;

  window.QRManagerSiteImport={
    mount:function(){},
    unmount:function(){}
  };

  if(window.__QR_MENU_AI_IMPORT__) return;
  window.__QR_MENU_AI_IMPORT__=true;

  var API='/api/import-ai';
  function qs(s){return document.querySelector(s);}
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
        setStatus(block,'🤖 ИИ Gemini анализирует PDF…',false);
        var pdfResult=await send({kind:'pdf',filename:pdf.name,data:await fileData(pdf)});
        vm.importItems=normalize(vm,pdfResult.products);
        render(block,vm.importItems);
        setStatus(block,'✓ Gemini нашёл '+vm.importItems.length+' позиций',false);
      }catch(err){
        console.error('[QR Gemini PDF]',err);
        vm.importItems=[];
        render(block,[]);
        setStatus(block,'Ошибка AI: '+err.message,true);
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
        vm.importItems=all;
        render(block,all);
        setStatus(block,'✓ Gemini нашёл '+all.length+' позиций',false);
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
