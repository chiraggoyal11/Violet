const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Product = require('../models/product');
const Order = require('../models/order');
const Report = require('../models/report');
const Coupon = require('../models/coupon');
const Review = require('../models/review');
const user_jwt = require('../middleware/user_jwt');

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('role suspended');
    if (!user || user.suspended || user.role !== 'admin') {
      return res.status(403).json({ success: false, msg: 'Admin only' });
    }
    req.admin = user;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, msg: 'Auth failed' });
  }
}

router.use(user_jwt, requireAdmin);

router.get('/overview', async (req, res) => {
  try {
    const [users, products, orders, openReports, coupons] = await Promise.all([
      User.countDocuments({}),
      Product.countDocuments({ status: { $ne: 'deleted' } }),
      Order.countDocuments({}),
      Report.countDocuments({ status: 'open' }),
      Coupon.countDocuments({ active: true }),
    ]);
    return res.status(200).json({
      success: true,
      overview: { users, products, orders, openReports, coupons },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load overview' });
  }
});

router.get('/reports', async (req, res) => {
  const reports = await Report.find().sort({ _id: -1 }).limit(100);
  return res.status(200).json({ success: true, reports });
});

router.patch('/reports/:id', async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ success: false, msg: 'Report not found' });
  if (req.body.status) report.status = req.body.status;
  if (typeof req.body.adminNote === 'string') report.adminNote = req.body.adminNote;
  await report.save();
  return res.status(200).json({ success: true, report });
});

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = q
    ? {
        $or: [
          { username: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') },
          { phone_no: new RegExp(q, 'i') },
        ],
      }
    : {};
  const users = await User.find(filter)
    .select('username email phone_no role suspended createdAt isGuest')
    .sort({ _id: -1 })
    .limit(50);
  return res.status(200).json({ success: true, users });
});

router.patch('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
  if (typeof req.body.suspended === 'boolean') user.suspended = req.body.suspended;
  if (req.body.role === 'admin' || req.body.role === 'user') user.role = req.body.role;
  await user.save();
  return res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      role: user.role,
      suspended: user.suspended,
    },
  });
});

router.patch('/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, msg: 'Product not found' });
  if (req.body.status === 'deleted' || req.body.status === 'active' || req.body.status === 'sold') {
    product.status = req.body.status;
    if (req.body.status === 'deleted') product.deletedAt = new Date();
  }
  await product.save();
  return res.status(200).json({ success: true, product });
});

router.delete('/reviews/:id', async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  return res.status(200).json({ success: true, msg: 'Review removed' });
});

module.exports = router;
