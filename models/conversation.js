const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: String, required: true }],
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: 'Conversation must have exactly two participants'
      }
    },
    product_id: { type: String, default: null, index: true },
    product_name: { type: String, default: '' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
