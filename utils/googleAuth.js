const { OAuth2Client } = require('google-auth-library');

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

function getClient() {
  if (!googleConfigured()) return null;
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

async function verifyGoogleCredential(credential) {
  if (!credential) {
    throw new Error('Google credential is required');
  }

  if (process.env.NODE_ENV === 'test' && credential === 'test-google-token') {
    return {
      google_id: 'test-google-sub',
      email: 'google.test@example.com',
      username: 'Google Tester',
      avatar: 'https://gravatar.com/avatar/?s=200&d=retro',
      email_verified: true
    };
  }

  const client = getClient();
  if (!client) {
    const err = new Error('Google sign-in is not configured on this server');
    err.status = 503;
    throw err;
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error('Invalid Google token');
  }

  return {
    google_id: payload.sub,
    email: (payload.email || '').toLowerCase(),
    username: (payload.name || payload.given_name || 'Google User').trim(),
    avatar: payload.picture || 'https://gravatar.com/avatar/?s=200&d=retro',
    email_verified: Boolean(payload.email_verified)
  };
}

module.exports = {
  googleConfigured,
  verifyGoogleCredential
};
