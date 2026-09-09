const { test, expect } = require('@playwright/test');

test('legacy guest menu URL redirects to the role-organized page', async ({ page }) => {
  await page.goto('/menu.html');
  await expect(page).toHaveURL(/\/src\/pages\/guest\/menu\.html(?:$|\?)/);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).toContainText(/меню/i);
});

test('guest menu is directly addressable at its new source path', async ({ page }) => {
  await page.goto('/src/pages/guest/menu.html');
  await expect(page.locator('body')).toBeVisible();
});
