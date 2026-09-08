const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0 },
    maxUses: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
