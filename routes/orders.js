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
  UPI_TIMEOUT_SECONDS,
  demoUpiAutoConfirmSeconds,
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

async function restoreStock(orderItems) {
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product_id, {
      $inc: { stock: item.quantity },
      $set: { status: 'active' },
    });
  }
}

/** Clear active cart items after a successful payment (saved-for-later stays). */
async function clearBuyerCartItems(userId) {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return;
  cart.items = [];
  await cart.save();
}

async function failPendingPaymentOrder(order) {
  if (order.paymentStatus !== 'pending') {
    return order;
  }
  // COD stays pending until delivery — do not auto-fail here.
  if (order.paymentMethod === 'cod') {
    return order;
  }
  order.paymentStatus = 'failed';
  order.status = 'cancelled';
  await order.save();
  await restoreStock(order.items);
  return order;
}

/**
 * Resolve a pending online payment: expire after the timer, or auto-confirm demo UPI.
 * COD stays pending until delivery.
 */
async function resolvePendingPayment(order) {
  if (!order || order.paymentStatus !== 'pending') {
    return order;
  }
  if (order.paymentMethod === 'cod') {
    return order;
  }

  const now = Date.now();
  const expiresAt = order.paymentExpiresAt
    ? new Date(order.paymentExpiresAt).getTime()
    : 0;

  if (expiresAt && now >= expiresAt) {
    return failPendingPaymentOrder(order);
  }

  // Demo: simulate UPI app approval after a short delay.
  if (
    order.paymentMethod === 'upi' &&
    order.paymentProvider === 'demo'
  ) {
    const created = new Date(order.createdAt || order._id.getTimestamp()).getTime();
    if (now - created >= demoUpiAutoConfirmSeconds() * 1000) {
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      if (!order.paymentRef) {
        order.paymentRef = `upi_paid_${Date.now().toString(36)}`;
      }
      await order.save();
      await clearBuyerCartItems(order.buyer_id);
      await notifySellers(order.items, order.buyer_id);
    }
  }

  return order;
}

/** @deprecated use resolvePendingPayment */
async function resolveUpiPayment(order) {
  return resolvePendingPayment(order);
}

async function findActivePendingPayment(buyerId) {
  let pending = await Order.findOne({
    buyer_id: buyerId,
    paymentStatus: 'pending',
    paymentMethod: { $in: ['upi', 'card'] },
  }).sort({ _id: -1 });
  if (!pending) return null;
  pending = await resolvePendingPayment(pending);
  if (!pending || pending.paymentStatus !== 'pending') return null;
  return pending;
}

function paymentPayload(order) {
  const expiresAt = order.paymentExpiresAt
    ? new Date(order.paymentExpiresAt).toISOString()
    : null;
  const remainingMs = expiresAt
    ? Math.max(0, new Date(expiresAt).getTime() - Date.now())
    : 0;
  return {
    status: order.paymentStatus,
    method: order.paymentMethod,
    detail: order.paymentDetail,
    provider: order.paymentProvider,
    ref: order.paymentRef,
    amount: order.total,
    currency: 'INR',
    expiresAt,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}

router.get('/payments/config', user_jwt, (req, res) => {
  return res.status(200).json({ success: true, payment: getPublicConfig() });
});

router.get('/', user_jwt, async (req, res) => {
  try {
    let orders = await Order.find({ buyer_id: req.user.id }).sort({ _id: -1 });
    orders = await Promise.all(
      orders.map(async (order) => {
        if (
          order.paymentStatus === 'pending' &&
          order.paymentMethod !== 'cod'
        ) {
          return resolvePendingPayment(order);
        }
        return order;
      }),
    );
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load orders' });
  }
});

/** Active UPI/card payment that must be finished or cancelled before a new checkout. */
router.get('/pending-payment', user_jwt, async (req, res) => {
  try {
    const pending = await findActivePendingPayment(req.user.id);
    if (!pending) {
      return res.status(200).json({ success: true, pending: null });
    }
    return res.status(200).json({
      success: true,
      pending,
      payment: paymentPayload(pending),
      resumePath: `/checkout?resume=${pending._id}`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load pending payment' });
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
      trackingNumber: o.trackingNumber || '',
      carrier: o.carrier || '',
      returnRequest: o.returnRequest || null,
      timeline: o.timeline || [],
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
    const couponCode = String(req.body.couponCode || '').trim().toUpperCase();

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

    // Avoid double-reserving stock while a UPI/Razorpay collect is still open.
    // Also expire timed-out payments here so abandoned checkouts unlock after 2 minutes.
    const pendingPay = await findActivePendingPayment(req.user.id);
    if (pendingPay) {
      return res.status(400).json({
        success: false,
        msg:
          'You already have a payment in progress. Open Orders to finish or cancel it, or wait until the 2‑minute timer expires.',
        orderId: pendingPay._id,
        payment: paymentPayload(pendingPay),
        resumePath: `/checkout?resume=${pendingPay._id}`,
      });
    }

    const reserved = await reserveCartItems(cart, req.user.id);
    if (!reserved.ok) {
      return res.status(reserved.status).json({ success: false, msg: reserved.msg });
    }

    const { orderItems, total } = reserved;
    let chargeTotal = total;
    let discount = 0;
    let appliedCoupon = '';
    if (couponCode) {
      const Coupon = require('../models/coupon');
      const { calcDiscount } = require('./coupons');
      const coupon = await Coupon.findOne({ code: couponCode, active: true });
      if (
        !coupon ||
        (coupon.expiresAt && coupon.expiresAt < new Date()) ||
        (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
      ) {
        for (const item of orderItems) {
          await Product.findByIdAndUpdate(item.product_id, {
            $inc: { stock: item.quantity },
            $set: { status: 'active' },
          });
        }
        return res.status(400).json({ success: false, msg: 'Invalid or expired coupon' });
      }
      const priced = calcDiscount(coupon, total);
      if (!priced.ok) {
        for (const item of orderItems) {
          await Product.findByIdAndUpdate(item.product_id, {
            $inc: { stock: item.quantity },
            $set: { status: 'active' },
          });
        }
        return res.status(400).json({ success: false, msg: priced.msg });
      }
      discount = priced.discount;
      chargeTotal = priced.total;
      appliedCoupon = coupon.code;
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save();
    }
    const amount = chargeTotal.toFixed(2);
    const orderExtras = {
      subtotal: total.toFixed(2),
      discount: discount.toFixed(2),
      couponCode: appliedCoupon,
      timeline: [{ status: 'placed', note: 'Order placed', at: new Date(), by: 'system' }],
    };
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
        paymentExpiresAt: new Date(Date.now() + UPI_TIMEOUT_SECONDS * 1000),
        ...orderExtras,
      });

      // Keep cart items until payment succeeds; fail/cancel leaves them for retry.
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

    if (payResult.action === 'awaiting_upi') {
      const order = await Order.create({
        buyer_id: req.user.id,
        items: orderItems,
        total: amount,
        note,
        shippingAddress,
        paymentMethod: 'upi',
        paymentStatus: 'pending',
        paymentRef: payResult.ref,
        paymentProvider: payResult.provider,
        paymentDetail: payResult.masked || payResult.detail || '',
        paymentExpiresAt: payResult.expiresAt,
        ...orderExtras,
      });

      // Keep cart items until payment succeeds; fail/cancel leaves them for retry.
      return res.status(200).json({
        success: true,
        msg: `Approve the UPI payment request within ${Math.round(UPI_TIMEOUT_SECONDS / 60)} minutes`,
        action: 'awaiting_upi',
        order,
        payment: paymentPayload(order),
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
      ...orderExtras,
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

/** Poll UPI / pending payment status (also expires or auto-confirms demo UPI). */
router.get('/:id/payment-status', user_jwt, async (req, res) => {
  try {
    let order = await Order.findById(req.params.id);
    if (!order || String(order.buyer_id) !== String(req.user.id)) {
      return res.status(404).json({ success: false, msg: 'Order not found' });
    }
    order = await resolvePendingPayment(order);
    return res.status(200).json({
      success: true,
      order,
      payment: paymentPayload(order),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load payment status' });
  }
});

/** Cancel a pending UPI collect before the timer ends. */
router.post('/:id/cancel-payment', user_jwt, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.buyer_id) !== String(req.user.id)) {
      return res.status(404).json({ success: false, msg: 'Order not found' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, msg: 'Payment already completed' });
    }
    if (order.paymentStatus === 'failed') {
      return res.status(200).json({ success: true, msg: 'Already cancelled', order });
    }
    await failPendingPaymentOrder(order);
    return res.status(200).json({
      success: true,
      msg: 'Payment cancelled',
      order,
      payment: paymentPayload(order),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not cancel payment' });
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
      await failPendingPaymentOrder(order);
      return res.status(400).json({ success: false, msg: 'Payment verification failed' });
    }

    order.paymentStatus = 'paid';
    order.paymentRef = paymentId;
    order.paymentProvider = 'razorpay';
    order.paidAt = new Date();
    await order.save();
    await clearBuyerCartItems(order.buyer_id);
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

function pushTimeline(order, status, note, by) {
  if (!Array.isArray(order.timeline)) order.timeline = [];
  order.timeline.push({
    status,
    note: note || status,
    at: new Date(),
    by: by || 'system',
  });
}

/** Seller marks order shipped / buyer or seller marks delivered. */
router.post('/:id/status', user_jwt, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' });
    const status = String(req.body.status || '').toLowerCase();
    const isBuyer = String(order.buyer_id) === String(req.user.id);
    const isSeller = order.items.some((i) => String(i.seller_id) === String(req.user.id));
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, msg: 'Not allowed' });
    }

    if (status === 'shipped') {
      if (!isSeller) return res.status(403).json({ success: false, msg: 'Only seller can mark shipped' });
      if (!['placed', 'shipped'].includes(order.status)) {
        return res.status(400).json({ success: false, msg: 'Order cannot be shipped from current status' });
      }
      order.status = 'shipped';
      order.shippedAt = new Date();
      order.trackingNumber = String(req.body.trackingNumber || order.trackingNumber || '').trim();
      order.carrier = String(req.body.carrier || order.carrier || '').trim();
      pushTimeline(
        order,
        'shipped',
        order.trackingNumber
          ? `Shipped via ${order.carrier || 'carrier'} · ${order.trackingNumber}`
          : 'Marked as shipped',
        req.user.id,
      );
      await order.save();
      await notifyUser({
        user_id: order.buyer_id,
        type: 'order',
        title: 'Your order shipped',
        body: `Order #${String(order._id).slice(-6)} is on the way`,
        link: '/orders',
      });
      return res.status(200).json({ success: true, order });
    }

    if (status === 'delivered') {
      if (!isBuyer && !isSeller) {
        return res.status(403).json({ success: false, msg: 'Not allowed' });
      }
      if (!['shipped', 'placed', 'delivered'].includes(order.status)) {
        return res.status(400).json({ success: false, msg: 'Order cannot be delivered yet' });
      }
      order.status = 'delivered';
      order.deliveredAt = new Date();
      pushTimeline(order, 'delivered', 'Delivered', req.user.id);
      await order.save();
      return res.status(200).json({ success: true, order });
    }

    return res.status(400).json({ success: false, msg: 'Unsupported status' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update order status' });
  }
});

/** Buyer requests a return/refund after delivery. */
router.post('/:id/return', user_jwt, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.buyer_id) !== String(req.user.id)) {
      return res.status(404).json({ success: false, msg: 'Order not found' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, msg: 'Returns open after delivery' });
    }
    if (order.returnRequest?.status && order.returnRequest.status !== 'none') {
      return res.status(400).json({ success: false, msg: 'Return already requested' });
    }
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ success: false, msg: 'Please explain the return reason' });
    }
    order.returnRequest = {
      status: 'requested',
      reason,
      requestedAt: new Date(),
      resolvedAt: null,
      refundAmount: '',
    };
    pushTimeline(order, 'return_requested', reason, req.user.id);
    await order.save();
    const sellerIds = [...new Set(order.items.map((i) => String(i.seller_id)))];
    await Promise.all(
      sellerIds.map((sellerId) =>
        notifyUser({
          user_id: sellerId,
          type: 'order',
          title: 'Return requested',
          body: `Buyer requested a return on #${String(order._id).slice(-6)}`,
          link: '/seller',
        }),
      ),
    );
    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not request return' });
  }
});

/** Seller resolves a return request. */
router.post('/:id/return/resolve', user_jwt, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, msg: 'Order not found' });
    const isSeller = order.items.some((i) => String(i.seller_id) === String(req.user.id));
    if (!isSeller) return res.status(403).json({ success: false, msg: 'Only seller can resolve' });
    if (order.returnRequest?.status !== 'requested') {
      return res.status(400).json({ success: false, msg: 'No open return request' });
    }
    const decision = String(req.body.decision || '').toLowerCase();
    if (!['approved', 'rejected', 'refunded'].includes(decision)) {
      return res.status(400).json({ success: false, msg: 'decision must be approved, rejected, or refunded' });
    }
    order.returnRequest.status = decision;
    order.returnRequest.resolvedAt = new Date();
    if (decision === 'refunded') {
      order.returnRequest.refundAmount = order.total;
      order.paymentStatus = 'refunded';
      order.status = 'returned';
      pushTimeline(order, 'refunded', 'Refund issued', req.user.id);
    } else {
      pushTimeline(order, `return_${decision}`, `Return ${decision}`, req.user.id);
    }
    await order.save();
    await notifyUser({
      user_id: order.buyer_id,
      type: 'order',
      title: `Return ${decision}`,
      body: `Your return on #${String(order._id).slice(-6)} was ${decision}`,
      link: '/orders',
    });
    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not resolve return' });
  }
});

module.exports = router;
