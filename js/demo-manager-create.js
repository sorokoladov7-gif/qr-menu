(function(){
'use strict';
if(!window.__isDemoMode || !location.pathname.toLowerCase().match(/manager\.html$/)) return;
function install(){
  var root=document.getElementById('app');
  var app=root&&root.__vue_app__;
  var vm=app&&app._instance&&app._instance.proxy;
  if(!vm){setTimeout(install,100);return;}
  if(vm.__qrDemoCreateInstalled)return;
  vm.__qrDemoCreateInstalled=true;
  var original=vm.createVenue;
  vm.createVenue=function(){
    var self=this, form=self.newVenueForm||{}, name=String(form.name||'').trim(), slug=String(form.slug||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
    self.formError='';
    if(!name||!slug){self.formError='Заполните название и код заведения';return;}
    if(typeof self.canCreateVenue==='boolean' && !self.canCreateVenue){self.formError='Лимит заведений';return;}
    var template=self.selectedVenueTemplate;
    if(!template){self.formError='Выберите шаблон ниши';return;}
    self.busy=true;
    var now=new Date();
    var end=new Date(now.getTime()+10*86400000).toISOString();
    var venue={id:'demo-venue-'+Date.now(),name:name,slug:slug,status:'active',created_at:now.toISOString(),subscription_end:end,plan_id:(self.managerSubscription&&self.managerSubscription.plan_id)||'demo-plan',products:Array.isArray(template.products)?JSON.parse(JSON.stringify(template.products)):[]};
    var D=window.QR_DEMO_DATA||{};
    D.demoVenues=D.demoVenues||[];
    D.demoVenues.unshift(venue);
    D.venues=D.demoVenues;
    try{sessionStorage.setItem('qr_demo_venues',JSON.stringify(D.demoVenues));}catch(e){}
    self.myVenues=[].concat(D.demoVenues);
    self.showCreateVenue=false;
    self.newVenueForm={name:'',slug:'',template:self.venueTemplates[0]?self.venueTemplates[0].id:'coffee'};
    self.templateSearchQuery='';
    self.busy=false;
    if(typeof self.selectVenue==='function')self.selectVenue(venue);
    if(typeof self.showToast==='function')self.showToast('Демо: заведение создано — '+template.name+' · '+template.products.length+' позиций добавлено');
  };
  var inputs=document.querySelectorAll('#qr-venue-name-v10,#qr-venue-slug-v10');
  for(var i=0;i<inputs.length;i++)inputs[i].disabled=false;
  var btn=document.getElementById('qr-create-submit-v10');
  if(btn)btn.disabled=false;
}
install();
window.addEventListener('qr-manager-vue-ready',install);
setTimeout(install,300);setTimeout(install,1000);setTimeout(install,2500);
})();
