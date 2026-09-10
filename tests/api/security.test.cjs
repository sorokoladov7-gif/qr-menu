const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const base = String(process.env.PLAYWRIGHT_BASE_URL || process.env.TEST_API_BASE_URL || '').replace(/\/$/, '');
const root = path.resolve(__dirname, '..', '..');

const protectedEndpoints = ['/api/payments', '/api/integrations', '/api/admin-ai-agent'];

test('protected API endpoints reject unauthenticated requests', async (t) => {
  t.skip(!base, 'TEST_API_BASE_URL or PLAYWRIGHT_BASE_URL is not configured');

  for (const endpoint of protectedEndpoints) {
    const response = await fetch(`${base}${endpoint}`, { method: 'GET' });
    assert.ok([401, 403, 405].includes(response.status), `${endpoint} returned ${response.status}`);
  }
});

test('Qrchick mutation gateway requires explicit approval tokens', () => {
  const source = fs.readFileSync(path.join(root, 'api', 'admin-ai-isolated.js'), 'utf8');
  assert.match(source, /if\(action==='apply'\)\{const changes=validateCodeChanges\(body\.changes\);verifyApproval\(body\.approval_token,'code',user\.id,changes\);/);
  assert.match(source, /if\(action==='apply_db'\)\{const raw=body\.database_changes;if\(!Array\.isArray\(raw\)\|\|!raw\.length\)throw/);
  assert.match(source, /verifyApproval\(body\.approval_token,'db',user\.id,normalized\);/);
  assert.doesNotMatch(source, /if\(body\.approval_token\)verifyApproval\(/);
});

test('YooKassa webhook preserves terminal payment statuses and claims subscriptions atomically', () => {
  const source = fs.readFileSync(path.join(root, 'lib', 'payments', 'yookassa', 'webhook.js'), 'utf8');
  assert.match(source, /if \(status === 'failed'\) return 'failed';/);
  assert.match(source, /if \(status === 'refunded'\) return 'refunded';/);
  assert.match(source, /'failed', 'refunded'\]\.includes\(status\)/);
  assert.match(source, /payment_status=neq\.paid&paid_at=is\.null/);
});

test('admin payment confirmation uses the canonical plan and entitlement chain', () => {
  const migrationDir = path.join(root, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql'));
  const source = files
    .filter((name) => name >= '20260910100000_harden_admin_payment_entitlement_chain.sql')
    .map((name) => fs.readFileSync(path.join(migrationDir, name), 'utf8'))
    .join('\n');

  assert.match(source, /from public\.plans\s+where id = v_payment\.plan_id\s+and is_active = true/);
  assert.match(source, /public\.admin_set_manager_plan\(v_payment\.manager_id, v_plan\.id::text\)/);
  assert.match(source, /payment_status = 'paid'/);
  assert.match(source, /paid_at is not null/);
  assert.match(source, /where id = p_payment_id\s+and status = 'pending'/);
  assert.match(source, /already_processed/);
});

test('manager entitlement RPCs serialize per-manager mutations', () => {
  const source = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260910101000_lock_manager_entitlement_rpcs.sql'), 'utf8');
  assert.match(source, /pg_advisory_xact_lock\(hashtextextended\(p_manager_id::text, 0\)\)/g);
  assert.equal((source.match(/pg_advisory_xact_lock\(hashtextextended\(p_manager_id::text, 0\)\)/g) || []).length, 2);
  assert.match(source, /limit 1\s+for update/);
});

test('manager AI action gateway keeps feature and venue checks before mutations', () => {
  const source = fs.readFileSync(path.join(root, 'api', 'manager-ai-action.js'), 'utf8');
  assert.match(source, /if\(!(MAP\[f\]\|\|\[\]\)\.includes\(type\)\)throw fail\('ACTION_NOT_ALLOWED_FOR_FEATURE'/);
  assert.match(source, /const e=await entitlement\(c,f\),r=await run\(c,f,action,e\)/);
  assert.match(source, /if\(type==='create_product'\)\{await venue\(c,vid,'menu'\)/);
  assert.match(source, /if\(type==='update_product_price'\)\{await venue\(c,vid,'price'\)/);
  assert.match(source, /if\(type==='create_staff'\)\{await venue\(c,vid,'venue'\)/);
  assert.match(source, /if\(H\.includes\(type\)\)\{await venue\(c,vid,'venue'\)/);
});
