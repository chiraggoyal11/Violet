const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    avatar: {
        type: String
    },
    country_code: {
        type: String,
        required: true,
        trim: true,
        default: '+91'
    },
    phone_no: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

userSchema.index({ country_code: 1, phone_no: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
