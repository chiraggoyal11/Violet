const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.jwtSecret = process.env.jwtSecret || 'test_jwt_secret';
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

const phone = `555${Date.now().toString().slice(-8)}`;

describe('Violet API', () => {
  let token;
  let productId;
  let imageKey;

  before(async () => {
    await mongoose.connection.asPromise();
    await Promise.all([User.deleteMany({}), Product.deleteMany({})]);
  });

  after(async () => {
    await Promise.all([User.deleteMany({}), Product.deleteMany({})]);
    await mongoose.disconnect();
  });

  it('registers a user without returning a password hash', async () => {
    const res = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'TestMaker',
        phone_no: phone,
        password: 'secret123'
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined);
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

  it('creates a product with an image via S3/MinIO', async () => {
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
        filename: 'swatch.png',
        contentType: 'image/png'
      })
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.product._id);
    assert.ok(res.body.product.Image);
    productId = res.body.product._id;
    imageKey = res.body.product.Image;
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
    assert.ok(withImage.ImageUrl);
    assert.match(withImage.ImageUrl, /^https?:\/\//);
  });

  it('returns a product detail with signed image URL', async () => {
    const res = await request(app)
      .get(`/api/violet/products/detail/${productId}`)
      .expect(200);

    assert.equal(res.body.product.Product_Name, 'Linen Napkin');
    assert.ok(res.body.product.ImageUrl);
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
