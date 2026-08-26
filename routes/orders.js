const express = require('express');
const router = express.Router();
const Cart = require('../models/cart');
const Order = require('../models/order');
const Product = require('../models/product');
const user_jwt = require('../middleware/user_jwt');

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
    const cart = await Cart.findOne({ user_id: req.user.id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, msg: 'Cart is empty' });
    }

    const orderItems = [];
    let total = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.product_id);
      if (!product || product.status !== 'active' || product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          msg: `Product unavailable: ${product?.Product_Name || item.product_id}`
        });
      }
      if (String(product.user_id) === String(req.user.id)) {
        return res.status(400).json({
          success: false,
          msg: 'You cannot buy your own listing'
        });
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

      product.stock = Math.max(0, product.stock - item.quantity);
      if (product.stock === 0) product.status = 'sold';
      await product.save();
    }

    const order = await Order.create({
      buyer_id: req.user.id,
      items: orderItems,
      total: total.toFixed(2),
      note
    });

    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      msg: 'Order placed',
      order
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Checkout failed' });
  }
});

module.exports = router;
