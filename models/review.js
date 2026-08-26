const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    username: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 1000 }
  },
  { timestamps: true }
);

reviewSchema.index({ product_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
