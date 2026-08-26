const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcryptjs = require('bcryptjs');
const user_jwt = require('../middleware/user_jwt');
const jwt = require('jsonwebtoken');

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
    const phone_no = (req.body.phone_no || '').trim();
    const password = req.body.password || '';

    try {
        if (!username || !phone_no || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Username, phone number, and password are required'
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                msg: 'Password must be at least 6 characters'
            });
        }

        const user_exist = await User.findOne({ phone_no });
        if (user_exist) {
            return res.status(409).json({
                success: false,
                msg: 'user already exist'
            });
        }

        const user = new User({
            username,
            phone_no,
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
    const phone_no = (req.body.phone_no || '').trim();
    const password = req.body.password || '';

    try {
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Phone number and password are required'
            });
        }

        const user = await User.findOne({ phone_no });
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

module.exports = router;
