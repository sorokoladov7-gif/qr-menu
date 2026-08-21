(function(){
'use strict';
function mount(){
  if(document.getElementById('manager-hall-listener')) return;
  var marker=document.createElement('span'); marker.id='manager-hall-listener'; marker.style.display='none'; document.body.appendChild(marker);
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-manager-hall-tab]'); if(!btn)return;
    e.preventDefault();
    var old=document.getElementById('manager-hall-overlay'); if(old)old.remove();
    var venueId=localStorage.getItem('manager_venue_id')||'';
    var overlay=document.createElement('div'); overlay.id='manager-hall-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:#0b1120;padding:12px;display:flex;flex-direction:column;gap:8px';
    var bar=document.createElement('div'); bar.style.cssText='display:flex;justify-content:space-between;align-items:center;color:#fff';
    bar.innerHTML='<b>🪑 Управление залом</b><button id="manager-hall-close" style="border:0;border-radius:10px;padding:9px 13px;background:#ffffff12;color:#fff;cursor:pointer">Закрыть</button>';
    var frame=document.createElement('iframe'); frame.src='hall.html'+(venueId?'?venue='+encodeURIComponent(venueId):''); frame.style.cssText='flex:1;width:100%;border:1px solid #ffffff12;border-radius:16px;background:#0b1120'; frame.setAttribute('allow','geolocation');
    overlay.appendChild(bar); overlay.appendChild(frame); document.body.appendChild(overlay);
    document.getElementById('manager-hall-close').onclick=function(){overlay.remove()};
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
