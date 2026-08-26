import { test, expect } from '@playwright/test';

const phone = `555${Date.now().toString().slice(-7)}`;

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /handmade/i })).toBeVisible();
});

test('register, browse catalog, and open password reset', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('E2E User');
  await page.getByLabel('Phone number').fill(phone);
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/sell/);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: /catalog/i })).toBeVisible();

  await page.goto('/forgot-password');
  await page.getByLabel('Phone number').fill(phone);
  await page.getByRole('button', { name: /send reset code/i }).click();
  await expect(page.locator('.status.ok').first()).toBeVisible();
});
