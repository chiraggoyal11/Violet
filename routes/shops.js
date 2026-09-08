const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Product = require('../models/product');
const Review = require('../models/review');
const Order = require('../models/order');
const { attachImageUrls } = require('../utils/s3');

router.get('/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    const seller = await User.findOne({ username }).select(
      'username first_name last_name bio shopName avatar createdAt settings.showPhoneToBuyers phone_no country_code suspended'
    );
    if (!seller || seller.suspended) {
      return res.status(404).json({ success: false, msg: 'Shop not found' });
    }

    const products = await Product.find({
      user_id: String(seller._id),
      status: 'active',
    })
      .sort({ _id: -1 })
      .limit(48);

    const productIds = products.map((p) => String(p._id));
    const reviews = productIds.length
      ? await Review.find({ product_id: { $in: productIds } })
      : [];
    const avg =
      reviews.length === 0
        ? 0
        : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

    const salesCount = await Order.countDocuments({
      'items.seller_id': String(seller._id),
      paymentStatus: { $in: ['paid', 'pending'] },
      status: { $in: ['placed', 'shipped', 'delivered'] },
    });

    await attachImageUrls(products);

    return res.status(200).json({
      success: true,
      shop: {
        _id: seller._id,
        username: seller.username,
        shopName: seller.shopName || seller.username,
        bio: seller.bio || '',
        avatar: seller.avatar,
        memberSince: seller.createdAt,
        phone:
          seller.settings?.showPhoneToBuyers
            ? `${seller.country_code || ''} ${seller.phone_no || ''}`.trim()
            : null,
        ratingAverage: Number(avg.toFixed(1)),
        reviewCount: reviews.length,
        salesCount,
        listingCount: products.length,
      },
      products,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load shop' });
  }
});

module.exports = router;
