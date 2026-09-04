/* FrontPad adapter routing is handled by the existing integration hub. */
(function(){
'use strict';
var provider='frontpad';
function patch(){
 var cards=document.querySelectorAll('.hub-card[data-provider="'+provider+'"]');
 cards.forEach(function(c){
   var b=c.querySelector('.hub-open');
   if(b)b.setAttribute('data-real-adapter','frontpad');
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch);else patch();
})();
