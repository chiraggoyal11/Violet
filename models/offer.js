const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    conversation_id: { type: String, required: true, index: true },
    product_id: { type: String, required: true, index: true },
    buyer_id: { type: String, required: true, index: true },
    seller_id: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    message: { type: String, default: '', trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Offer', offerSchema);
