/* QR Menu — unified manager site import controller v8. */
(function(){
'use strict';
if(window.__QR_MANAGER_SITE_IMPORT_V8__)return;
window.__QR_MANAGER_SITE_IMPORT_V8__=true;
var state={modal:null,mode:'template',data:null,busy:false};
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function slugify(v){var m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return String(v||'').toLowerCase().trim().replace(/[а-яё]/g,function(c){return m[c]||'';}).replace(/[^a-z0-9\s_-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);}
function errText(e){
if(!e)return'Неизвестная ошибка';
if(typeof e==='string')return e;
if(e.details&&e.details.message)return String(e.details.message);
if(e.error&&e.error.details&&e.error.details.message)return String(e.error.details.message);
if(e.message)return String(e.message);
if(e.error&&e.error.message)return String(e.error.message);
try{return JSON.stringify(e);}catch(_){return String(e);}
}
function getCreateModal(){
var nodes=document.querySelectorAll('.modal,[id^="qr-manager-create-modal-"]');
for(var i=0;i<nodes.length;i++){
  var m=nodes[i],h=m.querySelector('h3,h2');
  if(h&&/новое заведение/i.test(h.textContent||''))return m;
}
return null;
}
function showError(m,msg){var e=m&&m.querySelector('#qr-create-error-v11,#qr-create-error-v10');if(!e&&m){e=document.createElement('div');e.id='qr-create-error-v11';e.className='msg error';e.style.marginTop='10px';var content=m.firstElementChild;e.textContent=msg;if(content)content.appendChild(e);}if(e){e.textContent=msg;e.style.display='block';}}
function hideError(m){var e=m&&m.querySelector('#qr-create-error-v11,#qr-create-error-v10');if(e)e.style.display='none';}
function findNameSlug(content){
var inputs=Array.from(content.querySelectorAll('input'));
var name=content.querySelector('#qr-venue-name-v11,#qr-venue-name-v10')||inputs.find(function(x){return /название/i.test(x.placeholder||'')||x.type==='text'&&/coffee point/i.test(x.placeholder||'');});
var slug=content.querySelector('#qr-venue-slug-v11,#qr-venue-slug-v10')||inputs.find(function(x){return /slug|код/i.test(x.placeholder||'');});
if(!name||!slug){var fields=Array.from(content.querySelectorAll('.field'));fields.forEach(function(f){var l=f.querySelector('label'),x=f.querySelector('input');if(!x)return;var t=(l&&l.textContent||'')+' '+(x.placeholder||'');if(!name&&/название/i.test(t))name=x;if(!slug&&/(slug|код)/i.test(t))slug=x;});}
return {name:name,slug:slug};
}
function renderPreview(modal,data,url){var panel=modal.querySelector('#qr-site-import-panel-v4'),preview=panel.querySelector('#qr-site-preview-v4'),status=panel.querySelector('#qr-site-status-v4'),v=data.venue||{},items=Array.isArray(data.products)?data.products:[],d=data.meta&&data.meta.diagnostics||{},confidence=Number(d.confidence||0),hasItems=items.length>0;status.style.display='block';status.textContent=hasItems?'✓ Найдены позиции меню: '+items.length:'⚠ Меню автоматически не подтверждено';var stateColor=hasItems?'#6ee7b7':confidence>=70?'#6ee7b7':confidence>=50?'#fcd34d':'#fca5a5';preview.innerHTML='<div style="border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;background:rgba(15,23,42,.65)"><div style="display:flex;gap:12px;align-items:center"><div style="font-size:34px">🏪</div><div><b style="font-size:17px">'+esc(v.name||'Заведение')+'</b><div style="font-size:12px;color:#94a3b8">'+esc(v.address||'Адрес не найден')+'</div></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px;font-size:12px;color:#cbd5e1"><div>☎ '+esc(v.phone||'не найден')+'</div><div>🌐 '+esc(v.website_url||url)+'</div><div>🍽️ '+items.length+' позиций</div><div style="color:'+stateColor+'">🎯 '+confidence+'% уверенность</div></div></div>';}
function install(modal){
if(!modal||modal.dataset.siteImportInstalled==='8')return;
var content=modal.firstElementChild||modal;if(!content)return;
var label=Array.from(content.querySelectorAll('label')).find(function(x){return/шаблон ниши/i.test(x.textContent||'');});
var grid=content.querySelector('#qr-template-grid-v11,#qr-template-grid-v10,.template-grid');
var tp=content.querySelector('#qr-template-preview-v11,#qr-template-preview-v10,.template-preview');
var fields=findNameSlug(content),name=fields.name,slug=fields.slug;
var submit=content.querySelector('#qr-create-submit-v11,#qr-create-submit-v10')||Array.from(content.querySelectorAll('button')).find(function(b){return/создать( импортированное)? заведение/i.test(b.textContent||'')&&!/отмена/i.test(b.textContent||'');});
if(!grid||!name||!slug||!submit)return;
modal.dataset.siteImportInstalled='8';state.modal=modal;
var sw=document.createElement('div');sw.id='qr-site-import-switcher-v6';sw.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px';sw.innerHTML='<button type="button" data-mode="template" style="border:1px solid #8b5cf6;background:rgba(99,102,241,.14);color:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">🍽️ Создать из шаблона</button><button type="button" data-mode="site" style="border:1px solid rgba(255,255,255,.12);background:#172236;color:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">🌐 Импортировать с сайта</button>';
var panel=document.createElement('div');panel.id='qr-site-import-panel-v4';panel.style.cssText='display:none;margin-top:14px;border:1px solid rgba(96,165,250,.28);background:rgba(37,99,235,.06);border-radius:14px;padding:14px';panel.innerHTML='<div style="font-weight:800;margin-bottom:6px">🌐 Импорт существующего заведения</div><div style="color:#9ca3af;font-size:12px;margin-bottom:10px">Универсальный анализатор обходит сайт, страницы меню и структурированные данные.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="qr-site-url-v4" type="url" autocomplete="url" placeholder="https://example.ru" style="flex:1;min-width:220px;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;box-sizing:border-box"><button id="qr-site-find-v4" type="button" style="background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer">🔍 Анализировать сайт</button></div><div id="qr-site-status-v4" style="display:none;margin-top:9px;color:#93c5fd;font-size:12px"></div><div id="qr-site-preview-v4" style="margin-top:12px"></div>';
content.insertBefore(sw,label||grid);content.insertBefore(panel,sw.nextSibling);
var bs=sw.querySelectorAll('button');
function mode(x){state.mode=x;state.data=null;bs.forEach(function(b){var on=b.dataset.mode===x;b.style.borderColor=on?'#8b5cf6':'rgba(255,255,255,.12)';b.style.background=on?'rgba(99,102,241,.14)':'#172236';});var site=x==='site';panel.style.display=site?'block':'none';if(label)label.style.display=site?'none':'';grid.style.display=site?'none':'';if(tp)tp.style.display=site?'none':'';submit.textContent=site?'Создать импортированное заведение':'Создать заведение';hideError(modal);}
bs.forEach(function(b){b.onclick=function(){mode(b.dataset.mode);};});
panel.querySelector('#qr-site-find-v4').onclick=async function(){if(state.busy)return;var input=panel.querySelector('#qr-site-url-v4'),status=panel.querySelector('#qr-site-status-v4'),url=input.value.trim();hideError(modal);if(!url){showError(modal,'Введите адрес сайта заведения');return;}if(!/^https?:\/\//i.test(url))url='https://'+url;try{new URL(url);}catch(_){showError(modal,'Некорректный адрес сайта');return;}state.busy=true;this.disabled=true;this.textContent='Анализирую...';status.style.display='block';status.textContent='Обхожу сайт, страницы меню и структурированные данные...';panel.querySelector('#qr-site-preview-v4').innerHTML='';try{var r=await fetch('/api/import-site?url='+encodeURIComponent(url),{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'}),data=await r.json().catch(function(){return null;});if(!data)throw new Error('API вернул не-JSON ответ (HTTP '+r.status+')');if(!r.ok||data.ok===false)throw data.error||data.meta&&data.meta.error||data.message||new Error('HTTP '+r.status);state.data=data;var v=data.venue||{};name.value=v.name||'';slug.value=slugify(v.name||new URL(url).hostname.split('.')[0]);renderPreview(modal,data,url);}catch(e){status.style.display='none';showError(modal,'Ошибка импорта: '+errText(e));}finally{state.busy=false;this.disabled=false;this.textContent='🔍 Анализировать сайт';}};
submit.addEventListener('click',async function(e){if(state.mode!=='site')return;e.preventDefault();e.stopImmediatePropagation();if(state.busy)return;hideError(modal);if(!state.data){showError(modal,'Сначала укажите сайт и нажмите «Анализировать сайт»');return;}var v=state.data.venue||{},items=Array.isArray(state.data.products)?state.data.products:[],venueName=(name.value.trim()||v.name||'').trim(),venueSlug=slugify(slug.value.trim()||v.name||'');if(!venueName){showError(modal,'Не найдено название заведения');return;}if(!venueSlug){showError(modal,'Не удалось сформировать код заведения');return;}state.busy=true;submit.disabled=true;submit.textContent='Создаю...';try{var u=await db.auth.getUser(),uid=u&&u.data&&u.data.user&&u.data.user.id;if(!uid)throw new Error('Сессия управляющего не найдена');var sr=await db.from('subscriptions').select('plan_id,current_period_end,status').eq('manager_id',uid).order('created_at',{ascending:false}).limit(1).maybeSingle();if(sr.error)throw sr.error;if(!sr.data)throw new Error('Подписка не найдена');if(['active','trialing'].indexOf(sr.data.status)===-1)throw new Error('Подписка не активна');var pr=await db.from('plans').select('id,max_products').eq('id',sr.data.plan_id).maybeSingle();if(pr.error)throw pr.error;if(pr.data&&pr.data.max_products&&items.length>Number(pr.data.max_products))throw new Error('На выбранном тарифе лимит '+pr.data.max_products+' позиций, а найдено '+items.length+'.');var payload=items.slice(0,Number(pr.data&&pr.data.max_products||500)).map(function(i){return{name:i.name,description:i.description||null,price:Number(i.price)||0,category:i.category||'main',image_url:i.image_url||null,is_available:i.is_available!==false,applies_to:i.applies_to||'all'};});var rr=await db.rpc('manager_import_venue',{p_name:venueName,p_slug:venueSlug,p_plan:sr.data.plan_id,p_subscription_end:sr.data.current_period_end,p_address:v.address||null,p_phone:v.phone||null,p_website_url:v.website_url||panel.querySelector('#qr-site-url-v4').value.trim(),p_description:v.description||null,p_logo_url:v.logo_url||null,p_opening_hours:v.opening_hours||null,p_products:payload});if(rr.error)throw rr.error;alert('Заведение «'+venueName+'» создано. Импортировано позиций: '+(rr.data&&rr.data.products_count!=null?rr.data.products_count:payload.length)+'.');location.reload();}catch(e){showError(modal,'Ошибка создания: '+errText(e));submit.disabled=false;submit.textContent='Создать импортированное заведение';state.busy=false;}},true);
mode('template');
}
window.QRManagerSiteImport={mount:install,unmount:function(){state.modal=null;state.data=null;state.busy=false;}};
document.addEventListener('qr:manager-create-modal-ready',function(e){install(e.detail&&e.detail.modal||getCreateModal());});
function boot(){var m=getCreateModal();if(m)install(m);var root=document.getElementById('app');if(root){new MutationObserver(function(){var x=getCreateModal();if(x)install(x);}).observe(root,{childList:true,subtree:true});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
