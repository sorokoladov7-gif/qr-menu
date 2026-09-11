'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../..');
function readEntry(name) { return fs.readFileSync(path.join(root, 'api', name), 'utf8'); }
function readLib(relative) { return fs.readFileSync(path.join(root, 'lib', relative), 'utf8'); }
function readAsset(relative) { return fs.readFileSync(path.join(root, 'src', 'assets', relative), 'utf8'); }
function sqlFiles(dir = path.join(root, 'supabase', 'migrations')) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) out.push(...sqlFiles(file));
    else if (name.endsWith('.sql')) out.push(file);
  }
  return out;
}
function readSql() { return sqlFiles().map(file => fs.readFileSync(file, 'utf8')).join('\n'); }
function lastFunctionBody(sql, name, span = 12000) {
  const re = new RegExp(`(?:CREATE|CREATE OR REPLACE)\\s+FUNCTION\\s+public\\.${name}\\s*\\(`, 'ig');
  let match;
  let start = -1;
  while ((match = re.exec(sql))) start = match.index;
  return start < 0 ? '' : sql.slice(start, start + span);
}

const families = {
  menu: ['create_product','update_product','update_product_price','delete_product'],
  ingredients: ['create_ingredient','update_ingredient','delete_ingredient'],
  staff: ['create_staff','reset_staff_pin','delete_staff'],
  recipes: ['attach_ingredients','create_tech_card','save_recipe'],
  venue: ['update_venue_settings','update_delivery_settings','save_design'],
  delivery: ['update_delivery_integration','delete_delivery_integration'],
  orders: ['update_order'],
  hall: ['create_table','update_table','move_table','delete_table','regenerate_table_qr','set_table_status','seat_table','set_table_reservation_guest','close_table_session','save_hall_plan','delete_hall_plan'],
  integrations: ['disconnect_integration'],
  subscription: ['change_trial_plan'],
  onboarding: ['create_venue']
};

test('canonical mutation families own their actions', () => {
  for (const [module, types] of Object.entries(families)) {
    const source = readLib(`ai/manager/mutations/${module}.js`);
    assert.ok(fs.existsSync(path.join(root,'lib','ai','manager','mutations',`${module}.js`)));
    for (const type of types) assert.ok(source.includes(`'${type}'`), `${type} must live in ${module}.js`);
  }
});

test('recipe mutation contract excludes revoked legacy auto-sync', () => {
  const source = readLib('ai/manager/mutations/recipes.js');
  assert.equal(source.includes('recipe_auto_sync'), false);
  assert.equal(source.includes('manager_recipe_auto_sync'), false);
  assert.ok(source.includes('manager_product_recipe_save'));
  assert.ok(source.includes("Object.assign({},p,{venue_id:vid})"));
  assert.ok(source.includes("Object.assign({},r,{venue_id:vid})"));
  assert.ok(source.includes('p_venue_id:vid'));
});

test('venue mutation uses canonical venue write/RPC contracts', () => {
  const source = readLib('ai/manager/mutations/venue.js');
  assert.equal(source.includes('manager_save_venue_settings'), false);
  assert.ok(source.includes('manager_save_design'));
  assert.ok(source.includes('venues?id=eq.'));
  assert.ok(source.includes("'PATCH'"));
  assert.ok(source.includes("await venue(c,vid,'delivery')"));
});

test('manager AI dispatcher contains one canonical mutation boundary', () => {
  const source = readLib('ai/manager/action.js');
  assert.ok(source.includes('async function run(c,f,a,e)'));
  assert.ok(source.includes("if(!(MAP[f]||[]).includes(type))throw fail('ACTION_NOT_ALLOWED_FOR_FEATURE:"));
  assert.ok(source.includes('const vid=str(p.venue_id,80)'));
  for (const line of [
    "if(marketing.TYPES.has(type))return marketing.run(type,c,f,p,e);",
    "if(onboarding.TYPES.has(type))return onboarding.run(type,c,f,p,e);",
    "if(subscription.TYPES.has(type))return subscription.run(type,c,f,p,e);",
    "if(menu.TYPES.has(type))return menu.run(type,c,vid,p,e);",
    "if(ingredients.TYPES.has(type))return ingredients.run(type,c,vid,p);",
    "if(staff.TYPES.has(type))return staff.run(type,c,vid,p);",
    "if(recipes.TYPES.has(type))return recipes.run(type,c,vid,p);",
    "if(venueSettings.TYPES.has(type))return venueSettings.run(type,c,vid,p,e);",
    "if(delivery.TYPES.has(type))return delivery.run(type,c,vid,p);",
    "if(orders.TYPES.has(type))return orders.run(type,c,vid,p);",
    "if(hall.TYPES.has(type))return hall.run(type,c,vid,p);"
  ]) assert.ok(source.includes(line));
});

test('legacy mutation branches are absent from central dispatcher', () => {
  const source = readLib('ai/manager/action.js');
  for (const marker of [
    "if(type==='recipe_auto_sync')",
    "if(['attach_ingredients','create_tech_card','save_recipe'].includes(type)",
    "if(type==='update_venue_settings'||type==='update_delivery_settings')",
    "if(type==='save_design')",
    "if(type==='update_delivery_integration'||type==='delete_delivery_integration')",
    "if(type==='update_order')",
    'if(H.includes(type)',
    "if(type==='disconnect_integration')",
    "if(type==='change_trial_plan')",
    "if(type==='create_venue')",
    "if(type==='marketing_draft')return"
  ]) assert.equal(source.includes(marker), false, `${marker} must be extracted`);
});

test('all manager mutation modules enforce canonical venue context', () => {
  for (const module of ['menu','ingredients','staff','recipes','venue','delivery','orders','hall','integrations']) {
    const source = readLib(`ai/manager/mutations/${module}.js`);
    assert.ok(source.includes('vid'), `${module} must receive canonical venue id`);
  }
});

test('resolver boundary is venue-scoped', () => {
  const context = readLib('ai/manager/context.js');
  for (const table of ['products','ingredients','cooks','couriers','waiters']) {
    assert.ok(context.includes(`${table}?venue_id=eq.`), `${table} resolver must be venue-scoped`);
  }
});

test('recipe resolver calls override payload venue_id with canonical vid', () => {
  const source = readLib('ai/manager/mutations/recipes.js');
  assert.ok(source.includes("resolveProduct(c,Object.assign({},p,{venue_id:vid})"));
  assert.ok(source.includes("resolveIngredient(c,Object.assign({},r,{venue_id:vid})"));
});

test('manager mutation resolver calls never trust payload venue_id', () => {
  const menu = readLib('ai/manager/mutations/menu.js');
  const ingredients = readLib('ai/manager/mutations/ingredients.js');
  const staff = readLib('ai/manager/mutations/staff.js');
  assert.ok(menu.includes("resolveProduct(c,Object.assign({},p,{venue_id:vid})"));
  assert.ok(ingredients.includes("resolveIngredient(c,Object.assign({},p,{venue_id:vid})"));
  assert.ok(staff.includes("resolveStaff(c,Object.assign({},p,{venue_id:vid})"));
});

test('manager browser mutation bridge routes legacy ingredient/recipe writes through canonical action API', () => {
  const source = readAsset('js/manager/manager-core.js');
  assert.ok(source.includes("name==='manager_ingredient_upsert'"));
  assert.ok(source.includes("type=args.p_id?'update_ingredient':'create_ingredient'"));
  assert.ok(source.includes("name==='manager_ingredient_delete'"));
  assert.ok(source.includes("name==='manager_product_recipe_save'"));
  assert.ok(source.includes("type:'save_recipe'"));
  assert.ok(source.includes("fetch('/api/manager-ai-action'"));
  assert.ok(source.includes("name==='manager_recipe_auto_sync'"));
});

test('manager browser product mutations cross the canonical action boundary', () => {
  const source = readAsset('js/manager/manager-core.js');
  assert.ok(source.includes('function installProductMutationBridge()'));
  assert.ok(source.includes("table!=='products'"));
  assert.ok(source.includes("type:'create_product'"));
  assert.ok(source.includes("builder.update=function(values)"));
  assert.ok(source.includes("builder.delete=function()"));
  assert.ok(source.includes("type==='update_product'"));
  assert.ok(source.includes("type==='delete_product'"));
  assert.ok(source.includes("canonicalVenue"));
});

test('revoked manager ingredient compatibility mutations are removed from hall bootstrap', () => {
  const source = readAsset('js/manager/manager-hall-ai.js');
  for (const marker of ['manager_global_ingredient_update','manager_global_ingredient_delete','function ingredientControls','__QR_MANAGER_INGREDIENT_CONTROLS_V5__']) {
    assert.equal(source.includes(marker), false, `${marker} must not remain in manager hall compatibility layer`);
  }
  assert.ok(source.includes('create_venue_for_manager'));
  assert.ok(source.includes('create_venue_from_template'));
});

test('manager AI action endpoint remains a thin dispatcher', () => {
  const source = readEntry('manager-ai-action.js');
  assert.equal(source.trim(), "'use strict';\n\nmodule.exports = require('../lib/ai/manager/action');");
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('createClient('));
});

test('manager context owns authentication and entitlement boundaries', () => {
  const context = readLib('ai/manager/context.js');
  for (const symbol of ['MAP','fail','api','rpc','auth','entitlement','venue','resolveProduct','resolveIngredient','resolveStaff']) {
    assert.ok(context.includes(symbol), `${symbol} must remain in canonical manager context`);
  }
});

test('subscription mutation is manager-scoped', () => {
  const source = readLib('ai/manager/mutations/subscription.js');
  assert.ok(source.includes('manager_id=eq.'));
  assert.ok(source.includes('venue_id=is.null'));
  assert.ok(source.includes('status=eq.trialing'));
  assert.ok(source.includes('manager_change_trial_plan'));
});

test('hall mutations use manager RPC boundary and canonical venue id', () => {
  const source = readLib('ai/manager/mutations/hall.js');
  assert.ok(source.includes("await venue(c,vid,'venue')"));
  assert.ok(source.includes('p_venue_id:vid'));
  for (const rpcName of ['manager_create_table','manager_update_table','manager_move_table','manager_delete_table','manager_regenerate_table_qr','manager_set_table_status','manager_seat_table','manager_set_table_reservation_guest','manager_close_table_session','manager_save_hall_plan','manager_delete_hall_plan']) {
    assert.ok(source.includes(rpcName), `${rpcName} must remain in hall mutation module`);
  }
});

test('onboarding preserves manager subscription contract', () => {
  const source = readLib('ai/manager/mutations/onboarding.js');
  assert.ok(source.includes('manager_import_venue'));
  assert.ok(source.includes('e.subscription'));
  assert.ok(source.includes('p_products:prod'));
  assert.ok(source.includes('p_subscription_end:p.subscription_end||s.current_period_end||null'));
});

test('marketing action remains presentation-only', () => {
  const source = readLib('ai/manager/actions/marketing.js');
  assert.ok(source.includes("'marketing_draft'"));
  assert.equal(source.includes('rpc('), false);
  assert.equal(source.includes("'PATCH'"), false);
  assert.equal(source.includes("'POST'"), false);
});

test('manager RPCs keep an explicit authenticated/public execute boundary', () => {
  const sql = readSql();
  const rpcNames = [
    'manager_ingredient_upsert','manager_ingredient_delete',
    'manager_create_staff','manager_reset_staff_pin',
    'manager_product_recipe_save','manager_save_design',
    'manager_delivery_integration_upsert','manager_delivery_integration_delete',
    'manager_create_table','manager_update_table','manager_move_table','manager_delete_table',
    'manager_regenerate_table_qr','manager_set_table_status','manager_seat_table',
    'manager_set_table_reservation_guest','manager_close_table_session',
    'manager_save_hall_plan','manager_delete_hall_plan',
    'manager_change_trial_plan','manager_import_venue'
  ];
  for (const name of rpcNames) {
    const grant = new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\([^)]*\\)\\s+TO\\s+authenticated`, 'i');
    const revoke = new RegExp(`REVOKE\\s+(?:ALL|EXECUTE)\\s+ON\\s+FUNCTION\\s+public\\.${name}\\([^)]*\\)\\s+FROM\\s+(?:PUBLIC|public|anon)`, 'i');
    assert.match(sql, grant, `${name} must be executable only through authenticated RPC flow`);
    assert.match(sql, revoke, `${name} must not retain public/anon execute`);
  }
});

test('manager RPC SQL definitions retain an authorization predicate', () => {
  const sql = readSql();
  const rpcNames = [
    'manager_ingredient_upsert','manager_ingredient_delete','manager_create_staff','manager_reset_staff_pin',
    'manager_product_recipe_save','manager_save_design','manager_delivery_integration_upsert','manager_delivery_integration_delete',
    'manager_create_table','manager_update_table','manager_move_table','manager_delete_table','manager_regenerate_table_qr',
    'manager_set_table_status','manager_seat_table','manager_set_table_reservation_guest','manager_close_table_session',
    'manager_save_hall_plan','manager_delete_hall_plan','manager_change_trial_plan','manager_import_venue'
  ];
  for (const name of rpcNames) {
    const body = lastFunctionBody(sql, name);
    assert.ok(body, `${name} definition must exist in migrations`);
    assert.match(body, /auth\.uid\(\)|is_manager_of\(|manager_can_manage_venue\(|manager_has_permission\(|is_admin\(\)/i, `${name} must retain an authorization predicate`);
  }
});

test('legacy manager RPC overloads are not authenticated client contracts', () => {
  const sql = readSql();
  assert.match(sql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.manager_reset_staff_pin\(text,\s*uuid\)\s+FROM\s+public,\s*anon,\s*authenticated/i);
  assert.match(sql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.manager_set_table_status\(uuid,\s*text\)\s+FROM\s+public,\s*anon,\s*authenticated/i);
  assert.match(sql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.manager_upsert_table\(uuid,\s*uuid,\s*integer,\s*text,\s*integer,\s*text,\s*integer,\s*integer\)\s+FROM\s+public,\s*anon,\s*authenticated/i);
});
