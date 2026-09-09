# QR Menu — платформа цифрового меню и управления заведением

QR Menu — production SaaS-платформа для ресторанов и кафе: QR-меню, заказы, кабинеты персонала, управление заведениями, AI/Qrchick, интеграции и подписки/платежи.

> Ветка `refactor/full-cleanup` предназначена для инфраструктурного cleanup. Бизнес-логика заказов, роли, AI-агенты, платежи и парсинг не изменяются.

## Роли

| Роль | Назначение |
| --- | --- |
| Гость / клиент | QR-меню, корзина, создание и отслеживание заказа. |
| Официант | Столы, заказы, вызовы и обслуживание. |
| Повар | Очередь кухни и производственные статусы. |
| Курьер | Доставка и статусы назначенных заказов. |
| Управляющий / менеджер | Заведения, меню, персонал, настройки, интеграции, техкарты и доступный AI. |
| Администратор | Платформа, заведения, тарифы, права, аналитика и системный AI. |

## Стек

- Frontend: HTML/CSS/JavaScript, PWA, Service Worker.
- Backend: Vercel Serverless Functions, Node.js 22.
- Database/Auth: Supabase PostgreSQL, Auth, RLS, RPC.
- Edge Functions: Supabase Functions / Deno.
- AI: QRChick / Gemini через server-side endpoints.
- Payments: YooKassa.
- Integrations: iiko, Poster, Saby/Presto, Syrve, Эвотор, FrontPad и адаптеры `/lib/integrations`.
- CI/E2E: GitHub Actions, Playwright.

## Архитектура

```text
Browser / PWA
  ├─ /src/pages
  │   ├─ guest
  │   ├─ staff
  │   ├─ manager
  │   ├─ admin
  │   └─ auth
  ├─ /css + /js + /img + /icons
  ├─ /api
  └─ /lib + /supabase + /docs
```

### Структура frontend pages

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

Перечисленные role-oriented HTML-файлы физически находятся в `/src/pages`. Старые production/deep-link URL сохраняются через Vercel redirects, а относительные asset paths поддерживаются compatibility rewrites. `/api`, `/lib`, `/supabase` и `/docs` остаются root-level runtime boundaries. `/src/assets` подготовлен для последующей staged migration frontend assets.

## `menu-v2.html`

`menu-v2.html` оставлен отдельным: текущие данные не доказывают полную drop-in эквивалентность `menu.html`, поэтому безопасное объединение без регрессионной проверки не выполняется.

## Переменные окружения

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEYS`
- `SUPABASE_MANAGEMENT_API_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
- `ADMIN_AI_KEY`, `GEMINI_AUDIT_MODEL`
- `GITHUB_TOKEN`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- `DADATA_API_KEY`, `DADATA_TOKEN`
- `YOOKASSA_CLIENT_ID`, `YOOKASSA_CLIENT_SECRET`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`
- `SUBSCRIPTION_DURATION_DAYS`
- `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_MANAGER_EMAIL`, `PLAYWRIGHT_MANAGER_PASSWORD`, `PLAYWRIGHT_TEST_VENUE_SLUG`
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`

Полный шаблон без секретов: `.env.example`.

## Локальный запуск

Требование: Node.js 22.x.

```bash
npm install
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
```

Для static server: `npx serve .`.

## Supabase

Применяйте `supabase/migrations` по хронологии. RLS должен оставаться источником server-side авторизации, а service-role и management credentials — только server-side.

Роли приложения: `admin`, `manager`, `waiter`, `cook`, `courier`; публичный клиент работает без staff-role. Подробно: `docs/rls-policies.md`.

## Vercel

Секреты задаются в Vercel Project Settings, не в Git.

```bash
npx vercel@latest pull
npx vercel@latest build
npx vercel@latest deploy --prebuilt
```

## Security

Исторически `vercel.json` содержал публичный Supabase publishable/anon key. Он удалён из конфигурации ветки. Значения, попавшие в Git, следует считать раскрытыми согласно вашей security policy.

## Документы

- `docs/rls-policies.md`
- `docs/decisions.md`
- `docs/decisions-js-migration.md`
- `docs/filesystem-migration.md`
- `docs/sentry.md`
