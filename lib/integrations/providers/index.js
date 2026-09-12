'use strict';

// Canonical adapter boundary. Consumers resolve providers through this map
// instead of maintaining independent require() lists.
module.exports={
  iiko:require('./iiko'),
  quick_resto:require('./pos'),
  r_keeper:require('./pos'),
  saby_presto:require('./saby-presto'),
  poster:require('./poster'),
  syrve:require('./syrve'),
  evotor:require('./evotor'),
  frontpad:require('./frontpad')
};
