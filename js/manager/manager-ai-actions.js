/* QR Menu — compatibility shell for the canonical Qrchick manager AI UI. */
(function(){
  'use strict';
  if(window.__QR_MANAGER_AI_ACTIONS__)return;
  window.__QR_MANAGER_AI_ACTIONS__=true;

  /*
   * The complete manager action UI is owned by manager-ai.js.
   * This file remains because manager.html already loads it; it intentionally
   * does not monkey-patch fetch or render a second action panel.
   * All writes still go through /api/manager-ai-action, where the server
   * re-checks manager role, subscription, AI feature, venue ownership and
   * manager permissions before changing data.
   */
})();
