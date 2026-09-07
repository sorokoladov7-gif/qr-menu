'use strict';

/* Compatibility export. The canonical provider catalog lives in registry.js. */
const {PROVIDERS}=require('./registry');
module.exports=Object.values(PROVIDERS);
