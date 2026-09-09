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

## Compatibility

Legacy production/deep links remain available through Vercel redirects. Relocated pages retain the existing root runtime asset directories (`/css`, `/js`, `/img`, `/icons`) through compatibility rewrites.

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

The six latest standalone-page moves preserve the original HTML blobs unchanged; only their repository paths changed. Legacy redirects were added in the same final routing tree, and the manager integrations page keeps its existing no-store behavior.

Playwright smoke coverage asserts the main legacy redirects and the critical cross-role links introduced by the page relocation. The local static server mirrors the same role-page and asset compatibility behavior.

## menu-v2

`menu-v2.html` remains a distinct page. Repository evidence does not establish it as a drop-in replacement for `menu.html`, so it is not deleted or merged.

## Future asset migration

A later staged migration can move frontend assets into `/src/assets`. It should be performed role-by-role after exhaustive reference scans and smoke tests.
