const assert = require('node:assert/strict');
const test = require('node:test');

test('Qrchick admin AI entrypoints export callable handlers', () => {
  const entrypoints = [
    'admin-ai-agent',
    'admin-ai-isolated',
    'admin-ai-attachment',
    'admin-ai-usage',
  ];

  for (const name of entrypoints) {
    const handler = require(`../../api/${name}`);
    assert.equal(typeof handler, 'function', `${name} must export a callable handler`);
  }
});
