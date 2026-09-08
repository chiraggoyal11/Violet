const express = require('express');
const router = express.Router();
const Offer = require('../models/offer');
const Product = require('../models/product');
const Conversation = require('../models/conversation');
const user_jwt = require('../middleware/user_jwt');
const { notifyUser } = require('../utils/notifications');
const { emitToUser } = require('../utils/realtime');

router.post('/', user_jwt, async (req, res) => {
  try {
    const productId = String(req.body.product_id || '');
    const amount = Number(req.body.amount);
    const message = String(req.body.message || '').trim();
    const conversationId = String(req.body.conversation_id || '');
    if (!productId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, msg: 'product_id and amount required' });
    }
    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return res.status(404).json({ success: false, msg: 'Product not available' });
    }
    if (String(product.user_id) === String(req.user.id)) {
      return res.status(400).json({ success: false, msg: 'Cannot offer on your own listing' });
    }
    if (conversationId) {
      const convo = await Conversation.findById(conversationId);
      if (!convo || !convo.participants.map(String).includes(String(req.user.id))) {
        return res.status(403).json({ success: false, msg: 'Not in this conversation' });
      }
    }
    const offer = await Offer.create({
      conversation_id: conversationId || '',
      product_id: productId,
      buyer_id: req.user.id,
      seller_id: product.user_id,
      amount,
      message,
    });
    await notifyUser({
      user_id: product.user_id,
      type: 'message',
      title: 'New offer on your listing',
      body: `Offer of ₹${amount.toFixed(2)} for ${product.Product_Name}`,
      link: conversationId ? `/messages/${conversationId}` : `/product/${productId}`,
    });
    emitToUser(product.user_id, 'offer:new', { offer });
    return res.status(200).json({ success: true, offer });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not create offer' });
  }
});

router.patch('/:id', user_jwt, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ success: false, msg: 'Offer not found' });
    const status = String(req.body.status || '');
    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, msg: 'Invalid status' });
    }
    if (status === 'cancelled' && String(offer.buyer_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, msg: 'Only buyer can cancel' });
    }
    if ((status === 'accepted' || status === 'declined') && String(offer.seller_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, msg: 'Only seller can respond' });
    }
    offer.status = status;
    await offer.save();
    const notifyId = status === 'cancelled' ? offer.seller_id : offer.buyer_id;
    await notifyUser({
      user_id: notifyId,
      type: 'message',
      title: `Offer ${status}`,
      body: `Offer of ₹${Number(offer.amount).toFixed(2)} was ${status}`,
      link: offer.conversation_id ? `/messages/${offer.conversation_id}` : `/product/${offer.product_id}`,
    });
    emitToUser(notifyId, 'offer:update', { offer });
    return res.status(200).json({ success: true, offer });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not update offer' });
  }
});

router.get('/mine', user_jwt, async (req, res) => {
  const offers = await Offer.find({
    $or: [{ buyer_id: req.user.id }, { seller_id: req.user.id }],
  })
    .sort({ _id: -1 })
    .limit(50);
  return res.status(200).json({ success: true, offers });
});

module.exports = router;
