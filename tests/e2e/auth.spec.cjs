const { test, expect } = require('@playwright/test');

test('legacy login URL redirects to the role-organized page', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page).toHaveURL(/\/src\/pages\/auth\/login\.html(?:$|\?)/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('#loginButton')).toBeVisible();
});

test('register page links directly to the canonical guest menu', async ({ page }) => {
  await page.goto('/register.html');
  const link = page.locator('a[href="/src/pages/guest/menu.html"], a[href="/src/pages/guest/menu.html"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/src\/pages\/guest\/menu\.html(?:$|\?)/);
});

test('configured manager credentials can sign in', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_MANAGER_EMAIL;
  const password = process.env.PLAYWRIGHT_MANAGER_PASSWORD;
  test.skip(!email || !password, 'manager test credentials are not configured');
  await page.goto('/login.html');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('#loginButton').click();
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/src\/pages\/auth\/login\.html(?:$|\?)/);
});
