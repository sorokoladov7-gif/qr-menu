/* QR-Menu — manager AI compatibility bridge. */
'use strict';

/* Manager AI is isolated from the import/admin AI providers. */
process.env.GEMINI_API_KEY = '';
const propose = require('./manager-ai-propose');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ok:false,error:'method_not_allowed'}));
  }
  req.body = Object.assign({}, req.body || {}, {mode:'propose'});
  return propose(req, res);
};
