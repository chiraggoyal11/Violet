const express = require('express');
const router = express.Router();
const user_jwt = require('../middleware/user_jwt');
const User = require('../models/user');
const { getRates } = require('../utils/currency');

router.get('/rates', (req, res) => {
  return res.status(200).json({ success: true, ...getRates() });
});

router.post('/subscribe', user_jwt, async (req, res) => {
  try {
    const subscription = req.body.subscription || req.body;
    if (!subscription || typeof subscription !== 'object') {
      return res.status(400).json({ success: false, msg: 'Push subscription required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
    user.pushSubscription = subscription;
    if (!user.settings) user.settings = {};
    user.settings.pushEnabled = true;
    await user.save();
    return res.status(200).json({ success: true, msg: 'Push notifications enabled' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not save subscription' });
  }
});

router.delete('/subscribe', user_jwt, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
    user.pushSubscription = null;
    if (user.settings) user.settings.pushEnabled = false;
    await user.save();
    return res.status(200).json({ success: true, msg: 'Push notifications disabled' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not disable push' });
  }
});

/** VAPID public key for Web Push (optional). */
router.get('/vapid-public-key', (req, res) => {
  return res.status(200).json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
});

module.exports = router;
