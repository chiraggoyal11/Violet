const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    seller_id: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    method: { type: String, default: 'bank_transfer' },
    note: { type: String, default: '' },
    orderIds: { type: [String], default: [] },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payout', payoutSchema);
