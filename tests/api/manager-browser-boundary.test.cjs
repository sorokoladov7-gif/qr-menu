'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
function readAsset(name) {
  return fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'manager', name), 'utf8');
}

test('manager order status mutations use canonical action API', () => {
  const source = readAsset('manager-orders.js');
  assert.ok(source.includes("action({type:'update_order'"));
  assert.ok(source.includes("payload:Object.assign({venue_id:self.venue&&self.venue.id,order_id:id},u)"));
  assert.equal(source.includes("db.from('orders').update(u)"), false);
});

test('manager staff deletion mutations use canonical action API', () => {
  const source = readAsset('manager-staff.js');
  assert.ok(source.includes("type:'delete_staff'"));
  assert.ok(source.includes("__QR_RUN_MANAGER_ACTION__"));
  assert.equal(source.includes("db.from('cooks').delete()"), false);
  assert.equal(source.includes("db.from('couriers').delete()"), false);
  assert.equal(source.includes("db.from('waiters').delete()"), false);
});

test('manager product browser mutations remain behind the central bridge', () => {
  const source = readAsset('manager-core.js');
  assert.ok(source.includes('function installProductMutationBridge()'));
  assert.ok(source.includes("type:'create_product'"));
  assert.ok(source.includes("type==='update_product'"));
  assert.ok(source.includes("type==='delete_product'"));
});
