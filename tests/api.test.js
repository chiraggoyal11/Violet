const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.jwtSecret = process.env.jwtSecret || 'test_jwt_secret';
process.env.RESET_DEV_MODE = 'true';
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

  it('registers a user without returning a password hash', async () => {
    const res = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'TestMaker',
        country_code,
        phone_no: phone,
        password: validPassword
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined);
    assert.equal(res.body.user.country_code, country_code);
    assert.equal(res.body.user.phone_no, phone);
    token = res.body.token;
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
    const withImage = res.body.product.find((p) => p._id === productId);
    assert.ok(withImage);
    assert.ok(withImage.ImageUrls?.length >= 1 || withImage.ImageUrl);
    const url = withImage.ImageUrls?.[0] || withImage.ImageUrl;
    assert.match(url, /^https?:\/\//);
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

    const notes = await request(app)
      .get('/api/violet/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(notes.body.notifications.some((n) => n.type === 'message'));
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
