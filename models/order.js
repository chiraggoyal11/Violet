const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product_id: { type: String, required: true },
    Product_Name: { type: String, required: true },
    Price: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    seller_id: { type: String, required: true }
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const timelineEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: String, default: '' },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['none', 'requested', 'approved', 'rejected', 'refunded'],
      default: 'none',
    },
    reason: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    refundAmount: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    buyer_id: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: String, required: true },
    subtotal: { type: String, default: '' },
    discount: { type: String, default: '0.00' },
    couponCode: { type: String, default: '' },
    status: {
      type: String,
      enum: ['placed', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'placed',
      index: true,
    },
    timeline: { type: [timelineEventSchema], default: [] },
    trackingNumber: { type: String, default: '' },
    carrier: { type: String, default: '' },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    returnRequest: {
      type: returnRequestSchema,
      default: () => ({ status: 'none' }),
    },
    note: { type: String, default: '' },
    shippingAddress: {
      type: shippingAddressSchema,
      default: () => ({})
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'cod', ''],
      default: ''
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentRef: { type: String, trim: true, default: '' },
    paymentProvider: { type: String, trim: true, default: 'demo' },
    paymentDetail: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null },
    paymentExpiresAt: { type: Date, default: null },
    razorpayOrderId: { type: String, trim: true, default: '' },
    isGuest: { type: Boolean, default: false },
    guestEmail: { type: String, default: '' },
    guestPhone: { type: String, default: '' },
  },
  { timestamps: true }
);

orderSchema.pre('save', function ensureTimeline(next) {
  if (!this.timeline || this.timeline.length === 0) {
    this.timeline = [
      {
        status: this.status || 'placed',
        note: 'Order placed',
        at: this.createdAt || new Date(),
        by: 'system',
      },
    ];
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
