const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_RULES = [
  { test: (p) => p.length >= PASSWORD_MIN_LENGTH, msg: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p) => /[A-Z]/.test(p), msg: 'Password must include an uppercase letter' },
  { test: (p) => /[a-z]/.test(p), msg: 'Password must include a lowercase letter' },
  { test: (p) => /[0-9]/.test(p), msg: 'Password must include a number' },
  {
    test: (p) => /[^A-Za-z0-9]/.test(p),
    msg: 'Password must include a special character'
  }
];

const COUNTRY_CODE_PATTERN = /^\+[1-9]\d{0,3}$/;

function validatePassword(password) {
  const value = String(password || '');
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(value)) {
      return { valid: false, msg: rule.msg };
    }
  }
  return { valid: true, msg: '' };
}

function normalizeCountryCode(code, fallback = '+91') {
  const raw = String(code || fallback).trim();
  const withPlus = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
  return withPlus;
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function validateCountryCode(country_code) {
  const code = normalizeCountryCode(country_code, '');
  if (!COUNTRY_CODE_PATTERN.test(code)) {
    return { valid: false, msg: 'Country code must start with + (e.g. +91, +1)' };
  }
  return { valid: true, code };
}

function validatePhoneNumber(phone_no) {
  const digits = normalizePhoneDigits(phone_no);
  if (!/^\d{10}$/.test(digits)) {
    return { valid: false, msg: 'Phone number must be exactly 10 digits' };
  }
  return { valid: true, phone_no: digits };
}

function parsePhoneFields(body = {}) {
  const countryResult = validateCountryCode(body.country_code || '+91');
  if (!countryResult.valid) {
    return { valid: false, msg: countryResult.msg };
  }

  const phoneResult = validatePhoneNumber(body.phone_no);
  if (!phoneResult.valid) {
    return { valid: false, msg: phoneResult.msg };
  }

  return {
    valid: true,
    country_code: countryResult.code,
    phone_no: phoneResult.phone_no
  };
}

function phoneLookupKey(country_code, phone_no) {
  return `${normalizeCountryCode(country_code)}:${normalizePhoneDigits(phone_no)}`;
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  validatePassword,
  normalizeCountryCode,
  normalizePhoneDigits,
  validateCountryCode,
  validatePhoneNumber,
  parsePhoneFields,
  phoneLookupKey
};
