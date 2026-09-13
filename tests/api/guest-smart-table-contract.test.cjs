const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '../../src/assets/js/shared/app.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260912121000_smart_table_collaboration_hardening.sql'), 'utf8');

function blockAfter(marker) {
  const start = appJs.indexOf(marker);
  assert.notEqual(start, -1, `missing marker: ${marker}`);
  return appJs.slice(start);
}

test('guest QR bridge resolves table context by QR token', () => {
  const block = blockAfter('Smart Table 2.0 guest bridge');
  assert.match(block, /smart_table_get_context_by_token/);
  assert.match(block, /p_qr_token:tableToken/);
  assert.match(block, /smart_table_join/);
  assert.match(block, /p_guest_token:guestToken/);
});

test('guest QR bridge keeps guest identity scoped to the table QR token', () => {
  const block = blockAfter('Smart Table 2.0 guest bridge');
  assert.match(block, /qr-smart-table-guest.*tableToken/);
  assert.match(block, /sessionStorage\.getItem/);
  assert.match(block, /sessionStorage\.setItem/);
});

test('table order RPC is joined to the Smart Table guest session before creation', () => {
  const block = blockAfter('Smart Table 2.0 guest bridge');
  assert.match(block, /name!=='create_public_order'/);
  assert.match(block, /args\.p_order_type!=='table'/);
  assert.match(block, /return join\(guestName\)\.then\(function\(\)\{return originalRpc\(name,args,options\);\}\)/);
});

test('Smart Table polling is read-only and visibility aware', () => {
  const block = blockAfter('Smart Table 2.0 guest bridge');
  assert.match(block, /if\(document\.hidden\)return/);
  assert.match(block, /setInterval\(poll,5000\)/);
  assert.doesNotMatch(block, /setInterval\([^\n]*smart_table_join/);
});

test('public QR context resolver derives venue from active QR token', () => {
  assert.match(migration, /create or replace function public\.smart_table_get_context_by_token\(p_qr_token text/);
  assert.match(migration, /from public\.venue_tables where qr_token=trim\(p_qr_token\) and is_active=true/);
  assert.match(migration, /return public\.smart_table_context\(v_venue_id,p_qr_token,p_language\)/);
});
