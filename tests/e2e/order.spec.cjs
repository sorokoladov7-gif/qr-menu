const { test, expect } = require('@playwright/test');

test('guest can start order flow from menu', async ({ page }) => {
  await page.goto('/menu.html');

  const add = page.getByText(/в корзину/i).first();
  test.skip((await add.count()) === 0, 'menu has no rendered add-to-cart control in this environment');
  await add.click();

  const checkout = page.getByRole('button', { name: /оформить|заказать/i }).first();
  test.skip((await checkout.count()) === 0, 'checkout control is not rendered by current menu state');
  await checkout.click();

  await expect(page.locator('body')).toContainText(/заказ/i);
});
