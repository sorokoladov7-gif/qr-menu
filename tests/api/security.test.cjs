const assert = require('node:assert/strict');
const test = require('node:test');

const base = String(process.env.PLAYWRIGHT_BASE_URL || process.env.TEST_API_BASE_URL || '').replace(/\/$/, '');

const protectedEndpoints = ['/api/payments', '/api/integrations', '/api/admin-ai-agent'];

test('protected API endpoints reject unauthenticated requests', async (t) => {
  t.skip(!base, 'TEST_API_BASE_URL or PLAYWRIGHT_BASE_URL is not configured');

  for (const endpoint of protectedEndpoints) {
    const response = await fetch(`${base}${endpoint}`, { method: 'GET' });
    assert.ok([401, 403, 405].includes(response.status), `${endpoint} returned ${response.status}`);
  }
});
