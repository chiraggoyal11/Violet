const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter_id: { type: String, required: true, index: true },
    targetType: {
      type: String,
      enum: ['user', 'product', 'message', 'review'],
      required: true,
    },
    targetId: { type: String, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['open', 'reviewed', 'actioned', 'dismissed'],
      default: 'open',
      index: true,
    },
    adminNote: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
