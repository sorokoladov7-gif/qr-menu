/* Manager staff UI compatibility + cook phone support. */
(function(){
  'use strict';
  if(!/\/manager\.html$/i.test(location.pathname)) return;
  function vm(){var app=document.getElementById('app');return app&&app.__vueParentComponent&&app.__vueParentComponent.proxy;}
  function addPhoneField(v){
    var modal=document.querySelector('.modal');
    if(!modal||!v||!v.createStaffModal||v.createStaffType!=='cook') return;
    if(modal.querySelector('[data-cook-phone-field]')) return;
    var inputs=modal.querySelectorAll('.field');
    if(!inputs.length) return;
    var pinField=inputs[inputs.length-1];
    var wrap=document.createElement('div');
    wrap.className='field';
    wrap.setAttribute('data-cook-phone-field','1');
    wrap.innerHTML='<label>Телефон</label><input type="tel" placeholder="+7 900 000-00-00" value="'+String(v.createStaffForm.phone||'').replace(/"/g,'&quot;')+'">';
    var input=wrap.querySelector('input');
    input.addEventListener('input',function(){var cur=vm();if(cur&&cur.createStaffForm)cur.createStaffForm.phone=input.value;});
    pinField.parentNode.insertBefore(wrap,pinField);
  }
  function addCookPhones(v){
    var tab=location.pathname.toLowerCase().endsWith('manager.html') ? document.querySelector('.tabs') : null;
    if(!tab||!v.venue||!v.cooks) return;
    var cards=[].slice.call(document.querySelectorAll('.menu-item'));
    v.cooks.forEach(function(c){
      var card=cards.find(function(el){return (el.textContent||'').indexOf(c.name)>=0 && (el.textContent||'').indexOf('Повар')>=0;});
      if(!card||card.querySelector('[data-cook-phone]'))return;
      var b=document.createElement('div');b.className='muted';b.setAttribute('data-cook-phone','1');b.style.fontSize='12px';b.textContent='📞 '+(c.phone||'не указан');
      var host=card.querySelector('div[style*="flex:1"]')||card.firstElementChild; if(host)host.appendChild(b);
    });
  }
  function install(){
    var v=vm();var tabs=document.querySelector('.tabs');
    if(!v||!tabs||!v.venue){setTimeout(install,250);return;}
    if(!document.getElementById('manager-staff-quick-actions')){
      var box=document.createElement('div');box.id='manager-staff-quick-actions';box.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);';
      var label=document.createElement('span');label.textContent='Персонал:';label.style.cssText='font-weight:800;color:#e5e7eb;margin-right:4px;';box.appendChild(label);
      [['cook','👨‍🍳 Добавить повара','#047857'],['waiter','🤵 Добавить официанта','#0e7490'],['courier','🚗 Добавить курьера','#b45309']].forEach(function(x){var b=document.createElement('button');b.type='button';b.textContent=x[1];b.className='btn btn-green btn-sm';b.style.background=x[2];b.onclick=function(){var cur=vm();if(cur&&typeof cur.openCreateStaff==='function')cur.openCreateStaff(x[0]);};box.appendChild(b);});
      tabs.parentNode.insertBefore(box,tabs);
    }
    addPhoneField(v);addCookPhones(v);
    setTimeout(install,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
