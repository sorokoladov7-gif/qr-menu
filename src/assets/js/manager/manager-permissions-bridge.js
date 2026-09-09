/* QR Menu — manager permission bridge v2. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_PERMISSION_BRIDGE_V2__) return;
  window.__QR_MANAGER_PERMISSION_BRIDGE_V2__=true;
  var timer=null;
  function vm(){ return window.__managerVue || null; }
  async function sync(){
    try{
      var p=vm();
      if(!p || !p.venue || !p.venue.id || !p.profile || !p.profile.id || typeof db==='undefined') return;
      if(p.profile.role==='admin') return;
      var venueId=p.venue.id, managerId=p.profile.id;
      var r=await db.from('manager_venue_permissions')
        .select('can_edit_menu,can_edit_prices,can_edit_delivery,can_edit_design,can_edit_branding,can_edit_venue')
        .eq('manager_id',managerId).eq('venue_id',venueId).maybeSingle();
      if(r.error){ console.warn('[QR Manager] permission bridge:',r.error.message||r.error); return; }
      var legacy=(p.venue.manager_permissions&&typeof p.venue.manager_permissions==='object')?p.venue.manager_permissions:{};
      var x=r.data;
      if(!x){
        /* Older admin UI stores these flags in venues.manager_permissions. */
        x={
          can_edit_menu:legacy.products===true || legacy.can_edit_menu===true,
          can_edit_prices:legacy.prices===true || legacy.can_edit_prices===true,
          can_edit_delivery:legacy.delivery===true || legacy.can_edit_delivery===true,
          can_edit_design:legacy.design===true || legacy.can_edit_design===true,
          can_edit_branding:legacy.branding===true || legacy.can_edit_branding===true,
          can_edit_venue:legacy.venue===true || legacy.can_edit_venue===true
        };
      }
      p.venue.manager_permissions=Object.assign({},legacy,{
        products:x.can_edit_menu===true,
        prices:x.can_edit_prices===true,
        addons:legacy.addons!==false,
        delivery:x.can_edit_delivery===true,
        design:x.can_edit_design===true,
        branding:x.can_edit_branding===true,
        venue:x.can_edit_venue===true,
        can_edit_menu:x.can_edit_menu===true,
        can_edit_prices:x.can_edit_prices===true,
        can_edit_delivery:x.can_edit_delivery===true,
        can_edit_design:x.can_edit_design===true,
        can_edit_branding:x.can_edit_branding===true,
        can_edit_venue:x.can_edit_venue===true
      });
      window.dispatchEvent(new CustomEvent('qr-manager-permissions-updated',{detail:p.venue.manager_permissions}));
    }catch(e){ console.warn('[QR Manager] permission bridge exception:',e); }
  }
  function start(){ if(timer) clearInterval(timer); sync(); timer=setInterval(sync,2000); }
  window.addEventListener('qr-manager-vue-ready',start);
  window.addEventListener('qr-manager-venue-selected',sync);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
