const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const Product = require('../models/product');
const User = require('../models/user');
const user_jwt = require('../middleware/user_jwt');
const { notifyUser } = require('../utils/notifications');
const { signImageKey } = require('../utils/s3');

async function resolveAvatar(user) {
  if (!user) return null;
  const obj = {
    _id: user._id,
    username: user.username,
    avatar: user.avatar || null
  };
  const key =
    user.avatar_key ||
    (!/^https?:\/\//i.test(String(user.avatar || '')) ? user.avatar : null);
  if (key && !/^https?:\/\//i.test(String(key))) {
    try {
      const signed = await signImageKey(key);
      if (signed) obj.avatar = signed;
    } catch {
      /* keep stored avatar */
    }
  }
  return obj;
}

async function hydrateConversation(conv, currentUserId) {
  const otherId = conv.participants.find((p) => String(p) !== String(currentUserId));
  const [other, unread] = await Promise.all([
    otherId ? User.findById(otherId).select('username avatar avatar_key') : null,
    Message.countDocuments({
      conversation_id: conv._id,
      sender_id: { $ne: String(currentUserId) },
      readAt: null
    })
  ]);
  return {
    ...conv.toObject(),
    otherUser: await resolveAvatar(other),
    unread
  };
}

router.get('/', user_jwt, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const conversations = await Conversation.find({ participants: userId }).sort({
      lastMessageAt: -1
    });
    const hydrated = await Promise.all(
      conversations.map((c) => hydrateConversation(c, userId))
    );
    return res.status(200).json({ success: true, conversations: hydrated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load conversations' });
  }
});

router.get('/:id/messages', user_jwt, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.participants.includes(userId)) {
      return res.status(404).json({ success: false, msg: 'Conversation not found' });
    }

    const messages = await Message.find({ conversation_id: conv._id }).sort({ _id: 1 });
    await Message.updateMany(
      { conversation_id: conv._id, sender_id: { $ne: userId }, readAt: null },
      { readAt: new Date() }
    );

    const hydrated = await hydrateConversation(conv, userId);
    return res.status(200).json({
      success: true,
      conversation: hydrated,
      messages
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load messages' });
  }
});

router.post('/', user_jwt, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const recipientId = String(req.body.recipient_id || '').trim();
    const body = String(req.body.body || '').trim();
    const productId = req.body.product_id ? String(req.body.product_id) : null;

    if (!recipientId || recipientId === userId) {
      return res.status(400).json({ success: false, msg: 'Valid recipient required' });
    }
    if (!body) {
      return res.status(400).json({ success: false, msg: 'Message cannot be empty' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, msg: 'Recipient not found' });
    }

    let productName = '';
    if (productId) {
      const product = await Product.findById(productId);
      if (!product || product.status === 'deleted') {
        return res.status(404).json({ success: false, msg: 'Product not found' });
      }
      productName = product.Product_Name;
    }

    const participants = [userId, recipientId].sort();
    let conv = await Conversation.findOne({
      participants: { $all: participants, $size: 2 },
      ...(productId ? { product_id: productId } : { product_id: null })
    });

    if (!conv) {
      conv = await Conversation.create({
        participants,
        product_id: productId,
        product_name: productName,
        lastMessage: body.slice(0, 200),
        lastMessageAt: new Date()
      });
    } else {
      conv.lastMessage = body.slice(0, 200);
      conv.lastMessageAt = new Date();
      await conv.save();
    }

    const message = await Message.create({
      conversation_id: conv._id,
      sender_id: userId,
      body
    });

    const sender = await User.findById(userId).select('username');
    await notifyUser({
      user_id: recipientId,
      type: 'message',
      title: `New message from ${sender?.username || 'Someone'}`,
      body: body.slice(0, 120),
      link: `/messages/${conv._id}`
    });

    const hydrated = await hydrateConversation(conv, userId);
    return res.status(200).json({
      success: true,
      conversation: hydrated,
      message
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to send message' });
  }
});

module.exports = router;
