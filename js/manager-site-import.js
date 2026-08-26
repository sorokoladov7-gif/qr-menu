/* QR Menu — manager website import flow v3. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_SITE_IMPORT_V3__) return;
  window.__QR_MANAGER_SITE_IMPORT_V3__=true;

  var MODAL_ID='qr-manager-create-modal-v9';
  var state={mode:'template',data:null,busy:false};
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function slugify(v){
    var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
    return String(v||'').toLowerCase().trim().replace(/[а-яё]/g,function(c){return m[c]||'';}).replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  }
  function findModal(){return document.getElementById(MODAL_ID);}
  function showError(m,msg){var e=m&&m.querySelector('#qr-create-error-v9');if(e){e.textContent=msg;e.style.display='block';}}
  function hideError(m){var e=m&&m.querySelector('#qr-create-error-v9');if(e)e.style.display='none';}
  function safeInsert(parent,node,before){
    if(!parent||!node)return;
    if(before&&before.parentNode===parent) parent.insertBefore(node,before);
    else parent.appendChild(node);
  }

  function install(modal){
    if(!modal||modal.dataset.siteImportInstalled==='3')return;
    var content=modal.firstElementChild;if(!content)return;
    var templateLabel=Array.from(content.querySelectorAll('label')).find(function(x){return /шаблон ниши/i.test(x.textContent||'');});
    var templateGrid=content.querySelector('#qr-template-grid-v9');
    var templatePreview=content.querySelector('#qr-template-preview-v9');
    var name=content.querySelector('#qr-venue-name-v9');
    var slug=content.querySelector('#qr-venue-slug-v9');
    var submit=content.querySelector('#qr-create-submit-v9');
    if(!templateGrid||!name||!slug||!submit)return;
    modal.dataset.siteImportInstalled='3';

    var old=document.getElementById('qr-site-import-switcher-v2');if(old)old.remove();
    old=document.getElementById('qr-site-import-panel-v2');if(old)old.remove();

    var switcher=document.createElement('div');switcher.id='qr-site-import-switcher-v2';
    switcher.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px';
    switcher.innerHTML='<button type="button" data-mode="template" style="border:1px solid #8b5cf6;background:rgba(99,102,241,.14);color:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">🍽️ Создать из шаблона</button><button type="button" data-mode="site" style="border:1px solid rgba(255,255,255,.12);background:#172236;color:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">🌐 Импортировать с сайта</button>';
    safeInsert(content,switcher,templateLabel&&templateLabel.parentNode===content?templateLabel:templateGrid);

    var panel=document.createElement('div');panel.id='qr-site-import-panel-v2';
    panel.style.cssText='display:none;margin-top:14px;border:1px solid rgba(96,165,250,.28);background:rgba(37,99,235,.06);border-radius:14px;padding:14px';
    panel.innerHTML='<div style="font-weight:800;margin-bottom:6px">🌐 Импорт существующего заведения</div><div style="color:#9ca3af;font-size:12px;margin-bottom:10px">Введите адрес сайта. Система попробует получить данные заведения.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="qr-site-url-v2" type="url" autocomplete="url" placeholder="https://example.ru" style="flex:1;min-width:220px;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;box-sizing:border-box"><button id="qr-site-find-v2" type="button" style="background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer">🔍 Найти информацию</button></div><div id="qr-site-status-v2" style="display:none;margin-top:9px;color:#93c5fd;font-size:12px"></div><div id="qr-site-preview-v2" style="margin-top:12px"></div>';
    safeInsert(content,panel,switcher.nextSibling&&switcher.nextSibling.parentNode===content?switcher.nextSibling:null);

    var modeButtons=switcher.querySelectorAll('button');
    function setMode(mode){
      state.mode=mode;state.data=null;
      modeButtons.forEach(function(b){var on=b.dataset.mode===mode;b.style.borderColor=on?'#8b5cf6':'rgba(255,255,255,.12)';b.style.background=on?'rgba(99,102,241,.14)':'#172236';});
      var site=mode==='site';panel.style.display=site?'block':'none';if(templateLabel)templateLabel.style.display=site?'none':'';templateGrid.style.display=site?'none':'grid';if(templatePreview)templatePreview.style.display=site?'none':'';submit.textContent=site?'Создать импортированное заведение':'Создать заведение';
    }
    modeButtons.forEach(function(b){b.onclick=function(){setMode(b.dataset.mode);};});

    panel.querySelector('#qr-site-find-v2').onclick=async function(){
      if(state.busy)return;
      var input=panel.querySelector('#qr-site-url-v2'),status=panel.querySelector('#qr-site-status-v2'),preview=panel.querySelector('#qr-site-preview-v2'),url=input.value.trim();hideError(modal);
      if(!url){showError(modal,'Введите адрес сайта заведения');input.focus();return;}
      if(!/^https?:\/\//i.test(url))url='https://'+url;
      try{new URL(url);}catch(_){showError(modal,'Некорректный адрес сайта');return;}
      state.busy=true;this.disabled=true;this.textContent='Анализирую...';status.style.display='block';status.textContent='Получаю сайт и ищу данные заведения...';preview.innerHTML='';
      try{
        var r=await fetch('/api/import-site?url='+encodeURIComponent(url),{credentials:'same-origin',headers:{'Accept':'application/json'}});
        var data=await r.json().catch(function(){return{};});
        if(!r.ok)throw new Error(data.message||data.error||('HTTP '+r.status));
        state.data=data;var v=data.venue||{},items=Array.isArray(data.products)?data.products:[];
        name.value=v.name||'';slug.value=slugify(v.name||new URL(url).hostname.split('.')[0]);
        status.textContent='✓ Сайт обработан. Проверьте найденные данные.';
        preview.innerHTML='<div style="border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;background:rgba(15,23,42,.65)"><div style="display:flex;gap:12px;align-items:center">'+(v.logo_url?'<img src="'+esc(v.logo_url)+'" style="width:52px;height:52px;border-radius:12px;object-fit:cover" onerror="this.style.display=\'none\'">':'<div style="font-size:34px">🏪</div>')+'<div><b style="font-size:17px">'+esc(v.name||'Заведение')+'</b><div style="font-size:12px;color:#94a3b8">'+esc(v.address||'Адрес не найден')+'</div></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px;font-size:12px;color:#cbd5e1"><div>☎ '+esc(v.phone||'не найден')+'</div><div>🌐 '+esc(v.website_url||url)+'</div><div>🍽️ '+items.length+' позиций</div></div>'+ (v.description?'<div style="margin-top:10px;color:#94a3b8;font-size:12px">'+esc(v.description)+'</div>':'')+'<div style="margin-top:10px;color:'+(items.length?'#6ee7b7':'#fcd34d')+';font-size:12px">'+(items.length?'✓ Меню найдено.':'⚠ Меню автоматически не найдено. Заведение всё равно можно создать, а меню добавить вручную.')+'</div></div>';
      }catch(e){status.style.display='none';showError(modal,'Ошибка импорта: '+(e.message||String(e)));}
      finally{state.busy=false;this.disabled=false;this.textContent='🔍 Найти информацию';}
    };

    submit.addEventListener('click',async function(e){
      if(state.mode!=='site')return;e.preventDefault();e.stopImmediatePropagation();if(state.busy)return;hideError(modal);
      if(!state.data){showError(modal,'Сначала укажите сайт и нажмите «Найти информацию»');return;}
      var v=state.data.venue||{},items=Array.isArray(state.data.products)?state.data.products:[],venueName=(name.value.trim()||v.name||'').trim(),venueSlug=slugify(slug.value.trim()||v.name||'');
      if(!venueName){showError(modal,'Не найдено название заведения');return;}if(!venueSlug){showError(modal,'Не удалось сформировать код заведения');return;}
      state.busy=true;submit.disabled=true;submit.textContent='Создаю...';
      try{
        var u=await db.auth.getUser(),uid=u&&u.data&&u.data.user&&u.data.user.id;if(!uid)throw new Error('Сессия управляющего не найдена');
        var sr=await db.from('subscriptions').select('plan_id,current_period_end,status').eq('manager_id',uid).order('created_at',{ascending:false}).limit(1).maybeSingle();if(sr.error)throw sr.error;if(!sr.data)throw new Error('Подписка не найдена');if(['active','trialing'].indexOf(sr.data.status)===-1)throw new Error('Подписка не активна');
        var pr=await db.from('plans').select('id,max_products').eq('id',sr.data.plan_id).maybeSingle();if(pr.error)throw pr.error;if(pr.data&&pr.data.max_products&&items.length>Number(pr.data.max_products))throw new Error('На выбранном тарифе лимит '+pr.data.max_products+' позиций, а найдено '+items.length+'.');
        var payload=items.slice(0,Number(pr.data&&pr.data.max_products||500)).map(function(i){return{name:i.name,description:i.description||null,price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,is_available:i.is_available!==false,applies_to:i.applies_to||'all'};});
        var rr=await db.rpc('manager_import_venue',{p_name:venueName,p_slug:venueSlug,p_plan:sr.data.plan_id,p_subscription_end:sr.data.current_period_end,p_address:v.address||null,p_phone:v.phone||null,p_website_url:v.website_url||panel.querySelector('#qr-site-url-v2').value.trim(),p_description:v.description||null,p_logo_url:v.logo_url||null,p_opening_hours:v.opening_hours||null,p_products:payload});
        if(rr.error)throw rr.error;
        alert('Заведение «'+venueName+'» создано из сайта. Импортировано позиций: '+(rr.data&&rr.data.products_count!=null?rr.data.products_count:payload.length)+'.');location.reload();
      }catch(e){showError(modal,'Ошибка создания: '+(e.message||String(e)));submit.disabled=false;submit.textContent='Создать импортированное заведение';state.busy=false;}
    },true);
    setMode('template');
  }

  var observer=new MutationObserver(function(){var m=findModal();if(m)install(m);});
  function start(){if(document.body)observer.observe(document.body,{childList:true,subtree:true});var m=findModal();if(m)install(m);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();