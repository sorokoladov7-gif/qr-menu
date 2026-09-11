'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../..');
function readEntry(name) { return fs.readFileSync(path.join(root, 'api', name), 'utf8'); }
function readLib(relative) { return fs.readFileSync(path.join(root, 'lib', relative), 'utf8'); }

test('architecture entrypoints stay thin and point to canonical lib modules', () => {
  const expected = {
    'address.js': "require('../lib/address/suggestions')",
    'integrations.js': "require('../lib/integrations/router')",
    'import-site.js': "require('../lib/import/site')",
    'import-ai.js': "require('../lib/import/ai')",
    'cron.js': "require('../lib/jobs/integration-sync')",
  };
  for (const [file, target] of Object.entries(expected)) assert.ok(readEntry(file).includes(target), `${file} must dispatch to ${target}`);
});

test('AI import entrypoint remains a dispatcher, not a business-logic module', () => {
  const source = readEntry('import-ai.js');
  assert.equal(source.trim(), "'use strict';\n\nmodule.exports = require('../lib/import/ai');");
  assert.ok(!source.includes('fetch(')); assert.ok(!source.includes('createClient('));
});

test('AI import canonical module resolves its analyzer locally', () => {
  const source = readLib('import/ai.js');
  assert.ok(source.includes("require('./site-menu-analyzer-v3')"));
  assert.ok(!source.includes("require('../lib/import/site-menu-analyzer-v3')"));
});

test('payments entrypoint remains a dispatcher, not a business-logic module', () => {
  const source = readEntry('payments.js');
  for (const target of ["require('../lib/payments/yookassa/accounts')","require('../lib/payments/yookassa/callback')","require('../lib/payments/yookassa/connect')","require('../lib/payments/yookassa/create-order')","require('../lib/payments/yookassa/create-subscription')","require('../lib/payments/yookassa/status-order')","require('../lib/payments/yookassa/webhook')"]) assert.ok(source.includes(target));
  assert.ok(!source.includes('fetch(')); assert.ok(!source.includes('createClient('));
});

test('YooKassa modules use the canonical payments core', () => {
  for (const file of ['accounts.js','callback.js','connect.js','create-order.js','create-subscription.js','status-order.js','webhook.js']) {
    const source=readLib(`payments/yookassa/${file}`); assert.ok(source.includes("require('./core')")); assert.ok(!source.includes("require('../../_lib/yookassa')"));
  }
});

test('integration provider adapters live behind the providers boundary', () => {
  const modules=['iiko.js','pos.js','saby-presto.js','poster.js','syrve.js','evotor.js','frontpad.js'];
  for (const file of modules) {
    const source=readLib(`integrations/providers/${file}`);
    assert.ok(source.includes("../shared/manager-auth"));
    assert.ok(!source.includes("../_lib/manager-auth"));
    assert.equal(fs.existsSync(path.join(root,'lib','integrations',file)),false,`${file} must not remain in integrations root`);
  }
});

test('integration provider map is the single adapter loading boundary', () => {
  const source=readLib('integrations/providers/index.js');
  for (const [provider,target] of [['iiko','./iiko'],['quick_resto','./pos'],['r_keeper','./pos'],['saby_presto','./saby-presto'],['poster','./poster'],['syrve','./syrve'],['evotor','./evotor'],['frontpad','./frontpad']]) {
    assert.ok(source.includes(`${provider}:require('${target}')`), `${provider} must resolve through providers/index.js`);
  }
});

test('integration management and diagnostics modules use canonical manager auth', () => {
  for (const file of ['manage.js','test.js']) { const source=readLib(`integrations/${file}`); assert.ok(source.includes("../shared/manager-auth")); assert.ok(!source.includes("../_lib/manager-auth")); }
  const diagnostics=readLib('integrations/test.js'); assert.ok(diagnostics.includes('assertVenueAccess(user,venue_id)')); assert.ok(diagnostics.includes("manager_venues?manager_id=eq."));
});

test('integration router binds sync locks to the actual route provider', () => {
  const router=readLib('integrations/router.js');
  for (const entry of ["['/api/integrations/iiko','iiko']","['/api/integrations/pos',new Set(['quick_resto','r_keeper'])]","['/api/integrations/saby-presto','saby_presto']","['/api/integrations/poster','poster']","['/api/integrations/syrve','syrve']","['/api/integrations/evotor','evotor']","['/api/integrations/frontpad','frontpad']"]) assert.ok(router.includes(entry));
  assert.ok(router.includes("provider_route_mismatch"));
  assert.ok(router.includes("require('./providers')"));
  assert.ok(!router.includes("require('./providers/iiko')"));
});

test('integration sync job reuses the canonical provider map', () => {
  const cron=readLib('jobs/integration-sync.js');
  assert.ok(cron.includes("require('../integrations/providers')"));
  assert.ok(!cron.includes("require('../integrations/providers/iiko')"));
  assert.ok(!cron.includes("require('../integrations/providers/saby-presto')"));
  assert.ok(!cron.includes("require('../integrations/providers/poster')"));
  assert.ok(!cron.includes("require('../integrations/providers/syrve')"));
  assert.ok(!cron.includes("require('../integrations/providers/evotor')"));
  assert.ok(!cron.includes("require('../integrations/providers/frontpad')"));
});

test('integration sync locking is centralized', () => {
  const router=readLib('integrations/router.js'), cron=readLib('jobs/integration-sync.js'), lock=readLib('integrations/sync-lock.js');
  assert.ok(router.includes("require('./sync-lock')")); assert.ok(cron.includes("require('../integrations/sync-lock')"));
  assert.ok(lock.includes('claim_integration_sync_lock')); assert.ok(lock.includes('release_integration_sync_lock'));
  assert.ok(!router.includes('crypto.randomUUID')); assert.ok(!cron.includes('crypto.randomUUID'));
});

test('integration registry and cron coverage cannot silently diverge', () => {
  const registry=readLib('integrations/registry.js'), providers=readLib('integrations/providers/index.js');
  const implemented=[...registry.matchAll(/([a-z_]+):\{name:[^\n]+?implemented:true\}/g)].map(match=>match[1]);
  const covered=[...providers.matchAll(/^\s{2}([a-z_]+):require\(/gm)].map(match=>match[1]);
  assert.ok(implemented.length>0); for(const provider of implemented) assert.ok(covered.includes(provider),`implemented provider ${provider} must have adapter coverage`);
});

test('canonical architecture modules exist', () => {
  const required=['lib/address/suggestions.js','lib/integrations/router.js','lib/integrations/sync-lock.js','lib/integrations/providers/index.js','lib/integrations/providers/iiko.js','lib/integrations/providers/pos.js','lib/integrations/providers/saby-presto.js','lib/integrations/providers/poster.js','lib/integrations/providers/syrve.js','lib/integrations/providers/evotor.js','lib/integrations/providers/frontpad.js','lib/import/site.js','lib/import/ai.js','lib/import/site-menu-analyzer-v3.js','lib/import/site-browser-renderer-v2.js','lib/shared/manager-auth.js','lib/jobs/integration-sync.js','lib/payments/yookassa/core.js'];
  for(const relative of required) assert.equal(fs.existsSync(path.join(root,relative)),true,`${relative} must exist`);
});

test('obsolete architecture locations are not present', () => {
  for(const relative of ['lib/_lib/manager-auth.js','lib/_lib/yookassa.js','lib/cron/integration-sync.js']) assert.equal(fs.existsSync(path.join(root,relative)),false);
});

test('static test infrastructure lives under the test support boundary', () => {
  assert.equal(fs.existsSync(path.join(root,'tests/support/static-server.cjs')),true); assert.equal(fs.existsSync(path.join(root,'tests/static-server.cjs')),false);
});

test('manager AI action endpoint is a thin dispatcher', () => {
  const source=readEntry('manager-ai-action.js');
  assert.equal(source.trim(), "'use strict';\n\nmodule.exports = require('../lib/ai/manager/action');");
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('createClient('));
});

test('manager AI action keeps one canonical mutation boundary', () => {
  const source=readLib('ai/manager/action.js');
  assert.ok(source.includes('async function run(c,f,a,e)'));
  assert.ok(source.includes("if(!(MAP[f]||[]).includes(type))throw fail('ACTION_NOT_ALLOWED_FOR_FEATURE:"));
  assert.ok(source.includes("const vid=str(p.venue_id,80)"));
  assert.ok(source.includes("async function venue(c,id,need)"));
});

test('manager AI mutation branches retain venue isolation before data mutation', () => {
  const source=readLib('ai/manager/action.js');
  const mutations=['create_product','update_product','update_product_price','delete_product','create_ingredient','update_ingredient','delete_ingredient','create_staff','reset_staff_pin','delete_staff','update_order','update_venue_settings','update_delivery_settings','save_design','update_delivery_integration','delete_delivery_integration','recipe_auto_sync','attach_ingredients','create_tech_card','save_recipe',...['create_table','update_table','move_table','delete_table','regenerate_table_qr','set_table_status','seat_table','set_table_reservation_guest','close_table_session','save_hall_plan','delete_hall_plan']];
  for(const type of mutations){
    const marker=`if(type==='${type}')`;
    const at=source.indexOf(marker);
    assert.notEqual(at,-1,`${type} branch must exist`);
    const next=source.indexOf('\nif(type===',at+marker.length);
    const branch=source.slice(at,next===-1?source.length:next);
    assert.ok(branch.includes('await venue(c,vid,'),`${type} must verify venue access before mutation`);
    assert.ok(branch.includes('venue_id'),`${type} must carry venue_id into its data boundary`);
  }
});

test('manager AI resolver queries are venue-scoped', () => {
  const source=readLib('ai/manager/action.js');
  for(const table of ['products','ingredients','cooks','couriers','waiters']) {
    assert.ok(source.includes(`${table}?venue_id=eq.`),`${table} resolver must be venue-scoped`);
  }
});
