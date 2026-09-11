'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const router=fs.readFileSync(path.join(root,'lib/integrations/router.js'),'utf8');
const vercel=fs.readFileSync(path.join(root,'vercel.json'),'utf8');

test('integration rewrites preserve the provider subroute',()=>{
  assert.match(vercel,/\/api\/integrations\/:path\*.*\/api\/integrations\?route=\/api\/integrations\/:path\*/);
  assert.match(router,/params\.get\('route'\)/);
  assert.match(router,/routed\.startsWith\('\/'\)/);
});

test('integration router keeps provider locking after route normalization',()=>{
  assert.match(router,/const expected=LOCKED\.get\(pathname\)/);
  assert.match(router,/claim\(venue,provider,900\)/);
  assert.match(router,/release\(venue,provider,token\)/);
});
