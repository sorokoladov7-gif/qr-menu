# QR Menu

## Filesystem layout

Role-oriented pages are now physically stored under `/src/pages`:

```text
/src/pages
  /guest
    menu.html
    menu-v2.html
    index.html
  /staff
    waiter.html
    cook.html
    courier.html
    hall.html
  /manager
    manager.html
    manager-demo.html
    manager-staff-statistics.html
  /admin
    admin.html
    admin-analytics.html
    admin-permissions.html
    venue-analytics.html
  /auth
    login.html
    register.html
```

Legacy production URLs are preserved with Vercel redirects. Existing `/css`, `/js`, `/img`, and `/icons` remain runtime asset roots and are exposed from relocated pages with compatibility rewrites. `/api`, `/lib`, `/supabase`, and `/docs` remain root-level runtime boundaries.

`menu-v2.html` remains separate because current repository evidence does not establish it as a full drop-in replacement for `menu.html`.

The complete environment-variable documentation remains available in `.env.example` and the repository documentation set.
