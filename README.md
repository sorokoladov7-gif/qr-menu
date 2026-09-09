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
  ├─ /css + /js + /img + /icons   # runtime assets, root paths сохранены для совместимости
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

HTML-файлы физически перенесены в `/src/pages`. При этом публичные и исторические URL вроде `/menu.html`, `/manager.html`, `/admin.html` сохраняются через Vercel redirects, а относительные `css/js/img/icons` пути новых страниц разрешаются через compatibility rewrites. Это позволяет менять файловую структуру без изменения внешних deep links и бизнес-логики.

## Почему `menu-v2.html` сохранён

`menu-v2.html` не считается безопасным дублем `menu.html`: по текущему коду это отдельный сценарий/launcher для staff-role маршрутизации. Поэтому файл не удалён и не заменён без доказательства эквивалентности всех query-параметров и deep links.

## Переменные окружения

### Supabase

- `SUPABASE_URL` — URL проекта Supabase.
- `SUPABASE_ANON_KEY` — публичный client/anon key.
- `SUPABASE_PUBLISHABLE_KEY` — совместимое имя publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side service-role key; не отдавать браузеру.
- `SUPABASE_SERVICE_KEY` — legacy alias service-role key.
- `SUPABASE_SECRET_KEYS` — JSON с секретными ключами для Edge Function fallback.
- `SUPABASE_MANAGEMENT_API_TOKEN` — Management API token для read-only AI diagnostics.
- `SUPABASE_ACCESS_TOKEN` — совместимый alias Management API token.
- `SUPABASE_PROJECT_REF` — reference ID проекта Supabase.

### AI / automation

- `ADMIN_AI_KEY` — ключ QRChick/Gemini Interactions.
- `GEMINI_AUDIT_MODEL` — модель аудита/AI по умолчанию.
- `GITHUB_TOKEN` — GitHub API token для server-side automation.
- `VERCEL_TOKEN` — Vercel API token.
- `VERCEL_PROJECT_ID` — Vercel project ID.
- `VERCEL_TEAM_ID` — Vercel team/owner ID.

### Address / payments

- `DADATA_API_KEY` / `DADATA_TOKEN` — токен DaData.
- `YOOKASSA_CLIENT_ID` — OAuth client ID.
- `YOOKASSA_CLIENT_SECRET` — OAuth client secret.
- `YOOKASSA_SHOP_ID` — shop ID.
- `YOOKASSA_SECRET_KEY` — API secret key.
- `SUBSCRIPTION_DURATION_DAYS` — длина подписочного периода; default `30`.

### Tests / monitoring

- `PLAYWRIGHT_BASE_URL` — URL приложения для E2E.
- `PLAYWRIGHT_MANAGER_EMAIL` — тестовый login менеджера.
- `PLAYWRIGHT_MANAGER_PASSWORD` — тестовый пароль.
- `PLAYWRIGHT_TEST_VENUE_SLUG` — slug тестового заведения.
- `SENTRY_DSN` — Sentry DSN.
- `SENTRY_ENVIRONMENT` — environment (`development`, `staging`, `production`).
- `SENTRY_RELEASE` — release identifier.

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

Для локального static server используйте HTTP server, например `npx serve .`. Тестовые credentials задаются только environment variables.

## Supabase setup

1. Создайте проект и задайте `SUPABASE_URL`, client key и server secrets.
2. Примените `supabase/migrations` по хронологии через Supabase CLI/SQL Editor.
3. Убедитесь, что RLS включён на tenant-scoped таблицах.
4. Service-role и Management API credentials должны использоваться только server-side.
5. Роль приложения должна проверяться RLS/RPC, а не только UI.
6. После миграций проверьте auth, venue access, menu, order flow и staff flows.

Bootstrap-роли приложения: `admin`, `manager`, `waiter`, `cook`, `courier`. Публичный клиент работает без staff-role. Подробные рекомендации: `docs/rls-policies.md`.

## Vercel

Production/Preview environment variables задаются в Vercel Project Settings; секреты не хранятся в Git.

```bash
npx vercel@latest pull
npx vercel@latest build
npx vercel@latest deploy --prebuilt
```

CI также выполняет `vercel build`, когда заданы Vercel credentials.

## Security

В исходном `vercel.json` находился публичный Supabase publishable/anon key. В этой ветке он убран из `vercel.json`; client-side public key может оставаться частью браузерного runtime, но значение, когда-либо попавшее в Git, следует считать раскрытым. При вашей политике безопасности выполните замену ключа и проверьте Supabase audit.

Для аудита истории:

```bash
git log -p --all -- . ':!node_modules'
git grep -nE '(sk-|AIza|service_role|SUPABASE_SERVICE_ROLE_KEY|CLIENT_SECRET|SECRET_KEY)' $(git rev-list --all)
```

## Change policy

Один логический блок = один атомарный commit. Заказы, роли, AI-агенты, платежи и парсинг не рефакторятся без отдельного архитектурного решения.

## Документы

- `docs/rls-policies.md` — RLS matrix и рекомендации.
- `docs/decisions.md` — решения по изменениям, отложенным из-за риска регрессии.
- `docs/decisions-js-migration.md` — ограничения переноса shared JS.
- `docs/sentry.md` — Sentry.
