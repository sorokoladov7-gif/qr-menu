# QR Menu — платформа цифрового меню и управления заведением

QR Menu — production SaaS-платформа для ресторанов и кафе: QR-меню, заказы, кабинеты персонала, управление заведениями, AI/Qrchick, интеграции и подписки/платежи.

## Frontend layout

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

Перечисленные role-oriented HTML-файлы физически находятся в `/src/pages`. Старые production/deep-link URL сохраняются через Vercel redirects. Относительные asset paths исходных страниц сохраняются через compatibility rewrites к `/css`, `/js`, `/img`, `/icons`.

`/api`, `/lib`, `/supabase` и `/docs` остаются root-level runtime boundaries. `/src/assets` подготовлен для последующей staged migration frontend assets.

## `menu-v2.html`

`menu-v2.html` оставлен отдельным: текущие данные не доказывают полную drop-in эквивалентность `menu.html`.

## Roles

`guest`, `waiter`, `cook`, `courier`, `manager`, `admin`. Server-side authorization остаётся в Supabase RLS/RPC и backend endpoints.

## Environment

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_SECRET_KEYS`
- `SUPABASE_MANAGEMENT_API_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `ADMIN_AI_KEY`
- `GEMINI_AUDIT_MODEL`
- `GITHUB_TOKEN`
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`
- `DADATA_API_KEY`
- `DADATA_TOKEN`
- `YOOKASSA_CLIENT_ID`
- `YOOKASSA_CLIENT_SECRET`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `SUBSCRIPTION_DURATION_DAYS`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_MANAGER_EMAIL`
- `PLAYWRIGHT_MANAGER_PASSWORD`
- `PLAYWRIGHT_TEST_VENUE_SLUG`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`

Полный шаблон без секретов: `.env.example`.

## Supabase

Применяйте `supabase/migrations` по хронологии. RLS остаётся источником server-side авторизации; service-role и management credentials используются только server-side.

## Vercel

Секреты задаются в Vercel Project Settings, а не в Git.

```bash
npx vercel@latest pull
npx vercel@latest build
npx vercel@latest deploy --prebuilt
```

## Security

Исторически `vercel.json` содержал публичный Supabase publishable/anon key. Он удалён из конфигурации. Значения, попавшие в Git, следует считать раскрытыми согласно security policy.

## Documents

- `docs/rls-policies.md`
- `docs/decisions.md`
- `docs/decisions-js-migration.md`
- `docs/filesystem-migration.md`
- `docs/sentry.md`
