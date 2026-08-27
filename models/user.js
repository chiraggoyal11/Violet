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
    auth_provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    google_id: {
        type: String,
        trim: true,
        sparse: true,
        unique: true
    },
    country_code: {
        type: String,
        trim: true,
        default: '+91'
    },
    phone_no: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
        unique: true
    },
    password: {
        type: String
    }
});

userSchema.index(
    { country_code: 1, phone_no: 1 },
    {
        unique: true,
        partialFilterExpression: {
            phone_no: { $type: 'string', $gt: '' }
        }
    }
);

module.exports = mongoose.model('User', userSchema);
