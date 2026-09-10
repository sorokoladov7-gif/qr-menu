'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../..');

function readEntry(name) {
  return fs.readFileSync(path.join(root, 'api', name), 'utf8');
}

function readLib(relative) {
  return fs.readFileSync(path.join(root, 'lib', relative), 'utf8');
}

test('architecture entrypoints stay thin and point to canonical lib modules', () => {
  const expected = {
    'address.js': "require('../lib/address/suggestions')",
    'integrations.js': "require('../lib/integrations/router')",
    'import-site.js': "require('../lib/import/site')",
    'cron.js': "require('../lib/jobs/integration-sync')",
  };
  for (const [file, target] of Object.entries(expected)) {
    const source = readEntry(file);
    assert.ok(source.includes(target), `${file} must dispatch to ${target}`);
  }
});

test('payments entrypoint remains a dispatcher, not a business-logic module', () => {
  const source = readEntry('payments.js');
  const requiredHandlers = [
    "require('../lib/payments/yookassa/accounts')",
    "require('../lib/payments/yookassa/callback')",
    "require('../lib/payments/yookassa/connect')",
    "require('../lib/payments/yookassa/create-order')",
    "require('../lib/payments/yookassa/create-subscription')",
    "require('../lib/payments/yookassa/status-order')",
    "require('../lib/payments/yookassa/webhook')",
  ];
  for (const target of requiredHandlers) assert.ok(source.includes(target), `payments.js must dispatch to ${target}`);
  assert.ok(!source.includes('fetch('), 'payments.js must not contain upstream business calls');
  assert.ok(!source.includes('createClient('), 'payments.js must not contain Supabase client setup');
});

test('YooKassa modules use the canonical payments core', () => {
  const modules = ['accounts.js', 'callback.js', 'connect.js', 'create-order.js', 'create-subscription.js', 'status-order.js', 'webhook.js'];
  for (const file of modules) {
    const source = readLib(`payments/yookassa/${file}`);
    assert.ok(source.includes("require('./core')"), `${file} must use ./core`);
    assert.ok(!source.includes("require('../../_lib/yookassa')"), `${file} must not use obsolete YooKassa path`);
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
    'lib/jobs/integration-sync.js',
    'lib/payments/yookassa/core.js',
  ];
  for (const relative of required) assert.equal(fs.existsSync(path.join(root, relative)), true, `${relative} must exist`);
});

test('obsolete architecture locations are not present', () => {
  const obsolete = ['lib/_lib/manager-auth.js', 'lib/_lib/yookassa.js', 'lib/cron/integration-sync.js'];
  for (const relative of obsolete) assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must not exist`);
});
