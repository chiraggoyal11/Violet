const mongoose = require('mongoose');
const crypto = require('crypto');

const wishlistItemSchema = new mongoose.Schema(
  {
    product_id: { type: String, required: true },
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    name: { type: String, trim: true, default: 'My wishlist' },
    items: { type: [wishlistItemSchema], default: [] },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomBytes(8).toString('hex'),
    },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);
