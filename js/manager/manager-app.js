/* QR Menu — manager app methods bridge. */
(function(){
  'use strict';
  window.__QR_MANAGER_APP__ = window.__QR_MANAGER_APP__ || {};
  var appMethods = window.__QR_MANAGER_APP__;
  if(!appMethods.openStaffGuide){
    appMethods.openStaffGuide = function(){ window.location.href = '/staff-guide.html'; };
  }
})();