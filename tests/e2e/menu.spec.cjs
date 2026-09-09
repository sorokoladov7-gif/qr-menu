const { test, expect } = require('@playwright/test');

test('guest menu loads', async ({ page }) => {
  await page.goto('/menu.html');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).toContainText(/меню/i);
});
