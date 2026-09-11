# Filesystem migration map

## Page locations

| Legacy URL | New file |
|---|---|
| `/index.html` | `/src/pages/guest/index.html` |
| `/menu.html` | `/src/pages/guest/menu.html` |
| `/menu-v2.html` | `/src/pages/guest/menu-v2.html` |
| `/venues.html` | `/src/pages/guest/venues.html` |
| `/waiter.html` | `/src/pages/staff/waiter.html` |
| `/cook.html` | `/src/pages/staff/cook.html` |
| `/courier.html` | `/src/pages/staff/courier.html` |
| `/hall.html` | `/src/pages/staff/hall.html` |
| `/staff-history.html` | `/src/pages/staff/staff-history.html` |
| `/staff-table.html` | `/src/pages/staff/staff-table.html` |
| `/manager.html` | `/src/pages/manager/manager.html` |
| `/manager-demo.html` | `/src/pages/manager/manager-demo.html` |
| `/manager-staff-statistics.html` | `/src/pages/manager/manager-staff-statistics.html` |
| `/integrations.html` | `/src/pages/manager/integrations.html` |
| `/staff-guide.html` | `/src/pages/manager/staff-guide.html` |
| `/admin.html` | `/src/pages/admin/admin.html` |
| `/admin-analytics.html` | `/src/pages/admin/admin-analytics.html` |
| `/admin-permissions.html` | `/src/pages/admin/admin-permissions.html` |
| `/venue-analytics.html` | `/src/pages/admin/venue-analytics.html` |
| `/admin_templates.html` | `/src/pages/admin/admin_templates.html` |
| `/login.html` | `/src/pages/auth/login.html` |
| `/register.html` | `/src/pages/auth/register.html` |

## PWA assets

The six web app manifests are physically grouped under `/src/assets/pwa/`.

The install/runtime helper is grouped under `/src/assets/js/pwa/pwa-install.js`. It still registers the existing `/sw.js` service worker and preserves its role-aware behavior; only the physical asset location changed.

## Icon assets

The icon asset set is physically grouped under `/src/assets/icons/`. The role-specific 192/512 icons and the four Apple touch icons are canonical there. Legacy root role-icon and Apple touch icon URLs are compatibility rewrites only.

The icon blobs were moved without content changes. Public `/icons/*` URLs and historical root icon URLs remain available through compatibility rewrites.

## Image assets

The root `/img` directory is physically grouped under `/src/assets/img/` with the four existing PNG assets moved without content changes. Public `/img/*` URLs remain stable through compatibility rewrites.

## Stylesheet assets

The root `/css` directory is physically grouped under `/src/assets/css/` with its existing four stylesheet blobs moved without content edits. Public `/css/*` URLs remain stable through compatibility rewrites.

## Duplicate asset tree cleanup

The intermediate root `/assets` tree was audited against `/src/assets` and had identical Git tree SHAs for its `css`, `icons`, `img`, `js`, and `pwa` subtrees. It was removed rather than retained as a duplicate. `/assets/:path*` remains a compatibility URL space backed by `/src/assets/:path*`.

## Shared JavaScript assets

The shared browser runtime is physically grouped under `/src/assets/js/shared/`:

- `/js/shared/utils.js` → `/src/assets/js/shared/utils.js`
- `/js/shared/qr-support.js` → `/src/assets/js/shared/qr-support.js`
- `/js/app.js` → `/src/assets/js/shared/app.js`
- `/js/config.js` → `/src/assets/js/shared/config.js`
- `/js/offline-sync.js` → `/src/assets/js/shared/offline-sync.js`

The bootstrap files were moved unchanged after checking their browser-global contracts and cross-page guards. Explicit legacy rewrites preserve the flat `/js/app.js`, `/js/config.js`, and `/js/offline-sync.js` URLs.

## Guest JavaScript assets

Guest/public-menu modules are now grouped under `/src/assets/js/guest/`:

- `address-suggestions.js`
- `customer-order-live.js`
- `customer-order-status.js`
- `delivery-calc.js`
- `design-runtime.js`
- `menu-design-runtime.js`
- `menu-modifiers.js`
- `menu-table-flow.js`
- `yookassa-order-payment.js`

These are physical relocations only. `design-runtime.js` is menu-only and retains its pathname guard. Its historical flat `/js/design-runtime.js` URL is explicitly rewritten to the canonical guest path.

## Staff JavaScript assets

Staff-facing runtime modules are grouped under `/src/assets/js/staff/`:

- `cook-table-unified.js`
- `notify.js`
- `staff-auth.js`
- `staff-notifications.js`
- `staff-ui-patches.js`
- `staff-workday.js`
- `waiter-history-inline.js`

The files retain their existing blob contents. `staff-auth.js` remains a pre-`config.js` session dependency, while `staff-ui-patches.js` is loaded dynamically by `staff-workday.js`; its historical `/js/staff-ui-patches.js` URL therefore has an explicit compatibility rewrite.

## Demo JavaScript assets

The demo-only browser runtime is isolated under `/src/assets/js/demo/`:

- `demo-data.js`
- `demo-manager-create.js`
- `demo-mode.js`
- `demo-staff-v2.js`

These files are still available through explicit flat legacy rewrites at their historical `/js/*.js` URLs. Their demo gating logic remains unchanged; no production runtime logic was merged into the demo layer.

## Admin JavaScript assets

The complete admin JavaScript runtime group is now physically grouped under `/src/assets/js/admin/`:

- `admin-ai-audit.js`
- `admin-ai-usage.js`
- `admin-app.js`
- `admin-console-enhancer.js`
- `admin-core.js`
- `admin-design-access.js`
- `admin-managers.js`
- `admin-menu.js`
- `admin-payments.js`
- `admin-settings.js`
- `admin-staff.js`
- `admin-statistics.js`
- `admin-subscriptions.js`
- `admin-templates.js`
- `admin-venues.js`

All files were relocated by preserving their existing Git blob SHAs. No business logic, Vue mixin contract, global symbol, or load-order dependency was changed.

## Manager JavaScript assets

The manager browser runtime is physically grouped under `/src/assets/js/manager/`.

The canonical manager runtime contains the actual implementations and browser compatibility bridges. It is not a thin-loader/legacy split. Important runtime modules include:

- `manager-core.js` — shared manager state, entitlement helpers, canonical action bridge, and browser mutation interception.
- `manager-menu.js` — menu UI, PDF/photo/site import UI, and menu interaction layer.
- `manager-recipes.js` — recipe/ingredient UI; canonical RPC writes are intercepted by the manager core bridge.
- `manager-staff.js` — staff UI; destructive staff mutations use the canonical manager action boundary while supported read/analytics RPCs remain read-only.
- `manager-hall.js` — hall/table UI using the canonical manager hall RPC contract.
- `manager-hall-ai.js` — compatibility bootstrap only; revoked global-ingredient mutation RPCs are not exposed here.
- `manager-design.js` and `manager-hall-view.js` — manager design/hall presentation/runtime helpers.

Historical `/js/manager-*.js` URLs remain compatibility routes to the canonical files. No duplicate `legacy/` implementation tree is required by the current architecture.

## Server/runtime boundaries

Server-side runtime remains intentionally separated from browser assets:

- `/api` — thin HTTP entrypoints and compatibility dispatchers.
- `/lib/ai/manager/` — canonical manager AI action context, dispatcher, and mutation families.
- `/lib/integrations/` — provider registry/router and integration runtime.
- `/lib/import/` — menu/site import runtime.
- `/lib/jobs/` — scheduled/background jobs.
- `/lib/payments/` — payment provider runtime.
- `/lib/shared/` — reusable server-side security/auth helpers.
- `/supabase/migrations/` — database schema, RPC authorization, and security migrations.

Manager mutation flow is intentionally centralized as `browser UI → /api/manager-ai-action → lib/ai/manager/action.js → mutation family → Supabase/RPC`, while read-only browser queries may continue to use the existing Supabase client where their contract is explicitly read-only.

## Verification scripts

Standalone database verification scripts are grouped under `/supabase/verify/`. The unified operational-core checker moved from the repository root to `/supabase/verify/unified-core.sql` without source changes.

## Test support

Test infrastructure that is not itself a test suite is grouped under `/tests/support/`. The static compatibility server moved from `/tests/static-server.cjs` to `/tests/support/static-server.cjs`; `playwright.config.cjs` points to the canonical location. No runtime or production route was changed.

## Compatibility

Legacy production/deep links remain available through Vercel redirects. Relocated pages retain existing runtime URLs through compatibility rewrites, while migrated static assets and role-specific JavaScript are physically stored under `/src/assets/*`.

Root `/assets/*`, `/icons/*`, `/img/*`, `/css/*`, and `/js/*` are public compatibility URL spaces backed by `/src/assets/*`. Flat root JavaScript modules and historical manager URLs use explicit rewrites before the generic `/js/:path*` rule. Legacy root role-icon and Apple touch icon URLs likewise use explicit rewrites to canonical icon files.

`/api`, `/lib`, `/supabase`, and `/docs` remain root-level infrastructure boundaries.

## Validation

The page and static asset migrations preserve existing blobs. Shared, admin, manager, guest, staff, demo, and PWA JavaScript groups were relocated by blob SHA where possible. Runtime contract tests now cover the canonical manager mutation families, venue isolation, legacy RPC ACL boundaries, browser mutation bridges, and the canonical manager filesystem map.

The application runtime is not claimed as fully browser-tested in this environment. Production deployment status is checked separately through Vercel for each relevant commit.

## menu-v2

`menu-v2.html` remains a distinct page. Repository evidence does not establish it as a drop-in replacement for `menu.html`, so it is not deleted or merged.

## Remaining root files

Root files that remain intentionally include Vercel/serverless entrypoints, the root service worker (`sw.js`, whose scope depends on root placement), repository configuration, robots/sitemap metadata, and the standalone `demo-staff.html` shell. `demo-staff.html` is not relocated yet because its current iframe and error-state links are relative to the root role URLs; moving it would require coordinated URL changes rather than a pure filesystem move.

The browser-asset migration is structurally complete for the audited JS/assets boundary. Further cleanup targets dependency-driven server/runtime layout and runtime-contract hardening rather than another blanket file move.
