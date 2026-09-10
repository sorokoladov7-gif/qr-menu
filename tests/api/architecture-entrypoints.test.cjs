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
    'import-ai.js': "require('../lib/import/ai')",
    'cron.js': "require('../lib/jobs/integration-sync')",
  };
  for (const [file, target] of Object.entries(expected)) {
    const source = readEntry(file);
    assert.ok(source.includes(target), `${file} must dispatch to ${target}`);
  }
});

test('AI import entrypoint remains a dispatcher, not a business-logic module', () => {
  const source = readEntry('import-ai.js');
  assert.equal(source.trim(), "'use strict';\n\nmodule.exports = require('../lib/import/ai');");
  assert.ok(!source.includes('fetch('), 'import-ai.js must not contain upstream business calls');
  assert.ok(!source.includes('createClient('), 'import-ai.js must not contain Supabase client setup');
});

test('AI import canonical module resolves its analyzer locally', () => {
  const source = readLib('import/ai.js');
  assert.ok(source.includes("require('./site-menu-analyzer-v3')"), 'lib/import/ai.js must use its local analyzer path');
  assert.ok(!source.includes("require('../lib/import/site-menu-analyzer-v3')"), 'lib/import/ai.js must not use the old API-relative analyzer path');
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

test('integration provider modules use the canonical shared manager auth module', () => {
  const modules = ['iiko.js', 'pos.js', 'saby-presto.js', 'poster.js', 'syrve.js', 'evotor.js', 'frontpad.js'];
  for (const file of modules) {
    const source = readLib(`integrations/${file}`);
    assert.ok(source.includes("../shared/manager-auth"), `${file} must use ../shared/manager-auth`);
    assert.ok(!source.includes("../_lib/manager-auth"), `${file} must not use obsolete ../_lib/manager-auth`);
  }
});

test('integration management and diagnostics modules use canonical manager auth', () => {
  for (const file of ['manage.js', 'test.js']) {
    const source = readLib(`integrations/${file}`);
    assert.ok(source.includes("../shared/manager-auth"), `${file} must use ../shared/manager-auth`);
    assert.ok(!source.includes("../_lib/manager-auth"), `${file} must not use obsolete ../_lib/manager-auth`);
  }
});

test('integration router binds sync locks to the actual route provider', () => {
  const router = readLib('integrations/router.js');
  assert.ok(router.includes("['/api/integrations/iiko','iiko']"), 'iiko route must lock as iiko');
  assert.ok(router.includes("['/api/integrations/pos',new Set(['quick_resto','r_keeper'])]"), 'POS route must only lock supported POS providers');
  assert.ok(router.includes("['/api/integrations/saby-presto','saby_presto']"), 'Saby route must lock as saby_presto');
  assert.ok(router.includes("['/api/integrations/poster','poster']"), 'Poster route must lock as poster');
  assert.ok(router.includes("['/api/integrations/syrve','syrve']"), 'Syrve route must lock as syrve');
  assert.ok(router.includes("['/api/integrations/evotor','evotor']"), 'Evotor route must lock as evotor');
  assert.ok(router.includes("['/api/integrations/frontpad','frontpad']"), 'FrontPad route must lock as frontpad');
});

test('integration sync locking is centralized', () => {
  const router = readLib('integrations/router.js');
  const cron = readLib('jobs/integration-sync.js');
  const lock = readLib('integrations/sync-lock.js');
  assert.ok(router.includes("require('./sync-lock')"), 'integration router must use the canonical sync lock');
  assert.ok(cron.includes("require('../integrations/sync-lock')"), 'integration cron job must use the canonical sync lock');
  assert.ok(lock.includes("claim_integration_sync_lock"), 'sync lock module must claim the database lock');
  assert.ok(lock.includes("release_integration_sync_lock"), 'sync lock module must release the database lock');
  assert.ok(!router.includes('crypto.randomUUID'), 'integration router must not implement its own lock token generation');
  assert.ok(!cron.includes('crypto.randomUUID'), 'integration cron job must not implement its own lock token generation');
});

test('canonical architecture modules exist', () => {
  const required = [
    'lib/address/suggestions.js',
    'lib/integrations/router.js',
    'lib/integrations/sync-lock.js',
    'lib/import/site.js',
    'lib/import/ai.js',
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
