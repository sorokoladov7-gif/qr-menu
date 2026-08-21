/* QR Menu — compatibility bridge only. No hall UI, no click handlers, no iframe. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_HALL_VIEW_COMPAT__) return;
  window.__QR_MANAGER_HALL_VIEW_COMPAT__=true;
  function expose(){
    try{
      var root=document.getElementById('app');
      var p=root && root.__vue_app__ && root.__vue_app__._instance && root.__vue_app__._instance.proxy;
      if(p){
        window.__managerVue=p;
        window.__managerVenue=function(){return p.venue||null;};

        // Compatibility bridge: manager.html still calls selectVenueTemplate()
        // from the venue-template picker, while the method was renamed to selectVenue().
        if(typeof p.selectVenueTemplate!=='function'){
          p.selectVenueTemplate=function(id){
            var list=Array.isArray(p.venueTemplates)?p.venueTemplates:[];
            var t=list.find(function(x){return x.id===id;});
            if(!t) return;
            if(!p.newVenueForm) p.newVenueForm={};
            p.newVenueForm.template=id;
            if(!p.newVenueForm.name) p.newVenueForm.name=t.name;
            if(!p.newVenueForm.slug) p.newVenueForm.slug=id;
          };
        }
      }
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',expose);
  else expose();
  setTimeout(expose,250);
  setTimeout(expose,1000);
  setTimeout(expose,2000);
})();
