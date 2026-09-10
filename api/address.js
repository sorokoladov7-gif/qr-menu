'use strict';

// Public HTTP contract: GET /api/address?q=...
// Business logic lives outside /api so Vercel entrypoints stay thin.
module.exports = require('../lib/address/suggestions');
