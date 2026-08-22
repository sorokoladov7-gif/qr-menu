/* Static trial copy correction. No polling or DOM observers. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_TRIAL_COPY__) return;
  window.__QR_MANAGER_TRIAL_COPY__=true;
  function apply(){
    var root=document.getElementById('app')||document.body;
    if(!root) return;
    root.querySelectorAll('*').forEach(function(el){
      if(el.children.length===0 && typeof el.textContent==='string' && el.textContent.indexOf('3 дня бесплатно')!==-1){
        el.textContent=el.textContent.replace(/3 дня бесплатно/g,'5 дней бесплатно');
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(apply,400);});
  else setTimeout(apply,400);
})();
