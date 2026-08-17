(function(){
'use strict';
if(!/\/admin\.html$/i.test(location.pathname))return;
if(window.__adminDesignAccessLoaded)return;
window.__adminDesignAccessLoaded=true;

var STYLE_ID='admin-design-access-style';
var ITEM_CLASS='admin-design-access-item';
var BTN_ID='admin-design-open-btn';

function getApp(){return document.getElementById('app')&&document.getElementById('app').__vue_app__}
function getProxy(){var a=getApp();return a&&a._instance&&a._instance.proxy}

function addStyle(){
 if(document.getElementById(STYLE_ID))return;
 var s=document.createElement('style');
 s.id=STYLE_ID;
 s.textContent='.'+ITEM_CLASS+'{display:flex!important;align-items:center;gap:7px;background:rgba(99,102,241,.10);border:1px solid rgba(99,102,241,.30);padding:7px 10px;border-radius:8px;color:#e5e7eb;cursor:pointer}.'+ITEM_CLASS+' input{accent-color:#6366f1}.'+ITEM_CLASS+' b{color:#a5b4fc}.admin-design-access-note{display:block!important;margin:7px 0 0;color:#94a3b8;font-size:11px;line-height:1.4}.admin-design-open-btn{white-space:nowrap!important}';
 document.head.appendChild(s);
}

function venueDesignValue(v){
 var mp=v&&v.manager_permissions;
 return !!(mp&&mp.design===true);
}

function ensureDesignButton(p){
 addStyle();
 var tabs=document.querySelector('.tabs');
 if(!tabs)return;
 var btn=document.getElementById(BTN_ID);
 if(!btn){
   btn=document.createElement('button');
   btn.id=BTN_ID;
   btn.className='admin-design-open-btn';
   btn.type='button';
   btn.textContent='🎨 Дизайн';
   btn.title='Управление дизайном и доступом управляющих';
   btn.addEventListener('click',function(){
     var proxy=getProxy();
     if(!proxy)return;
     proxy.secretDesignPanel=true;
   });
   tabs.appendChild(btn);
 }
}

function patchOpen(p){
 if(!p||p.__adminDesignOpenPatched)return;
 if(typeof p.openVenueEdit!=='function')return;
 var original=p.openVenueEdit;
 p.openVenueEdit=function(v){
   var r=original.apply(this,arguments);
   try{
     if(this.venueEditModal&&this.venueEditModal.perms){
       this.venueEditModal.perms.design=venueDesignValue(v);
     }
   }catch(e){}
   setTimeout(function(){render(p)},50);
   return r;
 };
 p.__adminDesignOpenPatched=true;
}

function getOpenModal(){
 var list=document.querySelectorAll('.modal');
 for(var i=0;i<list.length;i++){
   var n=list[i];
   if(n.offsetParent!==null)return n;
 }
 return null;
}

function render(p){
 addStyle();
 ensureDesignButton(p);
 var vm=p&&p.venueEditModal;
 if(!vm||!vm.show||!vm.perms)return;
 var modal=getOpenModal();
 if(!modal)return;
 var labels=modal.querySelectorAll('label');
 var anchor=null;
 for(var i=0;i<labels.length;i++){
   var text=(labels[i].textContent||'').replace(/\s+/g,' ').trim();
   if(text.indexOf('Менять цены')!==-1){anchor=labels[i];break;}
 }
 if(!anchor)return;
 var old=modal.querySelector('.'+ITEM_CLASS);
 if(old)old.remove();
 var oldNote=modal.querySelector('.admin-design-access-note');
 if(oldNote)oldNote.remove();
 var item=document.createElement('label');
 item.className='checkbox-label '+ITEM_CLASS;
 var input=document.createElement('input');
 input.type='checkbox';
 input.checked=vm.perms.design===true;
 input.addEventListener('change',function(){
   try{p.venueEditModal.perms.design=input.checked}catch(e){}
 });
 var span=document.createElement('span');
 span.innerHTML='🎨 <b>Разрешить дизайн</b>';
 item.appendChild(input);item.appendChild(span);
 anchor.parentNode.insertBefore(item,anchor.nextSibling);
 var note=document.createElement('div');
 note.className='admin-design-access-note';
 note.textContent='Доступ к функциям дизайна получает только управляющий этого заведения. Выдавать и отзывать его может только администратор платформы.';
 item.parentNode.insertBefore(note,item.nextSibling);
}

function boot(){
 addStyle();
 var ticks=0;
 var timer=setInterval(function(){
   var p=getProxy();
   if(p){patchOpen(p);render(p)}
   if(++ticks>600)clearInterval(timer);
 },250);
 new MutationObserver(function(){
   var p=getProxy();
   if(p){patchOpen(p);render(p)}
 }).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
