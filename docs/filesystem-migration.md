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

The six web app manifests are physically grouped under `/src/assets/pwa/`:

| Legacy URL | New file |
|---|---|
| `/manifest.webmanifest` | `/src/assets/pwa/manifest.webmanifest` |
| `/manifest-admin.webmanifest` | `/src/assets/pwa/manifest-admin.webmanifest` |
| `/manifest-cook.webmanifest` | `/src/assets/pwa/manifest-cook.webmanifest` |
| `/manifest-courier.webmanifest` | `/src/assets/pwa/manifest-courier.webmanifest` |
| `/manifest-manager.webmanifest` | `/src/assets/pwa/manifest-manager.webmanifest` |
| `/manifest-waiter.webmanifest` | `/src/assets/pwa/manifest-waiter.webmanifest` |

The manifest contents are unchanged. Existing application references such as `/manifest-cook.webmanifest` remain valid through permanent redirects.

## Icon assets

The complete 12-file root `/icons` directory is now physically grouped under `/src/assets/icons/` without changing any blob contents. Public `/icons/*` URLs remain stable through one Vercel compatibility rewrite to the new location.

This includes the generic client PWA icons, cook/waiter favicons, manager/courier PWA icons, and admin icons. No unknown file was included in this move; the source directory was fully enumerated before relocation.

## Image assets

The root `/img` directory is now physically grouped under `/src/assets/img/` with the four existing PNG assets moved without content changes:

- `dashboard.PNG`
- `hall.PNG`
- `menu.PNG`
- `orders.PNG`

Public `/img/*` URLs remain stable through a Vercel compatibility rewrite to `/src/assets/img/*`. Existing role-page asset rewrites continue to resolve relative `/img/*` requests through this compatibility layer.

## Stylesheet assets

The root `/css` directory is now physically grouped under `/src/assets/css/`. The four existing stylesheet blobs were moved without content edits while preserving their existing internal structure:

- `/css/style.css` → `/src/assets/css/style.css`
- `/css/shared/common.css` → `/src/assets/css/shared/common.css`
- `/css/admin/admin.css` → `/src/assets/css/admin/admin.css`
- `/css/manager/manager.css` → `/src/assets/css/manager/manager.css`

Public `/css/*` URLs remain stable through a Vercel compatibility rewrite to `/src/assets/css/*`. Existing role-page CSS rewrites continue to resolve through this compatibility layer.

## Duplicate asset tree cleanup

The intermediate root `/assets` tree was audited against `/src/assets` before removal. Its `css`, `icons`, `img`, `js`, and `pwa` subtrees had the same Git tree SHAs as their `/src/assets/*` counterparts, so the root tree contained no independent production assets. It has therefore been removed instead of retained as a duplicate staging copy.

The public `/assets/:path*` URL space is preserved through a Vercel rewrite to `/src/assets/:path*`; the local static server mirrors the same compatibility rule. This also keeps the historical QRChick avatar URL functional without retaining a second physical copy.

## Shared JavaScript assets

The first production JS group has now been moved physically under `/src/assets/js/shared/`:

- `/js/shared/utils.js` → `/src/assets/js/shared/utils.js`
- `/js/shared/qr-support.js` → `/src/assets/js/shared/qr-support.js`

Both files were copied without business-logic changes. `utils.js` remains loaded by the admin and manager shells through the existing `/js/shared/utils.js` URL; the hosting layer now resolves that legacy URL to the relocated file. The same compatibility rule applies to the support runtime.

No relative JavaScript import or module dependency was found inside this group, so the move does not require changing script order or introducing an import system.

## Compatibility

Legacy production/deep links remain available through Vercel redirects. Relocated pages retain existing root runtime URLs through compatibility rewrites, while migrated static image/icon/stylesheet assets and the first shared JS group are physically stored under `/src/assets/*`.

Root `/assets/*`, `/icons/*`, `/img/*`, `/css/*`, and `/js/*` are public compatibility URL spaces backed by `/src/assets/*`.

Moved-page relative navigation is also covered at the hosting layer where the original relative URL would otherwise resolve inside the new role directory:

- `/src/pages/guest/login.html` → `/src/pages/auth/login.html`
- `/src/pages/guest/register.html` → `/src/pages/auth/register.html`
- `/src/pages/guest/manager-demo.html` → `/src/pages/manager/manager-demo.html`
- `/src/pages/guest/demo-staff.html` → `/demo-staff.html`
- `/src/pages/auth/menu.html` → `/src/pages/guest/menu.html`
- `/src/pages/guest/{cook,courier,waiter}.html` → corresponding staff pages

For relocated pages whose original relative links are intentionally role-local (`venues` → `menu-v2`, `staff-table` → `waiter`, `integrations` → `manager`, `staff-guide` → manager), no content rewrite is required.

`/api`, `/lib`, `/supabase`, and `/docs` remain root-level infrastructure boundaries.

## Validation

The standalone-page moves preserve the original HTML blobs unchanged; PWA manifest blobs, the 12 icon blobs, the 4 image blobs, and the 4 stylesheet blobs are likewise moved without content edits. The first two shared JS blobs were also moved without source edits. Legacy redirects remain defined for pages/manifests, while `/assets/*`, `/icons/*`, `/img/*`, `/css/*`, and `/js/*` public paths are preserved with internal compatibility rewrites. `tests/static-server.cjs` mirrors these routes.

Playwright smoke coverage asserts critical legacy redirects and checks legacy static URLs plus canonical relocated asset responses, including the compatibility `/assets/img/qrchick-avatar.svg` URL and the relocated shared JavaScript files.

## menu-v2

`menu-v2.html` remains a distinct page. Repository evidence does not establish it as a drop-in replacement for `menu.html`, so it is not deleted or merged.

## Next asset migration

The remaining JavaScript runtime outside `/js/shared` stays in place for now. The next migrations require per-role load-order analysis of `/js/admin`, `/js/manager`, and the remaining root JS files because they contain browser globals, side effects, dynamic script loading, service-worker integration, and API/page coupling.
