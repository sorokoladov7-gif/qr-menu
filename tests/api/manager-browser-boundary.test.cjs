'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const readAsset=name=>fs.readFileSync(path.join(root,'src','assets','js','manager',name),'utf8');

test('manager order status mutations use canonical action API',()=>{const source=readAsset('manager-orders.js');assert.ok(source.includes("action({type:'update_order'"));assert.ok(source.includes('venue_id:self.venue'));assert.equal(source.includes("db.from('orders').update(u)"),false);});
test('manager staff deletion mutations use canonical action API',()=>{const source=readAsset('manager-staff.js');assert.ok(source.includes("type:'delete_staff'"));assert.ok(source.includes('__QR_RUN_MANAGER_ACTION__'));assert.equal(source.includes("db.from('cooks').delete()"),false);assert.equal(source.includes("db.from('couriers').delete()"),false);assert.equal(source.includes("db.from('waiters').delete()"),false);});
test('manager product browser mutations remain behind the central bridge',()=>{const source=readAsset('manager-core.js');assert.ok(source.includes('function installProductMutationBridge()'));assert.ok(source.includes("type:'create_product'"));assert.match(source,/type===['"]update_product['"]/);assert.match(source,/type===['"]delete_product['"]/);assert.ok(source.includes('Array.isArray(values)?values.slice():[values]'));assert.ok(source.includes('PRODUCT_PAYLOAD_INVALID'));assert.equal(source.includes('return originalInsert(values,options)'),false);});
test('hall compatibility bridge does not own billing mutations',()=>{const source=readAsset('manager-hall-view.js');assert.ok(source.includes('loadManagerSubscription'));assert.ok(source.includes('canCreateVenue'));assert.equal(source.includes("subscriptions').upsert"),false);assert.equal(source.includes("payments').insert"),false);});
test('canonical billing module remains the single browser billing implementation',()=>{const source=readAsset('manager-billing.js');assert.ok(source.includes('window.__QR_MANAGER_BILLING_MIXIN__ = billingMixin'));assert.ok(source.includes('markPaid: function()'));assert.ok(source.includes('loadPayments: function()'));});
