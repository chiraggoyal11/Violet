const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const user_jwt = require('../middleware/user_jwt');

router.get('/', user_jwt, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const notifications = await Notification.find({ user_id: req.user.id })
      .sort({ _id: -1 })
      .limit(limit);
    const unread = await Notification.countDocuments({
      user_id: req.user.id,
      read: false
    });
    return res.status(200).json({ success: true, notifications, unread });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load notifications' });
  }
});

router.get('/unread-count', user_jwt, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({
      user_id: req.user.id,
      read: false
    });
    return res.status(200).json({ success: true, unread });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to load count' });
  }
});

router.put('/read-all', user_jwt, async (req, res) => {
  try {
    await Notification.updateMany(
      { user_id: req.user.id, read: false },
      { read: true }
    );
    return res.status(200).json({ success: true, msg: 'All notifications marked read' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update notifications' });
  }
});

router.put('/:id/read', user_jwt, async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      { read: true },
      { new: true }
    );
    if (!note) {
      return res.status(404).json({ success: false, msg: 'Notification not found' });
    }
    return res.status(200).json({ success: true, notification: note });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Failed to update notification' });
  }
});

module.exports = router;
