/**
 * Smoke-test Expo web with expanded feature surfaces.
 * Usage: node mobile/scripts/smoke-web.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.EXPO_WEB_URL || 'http://127.0.0.1:8081';
const OUT = '/opt/cursor/artifacts';
const PHONE = process.env.SMOKE_PHONE || '9889067172';
const PASS = process.env.SMOKE_PASS || 'TestPass1!';

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('screenshot', file);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (err) => console.log('pageerror', err.message));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, 'full-01-login.png');

  // Login links present
  await page.getByText('Forgot password', { exact: false }).first().waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Phone number').fill(PHONE);
  await page.getByPlaceholder('Password').fill(PASS);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForTimeout(3000);

  await page.getByText('Shop', { exact: true }).first().waitFor({ timeout: 30000 });
  await shot(page, 'full-02-shop.png');

  // Open product
  await page.getByText(/₹/).first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'full-03-product.png');

  // Favorite / wishlist buttons if present
  for (const label of ['Favorite', 'Wishlist', 'Add to cart']) {
    const btn = page.getByText(label, { exact: false }).first();
    if (await btn.count()) {
      page.once('dialog', async (d) => d.accept().catch(() => {}));
      await btn.click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  await shot(page, 'full-04-product-actions.png');

  // Sell tab
  await page.getByText('Sell', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  await shot(page, 'full-05-sell.png');

  // Cart / checkout payment methods
  await page.getByText('Cart', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  await shot(page, 'full-06-cart.png');
  if (await page.getByText('Checkout', { exact: true }).count()) {
    await page.getByText('Checkout', { exact: true }).click();
    await page.waitForTimeout(1000);
    await shot(page, 'full-07-checkout.png');
    for (const method of ['UPI', 'Card', 'COD', 'Cash']) {
      const m = page.getByText(method, { exact: false }).first();
      if (await m.count()) {
        await m.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    await shot(page, 'full-08-checkout-methods.png');
  }

  // Orders
  await page.getByText('Orders', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  await shot(page, 'full-09-orders.png');

  // Account hub features
  await page.getByText('Account', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  await shot(page, 'full-10-account.png');

  for (const item of ['Favorites', 'Wishlist', 'Notifications', 'Settings', 'Offers', 'Messages', 'Seller dashboard']) {
    const row = page.getByText(item, { exact: false }).first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(1000);
      await shot(page, `full-account-${item.toLowerCase().replace(/\s+/g, '-')}.png`);
      // go back if header back exists
      const back = page.getByText('Account', { exact: true }).first();
      if (await page.getByLabel(/back/i).count()) {
        await page.getByLabel(/back/i).first().click().catch(() => {});
      } else if (await back.count()) {
        await page.getByText('Account', { exact: true }).last().click().catch(() => {});
      }
      await page.waitForTimeout(600);
    }
  }

  console.log('SMOKE_FULL_OK');
  await browser.close();
})().catch((err) => {
  console.error('SMOKE_FULL_FAIL', err);
  process.exit(1);
});
