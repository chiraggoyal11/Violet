const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');

process.env.jwtSecret = process.env.jwtSecret || 'test_jwt_secret';
process.env.RESET_DEV_MODE = 'true';
process.env.PAYMENT_MODE = 'demo';
process.env.MONGO = process.env.MONGO_TEST || 'mongodb://127.0.0.1:27017/violet_features_test';

const app = require('../server');
const User = require('../models/user');
const Product = require('../models/product');
const Coupon = require('../models/coupon');
const Order = require('../models/order');

describe('marketplace feature APIs', () => {
  let token;
  let userId;
  let productId;
  const phone = `${Date.now().toString().slice(-10)}`;

  before(async () => {
    await mongoose.connection.asPromise();
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Coupon.deleteMany({}),
      Order.deleteMany({}),
    ]);

    const reg = await request(app)
      .post('/api/violet/auth/register')
      .send({
        username: 'FeatureMaker',
        country_code: '+91',
        phone_no: phone,
        password: 'Secret1!',
        email: `feature${phone}@example.com`,
      })
      .expect(200);
    token = reg.body.token;
    userId = reg.body.user._id;

    await User.findByIdAndUpdate(userId, {
      role: 'admin',
      bio: 'Handmade studio',
      shopName: 'Feature Shop',
    });

    const listing = await request(app)
      .post('/api/violet/products')
      .set('Authorization', `Bearer ${token}`)
      .field('Product_Name', 'Feature Mug')
      .field('Product_Detail', 'Ceramic test mug')
      .field('Price', '20.00')
      .field('category', 'Home & Living')
      .field('stock', '5')
      .expect(200);
    productId = listing.body.product._id;
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('exposes new health features', async () => {
    const res = await request(app).get('/api/violet/health').expect(200);
    assert.ok(res.body.features.includes('order-tracking'));
    assert.ok(res.body.features.includes('guest-checkout'));
    assert.ok(res.body.features.includes('realtime-messaging'));
  });

  it('loads a seller shop page', async () => {
    const res = await request(app).get('/api/violet/shops/FeatureMaker').expect(200);
    assert.equal(res.body.shop.shopName, 'Feature Shop');
    assert.ok(res.body.products.some((p) => p._id === productId || String(p._id) === String(productId)));
  });

  it('validates coupons and guest sessions', async () => {
    await Coupon.create({
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
      active: true,
    });
    const guestPhone = `${(Date.now() + 3).toString().slice(-10)}`;
    const guest = await request(app)
      .post('/api/violet/guest/session')
      .send({
        email: `guest${guestPhone}@example.com`,
        phone_no: guestPhone,
        country_code: '+91',
        line1: '1 Guest Rd',
        city: 'Pune',
        state: 'MH',
        country: 'India',
        pincode: '411001',
      })
      .expect(200);
    assert.ok(guest.body.token);
    assert.equal(guest.body.user.isGuest, true);

    const coupon = await request(app)
      .post('/api/violet/coupons/validate')
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({ code: 'WELCOME10', subtotal: 100 })
      .expect(200);
    assert.equal(coupon.body.discount, '10.00');
  });

  it('supports wishlist share and currency rates', async () => {
    await request(app)
      .post('/api/violet/wishlists/mine/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: productId })
      .expect(200);
    const mine = await request(app)
      .get('/api/violet/wishlists/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.ok(mine.body.shareUrl);
    const tokenPart = mine.body.wishlist.shareToken;
    const shared = await request(app)
      .get(`/api/violet/wishlists/shared/${tokenPart}`)
      .expect(200);
    assert.ok(shared.body.products.length >= 1);

    const rates = await request(app).get('/api/violet/platform/rates').expect(200);
    assert.equal(rates.body.base, 'INR');
    assert.ok(rates.body.rates.USD);
  });

  it('admin overview works for admin role', async () => {
    const res = await request(app)
      .get('/api/violet/admin/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.ok(res.body.overview.users >= 1);
  });
});
