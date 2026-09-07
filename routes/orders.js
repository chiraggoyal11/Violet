const express = require('express');
const router = express.Router();
const Cart = require('../models/cart');
const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const user_jwt = require('../middleware/user_jwt');
const { notifyUser } = require('../utils/notifications');

function normalizeAddress(input = {}) {
  return {
    line1: String(input.line1 || '').trim(),
    line2: String(input.line2 || '').trim(),
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim(),
    country: String(input.country || '').trim(),
    pincode: String(input.pincode || '').trim()
  };
}

function addressValid(address) {
  return Boolean(
    address.line1 &&
      address.city &&
      address.state &&
      address.country &&
      address.pincode
  );
}

function validatePayment(method, payment = {}) {
  const m = String(method || '').toLowerCase();
  if (m !== 'card' && m !== 'upi') {
    return { ok: false, msg: 'Choose Card or UPI payment' };
  }

  if (m === 'upi') {
    const vpa = String(payment.upiId || '').trim().toLowerCase();
    if (!/^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i.test(vpa)) {
      return { ok: false, msg: 'Enter a valid UPI ID (example: name@upi)' };
    }
    return { ok: true, method: 'upi', detail: vpa };
  }

  const number = String(payment.cardNumber || '').replace(/\s+/g, '');
  const name = String(payment.cardName || '').trim();
  const expiry = String(payment.cardExpiry || '').trim();
  const cvv = String(payment.cardCvv || '').trim();
  if (!/^\d{13,19}$/.test(number)) {
    return { ok: false, msg: 'Enter a valid card number' };
  }
  if (!name || name.length < 2) {
    return { ok: false, msg: 'Enter the name on the card' };
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    return { ok: false, msg: 'Enter expiry as MM/YY' };
  }
  if (!/^\d{3,4}$/.test(cvv)) {
    return { ok: false, msg: 'Enter a valid CVV' };
  }
  return {
    ok: true,
    method: 'card',
    detail: `•••• ${number.slice(-4)}`
  };
}

router.get('/', user_jwt, async (req, res) => {
  try {
    const orders = await Order.find({ buyer_id: req.user.id }).sort({ _id: -1 });
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load orders' });
  }
});

router.get('/sales', user_jwt, async (req, res) => {
  try {
    const orders = await Order.find({ 'items.seller_id': req.user.id }).sort({ _id: -1 });
    const sales = orders.map((o) => ({
      _id: o._id,
      createdAt: o.createdAt,
      status: o.status,
      items: o.items.filter((i) => String(i.seller_id) === String(req.user.id)),
      total: o.items
        .filter((i) => String(i.seller_id) === String(req.user.id))
        .reduce((s, i) => s + (Number(i.Price) || 0) * i.quantity, 0)
        .toFixed(2)
    }));
    return res.status(200).json({ success: true, sales });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load sales' });
  }
});

router.post('/checkout', user_jwt, async (req, res) => {
  try {
    const note = (req.body.note || '').trim();
    const shippingAddress = normalizeAddress(req.body.shippingAddress || req.body.address);
    const paymentMethod = String(req.body.paymentMethod || '').toLowerCase();
    const payment = req.body.payment || {};

    if (!addressValid(shippingAddress)) {
      return res.status(400).json({
        success: false,
        msg: 'Shipping address needs line 1, city, state, country, and pincode'
      });
    }

    const payCheck = validatePayment(paymentMethod, payment);
    if (!payCheck.ok) {
      return res.status(400).json({ success: false, msg: payCheck.msg });
    }

    const cart = await Cart.findOne({ user_id: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, msg: 'Cart is empty' });
    }

    const orderItems = [];
    let total = 0;

    for (const item of cart.items) {
      const product = await Product.findOneAndUpdate(
        {
          _id: item.product_id,
          status: 'active',
          stock: { $gte: item.quantity },
          user_id: { $ne: req.user.id }
        },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!product) {
        const existing = await Product.findById(item.product_id);
        if (existing && String(existing.user_id) === String(req.user.id)) {
          return res.status(400).json({
            success: false,
            msg: 'You cannot buy your own listing'
          });
        }
        return res.status(400).json({
          success: false,
          msg: `Product unavailable: ${existing?.Product_Name || item.product_id}`
        });
      }

      if (product.stock === 0) {
        product.status = 'sold';
        await product.save();
      }

      const line = (Number(product.Price) || 0) * item.quantity;
      total += line;
      orderItems.push({
        product_id: String(product._id),
        Product_Name: product.Product_Name,
        Price: product.Price,
        quantity: item.quantity,
        seller_id: product.user_id
      });
    }

    // Free demo payment confirmation (no merchant keys required).
    // Swap this block for Razorpay/PhonePe when live keys are configured.
    const paymentRef = `demo_${payCheck.method}_${Date.now().toString(36)}`;

    const order = await Order.create({
      buyer_id: req.user.id,
      items: orderItems,
      total: total.toFixed(2),
      note,
      shippingAddress,
      paymentMethod: payCheck.method,
      paymentStatus: 'paid',
      paymentRef,
      paymentProvider: 'demo'
    });

    cart.items = [];
    await cart.save();

    const sellerIds = [...new Set(orderItems.map((i) => String(i.seller_id)))];
    const buyer = await User.findById(req.user.id).select('username');
    await Promise.all(
      sellerIds.map((sellerId) =>
        notifyUser({
          user_id: sellerId,
          type: 'order',
          title: 'New order received',
          body: `${buyer?.username || 'A buyer'} ordered ${orderItems
            .filter((i) => String(i.seller_id) === sellerId)
            .map((i) => i.Product_Name)
            .join(', ')}`,
          link: '/seller'
        })
      )
    );

    return res.status(200).json({
      success: true,
      msg: 'Order placed',
      order,
      payment: {
        status: 'paid',
        method: payCheck.method,
        detail: payCheck.detail,
        provider: 'demo',
        ref: paymentRef
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Checkout failed' });
  }
});

module.exports = router;
