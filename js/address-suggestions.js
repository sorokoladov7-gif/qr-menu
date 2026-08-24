(function(){
  'use strict';
  if (!/\/menu\.html$/i.test(location.pathname)) return;

  var state={timer:null,request:null,input:null,box:null,selected:null,venueDelivery:true,suppressNextInput:false};

  function getVm(){
    try{
      var root=document.getElementById('app');
      if(root&&root.__vue_app__&&root.__vue_app__._instance)return root.__vue_app__._instance.proxy;
      if(root&&root.__vueParentComponent)return root.__vueParentComponent.proxy;
    }catch(e){}
    return null;
  }

  function patchVenueRpc(){
    if(!window.db||!window.db.rpc||window.__qrAddressRpcPatched)return;
    var original=window.db.rpc;
    window.db.rpc=function(name,args,options){
      var p=original.apply(this,arguments);
      return p;
    };
    window.__qrAddressRpcPatched=true;
  }

  function getSelectedVenueDelivery(){
    var vm=getVm();
    return !(vm&&vm.venue&&vm.venue.delivery_enabled===false);
  }

  function findAddressInput(){
    var inputs=Array.prototype.slice.call(document.querySelectorAll('input'));
    return inputs.find(function(el){
      if(el.disabled||el.offsetParent===null)return false;
      var ph=(el.getAttribute('placeholder')||'').toLowerCase();
      var parentText=(el.parentElement&&el.parentElement.parentElement?el.parentElement.parentElement.textContent:'').toLowerCase();
      return ph.indexOf('улица')!==-1||ph.indexOf('адрес')!==-1||parentText.indexOf('адрес доставки')!==-1;
    })||null;
  }

  function positionBox(){
    if(!state.input||!state.box)return;
    var r=state.input.getBoundingClientRect();
    state.box.style.left=Math.round(r.left)+'px';
    state.box.style.top=Math.round(r.bottom+6)+'px';
    state.box.style.width=Math.round(r.width)+'px';
  }

  function ensureBox(input){
    if(!input)return null;
    if(state.input===input&&state.box&&document.documentElement.contains(state.box)){
      positionBox();
      return state.box;
    }

    state.input=input;
    if(state.box)state.box.remove();

    var box=document.createElement('div');
    box.className='qr-address-suggestions';
    box.style.cssText='position:fixed;z-index:2147483647;background:#111827;border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.55);overflow-y:auto;display:none;max-height:280px;pointer-events:auto;';
    document.body.appendChild(box);
    state.box=box;
    positionBox();

    input.setAttribute('autocomplete','off');
    input.setAttribute('aria-autocomplete','list');
    input.addEventListener('input',onInput);
    input.addEventListener('focus',function(){
      positionBox();
      if(input.value.trim().length>=3&&box.childElementCount)box.style.display='block';
    });
    input.addEventListener('blur',function(){
      setTimeout(function(){
        if(document.activeElement!==input&&!box.contains(document.activeElement))box.style.display='none';
      },180);
    });
    window.addEventListener('resize',positionBox,{passive:true});
    window.addEventListener('scroll',positionBox,{passive:true,capture:true});
    return box;
  }

  function clearSuggestions(){
    if(state.box){state.box.innerHTML='';state.box.style.display='none';}
  }

  function escapeHtml(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function render(items){
    var box=state.box;
    if(!box)return;
    box.innerHTML='';
    if(!items.length){box.style.display='none';return;}
    items.forEach(function(item){
      var row=document.createElement('button');
      row.type='button';
      row.tabIndex=-1;
      row.style.cssText='display:block;width:100%;text-align:left;border:0;border-bottom:1px solid rgba(255,255,255,.07);background:#111827;color:#fff;padding:12px 14px;cursor:pointer;font:inherit;';
      var d=item.data||{};
      var sub=[d.city,d.street,d.house].filter(Boolean).join(', ');
      row.innerHTML='<div style="font-weight:700;font-size:13px">'+escapeHtml(item.value||item.unrestricted_value||'')+'</div>'+(sub?'<div style="font-size:11px;color:#94a3b8;margin-top:3px">'+escapeHtml(sub)+'</div>':'');
      row.addEventListener('mouseenter',function(){row.style.background='#1e293b';});
      row.addEventListener('mouseleave',function(){row.style.background='#111827';});
      row.addEventListener('mousedown',function(e){e.preventDefault();});
      row.addEventListener('click',function(e){e.preventDefault();selectItem(item);});
      box.appendChild(row);
    });
    positionBox();
    box.style.display='block';
  }

  function onInput(){
    var input=state.input;
    if(!input)return;
    if(state.suppressNextInput){state.suppressNextInput=false;return;}
    state.selected=null;
    window.__selectedDeliveryAddress=null;
    var q=String(input.value||'').trim();
    clearTimeout(state.timer);
    if(state.request){try{state.request.abort();}catch(e){}state.request=null;}
    if(q.length<3){clearSuggestions();return;}
    state.timer=setTimeout(function(){
      var controller=new AbortController();
      state.request=controller;
      fetch('/api/address?q='+encodeURIComponent(q),{signal:controller.signal,headers:{Accept:'application/json'}})
      .then(function(r){if(!r.ok)throw new Error('address_api_'+r.status);return r.json();})
      .then(function(data){
        if(data&&Array.isArray(data.suggestions))render(data.suggestions);else clearSuggestions();
      })
      .catch(function(e){if(e&&e.name!=='AbortError')console.warn('[QR address]',e);})
      .finally(function(){state.request=null;});
    },250);
  }

  function selectItem(item){
    var input=state.input;if(!input)return;
    var d=item.data||{};
    var lat=d.geo_lat!=null?Number(d.geo_lat):null;
    var lng=d.geo_lon!=null?Number(d.geo_lon):null;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)){alert('У выбранного адреса нет координат. Выберите другой адрес.');return;}
    state.selected={value:item.value||item.unrestricted_value||'',fias_id:d.fias_id||null,city:d.city||d.settlement||null,street:d.street||null,house:d.house||null,flat:d.flat||null,lat:lat,lng:lng};
    window.__selectedDeliveryAddress=state.selected;
    input.value=state.selected.value;
    state.suppressNextInput=true;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    clearSuggestions();
  }

  if(!window.__qrNominatimPatch){
    var nativeFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
      var url=typeof input==='string'?input:(input&&input.url)||'';
      if(window.__selectedDeliveryAddress&&/nominatim\.openstreetmap\.org\/search/i.test(url)){
        var s=window.__selectedDeliveryAddress;
        return Promise.resolve(new Response(JSON.stringify([{lat:String(s.lat),lon:String(s.lng)}]),{status:200,headers:{'Content-Type':'application/json'}}));
      }
      return nativeFetch(input,init);
    };
    window.__qrNominatimPatch=true;
  }

  document.addEventListener('click',function(e){
    var target=e.target&&e.target.closest?e.target.closest('button'):null;
    if(!target||getSelectedVenueDelivery()===false)return;
    var text=(target.textContent||'').trim();
    if(text.indexOf('Рассчитать')!==-1||text.indexOf('Подтвердить заказ')!==-1){
      var vm=getVm();
      if(vm&&vm.form&&vm.form.type==='delivery'&&(!state.selected||!window.__selectedDeliveryAddress)){
        e.preventDefault();e.stopImmediatePropagation();
        vm.msg='Выберите адрес доставки из предложенных реальных адресов';
      }
    }
  },true);

  function enforceDeliveryVisibility(){
    var enabled=getSelectedVenueDelivery();
    Array.prototype.slice.call(document.querySelectorAll('button')).forEach(function(btn){
      if((btn.textContent||'').indexOf('Доставка')!==-1)btn.style.display=enabled?'':'none';
    });
    if(!enabled)clearSuggestions();
  }

  function init(){
    patchVenueRpc();
    var input=findAddressInput();
    if(input)ensureBox(input);
    enforceDeliveryVisibility();
  }

  var observer=new MutationObserver(function(){init();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  var tries=0;
  var timer=setInterval(function(){init();if(++tries>120)clearInterval(timer);},250);
  document.addEventListener('click',function(e){
    if(state.box&&state.box.style.display==='block'&&e.target!==state.input&&!state.box.contains(e.target))clearSuggestions();
  },false);
})();
