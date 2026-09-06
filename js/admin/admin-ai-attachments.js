/* QR Menu — Qrchick admin chat attachments */
(function(){
  'use strict';
  if(window.__QRCHICK_ATTACHMENTS__)return;
  window.__QRCHICK_ATTACHMENTS__=true;

  var MAX_BYTES=3*1024*1024,MAX_FILES=3,pending=[];
  var ACCEPT='image/*,application/pdf,text/plain,text/markdown,text/csv,application/json,application/javascript,text/javascript,text/css,text/html,application/xml,text/xml';

  function session(){
    try{return window.db&&db.auth&&db.auth.getSession?db.auth.getSession():Promise.resolve({data:{session:null}});}
    catch(e){return Promise.resolve({data:{session:null}});}
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' Б';if(n<1048576)return (n/1024).toFixed(1)+' КБ';return (n/1048576).toFixed(1)+' МБ';}
  function status(t){var e=document.getElementById('qc-status');if(e)e.textContent=t;}

  function compressImage(file){
    if(file.size<=MAX_BYTES)return Promise.resolve(file);
    return new Promise(function(resolve,reject){
      var r=new FileReader();
      r.onerror=function(){reject(new Error('Не удалось прочитать изображение'));};
      r.onload=function(ev){
        var img=new Image();
        img.onerror=function(){reject(new Error('Не удалось обработать изображение'));};
        img.onload=function(){
          var max=1800,w=img.width,h=img.height;
          if(w>max){h=Math.round(h*max/w);w=max;}
          if(h>max){w=Math.round(w*max/h);h=max;}
          var c=document.createElement('canvas');c.width=w;c.height=h;
          var ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
          c.toBlob(function(blob){
            if(!blob||blob.size>MAX_BYTES)return reject(new Error('Изображение после сжатия всё ещё больше 3 МБ'));
            resolve(new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:Date.now()}));
          },'image/jpeg',.78);
        };
        img.src=ev.target.result;
      };
      r.readAsDataURL(file);
    });
  }
  function readBase64(file){
    return new Promise(function(resolve,reject){
      var r=new FileReader();
      r.onerror=function(){reject(new Error('Не удалось прочитать '+file.name));};
      r.onload=function(){var s=String(r.result||'');resolve(s.split(',').pop()||'');};
      r.readAsDataURL(file);
    });
  }

  function render(){
    var old=document.getElementById('qc-attachments');if(old)old.remove();
    if(!pending.length)return;
    var inputWrap=document.querySelector('.qc-input-wrap');if(!inputWrap)return;
    var bar=document.createElement('div');bar.id='qc-attachments';bar.className='qc-attachments';
    bar.innerHTML=pending.map(function(a,i){
      var type=a.file.type||'';
      var icon=type.indexOf('image/')===0?'▧':type==='application/pdf'?'PDF':'TXT';
      return '<div class="qc-attachment"><span class="qc-attachment-icon">'+icon+'</span><div><b>'+esc(a.file.name)+'</b><small>'+fmt(a.file.size)+'</small></div><button type="button" data-remove-attachment="'+i+'" aria-label="Удалить">×</button></div>';
    }).join('');
    inputWrap.parentNode.insertBefore(bar,inputWrap);
    bar.querySelectorAll('[data-remove-attachment]').forEach(function(b){b.onclick=function(){pending.splice(Number(b.dataset.removeAttachment),1);render();};});
  }

  function addFiles(files){
    files=Array.prototype.slice.call(files||[]);
    if(!files.length)return;
    if(pending.length+files.length>MAX_FILES){alert('Можно прикрепить максимум '+MAX_FILES+' файла за сообщение.');return;}
    files.forEach(function(file){
      if(file.size>MAX_BYTES&&!/^image\//i.test(file.type)){alert(file.name+': файл больше 3 МБ. Для PDF и документов текущий лимит — 3 МБ.');return;}
      pending.push({file:file});
    });
    render();
  }

  async function analyzeOne(item,prompt,access){
    var file=await compressImage(item.file);
    if(file.size>MAX_BYTES)throw new Error(file.name+': больше 3 МБ');
    var data=await readBase64(file);
    var r=await fetch('/api/admin-ai-attachment',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify({prompt:prompt,file:{name:file.name,type:file.type,size:file.size,data:data}})});
    var d=await r.json().catch(function(){return{};});
    if(!r.ok)throw new Error(d.error||('Ошибка обработки '+file.name));
    return {name:file.name,analysis:String(d.analysis||'').slice(0,14000)};
  }

  async function sendWithAttachments(send){
    if(!pending.length)return false;
    var input=document.getElementById('qc-input');
    var message=input?input.value.trim():'';
    if(!message)message='Проанализируй прикреплённые материалы и сопоставь их с текущим проектом.';
    var s=await session(),access=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!access)throw new Error('Сессия администратора не найдена');
    var current=pending.slice(),results=[];
    status('Qrchick анализирует вложения…');
    for(var i=0;i<current.length;i++){
      status('Qrchick читает вложение '+(i+1)+' из '+current.length+'…');
      results.push(await analyzeOne(current[i],message,access));
    }
    var context='\n\n[ВЛОЖЕНИЯ ПЕРЕДАНЫ QRCHICK]\n'+results.map(function(x){return '\nФайл: '+x.name+'\nАнализ вложения:\n'+x.analysis;}).join('\n')+'\n\nИспользуй этот контекст вместе с GitHub, Supabase и Vercel. Если вложение показывает ошибку интерфейса или код, сопоставь его с реальным проектом и не делай выводов, не подтверждённых репозиторием.';
    pending=[];render();
    input.value=message+context;
    if(send.__qrchickOriginal)send.__qrchickOriginal.call(send);
    else send.click();
    return true;
  }

  function hideProviderNames(){
    var root=document.getElementById('qr-center');if(!root)return;
    root.querySelectorAll('.qc-model span').forEach(function(e){e.remove();});
    root.querySelectorAll('.qc-cap').forEach(function(e){if(/gemini|flash/i.test(e.textContent))e.textContent='AI-агент · готов';});
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),nodes=[],n;
    while((n=walker.nextNode()))nodes.push(n);
    nodes.forEach(function(t){
      if(/gemini/i.test(t.nodeValue))t.nodeValue=t.nodeValue.replace(/Gemini(?:\s+3(?:\.\d+)?(?:\s+Flash(?:\s+(?:Lite|Pro))?)?|\s+API)?/gi,'AI-агент');
    });
  }

  function polish(){
    var model=document.querySelector('.qc-model span');if(model)model.remove();
    hideProviderNames();
    var input=document.getElementById('qc-input');
    if(input){input.placeholder='Сообщение…';input.setAttribute('aria-label','Сообщение для Qrchick');}
    var attach=document.getElementById('qc-attach');
    if(attach){attach.setAttribute('aria-label','Прикрепить файл');attach.title='Прикрепить файл';}
    var send=document.getElementById('qc-send');if(send)send.setAttribute('aria-label','Отправить сообщение');
    if(!document.getElementById('qc-chat-polish')){
      var style=document.createElement('style');style.id='qc-chat-polish';style.textContent='.qc-model span{display:none!important}.qc-attachments{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 7px}.qc-attachment{display:flex;align-items:center;gap:7px;min-width:150px;max-width:260px;padding:7px 8px;border:1px solid rgba(83,203,255,.18);border-radius:10px;background:rgba(9,31,51,.8)}.qc-attachment-icon{width:25px;height:25px;border-radius:7px;background:#0c3855;color:#8fe5ff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800}.qc-attachment div{min-width:0;flex:1}.qc-attachment b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px}.qc-attachment small{display:block;color:#6788a4;font-size:9px;margin-top:2px}.qc-attachment button{border:0;background:transparent;color:#6f8da7;font-size:18px;cursor:pointer}.qc-attach-drag .qc-input-wrap{border-color:#36cfff;box-shadow:0 0 0 2px rgba(54,207,255,.08)}.qc-input-wrap:focus-within{border-color:rgba(91,207,255,.48);box-shadow:0 0 0 3px rgba(53,190,255,.07),0 12px 35px rgba(0,0,0,.28)}';document.head.appendChild(style);
    }
  }

  function bind(){
    var attach=document.getElementById('qc-attach'),send=document.getElementById('qc-send'),input=document.getElementById('qc-input');
    if(!attach||!send||!input){setTimeout(bind,200);return;}
    if(attach.__qrBound)return;
    attach.__qrBound=true;polish();
    var picker=document.createElement('input');picker.type='file';picker.id='qc-file-picker';picker.multiple=true;picker.accept=ACCEPT;picker.style.display='none';document.body.appendChild(picker);
    attach.onclick=function(e){e.preventDefault();picker.click();};
    picker.onchange=function(){addFiles(picker.files);picker.value='';};
    input.addEventListener('paste',function(e){var files=Array.prototype.slice.call((e.clipboardData&&e.clipboardData.files)||[]).filter(function(f){return /^image\//i.test(f.type);});if(files.length){e.preventDefault();addFiles(files);}});
    var compose=document.querySelector('.qc-compose');
    if(compose){compose.addEventListener('dragover',function(e){e.preventDefault();compose.classList.add('qc-attach-drag');});compose.addEventListener('dragleave',function(){compose.classList.remove('qc-attach-drag');});compose.addEventListener('drop',function(e){e.preventDefault();compose.classList.remove('qc-attach-drag');addFiles(e.dataTransfer&&e.dataTransfer.files);});}
    send.__qrchickOriginal=send.onclick;
    send.onclick=function(){
      if(!pending.length)return send.__qrchickOriginal&&send.__qrchickOriginal.call(send);
      if(send.__qrAttachmentBusy)return;
      send.__qrAttachmentBusy=true;send.disabled=true;
      sendWithAttachments(send).catch(function(e){alert('Qrchick: '+e.message);status('Ошибка');}).finally(function(){send.__qrAttachmentBusy=false;send.disabled=false;});
    };
    hideProviderNames();
    try{new MutationObserver(function(){polish();hideProviderNames();}).observe(document.getElementById('qr-center'),{childList:true,subtree:true});}catch(e){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else setTimeout(bind,50);
})();