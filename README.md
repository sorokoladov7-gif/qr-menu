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

Перечисленные страницы физически находятся в `/src/pages`. Старые root URL сохраняются Vercel redirects; существующие `/css`, `/js`, `/img`, `/icons` остаются runtime-ресурсами и доступны из relocated pages через compatibility routing.

`menu-v2.html` сохранён отдельно: текущие ссылки и role-launcher поведение не подтверждают безопасную drop-in эквивалентность `menu.html`.

## Runtime boundaries

`/api`, `/lib`, `/supabase` и `/docs` остаются в корне. `/src/assets` подготовлен для последующей staged migration CSS/JS/images/icons после отдельного dependency audit.

## Roles

`guest`, `waiter`, `cook`, `courier`, `manager`, `admin`. Server-side authorization остаётся в Supabase RLS/RPC и backend endpoints.

## Environment

Секреты не хранятся в Git. Полный список переменных и их назначение находится в предыдущей документации ветки и `.env.example`.
