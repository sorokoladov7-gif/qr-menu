'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../..');
function readEntry(name) { return fs.readFileSync(path.join(root, 'api', name), 'utf8'); }
function readLib(relative) { return fs.readFileSync(path.join(root, 'lib', relative), 'utf8'); }

test('architecture entrypoints stay thin and point to canonical lib modules', () => {
  const expected = {'address.js': "require('../lib/address/suggestions')",'integrations.js': "require('../lib/integrations/router')",'import-site.js': "require('../lib/import/site')",'import-ai.js': "require('../lib/import/ai')",'cron.js': "require('../lib/jobs/integration-sync')"};
  for (const [file, target] of Object.entries(expected)) assert.ok(readEntry(file).includes(target), `${file} must dispatch to ${target}`);
});

test('AI import entrypoint remains a dispatcher, not a business-logic module', () => { const source=readEntry('import-ai.js'); assert.equal(source.trim(), "'use strict';\n\nmodule.exports = require('../lib/import/ai');"); assert.ok(!source.includes('fetch(')); assert.ok(!source.includes('createClient(')); });

test('AI import canonical module resolves its analyzer locally', () => { const source=readLib('import/ai.js'); assert.ok(source.includes("require('./site-menu-analyzer-v3')")); assert.ok(!source.includes("require('../lib/import/site-menu-analyzer-v3')")); });

test('payments entrypoint remains a dispatcher, not a business-logic module', () => { const source=readEntry('payments.js'); for (const target of ["require('../lib/payments/yookassa/accounts')","require('../lib/payments/yookassa/callback')","require('../lib/payments/yookassa/connect')","require('../lib/payments/yookassa/create-order')","require('../lib/payments/yookassa/create-subscription')","require('../lib/payments/yookassa/status-order')","require('../lib/payments/yookassa/webhook')"]) assert.ok(source.includes(target)); assert.ok(!source.includes('fetch(')); assert.ok(!source.includes('createClient(')); });

test('YooKassa modules use the canonical payments core', () => { for (const file of ['accounts.js','callback.js','connect.js','create-order.js','create-subscription.js','status-order.js','webhook.js']) { const source=readLib(`payments/yookassa/${file}`); assert.ok(source.includes("require('./core')")); assert.ok(!source.includes("require('../../_lib/yookassa')")); } });

test('integration provider adapters live behind the providers boundary', () => { const modules=['iiko.js','pos.js','saby-presto.js','poster.js','syrve.js','evotor.js','frontpad.js']; for (const file of modules) { const source=readLib(`integrations/providers/${file}`); assert.ok(source.includes("../shared/manager-auth")); assert.ok(!source.includes("../_lib/manager-auth")); assert.equal(fs.existsSync(path.join(root,'lib','integrations',file)),false,`${file} must not remain in integrations root`); } });

test('integration provider map is the single adapter loading boundary', () => { const source=readLib('integrations/providers/index.js'); for (const [provider,target] of [['iiko','./iiko'],['quick_resto','./pos'],['r_keeper','./pos'],['saby_presto','./saby-presto'],['poster','./poster'],['syrve','./syrve'],['evotor','./evotor'],['frontpad','./frontpad']]) assert.ok(source.includes(`${provider}:require('${target}')`),`${provider} must resolve through providers/index.js`); });

test('integration management and diagnostics modules use canonical manager auth', () => { for (const file of ['manage.js','test.js']) { const source=readLib(`integrations/${file}`); assert.ok(source.includes("../shared/manager-auth")); assert.ok(!source.includes("../_lib/manager-auth")); } const diagnostics=readLib('integrations/test.js'); assert.ok(diagnostics.includes('assertVenueAccess(user,venue_id)')); assert.ok(diagnostics.includes("manager_venues?manager_id=eq.")); });

test('integration router binds sync locks to the actual route provider', () => { const router=readLib('integrations/router.js'); for (const entry of ["['/api/integrations/iiko','iiko']","['/api/integrations/pos',new Set(['quick_resto','r_keeper'])]","['/api/integrations/saby-presto','saby_presto']","['/api/integrations/poster','poster']","['/api/integrations/syrve','syrve']","['/api/integrations/evotor','evotor']","['/api/integrations/frontpad','frontpad']"]) assert.ok(router.includes(entry)); assert.ok(router.includes("provider_route_mismatch")); assert.ok(router.includes("require('./providers')")); assert.ok(!router.includes("require('./providers/iiko')")); });

test('integration sync job reuses the canonical provider map', () => { const cron=readLib('jobs/integration-sync.js'); assert.ok(cron.includes("require('../integrations/providers')")); for(const provider of ['iiko','saby-presto','poster','syrve','evotor','frontpad']) assert.ok(!cron.includes(`require('../integrations/providers/${provider}')`)); });

test('integration sync locking is centralized', () => { const router=readLib('integrations/router.js'),cron=readLib('jobs/integration-sync.js'),lock=readLib('integrations/sync-lock.js'); assert.ok(router.includes("require('./sync-lock')")); assert.ok(cron.includes("require('../integrations/sync-lock')")); assert.ok(lock.includes('claim_integration_sync_lock')); assert.ok(lock.includes('release_integration_sync_lock')); assert.ok(!router.includes('crypto.randomUUID')); assert.ok(!cron.includes('crypto.randomUUID')); });

test('integration registry and cron coverage cannot silently diverge', () => { const registry=readLib('integrations/registry.js'),providers=readLib('integrations/providers/index.js'); const implemented=[...registry.matchAll(/([a-z_]+):\{name:[^\n]+?implemented:true\}/g)].map(m=>m[1]); const covered=[...providers.matchAll(/^\s{2}([a-z_]+):require\(/gm)].map(m=>m[1]); assert.ok(implemented.length>0); for(const provider of implemented) assert.ok(covered.includes(provider),`implemented provider ${provider} must have adapter coverage`); });

test('canonical architecture modules exist', () => { const required=['lib/address/suggestions.js','lib/integrations/router.js','lib/integrations/sync-lock.js','lib/integrations/providers/index.js','lib/integrations/providers/iiko.js','lib/integrations/providers/pos.js','lib/integrations/providers/saby-presto.js','lib/integrations/providers/poster.js','lib/integrations/providers/syrve.js','lib/integrations/providers/evotor.js','lib/integrations/providers/frontpad.js','lib/import/site.js','lib/import/ai.js','lib/import/site-menu-analyzer-v3.js','lib/import/site-browser-renderer-v2.js','lib/shared/manager-auth.js','lib/jobs/integration-sync.js','lib/payments/yookassa/core.js','lib/ai/manager/context.js']; for(const relative of required) assert.equal(fs.existsSync(path.join(root,relative)),true,`${relative} must exist`); });

test('obsolete architecture locations are not present', () => { for(const relative of ['lib/_lib/manager-auth.js','lib/_lib/yookassa.js','lib/cron/integration-sync.js']) assert.equal(fs.existsSync(path.join(root,relative)),false); });

test('static test infrastructure lives under the test support boundary', () => { assert.equal(fs.existsSync(path.join(root,'tests/support/static-server.cjs')),true); assert.equal(fs.existsSync(path.join(root,'tests/static-server.cjs')),false); });

test('manager AI action endpoint is a thin dispatcher', () => { const source=readEntry('manager-ai-action.js'); assert.equal(source.trim(), "'use strict';\n\nmodule.exports = require('../lib/ai/manager/action');"); assert.ok(!source.includes('fetch(')); assert.ok(!source.includes('createClient(')); });

test('manager AI action delegates runtime context to one canonical module', () => { const action=readLib('ai/manager/action.js'),context=readLib('ai/manager/context.js'); assert.ok(action.includes("require('./context')")); assert.ok(!action.includes('async function auth(req)')); assert.ok(!action.includes('async function entitlement(c,f)')); assert.ok(!action.includes('async function venue(c,id,need)')); assert.ok(!action.includes('async function resolveProduct(c,p')); for(const symbol of ['MAP','fail','api','rpc','auth','entitlement','venue','resolveProduct','resolveIngredient','resolveStaff']) assert.ok(context.includes(symbol),`${symbol} must live in manager action context`); });

test('manager AI action keeps one canonical mutation boundary', () => { const source=readLib('ai/manager/action.js'); assert.ok(source.includes('async function run(c,f,a,e)')); assert.ok(source.includes("if(!(MAP[f]||[]).includes(type))throw fail('ACTION_NOT_ALLOWED_FOR_FEATURE:")); assert.ok(source.includes("const vid=str(p.venue_id,80)")); });

test('manager AI mutation families retain venue isolation', () => { const source=readLib('ai/manager/action.js'); const guardedFamilies=[["if(type==='create_product')",'create_product'],["if(type==='update_product'||type==='update_product_price'||type==='delete_product')",'product mutations'],["if(type==='create_ingredient')",'create_ingredient'],["if(type==='update_ingredient'||type==='delete_ingredient')",'ingredient mutations'],["if(type==='create_staff')",'create_staff'],["if(type==='reset_staff_pin'||type==='delete_staff')",'staff mutations'],["if(type==='update_order')",'update_order'],["if(type==='update_venue_settings'||type==='update_delivery_settings')",'venue settings'],["if(type==='save_design')",'save_design'],["if(type==='update_delivery_integration'||type==='delete_delivery_integration')",'delivery integrations'],["if(type==='recipe_auto_sync')",'recipe_auto_sync'],["if(['attach_ingredients','create_tech_card','save_recipe'].includes(type))",'recipe mutations'],["if(H.includes(type))",'hall/table mutations'],["if(type==='disconnect_integration')",'POS disconnect']]; for(const [marker,label] of guardedFamilies){const at=source.indexOf(marker);assert.notEqual(at,-1,`${label} branch must exist`);const guard=source.indexOf('await venue(c,vid,',at);assert.ok(guard>at,`${label} must verify venue access before its mutation boundary`);}});

test('manager AI resolver queries are venue-scoped', () => { const source=readLib('ai/manager/context.js'); for(const table of ['products','ingredients','cooks','couriers','waiters']) assert.ok(source.includes(`${table}?venue_id=eq.`),`${table} resolver must be venue-scoped`); });
