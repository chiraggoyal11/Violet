const express = require('express');
const router = express.Router();
const Report = require('../models/report');
const User = require('../models/user');
const user_jwt = require('../middleware/user_jwt');

router.post('/', user_jwt, async (req, res) => {
  try {
    const targetType = String(req.body.targetType || '').trim();
    const targetId = String(req.body.targetId || '').trim();
    const reason = String(req.body.reason || '').trim();
    if (!['user', 'product', 'message', 'review'].includes(targetType)) {
      return res.status(400).json({ success: false, msg: 'Invalid report target' });
    }
    if (!targetId || reason.length < 3) {
      return res.status(400).json({ success: false, msg: 'Add a short reason' });
    }
    const report = await Report.create({
      reporter_id: req.user.id,
      targetType,
      targetId,
      reason,
    });
    return res.status(200).json({ success: true, msg: 'Report submitted', report });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not submit report' });
  }
});

router.post('/block/:userId', user_jwt, async (req, res) => {
  try {
    const blockedId = String(req.params.userId);
    if (blockedId === String(req.user.id)) {
      return res.status(400).json({ success: false, msg: 'Cannot block yourself' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
    const set = new Set(user.blockedUsers || []);
    set.add(blockedId);
    user.blockedUsers = [...set];
    await user.save();
    return res.status(200).json({ success: true, blockedUsers: user.blockedUsers });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not block user' });
  }
});

router.delete('/block/:userId', user_jwt, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
    user.blockedUsers = (user.blockedUsers || []).filter(
      (id) => String(id) !== String(req.params.userId),
    );
    await user.save();
    return res.status(200).json({ success: true, blockedUsers: user.blockedUsers });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not unblock user' });
  }
});

module.exports = router;
