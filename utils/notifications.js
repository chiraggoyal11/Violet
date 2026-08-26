const Notification = require('../models/notification');

async function notifyUser({ user_id, type, title, body = '', link = '' }) {
  if (!user_id) return null;
  return Notification.create({
    user_id: String(user_id),
    type,
    title,
    body,
    link
  });
}

module.exports = { notifyUser };
