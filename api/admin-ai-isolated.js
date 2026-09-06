'use strict';

/* Admin Qrchick provider isolation bridge.
 * The admin route may use ADMIN_AI_KEY only; the menu-import key is never a fallback.
 */
process.env.GEMINI_API_KEY = '';
const agent = require('./admin-ai-agent');

module.exports = function handler(req, res) {
  return agent(req, res);
};
