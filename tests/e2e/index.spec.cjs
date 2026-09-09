const { test, expect } = require('@playwright/test');

test('legacy homepage redirects and role links remain reachable', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page).toHaveURL(/\/src\/pages\/guest\/index\.html(?:$|\?)/);

  await page.locator('a[href="manager-demo.html"]').click();
  await expect(page).toHaveURL(/\/src\/pages\/manager\/manager-demo\.html(?:$|\?)/);

  await page.goto('/index.html');
  await page.locator('a[href="demo-staff.html"]').click();
  await expect(page).toHaveURL(/\/demo-staff\.html(?:$|\?)/);

  await page.goto('/index.html');
  await page.locator('a[href="login.html"]').click();
  await expect(page).toHaveURL(/\/src\/pages\/auth\/login\.html(?:$|\?)/);
});

test('legacy manifest URL redirects to the relocated PWA asset', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  expect(response.url()).toMatch(/\/src\/assets\/pwa\/manifest\.webmanifest$/);
  expect(response.headers()['content-type']).toMatch(/application\/manifest\+json/i);
});

test('legacy icon URL remains available after icon relocation', async ({ page }) => {
  const response = await page.request.get('/icons/icon-192.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/png/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('legacy image URL remains available after image relocation', async ({ page }) => {
  const response = await page.request.get('/img/dashboard.PNG');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/png/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated image is directly reachable at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/img/dashboard.PNG');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/png/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('legacy stylesheet URL remains available after stylesheet relocation', async ({ page }) => {
  const response = await page.request.get('/css/style.css');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/css/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated stylesheet is directly reachable at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/css/style.css');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/css/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('legacy assets URL remains available after duplicate tree cleanup', async ({ page }) => {
  const response = await page.request.get('/assets/img/qrchick-avatar.svg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('legacy JS URL remains available after shared runtime relocation', async ({ page }) => {
  const response = await page.request.get('/js/shared/utils.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated shared JS is directly reachable at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/js/shared/utils.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated support JS is directly reachable at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/js/shared/qr-support.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('legacy admin JS URL remains available after admin runtime relocation', async ({ page }) => {
  const response = await page.request.get('/js/admin/admin-core.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated admin JS is directly reachable at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/js/admin/admin-core.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated admin AI workspace remains directly reachable', async ({ page }) => {
  const response = await page.request.get('/src/assets/js/admin/admin-ai-audit.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('legacy favicon URL remains available after icon relocation', async ({ page }) => {
  const response = await page.request.get('/favicon.svg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('relocated favicon is directly reachable at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/icons/favicon.svg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});

test('apple touch icons remain available after icon relocation', async ({ page }) => {
  for (const path of [
    'apple-touch-icon.png',
    'apple-touch-icon-courier.png',
    'apple-touch-icon-manager.png',
    'apple-touch-icon-waiter.png',
  ]) {
    const legacy = await page.request.get(`/${path}`);
    expect(legacy.status(), path).toBe(200);
    expect(legacy.headers()['content-type'], path).toMatch(/^image\/png/i);
    expect((await legacy.body()).length, path).toBeGreaterThan(0);

    const canonical = await page.request.get(`/src/assets/icons/${path}`);
    expect(canonical.status(), path).toBe(200);
    expect(canonical.headers()['content-type'], path).toMatch(/^image\/png/i);
    expect((await canonical.body()).length, path).toBeGreaterThan(0);
  }
});

test('relocated PWA runtime is directly reachable while the legacy URL is rewritten', async ({ page }) => {
  const legacy = await page.request.get('/js/pwa-install.js');
  expect(legacy.status()).toBe(200);
  expect(legacy.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await legacy.body()).length).toBeGreaterThan(0);

  const canonical = await page.request.get('/src/assets/js/pwa/pwa-install.js');
  expect(canonical.status()).toBe(200);
  expect(canonical.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await canonical.body()).length).toBeGreaterThan(0);
});

test('guest runtime modules are available at their canonical asset paths', async ({ page }) => {
  for (const path of [
    'address-suggestions.js',
    'customer-order-live.js',
    'customer-order-status.js',
    'delivery-calc.js',
    'design-runtime.js',
    'menu-design-runtime.js',
    'menu-modifiers.js',
    'menu-table-flow.js',
    'yookassa-order-payment.js',
  ]) {
    const response = await page.request.get(`/src/assets/js/guest/${path}`);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toMatch(/^text\/javascript/i);
    expect((await response.body()).length, path).toBeGreaterThan(0);
  }
});

test('staff runtime modules are available at their canonical asset paths', async ({ page }) => {
  for (const path of [
    'cook-table-unified.js',
    'notify.js',
    'staff-auth.js',
    'staff-notifications.js',
    'staff-workday.js',
    'waiter-history-inline.js',
  ]) {
    const response = await page.request.get(`/src/assets/js/staff/${path}`);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toMatch(/^text\/javascript/i);
    expect((await response.body()).length, path).toBeGreaterThan(0);
  }
});

test('manager runtime modules are available at their canonical asset paths', async ({ page }) => {
  for (const path of [
    'integrations-hub.js',
    'manager-instruction-tab-v2.js',
    'manager-payment-settings.js',
    'manager-permissions-bridge.js',
    'manager-personnel-final.js',
    'manager-staff-quick-actions.js',
    'manager-staff-statistics.js',
  ]) {
    const response = await page.request.get(`/src/assets/js/manager/${path}`);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toMatch(/^text\/javascript/i);
    expect((await response.body()).length, path).toBeGreaterThan(0);
  }
});

test('demo runtime modules are available at their canonical asset paths', async ({ page }) => {
  for (const path of [
    'demo-data.js',
    'demo-manager-create.js',
    'demo-mode.js',
    'demo-staff-v2.js',
  ]) {
    const response = await page.request.get(`/src/assets/js/demo/${path}`);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toMatch(/^text\/javascript/i);
    expect((await response.body()).length, path).toBeGreaterThan(0);
  }
});

test('admin design access module is available at its canonical asset path', async ({ page }) => {
  const response = await page.request.get('/src/assets/js/admin/admin-design-access.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/javascript/i);
  expect((await response.body()).length).toBeGreaterThan(0);
});
