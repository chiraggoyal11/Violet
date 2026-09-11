/**
 * Smoke test the Expo web build of Violet mobile against a running Metro server.
 * Usage: node mobile/scripts/smoke-web.mjs
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
  return file;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      console.log('console', msg.type(), msg.text().slice(0, 200));
    }
  });
  page.on('pageerror', (err) => console.log('pageerror', err.message));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await shot(page, 'expo-01-login.png');

  // RN Web TextInputs often lack labels; fill by placeholder
  const phone = page.getByPlaceholder('Phone number');
  const password = page.getByPlaceholder('Password');
  await phone.waitFor({ timeout: 30000 });
  await phone.fill(PHONE);
  await password.fill(PASS);
  await shot(page, 'expo-02-login-filled.png');

  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForTimeout(2500);

  // Shop should show
  const shopTitle = page.getByText('Shop', { exact: true }).first();
  await shopTitle.waitFor({ timeout: 30000 });
  await shot(page, 'expo-03-shop.png');

  // Open first product card — look for price-ish or product names
  // ProductCard shows Product_Name; click first card area with ₹
  const price = page.getByText(/₹/).first();
  await price.click();
  await page.waitForTimeout(1500);
  await shot(page, 'expo-04-product.png');

  const add = page.getByText('Add to cart');
  if (await add.count()) {
    // Handle native alert via dialog
    page.once('dialog', async (dialog) => {
      console.log('dialog', dialog.message());
      await dialog.accept();
    });
    await add.click();
    await page.waitForTimeout(1500);
  }

  // Cart tab
  await page.getByText('Cart', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  await shot(page, 'expo-05-cart.png');

  const checkoutBtn = page.getByText('Checkout', { exact: true });
  if (await checkoutBtn.count()) {
    await checkoutBtn.click();
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Address line 1').fill('12 Mobile Lane');
    await page.getByPlaceholder('City', { exact: true }).fill('Mumbai');
    await page.getByPlaceholder('State', { exact: true }).fill('MH');
    await page.getByPlaceholder('Country').fill('India');
    await page.getByPlaceholder(/Pincode/).fill('400001');
    await shot(page, 'expo-06-checkout.png');
    page.once('dialog', async (dialog) => {
      console.log('dialog', dialog.message());
      await dialog.accept();
    });
    await page.getByText('Place COD order').click();
    await page.waitForTimeout(2500);
  }

  await page.getByText('Orders', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  await shot(page, 'expo-07-orders.png');

  await page.getByText('Profile', { exact: true }).last().click();
  await page.waitForTimeout(1000);
  await shot(page, 'expo-08-profile.png');

  await page.getByText('Messages', { exact: true }).last().click();
  await page.waitForTimeout(1000);
  await shot(page, 'expo-09-messages.png');

  console.log('SMOKE_WEB_OK');
  await browser.close();
})().catch(async (err) => {
  console.error('SMOKE_WEB_FAIL', err);
  process.exit(1);
});
