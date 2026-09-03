(function(){
'use strict';
var qs=new URLSearchParams(location.search), role=(qs.get('role')||'').toLowerCase();
if(!role){var m=location.pathname.toLowerCase().match(/\/(cook|courier|waiter)\.html$/i);if(m)role=m[1].toLowerCase();}
var D=window.QR_DEMO_DATA||{};
if(!D.venue||['cook','courier','waiter'].indexOf(role)<0)return;
var names={cook:D.session.cookName,courier:D.session.courierName,waiter:D.session.waiterName};
var token='demo-'+role+'-'+Date.now();
function put(k,v){try{sessionStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));}catch(e){}}
var session={venueId:D.venue.id,venueName:D.venue.name,staffName:names[role]||'Демо сотрудник'};
put(role+'_token',token);put('staff_token',token);put(role+'_session',session);

function readonly(){
 if(window.__qrDemoReadonlyInstalled)return;window.__qrDemoReadonlyInstalled=true;
 var css=document.createElement('style');
 css.textContent='.qr-demo-readonly-banner{position:fixed;top:8px;right:8px;z-index:1000;max-width:calc(100vw - 16px);box-sizing:border-box;background:rgba(180,83,9,.94);color:#fff;text-align:center;padding:6px 10px;border-radius:8px;font:700 11px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.18);pointer-events:none;user-select:none}.qr-demo-readonly-banner+*{}button[disabled],input[disabled],select[disabled],textarea[disabled]{opacity:.55!important;cursor:not-allowed!important}';
 document.head.appendChild(css);
 var banner=document.createElement('div');
 banner.className='qr-demo-readonly-banner';
 banner.textContent='ДЕМО · только просмотр';
 document.body.appendChild(banner);
 // В демо клики по интерфейсу разрешены: вкладки, боковое меню, модальные окна
 // и навигационные кнопки должны работать как в настоящем кабинете.
 // Изменения блокируются на уровне RPC ниже, поэтому UI можно полноценно просматривать.
 document.addEventListener('submit',function(e){
   var form=e.target;
   if(form&&form.closest&&form.closest('[data-demo-allow-submit]'))return;
   e.preventDefault();e.stopImmediatePropagation();
 },true);
}

function install(){
 if(!window.db){setTimeout(install,50);return;}
 if(window.__qrDemoStaffInstalled)return;window.__qrDemoStaffInstalled=true;
 var oldRpc=window.db.rpc&&window.db.rpc.bind(window.db);
 window.db.rpc=function(name,args){args=args||{};
   if(name==='staff_login')return Promise.resolve({data:{staffId:'demo-'+role,staffName:names[role],venueId:D.venue.id,venueName:D.venue.name,token:token,expiresAt:Date.now()+43200000,shiftOpen:true,shift_open:true},error:null});
   if(name==='staff_venue_by_slug')return Promise.resolve({data:D.venue,error:null});
   if(name==='staff_orders_json'||name==='staff_history_json')return Promise.resolve({data:D.orders||[],error:null});
   if(name==='staff_update_order')return Promise.resolve({data:null,error:{message:'Демо-режим: изменения отключены'}});
   if(name==='cook_get_table_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:false},error:null});
   if(name==='waiter_get_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:false},error:null});
   if(name==='cook_start_table_session'||name==='waiter_start_table_session'||name==='cook_release_table'||name==='waiter_release_table')return Promise.resolve({data:null,error:{message:'Демо-режим: изменения отключены'}});
   if(name==='staff_table_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:false},error:null});
   return oldRpc?oldRpc(name,args):Promise.resolve({data:null,error:null});
 };
 readonly();
 var tries=0,timer=setInterval(function(){tries++;var root=document.getElementById('app');var inst=root&&root.__vue_app__&&root.__vue_app__._instance;var vm=inst&&inst.proxy;if(vm){if(!vm.session&&typeof vm.login==='function'){vm.form=vm.form||{};vm.form.slug=D.venue.slug;vm.form.pin=role==='cook'?'1234':role==='courier'?'1111':'2222';try{vm.login();}catch(e){}}if(vm.session){clearInterval(timer);timer=null;}}if(tries>100&&timer){clearInterval(timer);timer=null;}},100);
}
install();
})();
