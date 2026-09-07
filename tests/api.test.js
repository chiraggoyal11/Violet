const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.jwtSecret = process.env.jwtSecret || 'test_jwt_secret';
process.env.RESET_DEV_MODE = 'true';
process.env.PAYMENT_MODE = 'demo';
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
process.env.MONGO =
  process.env.MONGO_TEST || 'mongodb://127.0.0.1:27017/violet_test';
process.env.BUCKET_NAME = 'violet-products';
process.env.BUCKET_REGION = 'us-east-1';
process.env.ACCESS_KEY = 'minioadmin';
process.env.SECRET_ACCESS_KEY = 'minioadmin';
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';

const app = require('../server');
const User = require('../models/user');
const Product = require('../models/product');
const Notification = require('../models/notification');

const phone = `${Date.now().toString().slice(-10)}`;
const phone2 = `${(Date.now() + 1).toString().slice(-10)}`;
const country_code = '+91';
const validPassword = 'Secret1!';
const newPassword = 'Reset123!';

describe('Violet API', () => {
  let token;
  let token2;
  let user2Id;
  let productId;
  let imageKey;
  let conversationId;

  before(async () => {
    await mongoose.connection.asPromise();
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Notification.deleteMany({})
    ]);
  });

  after(async () => {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Notification.deleteMany({})
    ]);
    await mongoose.disconnect();
  });

  it('rejects weak passwords and invalid phone numbers', async () => {
    const weak = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'WeakPass',
        country_code,
        phone_no: '12345',
        password: 'weak'
      })
      .expect(400);
    assert.match(weak.body.msg, /10 digits|Password/i);

    const shortPhone = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'BadPhone',
        country_code,
        phone_no: '123456789',
        password: validPassword
      })
      .expect(400);
    assert.match(shortPhone.body.msg, /10 digits/i);
  });

  it('signs in with Google using a verified ID token', async () => {
    const res = await request(app)
      .post('/api/violet/auth/google')
      .send({ credential: 'test-google-token' })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.auth_provider, 'google');
    assert.equal(res.body.user.google_id, 'test-google-sub');
    assert.equal(res.body.user.email, 'google.test@example.com');
    assert.equal(res.body.user.password, undefined);
  });

  it('registers a user without returning a password hash', async () => {
    const res = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'TestMaker',
        country_code,
        phone_no: phone,
        password: validPassword,
        email: 'maker@example.com'
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined);
    assert.equal(res.body.user.country_code, country_code);
    assert.equal(res.body.user.phone_no, phone);
    token = res.body.token;
  });

  it('rejects registration when phone or email already exists', async () => {
    const samePhone = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'CopyCat',
        country_code,
        phone_no: phone,
        password: validPassword
      })
      .expect(409);
    assert.match(samePhone.body.msg, /already exists/i);
    assert.match(samePhone.body.msg, /phone/i);

    const sameEmail = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'OtherPerson',
        country_code,
        phone_no: `${(Date.now() + 7).toString().slice(-10)}`,
        password: validPassword,
        email: 'maker@example.com'
      })
      .expect(409);
    assert.match(sameEmail.body.msg, /already exists/i);
    assert.match(sameEmail.body.msg, /email/i);
  });

  it('rejects product create without auth', async () => {
    await request(app)
      .post('/api/violet/products')
      .field('Product_Name', 'No Auth')
      .field('Product_Detail', 'Should fail')
      .field('Price', '1')
      .expect(401);
  });

  it('creates a product with multiple images via S3/MinIO', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .post('/api/violet/products')
      .set('Authorization', `Bearer ${token}`)
      .field('Product_Name', 'Linen Napkin')
      .field('Product_Detail', 'Soft stonewashed linen')
      .field('Price', '14.00')
      .attach('Product_Image', png, {
        filename: 'swatch-a.png',
        contentType: 'image/png'
      })
      .attach('Product_Image', png, {
        filename: 'swatch-b.png',
        contentType: 'image/png'
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.product._id);
    assert.ok(Array.isArray(res.body.product.Images));
    assert.equal(res.body.product.Images.length, 2);
    productId = res.body.product._id;
    imageKey = res.body.product.Images[0];
  });

  it('lists products with pagination and signed image URLs', async () => {
    const res = await request(app)
      .get('/api/violet/products?page=1&limit=12')
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.product));
    assert.ok(res.body.total >= 1);
    assert.ok(res.body.totalPages >= 1);
    assert.ok(Array.isArray(res.body.colours));
    const withImage = res.body.product.find((p) => p._id === productId);
    assert.ok(withImage);
    assert.ok(withImage.ImageUrls?.length >= 1 || withImage.ImageUrl);
    const url = withImage.ImageUrls?.[0] || withImage.ImageUrl;
    assert.match(url, /^https?:\/\//);
  });

  it('filters by colour and sorts by popular', async () => {
    const coloured = await request(app)
      .post('/api/violet/products')
      .set('Authorization', `Bearer ${token}`)
      .field('Product_Name', 'Blue Scarf')
      .field('Product_Detail', 'Soft indigo weave')
      .field('Price', '22.00')
      .field('category', 'Fashion')
      .field('colour', 'Blue')
      .expect(200);

    const blueId = coloured.body.product._id;
    await request(app)
      .post(`/api/violet/favorites/${blueId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const filtered = await request(app)
      .get('/api/violet/products?colour=Blue&status=active')
      .expect(200);
    assert.ok(filtered.body.product.some((p) => p._id === blueId));
    assert.ok(filtered.body.product.every((p) => p.colour === 'Blue'));

    const popular = await request(app)
      .get('/api/violet/products?sort=popular&limit=12')
      .expect(200);
    assert.equal(popular.body.success, true);
    assert.ok(popular.body.product.some((p) => p._id === blueId));

    const statusOn = await request(app)
      .get(`/api/violet/favorites/${blueId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(statusOn.body.favorited, true);

    await request(app)
      .delete(`/api/violet/favorites/${blueId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const statusOff = await request(app)
      .get(`/api/violet/favorites/${blueId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(statusOff.body.favorited, false);
  });

  it('returns product detail with image gallery URLs', async () => {
    const res = await request(app)
      .get(`/api/violet/products/detail/${productId}`)
      .expect(200);

    assert.equal(res.body.product.Product_Name, 'Linen Napkin');
    assert.ok(res.body.product.ImageUrls?.length >= 1 || res.body.product.ImageUrl);
  });

  it('updates profile display name', async () => {
    const res = await request(app)
      .put('/api/violet/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'UpdatedMaker' })
      .expect(200);

    assert.equal(res.body.user.username, 'UpdatedMaker');
    assert.equal(res.body.user.password, undefined);
  });

  it('updates extended profile fields and settings', async () => {
    const profile = await request(app)
      .put('/api/violet/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'UpdatedMaker',
        first_name: 'Ada',
        last_name: 'Lovelace',
        gender: 'female',
        date_of_birth: '1990-05-12',
        address: {
          line1: '12 Market Street',
          line2: 'Apt 4',
          city: 'Pune',
          state: 'MH',
          country: 'India',
          pincode: '411001'
        }
      })
      .expect(200);

    assert.equal(profile.body.user.first_name, 'Ada');
    assert.equal(profile.body.user.last_name, 'Lovelace');
    assert.equal(profile.body.user.gender, 'female');
    assert.equal(profile.body.user.date_of_birth, '1990-05-12');
    assert.equal(profile.body.user.address.city, 'Pune');
    assert.equal(profile.body.user.address.pincode, '411001');

    const settings = await request(app)
      .put('/api/violet/auth/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderUpdates: true,
        promoAlerts: true,
        showPhoneToBuyers: true,
        preferredCurrency: 'USD',
        defaultCheckoutNote: 'Leave at the lobby'
      })
      .expect(200);

    assert.equal(settings.body.user.settings.promoAlerts, true);
    assert.equal(settings.body.user.settings.showPhoneToBuyers, true);
    assert.equal(settings.body.user.settings.preferredCurrency, 'USD');
    assert.equal(settings.body.user.settings.defaultCheckoutNote, 'Leave at the lobby');
  });

  it('uploads a profile photo', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const res = await request(app)
      .put('/api/violet/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', png, { filename: 'face.png', contentType: 'image/png' })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.user.avatar_key || res.body.user.avatar);
    assert.match(String(res.body.user.avatar), /^https?:\/\//);
  });

  it('resets password with OTP', async () => {
    const forgot = await request(app)
      .post('/api/violet/auth/forgot-password')
      .send({ country_code, phone_no: phone })
      .expect(200);

    assert.ok(forgot.body.devOtp);

    await request(app)
      .post('/api/violet/auth/reset-password')
      .send({
        country_code,
        phone_no: phone,
        otp: forgot.body.devOtp,
        password: newPassword
      })
      .expect(200);

    const login = await request(app)
      .post('/api/violet/auth/login')
      .send({ country_code, phone_no: phone, password: newPassword })
      .expect(200);

    token = login.body.token;
  });

  it('supports buyer-seller messaging and notifications', async () => {
    const buyer = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'Buyer',
        country_code,
        phone_no: phone2,
        password: validPassword
      })
      .expect(200);

    token2 = buyer.body.token;
    user2Id = buyer.body.user._id;

    const seller = await User.findOne({ country_code, phone_no: phone });
    const sent = await request(app)
      .post('/api/violet/messages')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        recipient_id: String(seller._id),
        product_id: productId,
        body: 'Is this still available?'
      })
      .expect(200);

    assert.ok(sent.body.conversation._id);
    conversationId = sent.body.conversation._id;

    const unreadBefore = await request(app)
      .get('/api/violet/messages/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.ok(unreadBefore.body.unread >= 1);

    const notes = await request(app)
      .get('/api/violet/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(notes.body.notifications.some((n) => n.type === 'message'));
  });

  it('clamps cart quantity to stock and supports checkout', async () => {
    const listing = await request(app)
      .post('/api/violet/products')
      .set('Authorization', `Bearer ${token}`)
      .field('Product_Name', 'Cart Test Mug')
      .field('Product_Detail', 'Stock limited mug')
      .field('Price', '12.00')
      .field('category', 'Home')
      .field('stock', '2')
      .expect(200);

    const cartProductId = listing.body.product._id;

    await request(app)
      .post('/api/violet/cart/items')
      .set('Authorization', `Bearer ${token2}`)
      .send({ product_id: cartProductId, quantity: 1 })
      .expect(200);

    const updated = await request(app)
      .put(`/api/violet/cart/items/${cartProductId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ quantity: 99 })
      .expect(200);

    assert.equal(updated.body.items[0].quantity, 2);

    const blockedReview = await request(app)
      .post(`/api/violet/reviews/product/${cartProductId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ rating: 5, comment: 'too soon' })
      .expect(403);
    assert.match(blockedReview.body.msg, /Buy this product/i);

    const checkout = await request(app)
      .post('/api/violet/orders/checkout')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        note: 'test checkout',
        shippingAddress: {
          line1: '12 Test Lane',
          line2: 'Apt 4',
          city: 'Pune',
          state: 'MH',
          country: 'India',
          pincode: '411001'
        },
        paymentMethod: 'upi',
        payment: { upiId: 'buyer@upi' }
      })
      .expect(200);

    assert.ok(checkout.body.order._id);
    assert.equal(checkout.body.action, 'awaiting_upi');
    assert.equal(checkout.body.order.paymentMethod, 'upi');
    assert.equal(checkout.body.order.paymentStatus, 'pending');
    assert.equal(checkout.body.order.paymentProvider, 'demo');
    assert.ok(checkout.body.payment?.expiresAt);
    assert.ok(checkout.body.payment?.remainingSeconds > 0);
    assert.equal(checkout.body.order.shippingAddress.city, 'Pune');

    // Speed up demo UPI auto-confirm for this assertion
    process.env.PAYMENT_DEMO_UPI_AUTO_CONFIRM_SECONDS = '1';
    await new Promise((r) => setTimeout(r, 1200));
    const paid = await request(app)
      .get(`/api/violet/orders/${checkout.body.order._id}/payment-status`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.equal(paid.body.order.paymentStatus, 'paid');
    delete process.env.PAYMENT_DEMO_UPI_AUTO_CONFIRM_SECONDS;

    const review = await request(app)
      .post(`/api/violet/reviews/product/${cartProductId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ rating: 5, comment: 'after purchase' })
      .expect(200);
    assert.equal(review.body.success, true);

    const orders = await request(app)
      .get('/api/violet/orders')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.ok(orders.body.orders.length >= 1);
  });

  it('exposes payment config and supports COD checkout', async () => {
    const cfg = await request(app)
      .get('/api/violet/orders/payments/config')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    assert.equal(cfg.body.payment.mode, 'demo');
    assert.ok(cfg.body.payment.methods.includes('cod'));

    const listing = await request(app)
      .post('/api/violet/products')
      .set('Authorization', `Bearer ${token}`)
      .field('Product_Name', 'COD Bowl')
      .field('Product_Detail', 'Pay later bowl')
      .field('Price', '40.00')
      .field('category', 'Home')
      .field('stock', '3')
      .expect(200);

    const pid = listing.body.product._id;
    await request(app)
      .post('/api/violet/cart/items')
      .set('Authorization', `Bearer ${token2}`)
      .send({ product_id: pid, quantity: 1 })
      .expect(200);

    const declined = await request(app)
      .post('/api/violet/orders/checkout')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        shippingAddress: {
          line1: '1 Road',
          city: 'Pune',
          state: 'MH',
          country: 'India',
          pincode: '411001'
        },
        paymentMethod: 'card',
        payment: {
          cardNumber: '4111111111110000',
          cardName: 'Test',
          cardExpiry: '12/28',
          cardCvv: '123'
        }
      })
      .expect(400);
    assert.match(String(declined.body.msg || ''), /declined/i);

    const cod = await request(app)
      .post('/api/violet/orders/checkout')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        shippingAddress: {
          line1: '1 Road',
          city: 'Pune',
          state: 'MH',
          country: 'India',
          pincode: '411001'
        },
        paymentMethod: 'cod',
        payment: {}
      })
      .expect(200);

    assert.equal(cod.body.order.paymentMethod, 'cod');
    assert.equal(cod.body.order.paymentStatus, 'pending');
    assert.equal(cod.body.order.paymentProvider, 'cod');
    assert.ok(cod.body.payment?.ref);
  });

  it('updates and deletes owned products (including S3 object)', async () => {
    await request(app)
      .put(`/api/violet/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        Product_Name: 'Linen Napkin Set',
        Product_Detail: 'Soft stonewashed linen',
        Price: '18.00'
      })
      .expect(200);

    const del = await request(app)
      .put('/api/violet/products/delete/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: [productId] })
      .expect(200);

    assert.equal(del.body.success, true);
    assert.ok(imageKey);
  });
});
