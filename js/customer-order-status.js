(function(){
'use strict';
if(window.__customerOrderStatusLoaded)return;
window.__customerOrderStatusLoaded=true;

function statusLabel(status){
  return ({
    new:'Принят',
    changed:'Изменён',
    cooking:'Готовится',
    ready:'Готов',
    delivery:'Передан в доставку',
    done:'Выполнен',
    cancelled:'Отменён'
  })[status]||status||'Ожидание';
}
function statusStep(status){
  return ({new:1,changed:1,cooking:2,ready:3,delivery:3,done:4,cancelled:0})[status]||1;
}
function esc(v){var d=document.createElement('div');d.textContent=String(v==null?'':v);return d.innerHTML}
function render(box,order){
  if(!box||!order)return;
  var s=order.status||'new', step=statusStep(s);
  var steps=['Принят','Готовится','Готов','Выполнен'];
  box.innerHTML='<div class="customer-order-status" style="margin:18px 0 0;padding:16px;border-radius:16px;background:rgba(255,255,255,.06);text-align:left">'
    +'<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>Статус заказа</b><strong>'+esc(statusLabel(s))+'</strong></div>'
    +'<div style="margin-top:12px;display:grid;gap:7px">'+steps.map(function(x,i){var active=step>=i+1;return '<div style="display:flex;align-items:center;gap:8px;opacity:'+(active?'1':'.35')+'"><span style="width:10px;height:10px;border-radius:50%;background:'+(active?'currentColor':'#64748b')+'"></span><span>'+x+'</span></div>'}).join('')+'</div>'
    +(s==='cancelled'?'<div style="margin-top:10px;color:#f87171"><b>Заказ отменён</b></div>':'')
    +'<div style="margin-top:10px;font-size:12px;opacity:.65">Автоматическое обновление статуса</div>'
    +'</div>';
}
function boot(){
  var tries=0;
  var timer=setInterval(function(){
    var app=document.getElementById('app'),inst=app&&app.__vue_app__&&app.__vue_app__._instance,vm=inst&&inst.proxy;
    if(!vm||!vm.done||!vm.venue||!vm.form||!vm.form.phone)return;
    if(!vm.__customerStatusStarted){
      vm.__customerStatusStarted=true;
      var modal=document.querySelector('.modal .box');
      if(!modal)return;
      var box=document.createElement('div');box.id='customer-order-status-box';modal.appendChild(box);
      var load=function(){
        if(!window.db||typeof window.db.rpc!=='function')return;
        window.db.rpc('customer_track_order_json',{p_venue_id:vm.venue.id,p_customer_phone:vm.form.phone}).then(function(r){
          if(!r.error&&r.data)render(box,r.data);
        });
      };
      load();
      var poll=setInterval(load,5000);
      vm.__customerStatusPoll=poll;
      return;
    }
    if(++tries>120)clearInterval(timer);
  },250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
