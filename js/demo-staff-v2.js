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
function install(){
 if(!window.db){setTimeout(install,50);return;}
 if(window.__qrDemoStaffInstalled)return;window.__qrDemoStaffInstalled=true;
 var oldRpc=window.db.rpc&&window.db.rpc.bind(window.db);
 window.db.rpc=function(name,args){args=args||{};
   if(name==='staff_login')return Promise.resolve({data:{staffId:'demo-'+role,staffName:names[role],venueId:D.venue.id,venueName:D.venue.name,token:token,expiresAt:Date.now()+43200000},error:null});
   if(name==='staff_venue_by_slug')return Promise.resolve({data:D.venue,error:null});
   if(name==='staff_orders_json'||name==='staff_history_json')return Promise.resolve({data:D.orders||[],error:null});
   if(name==='staff_update_order'){var found=(D.orders||[]).find(function(o){return o.id===args.p_order_id;});if(found)found.status=args.p_status;return Promise.resolve({data:found||{id:args.p_order_id,status:args.p_status},error:null});}
   if(name==='cook_get_table_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:true},error:null});
   if(name==='waiter_get_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:true},error:null});
   if(name==='cook_start_table_session'||name==='waiter_start_table_session'||name==='cook_release_table'||name==='waiter_release_table')return Promise.resolve({data:{ok:true},error:null});
   if(name==='staff_table_dashboard')return Promise.resolve({data:{tables:D.tables||[],can_control_tables:true},error:null});
   return oldRpc?oldRpc(name,args):Promise.resolve({data:null,error:null});
 };
 var tries=0,timer=setInterval(function(){tries++;var root=document.getElementById('app');var inst=root&&root.__vue_app__&&root.__vue_app__._instance;var vm=inst&&inst.proxy;if(vm){if(!vm.session&&typeof vm.login==='function'){vm.form=vm.form||{};vm.form.slug=D.venue.slug;vm.form.pin=role==='cook'?'1234':role==='courier'?'1111':'2222';try{vm.login();}catch(e){}}if(vm.session){clearInterval(timer);timer=null;}}if(tries>100&&timer){clearInterval(timer);timer=null;}},100);
}
install();
})();
