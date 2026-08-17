(function(){
'use strict';
if(!/\/admin\.html$/i.test(location.pathname))return;
if(window.__adminDesignAccessLoaded)return;window.__adminDesignAccessLoaded=true;

function getProxy(){var root=document.getElementById('app');return root&&root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy}
function style(){if(document.getElementById('ada-style'))return;var s=document.createElement('style');s.id='ada-style';s.textContent='.ada-design-access{display:flex;align-items:center;gap:6px;background:rgba(99,102,241,.10);border:1px solid rgba(99,102,241,.28);padding:6px 10px;border-radius:8px}.ada-design-access input{accent-color:#6366f1}.ada-design-access b{color:#a5b4fc}.ada-design-note{display:block;margin-top:6px;color:#94a3b8;font-size:11px}';document.head.appendChild(s)}

function getVenueFromModal(p){
 var vm=p&&p.venueEditModal;
 if(!vm)return null;
 return vm.venue||vm.item||vm.currentVenue||p.venueEditVenue||null;
}
function syncPermission(p){
 var vm=p&&p.venueEditModal;
 if(!vm||!vm.perms)return;
 var v=getVenueFromModal(p);
 if(v&&v.manager_permissions)vm.perms.design=v.manager_permissions.design===true;
}
function findModal(){
 var nodes=document.querySelectorAll('.modal,[role="dialog"],.modal-overlay,.modal-backdrop');
 for(var i=0;i<nodes.length;i++){
   var n=nodes[i];
   if(n.offsetParent!==null)return n;
 }
 return document.querySelector('.modal,[role="dialog"],.modal-overlay,.modal-backdrop');
}
function findPermissionGroup(modal){
 if(!modal)return null;
 var groups=modal.querySelectorAll('.checkbox-group');
 if(groups.length)return groups[groups.length-1];
 var labels=modal.querySelectorAll('label');
 for(var i=0;i<labels.length;i++){
   var txt=(labels[i].textContent||'').toLowerCase();
   if(txt.indexOf('цены')>=0||txt.indexOf('блюд')>=0||txt.indexOf('заказ')>=0||txt.indexOf('меню')>=0){
     return labels[i].parentElement||modal;
   }
 }
 return null;
}
function inject(p){
 style();
 var vm=p&&p.venueEditModal;
 if(!vm||!vm.show||!vm.perms)return;
 var modal=findModal();
 if(!modal)return;
 var group=findPermissionGroup(modal);
 if(!group)return;
 var old=group.querySelector('.ada-design-access');
 if(old)old.remove();
 var oldNote=group.parentNode&&group.parentNode.querySelector('.ada-design-note');
 if(oldNote)oldNote.remove();
 var label=document.createElement('label');label.className='checkbox-label ada-design-access';
 var input=document.createElement('input');input.type='checkbox';input.checked=vm.perms.design===true;
 var text=document.createElement('span');text.innerHTML='🎨 <b>Разрешить дизайн</b>';
 input.addEventListener('change',function(){
   try{p.venueEditModal.perms.design=input.checked}catch(e){}
 });
 label.appendChild(input);label.appendChild(text);group.appendChild(label);
 var note=document.createElement('span');note.className='ada-design-note';note.textContent='Только администратор платформы может изменить это разрешение.';
 if(group.parentNode)group.parentNode.appendChild(note);
}
function boot(){
 style();
 var n=0,t=setInterval(function(){
   var p=getProxy();
   if(p&&p.ready&&p.profile){syncPermission(p);inject(p)}
   if(++n>240)clearInterval(t);
 },250);
 new MutationObserver(function(){var p=getProxy();if(p){syncPermission(p);inject(p)}}).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
