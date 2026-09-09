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
