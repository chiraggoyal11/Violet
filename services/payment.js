const crypto = require('crypto');

/**
 * Payment gateway abstraction for Violet.
 * Default: demo (no merchant keys).
 * Optional: Razorpay when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set.
 */

const METHODS = new Set(['card', 'upi', 'cod']);

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function razorpayConfigured() {
  return Boolean(env('RAZORPAY_KEY_ID') && env('RAZORPAY_KEY_SECRET'));
}

function getPaymentMode() {
  const forced = env('PAYMENT_MODE').toLowerCase();
  if (forced === 'demo' || forced === 'razorpay') return forced;
  return razorpayConfigured() ? 'razorpay' : 'demo';
}

function getPublicConfig() {
  const mode = getPaymentMode();
  return {
    mode,
    provider: mode === 'razorpay' ? 'razorpay' : 'demo',
    methods: ['upi', 'card', 'cod'],
    razorpayKeyId: mode === 'razorpay' ? env('RAZORPAY_KEY_ID') : '',
    currency: 'INR',
    demo: mode === 'demo',
  };
}

function validatePaymentInput(method, payment = {}) {
  const m = String(method || '').toLowerCase();
  if (!METHODS.has(m)) {
    return { ok: false, msg: 'Choose UPI, Card, or Cash on delivery' };
  }

  if (m === 'cod') {
    return { ok: true, method: 'cod', detail: 'Pay on delivery', masked: 'COD' };
  }

  if (m === 'upi') {
    const vpa = String(payment.upiId || '').trim().toLowerCase();
    if (!/^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i.test(vpa)) {
      return { ok: false, msg: 'Enter a valid UPI ID (example: name@upi)' };
    }
    const [user, handle] = vpa.split('@');
    return {
      ok: true,
      method: 'upi',
      detail: vpa,
      masked: `${user.slice(0, 2)}•••@${handle}`,
    };
  }

  const number = String(payment.cardNumber || '').replace(/\s+/g, '');
  const name = String(payment.cardName || '').trim();
  const expiry = String(payment.cardExpiry || '').trim();
  const cvv = String(payment.cardCvv || '').trim();
  if (!/^\d{13,19}$/.test(number)) {
    return { ok: false, msg: 'Enter a valid card number' };
  }
  if (!name || name.length < 2) {
    return { ok: false, msg: 'Enter the name on the card' };
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    return { ok: false, msg: 'Enter expiry as MM/YY' };
  }
  if (!/^\d{3,4}$/.test(cvv)) {
    return { ok: false, msg: 'Enter a valid CVV' };
  }

  // Demo decline path for testing failed payments
  if (number.endsWith('0000')) {
    return { ok: false, msg: 'Card declined. Try another card or UPI.' };
  }

  return {
    ok: true,
    method: 'card',
    detail: `•••• ${number.slice(-4)}`,
    masked: `•••• ${number.slice(-4)}`,
    last4: number.slice(-4),
  };
}

function makeRef(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

async function chargeDemo({ amount, method, payCheck }) {
  // Simulate gateway latency
  await new Promise((r) => setTimeout(r, 450));

  if (method === 'cod') {
    return {
      ok: true,
      provider: 'cod',
      status: 'pending',
      ref: makeRef('cod'),
      detail: payCheck.detail,
      masked: payCheck.masked,
      amount: Number(amount).toFixed(2),
      currency: 'INR',
      paidAt: null,
    };
  }

  return {
    ok: true,
    provider: 'demo',
    status: 'paid',
    ref: makeRef(`demo_${method}`),
    detail: payCheck.detail,
    masked: payCheck.masked,
    amount: Number(amount).toFixed(2),
    currency: 'INR',
    paidAt: new Date(),
  };
}

async function createRazorpayOrder({ amount, receipt }) {
  const keyId = env('RAZORPAY_KEY_ID');
  const keySecret = env('RAZORPAY_KEY_SECRET');
  const paise = Math.round(Number(amount) * 100);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: paise,
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),
      payment_capture: 1,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      msg: data?.error?.description || 'Could not start Razorpay payment',
    };
  }

  return {
    ok: true,
    provider: 'razorpay',
    razorpayOrderId: data.id,
    amount: paise,
    currency: data.currency || 'INR',
    keyId,
  };
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const secret = env('RAZORPAY_KEY_SECRET');
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === String(signature || '');
}

/**
 * Charge (demo/COD) or prepare Razorpay order.
 * For razorpay + card/upi: returns action 'razorpay' with order details (no charge yet).
 * For demo/cod: returns action 'captured' with payment result.
 */
async function processCheckoutPayment({
  amount,
  method,
  payment,
  receipt,
}) {
  const payCheck = validatePaymentInput(method, payment);
  if (!payCheck.ok) return payCheck;

  const mode = getPaymentMode();

  if (payCheck.method === 'cod') {
    const charged = await chargeDemo({ amount, method: 'cod', payCheck });
    return { ok: true, action: 'captured', payCheck, ...charged };
  }

  if (mode === 'razorpay') {
    const rz = await createRazorpayOrder({ amount, receipt });
    if (!rz.ok) return rz;
    return {
      ok: true,
      action: 'razorpay',
      payCheck,
      provider: 'razorpay',
      status: 'pending',
      ...rz,
    };
  }

  const charged = await chargeDemo({
    amount,
    method: payCheck.method,
    payCheck,
  });
  return { ok: true, action: 'captured', payCheck, ...charged };
}

module.exports = {
  getPaymentMode,
  getPublicConfig,
  validatePaymentInput,
  processCheckoutPayment,
  verifyRazorpaySignature,
  razorpayConfigured,
};
