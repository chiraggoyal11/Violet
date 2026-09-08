const express = require('express');
const router = express.Router();
const Wishlist = require('../models/wishlist');
const Product = require('../models/product');
const user_jwt = require('../middleware/user_jwt');
const { attachImageUrls } = require('../utils/s3');

async function getOrCreateWishlist(userId) {
  let list = await Wishlist.findOne({ user_id: userId });
  if (!list) {
    list = await Wishlist.create({ user_id: userId, name: 'My wishlist', items: [] });
  }
  return list;
}

router.get('/mine', user_jwt, async (req, res) => {
  try {
    const list = await getOrCreateWishlist(req.user.id);
    const ids = list.items.map((i) => i.product_id);
    const products = ids.length
      ? await Product.find({ _id: { $in: ids }, status: { $ne: 'deleted' } })
      : [];
    await attachImageUrls(products);
    return res.status(200).json({
      success: true,
      wishlist: list,
      products,
      shareUrl: `/w/${list.shareToken}`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load wishlist' });
  }
});

router.post('/mine/items', user_jwt, async (req, res) => {
  try {
    const productId = String(req.body.product_id || '');
    if (!productId) return res.status(400).json({ success: false, msg: 'product_id required' });
    const list = await getOrCreateWishlist(req.user.id);
    if (!list.items.some((i) => i.product_id === productId)) {
      list.items.push({ product_id: productId });
      await list.save();
    }
    return res.status(200).json({ success: true, wishlist: list });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not add item' });
  }
});

router.delete('/mine/items/:productId', user_jwt, async (req, res) => {
  try {
    const list = await getOrCreateWishlist(req.user.id);
    list.items = list.items.filter((i) => i.product_id !== String(req.params.productId));
    await list.save();
    return res.status(200).json({ success: true, wishlist: list });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not remove item' });
  }
});

router.get('/shared/:token', async (req, res) => {
  try {
    const list = await Wishlist.findOne({
      shareToken: String(req.params.token),
      isPublic: true,
    });
    if (!list) return res.status(404).json({ success: false, msg: 'Wishlist not found' });
    const ids = list.items.map((i) => i.product_id);
    const products = ids.length
      ? await Product.find({ _id: { $in: ids }, status: 'active' })
      : [];
    await attachImageUrls(products);
    return res.status(200).json({
      success: true,
      wishlist: { name: list.name, shareToken: list.shareToken },
      products,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load shared wishlist' });
  }
});

module.exports = router;
