export const PASSWORD_HINT =
  'At least 8 characters with uppercase, lowercase, number, and special character.';

export const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
];

export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character';
  return '';
}

export function sanitizePhoneInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

export function validatePhoneNumber(phone) {
  const digits = sanitizePhoneInput(phone);
  if (!/^\d{10}$/.test(digits)) return 'Phone number must be exactly 10 digits';
  return '';
}

export function formatPhoneDisplay(user) {
  if (!user) return '';
  const code = user.country_code || '+91';
  return `${code} ${user.phone_no || ''}`.trim();
}
