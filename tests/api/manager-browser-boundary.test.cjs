'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const readAsset=name=>fs.readFileSync(path.join(root,'src','assets','js','manager',name),'utf8');

test('manager orders loading uses scoped RPC and status mutations use canonical action API',()=>{
  const source=readAsset('manager-orders.js');
  assert.ok(source.includes("db.rpc('manager_get_orders'"));
  assert.ok(source.includes("runner({type:'update_order'"));
  assert.ok(source.includes('venue_id:venueId'));
  assert.equal(source.includes("db.from('orders').update(u)"),false);
});

test('manager staff deletion mutations use canonical action API and scoped delete RPC',()=>{
  const source=readAsset('manager-staff.js');
  assert.ok(source.includes("type:'delete_staff'"));
  assert.ok(source.includes('__QR_RUN_MANAGER_ACTION__'));
  assert.equal(source.includes("db.from('cooks').delete()"),false);
  assert.equal(source.includes("db.from('couriers').delete()"),false);
  assert.equal(source.includes("db.from('waiters').delete()"),false);
});

test('manager product browser mutations remain behind the central bridge',()=>{
  const source=readAsset('manager-core.js');
  assert.ok(source.includes('function installProductMutationBridge()'));
  assert.ok(source.includes("type:'create_product'"));
  assert.ok(source.includes("mutationBridge('update_product'"));
  assert.ok(source.includes("mutationBridge('delete_product'"));
  assert.ok(source.includes('PRODUCT_PAYLOAD_INVALID'));
  assert.equal(source.includes('return originalInsert(values,options)'),false);
});

test('hall view helper is presentation-only and never wraps Vue or db.rpc',()=>{
  const source=readAsset('manager-hall-view.js');
  assert.ok(source.includes('__managerVue'));
  assert.equal(source.includes('Vue.createApp='),false);
  assert.equal(source.includes('db.rpc='),false);
  assert.equal(source.includes('loadManagerSubscription'),false);
  assert.equal(source.includes('canCreateVenue'),false);
});

test('canonical hall compatibility bridge owns the venue RPC and subscription helpers',()=>{
  const source=readAsset('manager-hall-ai.js');
  assert.ok(source.includes('window.db.rpc=function(fn,args,options)'));
  assert.ok(source.includes("originalRpc('create_venue_from_template'"));
  assert.ok(source.includes('loadManagerSubscription'));
  assert.ok(source.includes('selectVenueTemplate'));
  assert.equal(source.includes('options.computed.canCreateVenue='),false);
});

test('canonical billing module remains the single browser billing implementation',()=>{
  const source=readAsset('manager-billing.js');
  assert.ok(source.includes('window.__QR_MANAGER_BILLING_MIXIN__ = billingMixin'));
  assert.ok(source.includes('markPaid: function()'));
  assert.ok(source.includes('loadPayments: function()'));
});
