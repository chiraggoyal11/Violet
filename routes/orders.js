const express = require('express');
const router = express.Router();
const Cart = require('../models/cart');
const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const user_jwt = require('../middleware/user_jwt');
const { notifyUser } = require('../utils/notifications');
const {
  getPublicConfig,
  processCheckoutPayment,
  verifyRazorpaySignature,
} = require('../services/payment');

function normalizeAddress(input = {}) {
  return {
    line1: String(input.line1 || '').trim(),
    line2: String(input.line2 || '').trim(),
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim(),
    country: String(input.country || '').trim(),
    pincode: String(input.pincode || '')
      .replace(/\D/g, '')
      .slice(0, 6),
  };
}

function addressValid(address) {
  return Boolean(
    address.line1 &&
      address.city &&
      address.state &&
      address.country &&
      /^\d{6}$/.test(address.pincode),
  );
}

async function reserveCartItems(cart, buyerId) {
  const orderItems = [];
  let total = 0;
  const reserved = [];

  for (const item of cart.items) {
    const product = await Product.findOneAndUpdate(
      {
        _id: item.product_id,
        status: 'active',
        stock: { $gte: item.quantity },
        user_id: { $ne: buyerId },
      },
      { $inc: { stock: -item.quantity } },
      { new: true },
    );

    if (!product) {
      // roll back already reserved
      for (const r of reserved) {
        await Product.findByIdAndUpdate(r.product_id, {
          $inc: { stock: r.quantity },
          $set: { status: 'active' },
        });
      }
      const existing = await Product.findById(item.product_id);
      if (existing && String(existing.user_id) === String(buyerId)) {
        return { ok: false, status: 400, msg: 'You cannot buy your own listing' };
      }
      return {
        ok: false,
        status: 400,
        msg: `Product unavailable: ${existing?.Product_Name || item.product_id}`,
      };
    }

    if (product.stock === 0) {
      product.status = 'sold';
      await product.save();
    }

    reserved.push({ product_id: product._id, quantity: item.quantity });
    const line = (Number(product.Price) || 0) * item.quantity;
    total += line;
    orderItems.push({
      product_id: String(product._id),
      Product_Name: product.Product_Name,
      Price: product.Price,
      quantity: item.quantity,
      seller_id: product.user_id,
    });
  }

  return { ok: true, orderItems, total };
}

async function notifySellers(orderItems, buyerId) {
  const sellerIds = [...new Set(orderItems.map((i) => String(i.seller_id)))];
  const buyer = await User.findById(buyerId).select('username');
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
        link: '/seller',
      }),
    ),
  );
}

router.get('/payments/config', user_jwt, (req, res) => {
  return res.status(200).json({ success: true, payment: getPublicConfig() });
});

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
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      items: o.items.filter((i) => String(i.seller_id) === String(req.user.id)),
      total: o.items
        .filter((i) => String(i.seller_id) === String(req.user.id))
        .reduce((s, i) => s + (Number(i.Price) || 0) * i.quantity, 0)
        .toFixed(2),
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
        msg: 'Shipping address needs line 1, city, state, country, and a 6-digit pincode',
      });
    }

    const cart = await Cart.findOne({ user_id: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, msg: 'Cart is empty' });
    }

    const reserved = await reserveCartItems(cart, req.user.id);
    if (!reserved.ok) {
      return res.status(reserved.status).json({ success: false, msg: reserved.msg });
    }

    const { orderItems, total } = reserved;
    const amount = total.toFixed(2);
    const receipt = `violet_${req.user.id.slice(-6)}_${Date.now().toString(36)}`;

    const payResult = await processCheckoutPayment({
      amount,
      method: paymentMethod,
      payment,
      receipt,
    });

    if (!payResult.ok) {
      // restore stock
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.product_id, {
          $inc: { stock: item.quantity },
          $set: { status: 'active' },
        });
      }
      return res.status(400).json({ success: false, msg: payResult.msg });
    }

    if (payResult.action === 'razorpay') {
      const order = await Order.create({
        buyer_id: req.user.id,
        items: orderItems,
        total: amount,
        note,
        shippingAddress,
        paymentMethod: payResult.payCheck.method,
        paymentStatus: 'pending',
        paymentRef: '',
        paymentProvider: 'razorpay',
        paymentDetail: payResult.payCheck.masked || '',
        razorpayOrderId: payResult.razorpayOrderId,
      });

      cart.items = [];
      await cart.save();

      return res.status(200).json({
        success: true,
        msg: 'Payment required',
        action: 'razorpay',
        order,
        razorpay: {
          keyId: payResult.keyId,
          orderId: payResult.razorpayOrderId,
          amount: payResult.amount,
          currency: payResult.currency,
          name: 'Violet',
          description: `Order #${String(order._id).slice(-6)}`,
        },
      });
    }

    const order = await Order.create({
      buyer_id: req.user.id,
      items: orderItems,
      total: amount,
      note,
      shippingAddress,
      paymentMethod: payResult.payCheck.method,
      paymentStatus: payResult.status,
      paymentRef: payResult.ref,
      paymentProvider: payResult.provider,
      paymentDetail: payResult.masked || payResult.detail || '',
      paidAt: payResult.paidAt || null,
    });

    cart.items = [];
    await cart.save();
    await notifySellers(orderItems, req.user.id);

    return res.status(200).json({
      success: true,
      msg: payResult.payCheck?.method === 'cod'
        ? 'Order placed — pay on delivery'
        : 'Payment successful',
      action: 'captured',
      order,
      payment: {
        status: payResult.status,
        method: payResult.payCheck.method,
        detail: payResult.masked || payResult.detail,
        provider: payResult.provider,
        ref: payResult.ref,
        amount: payResult.amount,
        currency: payResult.currency,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Checkout failed' });
  }
});

/** Confirm Razorpay payment after Checkout.js success. */
router.post('/:id/confirm-payment', user_jwt, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.buyer_id) !== String(req.user.id)) {
      return res.status(404).json({ success: false, msg: 'Order not found' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(200).json({ success: true, msg: 'Already paid', order });
    }

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, msg: 'Missing Razorpay payment proof' });
    }
    if (order.razorpayOrderId && order.razorpayOrderId !== orderId) {
      return res.status(400).json({ success: false, msg: 'Payment order mismatch' });
    }
    if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
      order.paymentStatus = 'failed';
      await order.save();
      return res.status(400).json({ success: false, msg: 'Payment verification failed' });
    }

    order.paymentStatus = 'paid';
    order.paymentRef = paymentId;
    order.paymentProvider = 'razorpay';
    order.paidAt = new Date();
    await order.save();
    await notifySellers(order.items, req.user.id);

    return res.status(200).json({
      success: true,
      msg: 'Payment successful',
      order,
      payment: {
        status: 'paid',
        method: order.paymentMethod,
        provider: 'razorpay',
        ref: paymentId,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Payment confirmation failed' });
  }
});

module.exports = router;
