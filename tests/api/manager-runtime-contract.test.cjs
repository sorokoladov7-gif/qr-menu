'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
function readAsset(name) {
  return fs.readFileSync(path.join(root, 'src', 'assets', 'js', 'manager', name), 'utf8');
}

function assertNoLegacy(source, markers, file) {
  for (const marker of markers) {
    assert.equal(source.includes(marker), false, `${file} must not reference revoked/legacy mutation contract: ${marker}`);
  }
}

test('manager hall browser runtime stays on the canonical table RPC family', () => {
  const source = readAsset('manager-hall.js');
  const canonical = [
    'manager_create_table',
    'manager_update_table',
    'manager_move_table',
    'manager_delete_table',
    'manager_regenerate_table_qr',
    'manager_set_table_status',
    'manager_seat_table',
    'manager_set_table_reservation_guest',
    'manager_close_table_session',
    'manager_save_hall_plan',
    'manager_delete_hall_plan'
  ];
  for (const name of canonical) assert.ok(source.includes(name), `${name} must remain available to hall runtime`);
  assertNoLegacy(source, ['manager_upsert_table'], 'manager-hall.js');
});

test('manager recipes keep reads separate from canonical mutation bridge', () => {
  const source = readAsset('manager-recipes.js');
  for (const name of ['manager_ingredient_list', 'manager_recipe_list']) {
    assert.ok(source.includes(`rpc('${name}'`), `${name} must remain a read contract`);
  }
  assertNoLegacy(source, [
    'manager_recipe_auto_sync',
    'manager_global_ingredient_update',
    'manager_global_ingredient_delete'
  ], 'manager-recipes.js');
  assert.ok(source.includes('manager_ingredient_upsert'));
  assert.ok(source.includes('manager_ingredient_delete'));
  assert.ok(source.includes('manager_product_recipe_save'));
});

test('manager compatibility bridge does not reintroduce revoked table mutation RPCs', () => {
  const source = readAsset('manager-hall-view.js');
  assertNoLegacy(source, [
    'manager_upsert_table',
    'manager_recipe_auto_sync',
    'manager_global_ingredient_update',
    'manager_global_ingredient_delete'
  ], 'manager-hall-view.js');
});

test('manager core keeps venue settings off the removed legacy RPC', () => {
  const source = readAsset('manager-core.js');
  assertNoLegacy(source, ['manager_save_venue_settings'], 'manager-core.js');
  assert.ok(source.includes("type:'update_delivery_settings'"));
});
