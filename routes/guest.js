const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { normalizePhoneDigits, normalizeCountryCode } = require('../utils/authValidation');

/**
 * Create a lightweight guest account for checkout without full registration.
 * Returns a JWT so the client can complete cart/checkout.
 */
router.post('/session', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone_no = normalizePhoneDigits(req.body.phone_no || req.body.phone);
    const country_code = normalizeCountryCode(req.body.country_code || '+91');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, msg: 'Valid email is required for guest checkout' });
    }
    if (!/^\d{10}$/.test(phone_no)) {
      return res.status(400).json({ success: false, msg: 'Phone number must be exactly 10 digits' });
    }

    let user = await User.findOne({ email, isGuest: true });
    if (!user) {
      const existing = await User.findOne({
        $or: [{ email }, { country_code, phone_no }],
      });
      if (existing && !existing.isGuest) {
        return res.status(400).json({
          success: false,
          msg: 'An account already exists for this email or phone. Please sign in.',
        });
      }
      const username = `guest_${phone_no.slice(-4)}_${Date.now().toString(36)}`;
      const password = await bcryptjs.hash(`guest-${Date.now()}-${Math.random()}`, 8);
      user = await User.create({
        username,
        email,
        phone_no,
        country_code,
        password,
        isGuest: true,
        auth_provider: 'guest',
        address: {
          line1: String(req.body.line1 || '').trim(),
          line2: String(req.body.line2 || '').trim(),
          city: String(req.body.city || '').trim(),
          state: String(req.body.state || '').trim(),
          country: String(req.body.country || '').trim(),
          pincode: String(req.body.pincode || '').replace(/\D/g, '').slice(0, 6),
        },
      });
    }

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.jwtSecret, { expiresIn: '7d' });
    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone_no: user.phone_no,
        country_code: user.country_code,
        isGuest: true,
        address: user.address,
      },
      msg: 'Guest session ready — complete checkout, then create a password anytime in Profile.',
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, msg: 'Could not start guest checkout' });
  }
});

module.exports = router;
