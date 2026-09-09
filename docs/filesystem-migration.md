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

The icon asset set is physically grouped under `/src/assets/icons/`. The role-specific 192/512 icons and the four root Apple touch icons are included there as well.

The icon blobs were moved without content changes. Public `/icons/*` URLs and the historical root Apple touch icon URLs remain available through compatibility rewrites.

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

The first manager relocation moved the 19-file manager module group, preserving strict script ordering and the existing `window.__QR_MANAGER_*_MIXIN__` contracts. A second pass moved manager-only auxiliary modules, the POS integrations hub, and the manager AI assistant into the same namespace.

The legacy root `manager-design.js`, `manager-hall.js`, `manager-hall-ai.js`, and `manager-hall-view.js` files are intentionally not collapsed into the new manager directory yet. They participate in compatibility/dynamic loading chains and remain under dependency audit until each load path is proven safe to consolidate.

## Compatibility

Legacy production/deep links remain available through Vercel redirects. Relocated pages retain existing runtime URLs through compatibility rewrites, while migrated static assets and role-specific JavaScript are physically stored under `/src/assets/*`.

Root `/assets/*`, `/icons/*`, `/img/*`, `/css/*`, and `/js/*` are public compatibility URL spaces backed by `/src/assets/*`. Flat root JavaScript modules that were moved into role or shared subdirectories use explicit rewrites before the generic `/js/:path*` rule.

Historical root Apple touch icon URLs are separately mapped to `/src/assets/icons/*` so existing installed PWAs and bookmarks do not lose their icon resources.

`/api`, `/lib`, `/supabase`, and `/docs` remain root-level infrastructure boundaries.

## Validation

The page and static asset migrations preserve existing blobs. Shared, admin, manager, guest, staff, demo, and PWA JavaScript groups were relocated by blob SHA, avoiding source rewrites and business-logic edits wherever possible. `tests/static-server.cjs` mirrors the compatibility rules, while Playwright smoke coverage checks legacy and canonical asset URLs, including the new flat-to-canonical JavaScript mappings.

The application runtime itself has not been executed in this environment; local runtime/network limitations previously prevented a reliable full browser test run. The filesystem changes are therefore validated structurally through repository state and route definitions rather than claimed as a successful production deployment test.

## menu-v2

`menu-v2.html` remains a distinct page. Repository evidence does not establish it as a drop-in replacement for `menu.html`, so it is not deleted or merged.

## Next asset migration

The remaining root JavaScript is now concentrated in the legacy manager hall/design compatibility boundary: `manager-design.js`, `manager-hall.js`, `manager-hall-ai.js`, and `manager-hall-view.js`, plus any root files discovered by the dependency audit. These require load-order and dynamic-loader analysis before relocation. No blanket rename is planned.
