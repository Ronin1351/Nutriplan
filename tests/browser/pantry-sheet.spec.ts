import { test, expect } from '@playwright/test';

test('the add-item sheet is not covered by the bottom tab bar on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pantry' }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add pantry item' });
  await sheet.getByLabel('Item').fill('Eggs');
  await sheet.getByRole('button', { name: 'Save item' }).click({ timeout: 3000 });
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.pantry-card-opener').filter({ hasText: 'Eggs' })).toBeVisible();
});
