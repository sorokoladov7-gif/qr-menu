/* Manager staff UI compatibility module.
 * The manager cabinet already contains the real staff CRUD methods.
 * This module only restores the visible quick-action buttons and never
 * replaces the existing create/edit/delete staff logic.
 */
(function(){
  'use strict';
  if (!/\/manager\.html$/i.test(location.pathname)) return;

  function vm(){
    var app=document.getElementById('app');
    return app && app.__vueParentComponent && app.__vueParentComponent.proxy;
  }

  function install(){
    var v=vm();
    var tabs=document.querySelector('.tabs');
    if(!v || !tabs || !v.venue){setTimeout(install,250);return;}
    if(document.getElementById('manager-staff-quick-actions')) return;

    var box=document.createElement('div');
    box.id='manager-staff-quick-actions';
    box.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025);';

    var label=document.createElement('span');
    label.textContent='Персонал:';
    label.style.cssText='font-weight:800;color:#e5e7eb;margin-right:4px;';
    box.appendChild(label);

    function button(type,text,bg){
      var b=document.createElement('button');
      b.type='button';
      b.textContent=text;
      b.className='btn btn-green btn-sm';
      b.style.background=bg;
      b.onclick=function(){
        var cur=vm();
        if(cur && typeof cur.openCreateStaff==='function') cur.openCreateStaff(type);
      };
      box.appendChild(b);
    }

    button('cook','👨‍🍳 Добавить повара','#047857');
    button('waiter','🤵 Добавить официанта','#0e7490');
    button('courier','🚗 Добавить курьера','#b45309');
    tabs.parentNode.insertBefore(box,tabs);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install);
  else install();
})();
