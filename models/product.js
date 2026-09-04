const mongoose = require('mongoose');

const CATEGORIES = ['Home', 'Fashion', 'Art', 'Food', 'Other'];
const COLOURS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Purple',
  'Brown',
  'Beige',
  'Grey',
  'Multicolor',
  'Other'
];

const productSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    Product_Name: { type: String, required: true, trim: true },
    Product_Detail: { type: String, required: true, trim: true },
    Price: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: CATEGORIES,
      default: 'Other',
      index: true
    },
    colour: {
      type: String,
      enum: COLOURS,
      default: 'Other',
      index: true
    },
    stock: { type: Number, default: 1, min: 0 },
    status: {
      type: String,
      enum: ['active', 'sold', 'deleted'],
      default: 'active',
      index: true
    },
    Image: { type: String, required: false },
    ImageUrl: { type: String, required: false },
    Images: { type: [String], default: [] },
    ImageUrls: { type: [String], default: [] },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

productSchema.statics.CATEGORIES = CATEGORIES;
productSchema.statics.COLOURS = COLOURS;

module.exports = mongoose.model('Product', productSchema);
