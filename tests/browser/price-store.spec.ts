import { test, expect } from '@playwright/test';

test('mobile shell creates v2 local storage without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.client);
  const database = await page.evaluate(async () => new Promise<{ version: number; stores: string[] }>((resolve, reject) => { const request = indexedDB.open('nutriplan-cache'); request.onsuccess = () => { const db = request.result; const result = { version: db.version, stores: [...db.objectStoreNames] }; db.close(); resolve(result); }; request.onerror = () => reject(request.error); }));
  expect(database.version).toBe(2);
  expect(database.stores).toContain('price_observations');
});

test('records a local price and opens its history on a phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Pantry/i }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add pantry item' });
  await sheet.getByLabel('Item').fill('Rice');
  await sheet.getByLabel('Price').fill('100');
  await sheet.getByRole('button', { name: 'Save item' }).click();
  const riceCard = page.locator('.pantry-card-opener').filter({ hasText: 'Rice' });
  await expect(riceCard).toBeVisible();
  await riceCard.click();
  await expect(page.getByRole('heading', { name: 'Rice', exact: true })).toBeVisible();
  await expect(page.getByText('No dated observations in this range.')).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Recorded price observations' })).toBeVisible();
});
