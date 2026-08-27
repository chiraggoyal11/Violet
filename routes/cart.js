const express = require('express');
const router = express.Router();
const Cart = require('../models/cart');
const Product = require('../models/product');
const user_jwt = require('../middleware/user_jwt');
const { attachImageUrls } = require('../utils/s3');

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user_id: userId });
  if (!cart) {
    cart = await Cart.create({ user_id: userId, items: [] });
  }
  return cart;
}

async function hydrateCart(cart) {
  const ids = cart.items.map((i) => i.product_id);
  const products = await Product.find({
    _id: { $in: ids },
    status: { $ne: 'deleted' }
  });
  await attachImageUrls(products);
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = cart.items
    .map((i) => {
      const product = byId.get(String(i.product_id));
      if (!product) return null;
      return {
        product_id: i.product_id,
        quantity: i.quantity,
        product
      };
    })
    .filter(Boolean);

  const total = items.reduce(
    (sum, i) => sum + (Number(i.product.Price) || 0) * i.quantity,
    0
  );

  return { items, total: total.toFixed(2) };
}

router.get('/', user_jwt, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const hydrated = await hydrateCart(cart);
    return res.status(200).json({ success: true, ...hydrated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load cart' });
  }
});

router.post('/items', user_jwt, async (req, res) => {
  try {
    const productId = req.body.product_id;
    const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
    if (!productId) {
      return res.status(400).json({ success: false, msg: 'product_id is required' });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== 'active' || product.stock < 1) {
      return res.status(400).json({ success: false, msg: 'Product is not available' });
    }
    if (String(product.user_id) === String(req.user.id)) {
      return res.status(400).json({ success: false, msg: 'You cannot buy your own listing' });
    }

    const cart = await getOrCreateCart(req.user.id);
    const existing = cart.items.find((i) => String(i.product_id) === String(productId));
    if (existing) {
      existing.quantity = Math.min(product.stock, existing.quantity + quantity);
    } else {
      cart.items.push({ product_id: productId, quantity: Math.min(product.stock, quantity) });
    }
    await cart.save();
    const hydrated = await hydrateCart(cart);
    return res.status(200).json({ success: true, msg: 'Added to cart', ...hydrated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update cart' });
  }
});

router.put('/items/:productId', user_jwt, async (req, res) => {
  try {
    const quantity = Math.max(0, parseInt(req.body.quantity, 10) || 0);
    const cart = await getOrCreateCart(req.user.id);
    if (quantity === 0) {
      cart.items = cart.items.filter((i) => String(i.product_id) !== String(req.params.productId));
    } else {
      const item = cart.items.find((i) => String(i.product_id) === String(req.params.productId));
      if (!item) {
        return res.status(404).json({ success: false, msg: 'Item not in cart' });
      }
      const product = await Product.findById(req.params.productId);
      if (!product || product.status !== 'active' || product.stock < 1) {
        cart.items = cart.items.filter((i) => String(i.product_id) !== String(req.params.productId));
        await cart.save();
        return res.status(400).json({
          success: false,
          msg: 'Product is not available',
          ...(await hydrateCart(cart))
        });
      }
      item.quantity = Math.min(product.stock, quantity);
    }
    await cart.save();
    const hydrated = await hydrateCart(cart);
    return res.status(200).json({ success: true, ...hydrated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update cart' });
  }
});

router.delete('/items/:productId', user_jwt, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.items = cart.items.filter((i) => String(i.product_id) !== String(req.params.productId));
    await cart.save();
    const hydrated = await hydrateCart(cart);
    return res.status(200).json({ success: true, ...hydrated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update cart' });
  }
});

router.delete('/', user_jwt, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    cart.items = [];
    await cart.save();
    return res.status(200).json({ success: true, items: [], total: '0.00' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to clear cart' });
  }
});

module.exports = router;
