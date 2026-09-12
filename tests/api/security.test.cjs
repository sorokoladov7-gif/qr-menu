const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const base = String(process.env.PLAYWRIGHT_BASE_URL || process.env.TEST_API_BASE_URL || '').replace(/\/$/, '');
const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const protectedEndpoints = ['/api/payments', '/api/integrations', '/api/admin-ai-agent'];

test('protected API endpoints reject unauthenticated requests', async (t) => {
  t.skip(!base, 'TEST_API_BASE_URL or PLAYWRIGHT_BASE_URL is not configured');
  for (const endpoint of protectedEndpoints) {
    const response = await fetch(`${base}${endpoint}`, { method: 'GET' });
    assert.ok([401, 403, 405].includes(response.status), `${endpoint} returned ${response.status}`);
  }
});

test('Qrchick mutation gateway requires explicit approval tokens', () => {
  const source = read('lib/ai/admin/isolated.js');
  assert.match(source, /if\(action==='apply'\)\{const changes=validateCodeChanges\(body\.changes\);verifyApproval\(body\.approval_token,'code',user\.id,changes\);/);
  assert.match(source, /if\(action==='apply_db'\)\{const raw=body\.database_changes;if\(!Array\.isArray\(raw\)\|\|!raw\.length\)throw/);
  assert.match(source, /verifyApproval\(body\.approval_token,'db',user\.id,normalized\);/);
  assert.doesNotMatch(source, /if\(body\.approval_token\)verifyApproval\(/);
});

test('YooKassa webhook preserves terminal payment statuses and claims subscriptions atomically', () => {
  const source = read('lib/payments/yookassa/webhook.js');
  assert.match(source, /if \(status === 'failed'\) return 'failed';/);
  assert.match(source, /if \(status === 'refunded'\) return 'refunded';/);
  assert.match(source, /'failed', 'refunded'\]\.includes\(status\)/);
  assert.match(source, /payment_status=neq\.paid&paid_at=is\.null/);
});

test('admin payment confirmation uses the canonical plan and entitlement chain', () => {
  const migrationDir = path.join(root, 'supabase', 'migrations');
  const source = fs.readdirSync(migrationDir).filter(name => name.endsWith('.sql') && name >= '20260910100000_harden_admin_payment_entitlement_chain.sql').map(name => read(`supabase/migrations/${name}`)).join('\n');
  assert.match(source, /from public\.plans\s+where id = v_payment\.plan_id\s+and is_active = true/);
  assert.match(source, /public\.admin_set_manager_plan\(v_payment\.manager_id, v_plan\.id::text\)/);
  assert.match(source, /payment_status = 'paid'/);
  assert.match(source, /paid_at is not null/);
  assert.match(source, /where id = p_payment_id\s+and status = 'pending'/);
  assert.match(source, /already_processed/);
});

test('manager entitlement RPCs serialize per-manager mutations', () => {
  const source = read('supabase/migrations/20260910101000_lock_manager_entitlement_rpcs.sql');
  assert.equal((source.match(/pg_advisory_xact_lock\(hashtextextended\(p_manager_id::text, 0\)\)/g) || []).length, 2);
  assert.match(source, /limit 1\s+for update/);
});

test('manager AI action gateway keeps feature and venue checks before mutations', () => {
  const source = read('lib/ai/manager/action.js');
  assert.match(source, /MAP\[f\].*includes\(type\)/);
  assert.match(source, /entitlement\(c,f\)/);
  assert.match(source, /venue\(c,vid,'menu'\)/);
  assert.match(source, /venue\(c,vid,'price'\)/);
  assert.match(source, /venue\(c,vid,'venue'\)/);
  assert.match(source, /H\.includes\(type\)/);
});

test('manager support thread creation enforces supplied venue ownership', () => {
  const rpcSource = read('supabase/migrations/20260910180000_harden_manager_support_thread_venue_scope.sql');
  const rlsSource = read('supabase/migrations/20260910181500_harden_manager_support_thread_rls_venue_scope.sql');
  assert.match(rpcSource, /p_venue_id is not null and not public\.is_manager_of\(p_venue_id\)/);
  assert.match(rpcSource, /raise exception 'VENUE_ACCESS_DENIED'/);
  assert.match(rlsSource, /manager_support_threads_manager_insert/);
  assert.match(rlsSource, /venue_id is null or public\.is_manager_of\(venue_id\)/);
  assert.match(rlsSource, /manager_support_threads_manager_update/);
});
