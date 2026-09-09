# Filesystem migration map

The following production pages are physically relocated under `/src/pages`:

- Guest: `index.html`, `menu.html`, `menu-v2.html`
- Staff: `waiter.html`, `cook.html`, `courier.html`, `hall.html`
- Manager: `manager.html`, `manager-demo.html`, `manager-staff-statistics.html`
- Admin: `admin.html`, `admin-analytics.html`, `admin-permissions.html`, `venue-analytics.html`
- Auth: `login.html`, `register.html`

Vercel redirects preserve the legacy root URLs. Compatibility rewrites preserve relative runtime asset resolution for `/css`, `/js`, `/img`, and `/icons`.

`menu-v2.html` is intentionally retained because it is not proven equivalent to `menu.html`.
