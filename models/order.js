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

const orderSchema = new mongoose.Schema(
  {
    buyer_id: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: String, required: true },
    status: {
      type: String,
      enum: ['placed', 'cancelled'],
      default: 'placed'
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
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    paymentRef: { type: String, trim: true, default: '' },
    paymentProvider: { type: String, trim: true, default: 'demo' },
    paymentDetail: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null },
    razorpayOrderId: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
