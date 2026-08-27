const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const PasswordReset = require('../models/passwordReset');

const OTP_TTL_MS = 15 * 60 * 1000;

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function devOtpEnabled() {
  return (
    process.env.RESET_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development'
  );
}

/** Return the OTP in the API response when no SMS/email provider is configured. */
function shouldReturnOtpInResponse() {
  if (process.env.RESET_RETURN_OTP === 'false') return false;
  if (devOtpEnabled()) return true;
  if (process.env.RESET_RETURN_OTP === 'true') return true;
  // Default for free-tier deploys without Twilio/SMTP: show code once in the UI.
  return !process.env.TWILIO_ACCOUNT_SID && !process.env.SMTP_HOST;
}

async function createPasswordOtp(phone_no) {
  const otp = generateOtp();
  const otpHash = await bcryptjs.hash(otp, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await PasswordReset.deleteMany({ phone_no });
  await PasswordReset.create({ phone_no, otpHash, expiresAt });

  if (devOtpEnabled() || shouldReturnOtpInResponse()) {
    console.log(`[Violet] Password reset OTP for ${phone_no}: ${otp}`);
  }

  return otp;
}

async function verifyPasswordOtp(phone_no, otp) {
  const record = await PasswordReset.findOne({ phone_no }).sort({ _id: -1 });
  if (!record || record.expiresAt < new Date()) {
    return false;
  }
  const ok = await bcryptjs.compare(String(otp), record.otpHash);
  if (ok) {
    await PasswordReset.deleteMany({ phone_no });
  }
  return ok;
}

module.exports = {
  createPasswordOtp,
  verifyPasswordOtp,
  devOtpEnabled,
  shouldReturnOtpInResponse
};
