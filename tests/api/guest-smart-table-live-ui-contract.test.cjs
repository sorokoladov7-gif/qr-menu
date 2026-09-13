const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = fs.readFileSync(path.join(__dirname, '../../src/assets/js/guest/menu-modifiers.js'), 'utf8');

test('guest live Smart Table UI uses the server-authoritative guest sync RPC', () => {
  assert.match(file, /smart_table_guest_sync/);
  assert.match(file, /p_qr_token:token/);
  assert.match(file, /p_guest_token:guestToken/);
  assert.match(file, /p_language:'ru'/);
});

test('guest live Smart Table UI exposes session and order state to the page', () => {
  assert.match(file, /window\.QRSmartTable\.sessionId/);
  assert.match(file, /window\.QRSmartTable\.liveOrders/);
  assert.match(file, /qr-smart-table-sync/);
  assert.match(file, /qr-smart-table-orders-updated/);
});

test('guest live Smart Table UI is visibility-aware and refreshes periodically', () => {
  assert.match(file, /if\(document\.hidden\|\|busy\)return/);
  assert.match(file, /setInterval\(sync,5000\)/);
  assert.match(file, /visibilitychange/);
});

test('guest live UI does not trust URL venue/table identifiers for state sync', () => {
  assert.doesNotMatch(file, /smart_table_guest_sync[^\n]*p_venue_id/);
  assert.doesNotMatch(file, /smart_table_guest_sync[^\n]*p_table_id/);
});
