const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    product_id: { type: String, required: true, index: true }
  },
  { timestamps: true }
);

favoriteSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
