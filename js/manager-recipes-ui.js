/* QR Menu — recipe shortcut/cost integration. Loaded by manager-hall-ai bootstrap. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_RECIPES_UI__) return;
  window.__QR_MANAGER_RECIPES_UI__=true;
  function addShortcut(){
    var tabs=document.querySelector('.tabs');
    if(!tabs || tabs.querySelector('[data-manager-recipes-tab]')) return;
    var b=document.createElement('button');
    b.type='button';
    b.setAttribute('data-manager-recipes-tab','1');
    b.textContent='🧾 Рецептуры';
    b.style.background='rgba(255,255,255,.06)';
    b.onclick=function(){
      var id=localStorage.getItem('manager_venue_id')||localStorage.getItem('selectedVenueId');
      if(id) localStorage.setItem('manager_venue_id',id);
      location.href='manager-recipes.html';
    };
    tabs.appendChild(b);
  }
  function boot(){
    addShortcut();
    new MutationObserver(addShortcut).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
