/* QRChick Recipes legacy compatibility shim.
 * The recipe workspace is database- and AI-backed by js/manager/manager-recipe-db.js.
 * Kept at the canonical path so legacy lazy-loader references remain harmless.
 */
(function(){
  'use strict';
  window.__QR_RECEPT_AI_LOADED__=true;
  window.__QR_RECEPT_AI_DISABLED__=true;
})();
