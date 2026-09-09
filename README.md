# QR Menu

## Frontend layout

The role-oriented HTML pages are physically organized under `/src/pages`:

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

Legacy production URLs remain supported by Vercel redirects. Existing runtime assets stay in `/css`, `/js`, `/img`, `/icons` and are exposed from relocated pages through compatibility rewrites. `/api`, `/lib`, `/supabase`, and `/docs` remain root-level runtime/infrastructure boundaries.

`menu-v2.html` remains separate because the repository evidence does not establish full drop-in equivalence with `menu.html`.

## Environment

All secrets are environment-only. See `.env.example` for the complete variable set and `docs/rls-policies.md`, `docs/filesystem-migration.md`, and `docs/decisions-js-migration.md` for operational guidance.
