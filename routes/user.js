const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcryptjs = require('bcryptjs');
const user_jwt = require('../middleware/user_jwt');
const jwt = require('jsonwebtoken');
const { createPasswordOtp, verifyPasswordOtp, shouldReturnOtpInResponse } = require('../utils/otp');
const { googleConfigured, verifyGoogleCredential } = require('../utils/googleAuth');
const { requireMongo, mongoFailure } = require('../utils/mongo');

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

const GENDERS = new Set(['', 'female', 'male', 'non_binary', 'prefer_not_to_say']);
const CURRENCIES = new Set(['INR', 'USD', 'EUR']);

function normalizeAddress(raw = {}) {
    return {
        line1: String(raw.line1 || '').trim(),
        line2: String(raw.line2 || '').trim(),
        city: String(raw.city || '').trim(),
        state: String(raw.state || '').trim(),
        country: String(raw.country || '').trim(),
        pincode: String(raw.pincode || '').trim()
    };
}

function normalizeSettings(raw = {}, current = {}) {
    const base = {
        orderUpdates: true,
        messageAlerts: true,
        promoAlerts: false,
        reviewReminders: true,
        stockAlerts: true,
        showPhoneToBuyers: false,
        useProfileAddressAtCheckout: true,
        preferredCurrency: 'INR',
        defaultCheckoutNote: '',
        ...(current && typeof current === 'object' ? current : {})
    };

    const next = { ...base };
    const boolKeys = [
        'orderUpdates',
        'messageAlerts',
        'promoAlerts',
        'reviewReminders',
        'stockAlerts',
        'showPhoneToBuyers',
        'useProfileAddressAtCheckout'
    ];
    for (const key of boolKeys) {
        if (raw[key] !== undefined) next[key] = Boolean(raw[key]);
    }
    if (raw.preferredCurrency !== undefined) {
        const currency = String(raw.preferredCurrency || 'INR').toUpperCase();
        if (!CURRENCIES.has(currency)) {
            return { error: 'Preferred currency must be INR, USD, or EUR' };
        }
        next.preferredCurrency = currency;
    }
    if (raw.defaultCheckoutNote !== undefined) {
        next.defaultCheckoutNote = String(raw.defaultCheckoutNote || '').trim().slice(0, 280);
    }
    return { settings: next };
}

function publicUser(user) {
    if (!user) return null;
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    if (!obj.address) {
        obj.address = {
            line1: '',
            line2: '',
            city: '',
            state: '',
            country: '',
            pincode: ''
        };
    }
    if (!obj.settings) {
        obj.settings = {
            orderUpdates: true,
            messageAlerts: true,
            promoAlerts: false,
            reviewReminders: true,
            stockAlerts: true,
            showPhoneToBuyers: false,
            useProfileAddressAtCheckout: true,
            preferredCurrency: 'INR',
            defaultCheckoutNote: ''
        };
    }
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

router.get('/config', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    return res.status(200).json({
        success: true,
        googleEnabled: Boolean(clientId),
        googleClientId: clientId
    });
});

// All routes below need MongoDB
router.use(requireMongo);

router.post('/google', async (req, res) => {
    try {
        const credential = req.body.credential || req.body.id_token || '';
        const profile = await verifyGoogleCredential(credential);

        let user = await User.findOne({ google_id: profile.google_id });

        if (!user && profile.email) {
            user = await User.findOne({ email: profile.email });
            if (user) {
                if (user.google_id && user.google_id !== profile.google_id) {
                    return res.status(409).json({
                        success: false,
                        msg: 'This email is linked to a different Google account'
                    });
                }
                user.google_id = profile.google_id;
                if (profile.avatar) user.avatar = profile.avatar;
                await user.save();
            }
        }

        if (!user) {
            user = await User.create({
                username: profile.username,
                email: profile.email || undefined,
                google_id: profile.google_id,
                auth_provider: 'google',
                avatar: profile.avatar
            });
        } else {
            if (profile.avatar) user.avatar = profile.avatar;
            // Do not overwrite an existing display name on every Google sign-in.
            await user.save();
        }

        const token = await signToken(user.id);
        return res.status(200).json({
            success: true,
            token,
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        return mongoFailure(res, error, error.message || 'Google sign-in failed');
    }
});

router.get('/', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }
        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.log(error);
        return mongoFailure(res, error, 'Server error');
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

        const gender = req.body.gender !== undefined ? String(req.body.gender || '') : undefined;
        if (gender !== undefined && !GENDERS.has(gender)) {
            return res.status(400).json({ success: false, msg: 'Invalid gender value' });
        }

        let date_of_birth;
        if (req.body.date_of_birth !== undefined) {
            date_of_birth = String(req.body.date_of_birth || '').trim();
            if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
                return res.status(400).json({
                    success: false,
                    msg: 'Date of birth must be YYYY-MM-DD'
                });
            }
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
        if (req.body.first_name !== undefined) {
            user.first_name = String(req.body.first_name || '').trim().slice(0, 80);
        }
        if (req.body.last_name !== undefined) {
            user.last_name = String(req.body.last_name || '').trim().slice(0, 80);
        }
        if (gender !== undefined) user.gender = gender;
        if (date_of_birth !== undefined) user.date_of_birth = date_of_birth;
        if (req.body.address !== undefined) {
            user.address = normalizeAddress(req.body.address || {});
        }
        await user.save();

        return res.status(200).json({
            success: true,
            msg: 'Profile updated',
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        return mongoFailure(res, error, 'Failed to update profile');
    }
});

router.put('/settings', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const normalized = normalizeSettings(req.body || {}, user.settings);
        if (normalized.error) {
            return res.status(400).json({ success: false, msg: normalized.error });
        }

        user.settings = normalized.settings;
        await user.save();

        return res.status(200).json({
            success: true,
            msg: 'Settings updated',
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        return mongoFailure(res, error, 'Failed to update settings');
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

        const phoneTaken = await User.findOne({
            country_code: phone.country_code,
            phone_no: phone.phone_no
        });
        if (phoneTaken) {
            return res.status(409).json({
                success: false,
                msg: 'User already exists with this phone number. Please sign in.'
            });
        }

        if (email) {
            const emailTaken = await User.findOne({ email });
            if (emailTaken) {
                return res.status(409).json({
                    success: false,
                    msg: 'User already exists with this email. Please sign in.'
                });
            }
        }

        const user = new User({
            username,
            auth_provider: 'local',
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
            const key = Object.keys(err.keyPattern || {})[0] || '';
            const msg =
                key === 'email'
                    ? 'User already exists with this email. Please sign in.'
                    : key === 'phone_no' || key === 'country_code'
                      ? 'User already exists with this phone number. Please sign in.'
                      : 'User already exists. Please sign in.';
            return res.status(409).json({ success: false, msg });
        }
        return mongoFailure(res, err, 'Registration failed');
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

        if (!user.password) {
            return res.status(400).json({
                success: false,
                msg: 'This account uses Google sign-in. Continue with Google instead.'
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
        return mongoFailure(res, error, 'Login failed');
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
                msg: 'If that phone number is registered, a reset code is available for 15 minutes.'
            });
        }

        const otp = await createPasswordOtp(otpKey);
        const payload = {
            success: true,
            msg: 'If that phone number is registered, a reset code is available for 15 minutes.'
        };
        if (shouldReturnOtpInResponse()) {
            payload.resetCode = otp;
            payload.devOtp = otp; // backward compatible with older frontend
        }
        return res.status(200).json(payload);
    } catch (error) {
        console.log(error);
        return mongoFailure(res, error, 'Failed to send reset code');
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
        return mongoFailure(res, error, 'Failed to reset password');
    }
});

module.exports = router;
