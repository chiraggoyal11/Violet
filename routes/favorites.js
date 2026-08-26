const express = require('express');
const router = express.Router();
const Favorite = require('../models/favorite');
const Product = require('../models/product');
const user_jwt = require('../middleware/user_jwt');
const { attachImageUrls } = require('../utils/s3');

router.get('/', user_jwt, async (req, res) => {
  try {
    const favs = await Favorite.find({ user_id: req.user.id }).sort({ _id: -1 });
    const ids = favs.map((f) => f.product_id);
    const products = await Product.find({
      _id: { $in: ids },
      status: { $ne: 'deleted' }
    });
    await attachImageUrls(products);
    const order = new Map(ids.map((id, i) => [String(id), i]));
    products.sort(
      (a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0)
    );
    return res.status(200).json({ success: true, product: products });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load favorites' });
  }
});

router.post('/:productId', user_jwt, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ success: false, msg: 'Product not found' });
    }
    await Favorite.updateOne(
      { user_id: req.user.id, product_id: req.params.productId },
      { $setOnInsert: { user_id: req.user.id, product_id: req.params.productId } },
      { upsert: true }
    );
    return res.status(200).json({ success: true, msg: 'Added to favorites' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to favorite product' });
  }
});

router.delete('/:productId', user_jwt, async (req, res) => {
  try {
    await Favorite.deleteOne({
      user_id: req.user.id,
      product_id: req.params.productId
    });
    return res.status(200).json({ success: true, msg: 'Removed from favorites' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to unfavorite product' });
  }
});

module.exports = router;
