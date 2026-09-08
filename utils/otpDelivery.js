/**
 * Optional SMS (Twilio) / email (SMTP) delivery for password-reset OTPs.
 * Falls back to console + API response when providers are not configured.
 */

async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { sent: false, channel: 'sms', reason: 'twilio_not_configured' };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.log('Twilio SMS failed:', text.slice(0, 200));
    return { sent: false, channel: 'sms', reason: 'twilio_error' };
  }
  return { sent: true, channel: 'sms' };
}

async function sendEmail({ to, subject, text }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !to) {
    return { sent: false, channel: 'email', reason: 'smtp_not_configured' };
  }
  // Lightweight SMTP via raw fetch to a transactional API if SMTP_HTTP_URL set,
  // otherwise log — avoid adding nodemailer dependency weight on free deploys.
  if (process.env.SMTP_HTTP_URL) {
    const res = await fetch(process.env.SMTP_HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pass}`,
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      return { sent: false, channel: 'email', reason: 'smtp_http_error' };
    }
    return { sent: true, channel: 'email' };
  }
  console.log(`[Violet] Email OTP to ${to}: ${text}`);
  return { sent: false, channel: 'email', reason: 'smtp_http_url_missing_logged' };
}

async function deliverPasswordOtp({ phoneE164, email, otp }) {
  const body = `Your Violet password reset code is ${otp}. It expires in 15 minutes.`;
  const results = [];
  if (phoneE164) {
    results.push(await sendSms(phoneE164, body));
  }
  if (email) {
    results.push(
      await sendEmail({
        to: email,
        subject: 'Violet password reset code',
        text: body,
      }),
    );
  }
  return {
    delivered: results.some((r) => r.sent),
    results,
  };
}

module.exports = {
  sendSms,
  sendEmail,
  deliverPasswordOtp,
};
