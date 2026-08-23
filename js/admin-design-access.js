(function(){
'use strict';
if(!/\/admin\.html$/i.test(location.pathname))return;
if(window.__adminDesignAccessLoaded)return;
window.__adminDesignAccessLoaded=true;

var STYLE_ID='admin-design-access-style', ITEM_CLASS='admin-design-access-item';

function getProxy(){
  var root=document.getElementById('app');
  var app=root&&root.__vue_app__;
  return app&&app._instance&&app._instance.proxy||null;
}

function addStyle(){
  if(document.getElementById(STYLE_ID))return;
  var s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent='.'+ITEM_CLASS+'{display:flex!important;align-items:center;gap:7px;background:rgba(99,102,241,.10);border:1px solid rgba(99,102,241,.30);padding:7px 10px;border-radius:8px;color:#e5e7eb;cursor:pointer}.admin-design-access-note{display:block!important;margin:7px 0 0;color:#94a3b8;font-size:11px;line-height:1.4}.qr-sub-cell{vertical-align:middle}.qr-sub-select{min-width:120px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:#fff}.qr-sub-action{margin-top:4px;padding:3px 7px!important;font-size:11px!important}';
  document.head.appendChild(s);
}

function getVenueForModal(p){
  if(!p||!p.venueEditModal)return null;
  var id=p.venueEditModal.id,list=Array.isArray(p.venues)?p.venues:[];
  for(var i=0;i<list.length;i++)if(list[i]&&list[i].id===id)return list[i];
  return null;
}
function ensurePerm(p){
  if(!p||!p.venueEditModal||!p.venueEditModal.show)return false;
  if(!p.venueEditModal.perms)p.venueEditModal.perms={addons:true,products:true,prices:true};
  var v=getVenueForModal(p);
  if(v){var mp=v.manager_permissions||{};if(typeof p.venueEditModal.perms.design!=='boolean')p.venueEditModal.perms.design=mp.design===true}
  else if(typeof p.venueEditModal.perms.design!=='boolean')p.venueEditModal.perms.design=false;
  return true;
}
function patchOpen(p){
  if(!p||p.__adminDesignOpenPatched||typeof p.openVenueEdit!=='function')return;
  var original=p.openVenueEdit;
  p.openVenueEdit=function(v){
    var r=original.apply(this,arguments);
    try{
      if(this.venueEditModal){
        var mp=(v&&v.manager_permissions)||{};
        if(!this.venueEditModal.perms)this.venueEditModal.perms={addons:true,products:true,prices:true};
        this.venueEditModal.perms.design=mp.design===true;
      }
    }catch(e){}
    setTimeout(function(){renderDesignAccess(p)},0);
    return r;
  };
  p.__adminDesignOpenPatched=true;
}
function findSettingsModal(){
  var list=document.querySelectorAll('.modal');
  for(var i=0;i<list.length;i++){
    var n=list[i];if(n.offsetParent===null)continue;
    var text=(n.textContent||'').replace(/\s+/g,' ');
    if(text.indexOf('Права управляющего')!==-1&&text.indexOf('Менять цены')!==-1)return n;
  }
  return null;
}
function renderDesignAccess(p){
  addStyle();if(!ensurePerm(p))return;
  var modal=findSettingsModal();if(!modal)return;
  var group=null,labels=modal.querySelectorAll('label');
  for(var i=0;i<labels.length;i++)if((labels[i].textContent||'').indexOf('Менять цены')!==-1){group=labels[i].parentNode;break;}
  if(!group)return;
  var item=group.querySelector('.'+ITEM_CLASS);
  if(item){var inp=item.querySelector('input');if(inp)inp.checked=p.venueEditModal.perms.design===true;return;}
  var itemNew=document.createElement('label');itemNew.className='checkbox-label '+ITEM_CLASS;
  var input=document.createElement('input');input.type='checkbox';input.checked=p.venueEditModal.perms.design===true;
  input.addEventListener('change',function(){if(p.venueEditModal&&p.venueEditModal.perms)p.venueEditModal.perms.design=input.checked;});
  var span=document.createElement('span');span.textContent='🎨 Разрешить управляющему дизайн';
  itemNew.appendChild(input);itemNew.appendChild(span);group.appendChild(itemNew);
  var note=document.createElement('div');note.className='admin-design-access-note';note.textContent='Только администратор платформы может выдать или отозвать это право.';group.appendChild(note);
}

function tables(){return Array.prototype.slice.call(document.querySelectorAll('#app table.tbl'));}
function headerTexts(t){return t&&t.rows.length?Array.prototype.map.call(t.rows[0].cells,function(c){return(c.textContent||'').trim()}):[];}
function findVenueTable(){var ts=tables();for(var i=0;i<ts.length;i++){var h=headerTexts(ts[i]);if(h.indexOf('Заведение')!==-1&&h.indexOf('Действия')!==-1&&h.indexOf('Тариф')!==-1)return ts[i];}return null;}
function findManagerTable(){var ts=tables();for(var i=0;i<ts.length;i++){var h=headerTexts(ts[i]);if(h.indexOf('Имя')!==-1&&h.indexOf('Email')!==-1&&h.indexOf('Доступы к заведениям')!==-1)return ts[i];}return null;}
function removeVenueSubscriptionColumns(){
  var t=findVenueTable();if(!t||!t.rows.length)return;
  var idx=[];Array.prototype.forEach.call(t.rows[0].cells,function(c,i){var x=(c.textContent||'').trim();if(x==='Тариф'||x==='Подписка'||x==='До')idx.push(i);});
  idx.sort(function(a,b){return b-a;});
  idx.forEach(function(n){Array.prototype.forEach.call(t.rows,function(r){if(r.cells[n])r.deleteCell(n);});});
}
function findManagerForRow(p,row){
  var cells=row.cells;if(!cells||cells.length<2)return null;
  var name=(cells[0].textContent||'').trim();var email=(cells[1].textContent||'').trim();
  var list=Array.isArray(p.managers)?p.managers:[];
  for(var i=0;i<list.length;i++){
    var m=list[i]||{};
    if((m.email||'')===email || (m.display_name||'')===name)return m;
  }
  return null;
}
function findSub(p,managerId){
  var list=Array.isArray(p.subscriptions)?p.subscriptions:[];
  for(var i=0;i<list.length;i++)if(list[i]&&list[i].manager_id===managerId)return list[i];
  return null;
}
function findPlan(p,id){var list=Array.isArray(p.plans)?p.plans:[];for(var i=0;i<list.length;i++)if(list[i]&&list[i].id===id)return list[i];return null;}
function fmtDate(p,v){try{if(typeof p.fmtDate==='function')return p.fmtDate(v);if(!v)return '—';return new Date(v).toLocaleDateString('ru-RU');}catch(e){return v||'—';}}
async function setManagerPlan(p,m,planId){
  try{
    if(!window.db||!m||!m.id)return;
    var old=findSub(p,m.id);
    var end=old&&old.current_period_end?old.current_period_end:new Date(Date.now()+5*864e5).toISOString();
    var r=await db.from('subscriptions').upsert({manager_id:m.id,venue_id:null,plan_id:planId,status:'active',current_period_end:end},{onConflict:'manager_id'});
    if(r.error)throw r.error;
    var links=Array.isArray(p.links)?p.links.filter(function(x){return x&&x.manager_id===m.id}):[];
    var ids=links.map(function(x){return x.venue_id}).filter(Boolean);
    if(ids.length)await db.from('venues').update({plan:planId}).in('id',ids);
    if(typeof p.loadBaseData==='function')await p.loadBaseData();
    setTimeout(syncSubscriptionUI,50);
  }catch(e){alert('Не удалось изменить тариф: '+(e.message||e));}
}
async function extendManager(p,m){
  try{
    if(!window.db||!m||!m.id)return;
    var old=findSub(p,m.id),end=old&&old.current_period_end&&new Date(old.current_period_end)>new Date()?new Date(old.current_period_end):new Date();
    end.setDate(end.getDate()+30);
    var planId=old&&old.plan_id?old.plan_id:(Array.isArray(p.plans)&&p.plans[0]?p.plans[0].id:'start');
    var r=await db.from('subscriptions').upsert({manager_id:m.id,venue_id:null,plan_id:planId,status:'active',current_period_end:end.toISOString()},{onConflict:'manager_id'});
    if(r.error)throw r.error;
    var links=Array.isArray(p.links)?p.links.filter(function(x){return x&&x.manager_id===m.id}):[];
    var ids=links.map(function(x){return x.venue_id}).filter(Boolean);
    if(ids.length)await db.from('venues').update({plan:planId,subscription_end:end.toISOString(),status:'active'}).in('id',ids);
    if(typeof p.loadBaseData==='function')await p.loadBaseData();
    setTimeout(syncSubscriptionUI,50);
  }catch(e){alert('Не удалось продлить подписку: '+(e.message||e));}
}
function addManagerSubscriptionColumns(p){
  var t=findManagerTable();if(!t||!t.rows.length||!p)return;
  var h=t.rows[0],heads=headerTexts(t);
  if(heads.indexOf('Тариф')===-1){
    var access=heads.indexOf('Доступы к заведениям');if(access>=0){
      var th1=document.createElement('th');th1.textContent='Тариф';h.insertBefore(th1,h.cells[access]);
      var th2=document.createElement('th');th2.textContent='Подписка';h.insertBefore(th2,h.cells[access+1]);
      var th3=document.createElement('th');th3.textContent='До';h.insertBefore(th3,h.cells[access+2]);
    }
  }
  var rows=Array.prototype.slice.call(t.rows,1);
  rows.forEach(function(row){
    if(row.querySelector('.qr-sub-cell'))return;
    var m=findManagerForRow(p,row);if(!m)return;
    var sub=findSub(p,m.id),plan=findPlan(p,sub&&sub.plan_id),accessIndex=-1;
    Array.prototype.forEach.call(t.rows[0].cells,function(c,i){if((c.textContent||'').trim()==='Доступы к заведениям')accessIndex=i;});
    if(accessIndex<0)return;
    var c1=document.createElement('td');c1.className='qr-sub-cell';
    var select=document.createElement('select');select.className='qr-sub-select';
    var none=document.createElement('option');none.value='';none.textContent='— Нет тарифа —';select.appendChild(none);
    (p.plans||[]).forEach(function(pl){var o=document.createElement('option');o.value=pl.id;o.textContent=pl.name;if(sub&&sub.plan_id===pl.id)o.selected=true;select.appendChild(o);});
    select.addEventListener('change',function(){if(select.value)setManagerPlan(p,m,select.value);});c1.appendChild(select);row.insertBefore(c1,row.cells[accessIndex]);
    var c2=document.createElement('td');c2.className='qr-sub-cell';c2.innerHTML=sub?'<span class="badge '+(sub.status==='trialing'?'b-trial':'b-on')+'">'+(sub.status==='trialing'?'Триал':'Активна')+'</span>':'<span class="muted">Нет</span>';row.insertBefore(c2,row.cells[accessIndex+1]);
    var c3=document.createElement('td');c3.className='qr-sub-cell';c3.innerHTML=sub?'<div style="font-size:12px">'+fmtDate(p,sub.current_period_end)+'</div>':'';
    if(sub){var b=document.createElement('button');b.className='btn btn-ghost btn-sm qr-sub-action';b.textContent='+30 дн';b.onclick=function(){extendManager(p,m);};c3.appendChild(b);}else{var sp=document.createElement('span');sp.className='muted';sp.textContent='—';c3.appendChild(sp);}
    row.insertBefore(c3,row.cells[accessIndex+2]);
  });
}
function syncSubscriptionUI(){
  var p=getProxy();if(!p)return;removeVenueSubscriptionColumns();addManagerSubscriptionColumns(p);
}
function boot(){
  addStyle();
  var n=0,timer=setInterval(function(){syncSubscriptionUI();if(++n>120)clearInterval(timer);},300);
  var mo=new MutationObserver(function(){if(window.__qrAdminSubSync)return;window.__qrAdminSubSync=true;setTimeout(function(){window.__qrAdminSubSync=false;syncSubscriptionUI();},0);});
  if(document.body)mo.observe(document.body,{childList:true,subtree:true});
  var p=getProxy();if(p)patchOpen(p);
  setInterval(function(){var x=getProxy();if(x)patchOpen(x);},1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
