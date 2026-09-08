/* QR Menu — Manager Hall. Single source of truth (Enhanced 2D). */
(function(){
'use strict';
if(window.__QR_MANAGER_HALL_SINGLE__)return;window.__QR_MANAGER_HALL_SINGLE__=true;
var S={venue:null,tables:[],root:null,zoom:1,busy:false,moves:[]},qrPromise=null;
