/* QR Menu — unified manager site import controller v10. */
(function(){
'use strict';
if(window.__QR_MANAGER_SITE_IMPORT_V10__)return;
window.__QR_MANAGER_SITE_IMPORT_V10__=true;

var state={modal:null,mode:'template',data:null,busy:false};

function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function slugify(v){var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return String(v||'').toLowerCase().trim().replace(/[а-яё]/g,function(c){return m[c]||'';}).replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);}
function errText(e){if(!e)return'Неизвестная ошибка';if(typeof e==='string')return e;if(e.details&&e.details.message)return String(e.details.message);if(e.error&&e.error.details&&e.error.details.message)return String(e.error.details.message);if(e.message)return String(e.message);if(e.error&&e.error.message)return String(e.error.message);try{return JSON.stringify(e);}catch(_){return String(e);}}
function getCreateModal(){
  var nodes=document.querySelectorAll('.modal,[id^="qr-manager-create-modal-"]');
  for(var i=0;i<nodes.length;i++){
    var m=nodes[i],text=String((m.firstElementChild||m).textContent||'').replace(/\s+/g,' ').toLowerCase();
    if(m.querySelector('#qr-site-import-switcher-v10,#qr-create-submit-v11,#qr-create-submit-v10,.template-grid')||/создать\s+заведение|новое\s+заведение/.test(text))return m;
  }
  return null;
}
function showError(m,msg){var e=m&&m.querySelector('#qr-create-error-v11,#qr-create-error-v10');if(!e&&m){e=document.createElement('div');e.id='qr-create-error-v11';e.className='msg error';e.style.marginTop='10px';(m.firstElementChild||m).appendChild(e);}if(e){e.textContent=msg;e.style.display='block';}}
function hideError(m){var e=m&&m.querySelector('#qr-create-error-v11,#qr-create-error-v10');if(e)e.style.display='none';}
function findFields(content){
  var inputs=Array.prototype.slice.call(content.querySelectorAll('input')),name=content.querySelector('#qr-venue-name-v11,#qr-venue-name-v10'),slug=content.querySelector('#qr-venue-slug-v11,#qr-venue-slug-v10');
  inputs.forEach(function(x){var p=(x.placeholder||'').toLowerCase();if(!name&&(/название/.test(p)||/coffee point/.test(p)))name=x;if(!slug&&(/slug/.test(p)||/код/.test(p)))slug=x;});
  return{name:name||inputs[0]||null,slug:slug||inputs[1]||null};
}
function renderPreview(modal,data,url){
  var panel=modal.querySelector('#qr-site-import-panel-v4');if(!panel)return;
  var preview=panel.querySelector('#qr-site-preview-v4'),status=panel.querySelector('#qr-site-status-v4'),v=data.venue||{},items=Array.isArray(data.products)?data.products:[],d=data.meta&&data.meta.diagnostics||{},confidence=Number(d.confidence||0);
  status.style.display='block';status.textContent=items.length?'✓ Найдены позиции меню: '+items.length:'⚠ Меню автоматически не подтверждено';
  var stateColor=items.length?'#6ee7b7':confidence>=70?'#6ee7b7':confidence>=50?'#fcd34d':'#fca5a5';
  preview.innerHTML='<div style="border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;background:rgba(15,23,42,.65)"><b style="font-size:17px">'+esc(v.name||'Заведение')+'</b><div style="font-size:12px;color:#94a3b8;margin-top:4px">'+esc(v.address||'Адрес не найден')+'</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px;font-size:12px"><div>☎ '+esc(v.phone||'не найден')+'</div><div>🌐 '+esc(v.website_url||url)+'</div><div>🍽️ '+items.length+' позиций</div><div style="color:'+stateColor+'">🎯 '+confidence+'% уверенность</div></div></div>';
}
function setMode(modal,mode){
  var content=modal&&modal.firstElementChild||modal;if(!content)return;
  var sw=content.querySelector('#qr-site-import-switcher-v10');if(!sw)return;
  var panel=content.querySelector('#qr-site-import-panel-v4'),label=Array.prototype.slice.call(content.querySelectorAll('label')).find(function(x){return/шаблон ниши/i.test(x.textContent||'');}),grid=content.querySelector('#qr-template-grid-v11,#qr-template-grid-v10,.template-grid'),tp=content.querySelector('#qr-template-preview-v11,#qr-template-preview-v10,.template-preview'),submit=content.querySelector('#qr-create-submit-v11,#qr-create-submit-v10');
  state.modal=modal;state.mode=mode;state.data=null;
  Array.prototype.forEach.call(sw.querySelectorAll('button[data-mode]'),function(b){var on=b.getAttribute('data-mode')===mode;b.style.borderColor=on?'#8b5cf6':'rgba(255,255,255,.12)';b.style.background=on?'rgba(99,102,241,.14)':'#172236';});
  var site=mode==='site';
  if(panel)panel.style.display=site?'block':'none';if(label)label.style.display=site?'none':'';if(grid)grid.style.display=site?'none':'';if(tp)tp.style.display=site?'none':'';if(submit)submit.textContent=site?'Создать импортированное заведение':'Создать заведение';hideError(modal);
}
function install(modal){
  if(!modal)return;state.modal=modal;
  var content=modal.firstElementChild||modal;
  if(!content)return;
  var fields=findFields(content),grid=content.querySelector('#qr-template-grid-v11,#qr-template-grid-v10,.template-grid'),tp=content.querySelector('#qr-template-preview-v11,#qr-template-preview-v10,.template-preview'),submit=content.querySelector('#qr-create-submit-v11,#qr-create-submit-v10')||Array.prototype.slice.call(content.querySelectorAll('button')).find(function(b){return/создать( импортированное)? заведение/i.test(b.textContent||'')&&!/отмена/i.test(b.textContent||'');});
  if(!grid||!fields.name||!fields.slug||!submit)return;
  fields.name.id='qr-venue-name-v10';fields.slug.id='qr-venue-slug-v10';grid.id='qr-template-grid-v10';if(tp)tp.id='qr-template-preview-v10';submit.id='qr-create-submit-v10';
  if(content.querySelector('#qr-site-import-switcher-v10'))return;
  var sw=document.createElement('div');sw.id='qr-site-import-switcher-v10';sw.style.cssText='display:grid!important;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px;position:relative;z-index:200;pointer-events:auto';
  sw.innerHTML='<button type="button" data-mode="template" style="display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;border:1px solid #8b5cf6;background:rgba(99,102,241,.14);color:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">🍽️ Создать из шаблона</button><button type="button" data-mode="site" style="display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;border:1px solid rgba(255,255,255,.12);background:#172236;color:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">🌐 Импортировать с сайта</button>';
  var panel=document.createElement('div');panel.id='qr-site-import-panel-v4';panel.style.cssText='display:none;margin-top:14px;border:1px solid rgba(96,165,250,.28);background:rgba(37,99,235,.06);border-radius:14px;padding:14px;position:relative;z-index:200;pointer-events:auto';
  panel.innerHTML='<div style="font-weight:800;margin-bottom:6px">🌐 Импорт существующего заведения</div><div style="color:#9ca3af;font-size:12px;margin-bottom:10px">Универсальный анализатор обходит сайт, страницы меню и структурированные данные.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="qr-site-url-v4" type="url" autocomplete="url" placeholder="https://example.ru" style="flex:1;min-width:220px;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;box-sizing:border-box"><button id="qr-site-find-v4" type="button" style="display:inline-block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer">🔍 Анализировать сайт</button></div><div id="qr-site-status-v4" style="display:none;margin-top:9px;color:#93c5fd;font-size:12px"></div><div id="qr-site-preview-v4" style="margin-top:12px"></div>';
  var anchor=(grid.parentNode===content)?grid:content.querySelector('.field:last-of-type');
  if(anchor&&anchor.parentNode===content){content.insertBefore(sw,anchor);content.insertBefore(panel,sw.nextSibling);}else{content.appendChild(sw);content.appendChild(panel);}
  setMode(modal,'template');
}
function handleSiteFind(button){
  var modal=button&&button.closest('.modal');if(!modal||state.busy)return;
  var panel=button.closest('#qr-site-import-panel-v4'),input=panel&&panel.querySelector('#qr-site-url-v4'),status=panel&&panel.querySelector('#qr-site-status-v4');if(!input||!status)return;
  var url=input.value.trim();hideError(modal);if(!url){showError(modal,'Введите адрес сайта заведения');return;}if(!/^https?:\/\//i.test(url))url='https://'+url;try{new URL(url);}catch(_){showError(modal,'Некорректный адрес сайта');return;}
  state.busy=true;button.disabled=true;button.textContent='Анализирую...';status.style.display='block';status.textContent='Обхожу сайт, страницы меню и структурированные данные...';
  fetch('/api/import-site?url='+encodeURIComponent(url),{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'}).then(function(r){return r.json().catch(function(){return null;}).then(function(data){if(!data)throw new Error('API вернул не-JSON ответ (HTTP '+r.status+')');if(!r.ok||data.ok===false)throw data.error||data.meta&&data.meta.error||data.message||new Error('HTTP '+r.status);return data;});}).then(function(data){state.data=data;var f=findFields(modal.firstElementChild||modal),v=data.venue||{};if(f.name)f.name.value=v.name||'';if(f.slug)f.slug.value=slugify(v.name||new URL(url).hostname.split('.')[0]);renderPreview(modal,data,url);}).catch(function(e){status.style.display='none';showError(modal,'Ошибка импорта: '+errText(e));}).finally(function(){state.busy=false;button.disabled=false;button.textContent='🔍 Анализировать сайт';});
}
function handleCreate(submit){
  var modal=submit&&submit.closest('.modal');if(!modal||state.mode!=='site'||state.busy)return;
  var f=findFields(modal.firstElementChild||modal),data=state.data;if(!data){showError(modal,'Сначала укажите сайт и нажмите «Анализировать сайт»');return;}
  var v=data.venue||{},items=Array.isArray(data.products)?data.products:[],venueName=(f.name&&f.name.value||v.name||'').trim(),venueSlug=slugify((f.slug&&f.slug.value)||v.name||'');if(!venueName){showError(modal,'Не найдено название заведения');return;}if(!venueSlug){showError(modal,'Не удалось сформировать код заведения');return;}
  state.busy=true;submit.disabled=true;submit.textContent='Создаю...';
  Promise.resolve().then(function(){return db.auth.getUser();}).then(function(u){var uid=u&&u.data&&u.data.user&&u.data.user.id;if(!uid)throw new Error('Сессия управляющего не найдена');return db.from('subscriptions').select('plan_id,current_period_end,status').eq('manager_id',uid).order('created_at',{ascending:false}).limit(1).maybeSingle();}).then(function(sr){if(sr.error)throw sr.error;if(!sr.data)throw new Error('Подписка не найдена');if(['active','trialing'].indexOf(sr.data.status)===-1)throw new Error('Подписка не активна');state.subscription=sr.data;return db.from('plans').select('id,max_products').eq('id',sr.data.plan_id).maybeSingle();}).then(function(pr){if(pr.error)throw pr.error;var limit=Number(pr.data&&pr.data.max_products||500);if(items.length>limit)throw new Error('На выбранном тарифе лимит '+limit+' позиций, а найдено '+items.length+'.');var payload=items.slice(0,limit).map(function(i){return{name:i.name,description:i.description||null,price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,is_available:i.is_available!==false,applies_to:i.applies_to||'all'};});return db.rpc('manager_import_venue',{p_name:venueName,p_slug:venueSlug,p_plan:state.subscription.plan_id,p_subscription_end:state.subscription.current_period_end,p_address:v.address||null,p_phone:v.phone||null,p_website_url:v.website_url||modal.querySelector('#qr-site-url-v4').value.trim(),p_description:v.description||null,p_logo_url:v.logo_url||null,p_opening_hours:v.opening_hours||null,p_products:payload});}).then(function(rr){if(rr.error)throw rr.error;alert('Заведение «'+venueName+'» создано. Импортировано позиций: '+(rr.data&&rr.data.products_count!=null?rr.data.products_count:items.length)+'.');location.reload();}).catch(function(e){showError(modal,'Ошибка создания: '+errText(e));submit.disabled=false;submit.textContent='Создать импортированное заведение';state.busy=false;});
}

document.addEventListener('click',function(e){
  var t=e.target;
  var modeBtn=t&&t.closest?t.closest('#qr-site-import-switcher-v10 button[data-mode]'):null;
  if(modeBtn){e.preventDefault();e.stopPropagation();var modal=modeBtn.closest('.modal')||getCreateModal();if(modal){install(modal);setMode(modal,modeBtn.getAttribute('data-mode'));}return;}
  var findBtn=t&&t.closest?t.closest('#qr-site-find-v4'):null;if(findBtn){e.preventDefault();e.stopPropagation();handleSiteFind(findBtn);return;}
  var createBtn=t&&t.closest?t.closest('#qr-create-submit-v10,#qr-create-submit-v11'):null;if(createBtn&&state.mode==='site'){e.preventDefault();e.stopImmediatePropagation();handleCreate(createBtn);return;}
},true);

document.addEventListener('qr:manager-create-modal-ready',function(e){install(e.detail&&e.detail.modal||getCreateModal());});
function boot(){var m=getCreateModal();if(m)install(m);var root=document.getElementById('app');if(root)new MutationObserver(function(){var x=getCreateModal();if(x&&!x.querySelector('#qr-site-import-switcher-v10'))install(x);}).observe(root,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

window.QRManagerSiteImport={mount:install,unmount:function(){state.modal=null;state.data=null;state.busy=false;state.mode='template';}};
})();
