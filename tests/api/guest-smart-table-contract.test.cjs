const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appJs = fs.readFileSync(path.join(__dirname, '../../src/assets/js/shared/app.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260912121000_smart_table_collaboration_hardening.sql'), 'utf8');
const syncMigration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260913200000_smart_table_guest_session_sync.sql'), 'utf8');
const lifecycleMigration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260913213000_harden_smart_table_guest_lifecycle.sql'), 'utf8');

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

test('guest session sync is authoritative and cannot cross table sessions', () => {
  assert.match(syncMigration, /create or replace function public\.smart_table_guest_sync\(\n  p_qr_token text,/);
  assert.match(syncMigration, /where qr_token=trim\(p_qr_token\)\n     and is_active=true/);
  assert.match(syncMigration, /token_hash=encode\(digest\(trim\(p_guest_token\),'sha256'\),'hex'\)/);
  assert.match(syncMigration, /v_session\.id is null or v_guest\.table_session_id<>v_session\.id/);
  assert.match(syncMigration, /table_session_id=v_guest\.table_session_id/);
});

test('guest session sync returns live order state for the active session', () => {
  assert.match(syncMigration, /'status',o\.status/);
  assert.match(syncMigration, /'total_price',coalesce\(o\.total_price,0\)/);
  assert.match(syncMigration, /o\.status not in \('done','cancelled'\)/);
  assert.match(syncMigration, /grant execute on function public\.smart_table_guest_sync\(text,text,text\) to anon,authenticated/);
});

test('closing a table session immediately invalidates every guest session', () => {
  assert.match(lifecycleMigration, /create or replace function public\.smart_table_close_guest_sessions\(\)/i);
  assert.match(lifecycleMigration, /new\.status='closed'/);
  assert.match(lifecycleMigration, /update public\.table_guest_sessions/);
  assert.match(lifecycleMigration, /table_session_id=new\.id/);
  assert.match(lifecycleMigration, /left_at=coalesce\(left_at,coalesce\(new\.closed_at,now\(\)\)\)/);
  assert.match(lifecycleMigration, /trg_smart_table_close_guest_sessions/);
});

test('guest lifecycle backfill and sync expose a clean closed-session state', () => {
  assert.match(lifecycleMigration, /ts\.status='closed'/);
  assert.match(lifecycleMigration, /g\.left_at is null/);
  assert.match(lifecycleMigration, /'joined',false/);
  assert.match(lifecycleMigration, /'session_status',case when v_session\.id is null then 'closed' else v_session\.status end/);
  assert.match(lifecycleMigration, /'orders','\[\]'::jsonb/);
  assert.match(lifecycleMigration, /'session_status',v_session\.status/);
});
