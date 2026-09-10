'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../..');

function readEntry(name) {
  return fs.readFileSync(path.join(root, 'api', name), 'utf8');
}

test('architecture entrypoints stay thin and point to canonical lib modules', () => {
  const expected = {
    'address.js': "require('../lib/address/suggestions')",
    'integrations.js': "require('../lib/integrations/router')",
    'import-site.js': "require('../lib/import/site')",
    'import-ai.js': "require('../lib/import/ai')",
  };

  for (const [file, target] of Object.entries(expected)) {
    const source = readEntry(file);
    assert.match(source, new RegExp(target.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')),
      `${file} must dispatch to ${target}`);
  }
});

test('canonical architecture modules exist', () => {
  const required = [
    'lib/address/suggestions.js',
    'lib/integrations/router.js',
    'lib/import/site.js',
    'lib/import/site-menu-analyzer-v3.js',
    'lib/import/site-browser-renderer-v2.js',
    'lib/shared/manager-auth.js',
    'lib/_lib/yookassa.js',
  ];

  for (const relative of required) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, `${relative} must exist`);
  }
});

test('obsolete manager-auth location is not present', () => {
  assert.equal(fs.existsSync(path.join(root, 'lib/_lib/manager-auth.js')), false);
});
