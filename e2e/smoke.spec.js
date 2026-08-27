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

test('catalog product opens detail page', async ({ page, request }) => {
  const phone = `557${Date.now().toString().slice(-7)}`;
  const reg = await request.post('http://127.0.0.1:5000/api/violet/auth/register', {
    data: { username: 'CatalogE2E', phone_no: phone, password: 'secret123' },
  });
  const { token } = await reg.json();
  await request.post('http://127.0.0.1:5000/api/violet/products', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      Product_Name: 'E2E Bowl',
      Product_Detail: 'Handmade test listing',
      Price: '19.99',
      category: 'Home',
    },
  });

  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: /catalog/i })).toBeVisible();
  const productLink = page.getByRole('link', { name: /view e2e bowl/i });
  await expect(productLink).toBeVisible({ timeout: 10000 });
  await productLink.click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Bowl' })).toBeVisible();
});
