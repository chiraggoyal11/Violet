const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcryptjs = require('bcryptjs');
const user_jwt = require('../middleware/user_jwt');
const jwt = require('jsonwebtoken');
const { createPasswordOtp, verifyPasswordOtp, devOtpEnabled } = require('../utils/otp');

const {
    validatePassword,
    parsePhoneFields,
    phoneLookupKey
} = require('../utils/authValidation');

async function findUserByPhone(country_code, phone_no) {
    const parsed = parsePhoneFields({ country_code, phone_no });
    if (parsed.valid) {
        const byParts = await User.findOne({
            country_code: parsed.country_code,
            phone_no: parsed.phone_no
        });
        if (byParts) return byParts;
    }

    const raw = String(phone_no || '').trim();
    if (raw) {
        const legacy = await User.findOne({ phone_no: raw });
        if (legacy) return legacy;
    }

    return null;
}

function publicUser(user) {
    if (!user) return null;
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    return obj;
}

function signToken(userId) {
    return new Promise((resolve, reject) => {
        jwt.sign(
            { user: { id: userId } },
            process.env.jwtSecret,
            { expiresIn: '7d' },
            (err, token) => (err ? reject(err) : resolve(token))
        );
    });
}

router.get('/', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }
        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Server error' });
    }
});

router.put('/profile', user_jwt, async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        if (!username) {
            return res.status(400).json({
                success: false,
                msg: 'Username is required'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        user.username = username;
        if (req.body.email !== undefined) {
            const email = String(req.body.email || '').trim().toLowerCase();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ success: false, msg: 'Invalid email address' });
            }
            user.email = email || undefined;
        }
        await user.save();

        return res.status(200).json({
            success: true,
            msg: 'Profile updated',
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to update profile' });
    }
});

router.post('/register', async (req, res) => {
    const username = (req.body.username || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    try {
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Username, phone number, and password are required'
            });
        }

        const phone = parsePhoneFields(req.body);
        if (!phone.valid) {
            return res.status(400).json({ success: false, msg: phone.msg });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ success: false, msg: passwordCheck.msg });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, msg: 'Invalid email address' });
        }

        const user_exist = await User.findOne({
            country_code: phone.country_code,
            phone_no: phone.phone_no
        });
        if (user_exist) {
            return res.status(409).json({
                success: false,
                msg: 'user already exist'
            });
        }

        const user = new User({
            username,
            country_code: phone.country_code,
            phone_no: phone.phone_no,
            ...(email ? { email } : {}),
            password: await bcryptjs.hash(password, await bcryptjs.genSalt(10)),
            avatar: 'https://gravatar.com/avatar/?s=200&d=retro'
        });

        await user.save();
        const token = await signToken(user.id);

        return res.status(200).json({
            success: true,
            token,
            user: publicUser(user)
        });
    } catch (err) {
        console.log(err);
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                msg: 'user already exist'
            });
        }
        return res.status(500).json({ success: false, msg: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    const password = req.body.password || '';

    try {
        const phone = parsePhoneFields(req.body);
        if (!phone.valid) {
            return res.status(400).json({ success: false, msg: phone.msg });
        }
        if (!password) {
            return res.status(400).json({
                success: false,
                msg: 'Phone number and password are required'
            });
        }

        const user = await findUserByPhone(phone.country_code, phone.phone_no);
        if (!user) {
            return res.status(400).json({
                success: false,
                msg: "Invalid Phone number , doesn't exist. "
            });
        }

        const isMatch = await bcryptjs.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                msg: 'Invalid password'
            });
        }

        const token = await signToken(user.id);
        return res.status(200).json({
            success: true,
            token,
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const phone = parsePhoneFields(req.body);
        if (!phone.valid) {
            return res.status(400).json({ success: false, msg: phone.msg });
        }

        const user = await findUserByPhone(phone.country_code, phone.phone_no);
        const otpKey = phoneLookupKey(phone.country_code, phone.phone_no);
        if (!user) {
            return res.status(200).json({
                success: true,
                msg: 'If that phone number exists, a reset code was sent.'
            });
        }

        const otp = await createPasswordOtp(otpKey);
        const payload = {
            success: true,
            msg: 'If that phone number exists, a reset code was sent.'
        };
        if (devOtpEnabled()) {
            payload.devOtp = otp;
        }
        return res.status(200).json(payload);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to send reset code' });
    }
});

router.post('/reset-password', async (req, res) => {
    const otp = String(req.body.otp || '').trim();
    const password = req.body.password || '';

    try {
        const phone = parsePhoneFields(req.body);
        if (!phone.valid) {
            return res.status(400).json({ success: false, msg: phone.msg });
        }
        if (!otp || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Phone number, reset code, and new password are required'
            });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ success: false, msg: passwordCheck.msg });
        }

        const user = await findUserByPhone(phone.country_code, phone.phone_no);
        if (!user) {
            return res.status(400).json({ success: false, msg: 'Invalid reset request' });
        }

        const otpKey = phoneLookupKey(phone.country_code, phone.phone_no);
        const valid = await verifyPasswordOtp(otpKey, otp);
        if (!valid) {
            return res.status(400).json({ success: false, msg: 'Invalid or expired reset code' });
        }

        user.password = await bcryptjs.hash(password, await bcryptjs.genSalt(10));
        await user.save();

        return res.status(200).json({ success: true, msg: 'Password updated. You can sign in now.' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, msg: 'Failed to reset password' });
    }
});

module.exports = router;
