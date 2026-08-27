const express = require('express');
const router = express.Router();
const Review = require('../models/review');
const Product = require('../models/product');
const User = require('../models/user');
const user_jwt = require('../middleware/user_jwt');
const { notifyUser } = require('../utils/notifications');

router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product_id: req.params.productId }).sort({
      _id: -1
    });
    const avg =
      reviews.length === 0
        ? 0
        : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return res.status(200).json({
      success: true,
      reviews,
      average: Number(avg.toFixed(1)),
      count: reviews.length
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load reviews' });
  }
});

router.post('/product/:productId', user_jwt, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = (req.body.comment || '').trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, msg: 'Rating must be 1-5' });
    }

    const product = await Product.findById(req.params.productId);
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ success: false, msg: 'Product not found' });
    }
    if (String(product.user_id) === String(req.user.id)) {
      return res.status(400).json({ success: false, msg: 'You cannot review your own product' });
    }

    const user = await User.findById(req.user.id).select('username');
    const review = await Review.findOneAndUpdate(
      { product_id: req.params.productId, user_id: req.user.id },
      {
        product_id: req.params.productId,
        user_id: req.user.id,
        username: user?.username || 'Buyer',
        rating,
        comment
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await notifyUser({
      user_id: product.user_id,
      type: 'review',
      title: 'New review on your listing',
      body: `${user?.username || 'A buyer'} rated ${product.Product_Name} ${rating}/5`,
      link: `/product/${product._id}`
    });

    return res.status(200).json({ success: true, msg: 'Review saved', review });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to save review' });
  }
});

module.exports = router;
