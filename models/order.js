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
    note: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
