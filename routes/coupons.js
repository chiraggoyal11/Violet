const express = require('express');
const router = express.Router();
const Coupon = require('../models/coupon');
const user_jwt = require('../middleware/user_jwt');
const User = require('../models/user');

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('role suspended');
    if (!user || user.suspended || user.role !== 'admin') {
      return res.status(403).json({ success: false, msg: 'Admin only' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, msg: 'Auth failed' });
  }
}

function calcDiscount(coupon, subtotal) {
  const total = Number(subtotal) || 0;
  if (total < (coupon.minOrder || 0)) {
    return { ok: false, msg: `Minimum order is ${coupon.minOrder}` };
  }
  let discount = 0;
  if (coupon.type === 'percent') {
    discount = (total * Number(coupon.value)) / 100;
  } else {
    discount = Number(coupon.value);
  }
  discount = Math.min(discount, total);
  return {
    ok: true,
    discount: Number(discount.toFixed(2)),
    total: Number((total - discount).toFixed(2)),
  };
}

router.post('/validate', user_jwt, async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const subtotal = Number(req.body.subtotal || 0);
    if (!code) return res.status(400).json({ success: false, msg: 'Enter a coupon code' });
    const coupon = await Coupon.findOne({ code, active: true });
    if (!coupon) return res.status(404).json({ success: false, msg: 'Coupon not found' });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return res.status(400).json({ success: false, msg: 'Coupon expired' });
    }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ success: false, msg: 'Coupon fully redeemed' });
    }
    const result = calcDiscount(coupon, subtotal);
    if (!result.ok) return res.status(400).json({ success: false, msg: result.msg });
    return res.status(200).json({
      success: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
      discount: result.discount.toFixed(2),
      total: result.total.toFixed(2),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not validate coupon' });
  }
});

router.get('/', user_jwt, requireAdmin, async (req, res) => {
  const coupons = await Coupon.find().sort({ _id: -1 }).limit(100);
  return res.status(200).json({ success: true, coupons });
});

router.post('/', user_jwt, requireAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.create({
      code: String(req.body.code || '').trim().toUpperCase(),
      type: req.body.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(req.body.value) || 0,
      minOrder: Number(req.body.minOrder) || 0,
      maxUses: Number(req.body.maxUses) || 0,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      createdBy: req.user.id,
      active: req.body.active !== false,
    });
    return res.status(200).json({ success: true, coupon });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, msg: error.message || 'Could not create coupon' });
  }
});

module.exports = router;
module.exports.calcDiscount = calcDiscount;
