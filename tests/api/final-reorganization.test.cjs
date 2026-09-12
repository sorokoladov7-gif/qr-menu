'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const exists = p => fs.existsSync(path.join(root, p));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('final filesystem has one canonical manager runtime tree', () => {
  for (const p of [
    'src/pages/manager/manager.html',
    'src/assets/js/manager/manager-core.js',
    'src/assets/js/manager/manager-menu.js',
    'src/assets/js/manager/manager-recipes.js',
    'src/assets/js/manager/manager-staff.js',
    'src/assets/js/manager/manager-hall.js',
    'src/assets/js/manager/manager-design.js',
    'lib/ai/manager/action.js',
    'lib/ai/manager/context.js'
  ]) assert.equal(exists(p), true, `${p} must be canonical`);
  for (const p of [
    'manager_fixed.html',
    'src/assets/js/manager/legacy',
    'lib/_lib/manager-auth.js',
    'lib/_lib/yookassa.js',
    'lib/cron/integration-sync.js',
    'lib/integrations/russian-providers.js'
  ]) assert.equal(exists(p), false, `${p} must not return as a duplicate/legacy implementation`);
});

test('API entrypoints stay thin and business logic remains in lib', () => {
  const action = read('api/manager-ai-action.js');
  assert.equal(action.trim(), "'use strict';\n\nmodule.exports = require('../lib/ai/manager/action');");
  for (const name of ['admin-ai-agent.js','admin-ai-isolated.js','import-site.js','import-ai.js','cron.js','integrations.js','payments.js']) {
    const source = read(`api/${name}`);
    assert.ok(source.length < 12000, `${name} should remain an entrypoint, not a business-logic monolith`);
  }
});

test('manager mutation architecture is complete and centralized', () => {
  const dir = path.join(root, 'lib/ai/manager/mutations');
  const expected = ['menu','ingredients','staff','recipes','venue','delivery','orders','hall','integrations','subscription','onboarding'];
  for (const name of expected) assert.equal(fs.existsSync(path.join(dir, `${name}.js`)), true, `${name}.js missing`);
  const dispatcher = read('lib/ai/manager/action.js');
  assert.equal(/type==='recipe_auto_sync'/.test(dispatcher), false);
  assert.equal(/manager_recipe_auto_sync/.test(dispatcher), false);
  assert.ok(dispatcher.includes("const vid=str(p.venue_id,80)"));
});

test('integration runtime has one canonical provider registry/router', () => {
  for (const p of [
    'lib/integrations/router.js',
    'lib/integrations/registry.js',
    'lib/integrations/sync-lock.js',
    'lib/integrations/providers/index.js',
    'lib/jobs/integration-sync.js'
  ]) assert.equal(exists(p), true, `${p} must exist`);
  assert.equal(exists('lib/integrations/russian-providers.js'), false);
});

test('tests cover the architecture rather than only individual features', () => {
  for (const p of [
    'tests/api/architecture-entrypoints.test.cjs',
    'tests/api/integrations-router.test.cjs',
    'tests/api/manager-browser-boundary.test.cjs',
    'tests/api/final-reorganization.test.cjs'
  ]) assert.equal(exists(p), true, `${p} must remain part of the regression suite`);
});
