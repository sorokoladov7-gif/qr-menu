(function(){
  'use strict';

  // Only affects the public customer menu. It is intentionally isolated from
  // manager/staff pages and from the existing order/calculation code.
  if (!/\/menu\.html$/i.test(location.pathname)) return;

  var state = {
    timer: null,
    request: null,
    input: null,
    box: null,
    selected: null,
    venueDelivery: true
  };

  function rememberVenue(value){
    if (!value) return;
    try {
      if (Array.isArray(value)) {
        value.forEach(function(v){ if(v && v.id) window.__qrVenueDeliveryById = Object.assign(window.__qrVenueDeliveryById || {}, {[v.id]: v.delivery_enabled !== false}); });
      } else if (value.id) {
        window.__qrVenueDeliveryById = window.__qrVenueDeliveryById || {};
        window.__qrVenueDeliveryById[value.id] = value.delivery_enabled !== false;
        state.venueDelivery = value.delivery_enabled !== false;
      }
    } catch(e) {}
  }

  // Capture delivery capability from the same public RPCs already used by menu.html.
  function patchVenueRpc(){
    if (!window.db || !window.db.rpc || window.__qrAddressRpcPatched) return false;
    var original = window.db.rpc;
    window.db.rpc = function(name,args,options){
      var p = original.apply(this, arguments);
      if (name === 'public_venue_by_slug' || name === 'public_venues_list') {
        return Promise.resolve(p).then(function(r){ rememberVenue(r && r.data); return r; });
      }
      return p;
    };
    window.__qrAddressRpcPatched = true;
    return true;
  }

  function getSelectedVenueDelivery(){
    try {
      var vm = document.getElementById('app') && document.getElementById('app').__vueParentComponent;
      if (vm && vm.proxy && vm.proxy.venue) return vm.proxy.venue.delivery_enabled !== false;
    } catch(e) {}
    return state.venueDelivery !== false;
  }

  function findAddressInput(){
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input'));
    return inputs.find(function(el){
      var ph = (el.getAttribute('placeholder') || '').toLowerCase();
      return ph.indexOf('улица') !== -1 || ph.indexOf('адрес') !== -1;
    }) || null;
  }

  function ensureBox(input){
    if (!input) return null;
    if (state.input === input && state.box) return state.box;
    state.input = input;
    var parent = input.parentElement;
    if (!parent) return null;
    parent.style.position = parent.style.position || 'relative';
    var box = document.createElement('div');
    box.className = 'qr-address-suggestions';
    box.style.cssText = 'position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:100000;background:#111827;border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.45);overflow:hidden;display:none;max-height:280px;overflow-y:auto;';
    parent.appendChild(box);
    state.box = box;

    input.setAttribute('autocomplete','off');
    input.addEventListener('input', onInput);
    input.addEventListener('focus', function(){ if(input.value.trim().length >= 3 && box.childElementCount) box.style.display='block'; });
    document.addEventListener('click', function(e){
      if(e.target !== input && !box.contains(e.target)) box.style.display='none';
    });
    return box;
  }

  function clearSuggestions(){
    if(state.box){ state.box.innerHTML=''; state.box.style.display='none'; }
  }

  function render(items){
    var box = state.box;
    if(!box) return;
    box.innerHTML='';
    if(!items.length){ box.style.display='none'; return; }
    items.forEach(function(item){
      var row=document.createElement('button');
      row.type='button';
      row.style.cssText='display:block;width:100%;text-align:left;border:0;border-bottom:1px solid rgba(255,255,255,.07);background:transparent;color:#fff;padding:12px 14px;cursor:pointer;font:inherit;';
      row.innerHTML='<div style="font-weight:700;font-size:13px">'+escapeHtml(item.value || item.unrestricted_value || '')+'</div>'+
        (item.data && item.data.city ? '<div style="font-size:11px;color:#94a3b8;margin-top:3px">'+escapeHtml([item.data.street_with_type,item.data.house].filter(Boolean).join(', '))+'</div>' : '');
      row.addEventListener('mouseenter',function(){row.style.background='rgba(99,102,241,.16)';});
      row.addEventListener('mouseleave',function(){row.style.background='transparent';});
      row.addEventListener('click',function(){selectItem(item);});
      box.appendChild(row);
    });
    box.style.display='block';
  }

  function escapeHtml(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }

  function onInput(){
    var input=state.input;
    state.selected=null;
    window.__selectedDeliveryAddress=null;
    var q=String(input.value||'').trim();
    clearTimeout(state.timer);
    if(state.request){try{state.request.abort();}catch(e){} state.request=null;}
    if(q.length<3) return;
    state.timer=setTimeout(function(){
      var controller=new AbortController();
      state.request=controller;
      fetch('/api/address?q='+encodeURIComponent(q),{signal:controller.signal,headers:{Accept:'application/json'}})
      .then(function(r){if(!r.ok)throw new Error('address_api');return r.json();})
      .then(function(data){
        if(data && Array.isArray(data.suggestions)) render(data.suggestions);
        else clearSuggestions();
      })
      .catch(function(e){if(e && e.name!=='AbortError') console.warn('[QR address]',e);})
      .finally(function(){state.request=null;});
    },350);
  }

  function selectItem(item){
    var input=state.input;
    if(!input) return;
    var d=item.data || {};
    state.selected={
      value:item.value || item.unrestricted_value || '',
      fias_id:d.fias_id || d.house_fias_id || null,
      city:d.city || d.settlement || null,
      street:d.street_with_type || d.street || null,
      house:d.house || null,
      lat:d.geo_lat != null ? Number(d.geo_lat) : null,
      lng:d.geo_lon != null ? Number(d.geo_lon) : null
    };
    window.__selectedDeliveryAddress=state.selected;
    input.value=state.selected.value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    clearSuggestions();
  }

  function enforceDeliveryVisibility(){
    var enabled=getSelectedVenueDelivery();
    var buttons=Array.prototype.slice.call(document.querySelectorAll('button'));
    buttons.forEach(function(btn){
      if((btn.textContent||'').indexOf('Доставка')!==-1){
        btn.style.display=enabled?'':'none';
      }
    });
    if(!enabled && state.input){
      var modal=state.input.closest('.modal');
      if(modal && state.input.value) state.input.value='';
      clearSuggestions();
    }
  }

  function init(){
    patchVenueRpc();
    var input=findAddressInput();
    if(input) ensureBox(input);
    enforceDeliveryVisibility();
  }

  var observer=new MutationObserver(function(){ init(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  var tries=0;
  var timer=setInterval(function(){
    init();
    if(++tries>120) clearInterval(timer);
  },250);
})();
