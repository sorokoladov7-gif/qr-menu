'use strict';

const agent = require('./admin-ai-agent');

module.exports = async function handler(req,res){
  if(!agent || typeof agent.streamAgent!=='function'){
    res.statusCode=503;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({error:'QRCHICK_STREAM_AGENT_UNAVAILABLE'}));
    return;
  }
  return agent.streamAgent(req,res);
};
