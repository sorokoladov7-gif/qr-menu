(function(){
'use strict';
if(!/\/admin\.html$/i.test(location.pathname))return;
if(window.__adminDesignAccessLoaded)return;window.__adminDesignAccessLoaded=true;

function getProxy(){var root=document.getElementById('app');return root&&root.__vue_app__&&root.__vue_app__._instance&&root.__vue_app__._instance.proxy}
function style(){if(document.getElementById('ada-style'))return;var s=document.createElement('style');s.id='ada-style';s.textContent='.ada-design-access{display:flex;align-items:center;gap:6px;background:rgba(99,102,241,.10);border:1px solid rgba(99,102,241,.28);padding:6px 10px;border-radius:8px}.ada-design-access input{accent-color:#6366f1}.ada-design-access b{color:#a5b4fc}.ada-design-note{display:block;margin-top:6px;color:#94a3b8;font-size:11px}';document.head.appendChild(s)}

function wrapOpenVenueEdit(p){
 if(!p||p.__adaWrapped)return;
 if(typeof p.openVenueEdit!=='function')return;
 var original=p.openVenueEdit;
 p.openVenueEdit=function(v){
   var r=original.apply(this,arguments);
   try{this.venueEditModal.perms.design=!!(v&&v.manager_permissions&&v.manager_permissions.design===true)}catch(e){}
   setTimeout(function(){inject(p)},0);
   return r;
 };
 p.__adaWrapped=true;
}

function inject(p){
 style();
 var modal=document.querySelector('.modal');
 if(!modal)return;
 var vm=p.venueEditModal;
 if(!vm||!vm.show)return;
 var group=Array.prototype.find.call(modal.querySelectorAll('.checkbox-group'),function(x){return x.querySelector('input[v-model*="venueEditModal.perms.prices"]')});
 if(!group)group=modal.querySelector('.checkbox-group');
 if(!group)return;
 var old=group.querySelector('.ada-design-access');
 if(old)old.remove();
 var label=document.createElement('label');label.className='checkbox-label ada-design-access';
 var input=document.createElement('input');input.type='checkbox';input.checked=!!(vm.perms&&vm.perms.design===true);
 var text=document.createElement('span');text.innerHTML='🎨 <b>Разрешить дизайн</b>';
 input.addEventListener('change',function(){
   try{p.venueEditModal.perms.design=input.checked}catch(e){}
 });
 label.appendChild(input);label.appendChild(text);group.appendChild(label);
 var note=document.createElement('span');note.className='ada-design-note';note.textContent='Только администратор платформы может изменить это разрешение.';group.parentNode.appendChild(note);
}

function boot(){style();var n=0,t=setInterval(function(){var p=getProxy();if(p&&p.ready&&p.profile){wrapOpenVenueEdit(p);inject(p);if(p.venueEditModal&&p.venueEditModal.show)inject(p)}if(++n>120)clearInterval(t)},250);new MutationObserver(function(){var p=getProxy();if(p){wrapOpenVenueEdit(p);inject(p)}}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();