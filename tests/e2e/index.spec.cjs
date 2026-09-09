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
