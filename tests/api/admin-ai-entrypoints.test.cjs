const assert = require('node:assert/strict');
const test = require('node:test');

test('Qrchick admin AI entrypoints export callable handlers', () => {
  const agent = require('../../api/admin-ai-agent');
  const isolated = require('../../api/admin-ai-isolated');
  const stream = require('../../api/admin-ai-stream');

  assert.equal(typeof agent, 'function');
  assert.equal(typeof isolated, 'function');
  assert.equal(typeof stream, 'function');
});
