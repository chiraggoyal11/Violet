const express = require('express');
const router = express.Router();
const Payout = require('../models/payout');
const Order = require('../models/order');
const user_jwt = require('../middleware/user_jwt');
const User = require('../models/user');

router.get('/mine', user_jwt, async (req, res) => {
  try {
    const sales = await Order.find({
      'items.seller_id': req.user.id,
      paymentStatus: 'paid',
      status: { $in: ['placed', 'shipped', 'delivered'] },
    }).sort({ _id: -1 });

    let earned = 0;
    const unpaidOrderIds = [];
    for (const order of sales) {
      const mine = order.items.filter((i) => String(i.seller_id) === String(req.user.id));
      const line = mine.reduce((s, i) => s + (Number(i.Price) || 0) * i.quantity, 0);
      earned += line;
      unpaidOrderIds.push(String(order._id));
    }

    const payouts = await Payout.find({ seller_id: req.user.id }).sort({ _id: -1 }).limit(50);
    const paidOut = payouts
      .filter((p) => p.status === 'paid' || p.status === 'processing')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const available = Math.max(0, Number((earned - paidOut).toFixed(2)));

    return res.status(200).json({
      success: true,
      balance: {
        earned: earned.toFixed(2),
        paidOut: paidOut.toFixed(2),
        available: available.toFixed(2),
        currency: 'INR',
      },
      payouts,
      eligibleOrderIds: unpaidOrderIds.slice(0, 20),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load payouts' });
  }
});

router.post('/request', user_jwt, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 100) {
      return res.status(400).json({
        success: false,
        msg: 'Minimum payout request is ₹100',
      });
    }
    const sales = await Order.find({
      'items.seller_id': req.user.id,
      paymentStatus: 'paid',
    });
    let earned = 0;
    for (const order of sales) {
      earned += order.items
        .filter((i) => String(i.seller_id) === String(req.user.id))
        .reduce((s, i) => s + (Number(i.Price) || 0) * i.quantity, 0);
    }
    const prior = await Payout.find({
      seller_id: req.user.id,
      status: { $in: ['pending', 'processing', 'paid'] },
    });
    const reserved = prior.reduce((s, p) => s + Number(p.amount || 0), 0);
    const available = earned - reserved;
    if (amount > available + 0.001) {
      return res.status(400).json({
        success: false,
        msg: `Available balance is ₹${available.toFixed(2)}`,
      });
    }
    const payout = await Payout.create({
      seller_id: req.user.id,
      amount,
      note: String(req.body.note || '').trim(),
      status: 'pending',
    });
    return res.status(200).json({ success: true, payout });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not request payout' });
  }
});

router.patch('/:id/status', user_jwt, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('role');
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ success: false, msg: 'Admin only' });
    }
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, msg: 'Payout not found' });
    const status = String(req.body.status || '');
    if (!['pending', 'processing', 'paid', 'failed'].includes(status)) {
      return res.status(400).json({ success: false, msg: 'Invalid status' });
    }
    payout.status = status;
    if (status === 'paid') payout.paidAt = new Date();
    await payout.save();
    return res.status(200).json({ success: true, payout });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not update payout' });
  }
});

module.exports = router;
