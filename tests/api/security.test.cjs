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

test('YooKassa webhook preserves terminal payment statuses', () => {
  const source = fs.readFileSync(path.join(root, 'lib', 'payments', 'yookassa', 'webhook.js'), 'utf8');
  assert.match(source, /if \(status === 'failed'\) return 'failed';/);
  assert.match(source, /if \(status === 'refunded'\) return 'refunded';/);
  assert.match(source, /'failed', 'refunded'\]\.includes\(status\)/);
});
