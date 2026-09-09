'use strict';

/* Compatibility endpoint for clients that still call /api/admin-ai-stream.
 * The canonical Qrchick intelligence remains admin-ai-agent.js.
 * No separate streaming implementation is introduced until the agent exposes one. */
const agent = require('./admin-ai-agent');

module.exports = async function handler(req, res) {
  const body = req && req.body && typeof req.body === 'object' ? req.body : {};
  return agent(req, res, Object.assign({}, body, { stream: true }));
};
