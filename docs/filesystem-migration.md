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

The install/runtime helper is now grouped under `/src/assets/js/pwa/pwa-install.js`. It still registers the existing `/sw.js` service worker and preserves its role-aware behavior; only the physical asset location changed.

## Icon assets

The complete 12-file root `/icons` directory is physically grouped under `/src/assets/icons/` without changing blob contents. Public `/icons/*` URLs remain stable through the Vercel compatibility rewrite.

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

The blobs were moved without source changes. Existing `/js/shared/*` URLs remain valid through the root `/js/:path*` compatibility rewrite.

## Guest JavaScript assets

Guest/public-menu modules are now grouped under `/src/assets/js/guest/`:

- `address-suggestions.js`
- `customer-order-live.js`
- `customer-order-status.js`
- `delivery-calc.js`
- `menu-design-runtime.js`
- `menu-table-flow.js`
- `menu-modifiers.js`
- `yookassa-order-payment.js`
- `design-runtime.js`

These are physical relocations only. Existing `/js/*.js` requests remain valid through the `/js/:path*` compatibility rewrite, so existing page script tags do not need to change as part of the filesystem migration. `design-runtime.js` is explicitly menu-only and was moved after verifying its pathname guard for `/menu.html`.

## Staff JavaScript assets

Staff-facing runtime modules are grouped under `/src/assets/js/staff/`:

- `cook-table-unified.js`
- `notify.js`
- `staff-auth.js`
- `staff-notifications.js`
- `staff-workday.js`
- `waiter-history-inline.js`

The files retain their existing blob contents. `staff-auth.js` remains a pre-`config.js` session dependency, while `notify.js` remains a staff-only notification helper.

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

All files were relocated by preserving their existing Git blob SHAs. No business logic, Vue mixin contract, global symbol, or load-order dependency was changed. The admin shell may continue to request `/js/admin/*.js`; Vercel and the local static server resolve `/js/:path*` to `/src/assets/js/:path*`.

Internal dynamic script paths such as `/js/admin/admin-ai-audit.js`, `/js/admin/admin-console-enhancer.js`, and `/js/admin/admin-ai-usage.js` therefore remain valid without modifying runtime code.

## Manager JavaScript assets

The manager browser runtime is physically grouped under `/src/assets/js/manager/`.

The first manager relocation moved the 19-file manager module group, preserving strict script ordering and the existing `window.__QR_MANAGER_*_MIXIN__` contracts. A second pass moved the manager-only auxiliary modules from the root `/js` directory:

- `manager-instruction-tab-v2.js`
- `manager-payment-settings.js`
- `manager-permissions-bridge.js`
- `manager-personnel-final.js`
- `manager-staff-quick-actions.js`
- `manager-staff-statistics.js`
- `integrations-hub.js`

`integrations-hub.js` is manager-only: it powers the POS integration page, calls the authenticated `/api/integrations/*` endpoints, and has no shared guest/staff dependency. The integrations page now references its canonical `/src/assets/js/manager/integrations-hub.js` path.

The legacy root `manager-design.js`, `manager-hall.js`, `manager-hall-ai.js`, and `manager-hall-view.js` files are intentionally not collapsed into the new manager directory yet. They participate in compatibility/dynamic loading chains and therefore remain under dependency audit until each load path is proven safe to consolidate.

## Compatibility

Legacy production/deep links remain available through Vercel redirects. Relocated pages retain existing runtime URLs through compatibility rewrites, while migrated static assets and role-specific JavaScript are physically stored under `/src/assets/*`.

Root `/assets/*`, `/icons/*`, `/img/*`, `/css/*`, and `/js/*` are public compatibility URL spaces backed by `/src/assets/*`.

`/api`, `/lib`, `/supabase`, and `/docs` remain root-level infrastructure boundaries.

## Validation

The page and static asset migrations preserve existing blobs. Shared, admin, manager, guest, staff, and PWA JavaScript groups were relocated by blob SHA, avoiding source rewrites and business-logic edits wherever possible. `tests/static-server.cjs` mirrors the `/js/*` compatibility rule, while Playwright smoke coverage checks legacy and canonical JavaScript URLs.

The application runtime itself has not been executed in this environment; local network/runtime limitations previously prevented a reliable full browser test run. The filesystem changes are therefore validated structurally through repository state and route definitions rather than claimed as a successful production deployment test.

## menu-v2

`menu-v2.html` remains a distinct page. Repository evidence does not establish it as a drop-in replacement for `menu.html`, so it is not deleted or merged.

## Next asset migration

The remaining root JavaScript is now the highest-risk boundary: `config.js`, `app.js`, demo bootstrap files, and the legacy manager hall/design implementations. These need dependency/load-order analysis before relocation because they use browser globals, dynamic script insertion, service-worker integration, or cross-page compatibility behavior.
