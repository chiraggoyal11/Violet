const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
    {
        line1: { type: String, trim: true, default: '' },
        line2: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        state: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
        pincode: { type: String, trim: true, default: '' }
    },
    { _id: false }
);

const settingsSchema = new mongoose.Schema(
    {
        orderUpdates: { type: Boolean, default: true },
        messageAlerts: { type: Boolean, default: true },
        promoAlerts: { type: Boolean, default: false },
        reviewReminders: { type: Boolean, default: true },
        stockAlerts: { type: Boolean, default: true },
        showPhoneToBuyers: { type: Boolean, default: false },
        useProfileAddressAtCheckout: { type: Boolean, default: true },
        preferredCurrency: {
            type: String,
            enum: ['INR', 'USD', 'EUR'],
            default: 'INR'
        },
        defaultCheckoutNote: { type: String, trim: true, default: '' }
    },
    { _id: false }
);

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    first_name: {
        type: String,
        trim: true,
        default: ''
    },
    last_name: {
        type: String,
        trim: true,
        default: ''
    },
    gender: {
        type: String,
        enum: ['', 'female', 'male', 'non_binary', 'prefer_not_to_say'],
        default: ''
    },
    date_of_birth: {
        type: String,
        trim: true,
        default: ''
    },
    address: {
        type: addressSchema,
        default: () => ({})
    },
    settings: {
        type: settingsSchema,
        default: () => ({})
    },
    avatar: {
        type: String
    },
    avatar_key: {
        type: String,
        trim: true
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
