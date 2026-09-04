import { test, expect } from '@playwright/test';

const phone = `${Date.now().toString().slice(-10)}`;
const validPassword = 'Secret1!';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /handmade/i })).toBeVisible();
});

test('register, browse catalog, and open password reset', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('E2E User');
  await page.getByLabel('Country code').selectOption('+91');
  await page.getByLabel('Phone number').fill(phone);
  await page.getByLabel('Password', { exact: true }).fill(validPassword);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/sell/);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: /^home$/i })).toBeVisible();

  await page.goto('/forgot-password');
  await page.getByLabel('Country code').selectOption('+91');
  await page.getByLabel('Phone number').fill(phone);
  await page.getByRole('button', { name: /send reset code/i }).click();
  await expect(page.locator('.status.ok').first()).toBeVisible();
});

test('catalog product opens detail page', async ({ page, request }) => {
  const catalogPhone = `${(Date.now() + 2).toString().slice(-10)}`;
  const productName = `E2E Bowl ${Date.now()}`;
  const reg = await request.post('http://127.0.0.1:5000/api/violet/auth/register', {
    data: {
      username: 'CatalogE2E',
      country_code: '+91',
      phone_no: catalogPhone,
      password: validPassword,
    },
  });
  const { token } = await reg.json();
  await request.post('http://127.0.0.1:5000/api/violet/products', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      Product_Name: productName,
      Product_Detail: 'Handmade test listing',
      Price: '19.99',
      category: 'Home',
    },
  });

  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: /^home$/i })).toBeVisible();
  const productLink = page.getByRole('link', { name: new RegExp(`view ${productName}`, 'i') }).first();
  await expect(productLink).toBeVisible({ timeout: 10000 });
  await productLink.click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByRole('heading', { level: 1, name: productName })).toBeVisible();
});

test('rejects weak password on register', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Weak User');
  await page.getByLabel('Phone number').fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill('weak');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.status.error').first()).toBeVisible();
});
