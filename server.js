const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { isMongoReady, requireMongo } = require('./utils/mongo');
const { initRealtime } = require('./utils/realtime');

dotenv.config({
  path: './config/config.env'
});

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(morgan('dev'));

/** Comma-separated allowlist, or reflect request origin in loose/dev mode. */
function buildCorsOrigin() {
  const raw =
    process.env.CORS_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    '';
  if (!raw || raw === '*' || raw === 'true') {
    return true;
  }
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (origin, callback) => {
    // Native Expo / mobile clients often send no Origin header.
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    // Always allow local Expo web / emulators so shop can load during development.
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i.test(
        origin,
      )
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin ${origin}`));
  };
}
app.use(
  cors({
    origin: buildCorsOrigin(),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, msg: 'Too many requests, try again later' },
  skip: (req) => req.method === 'GET',
});

connectDB().catch((err) => {
  console.log('MongoDB bootstrap failed:'.red, err.message);
});

app.get('/api/violet/health', (req, res) => {
  const mongo = isMongoReady();
  res.status(200).json({
    success: true,
    version: 4,
    mongo,
    features: [
      'multi-image',
      'messages',
      'notifications',
      'password-reset',
      'google-oauth',
      'order-tracking',
      'returns',
      'shops',
      'coupons',
      'offers',
      'wishlists',
      'admin',
      'guest-checkout',
      'realtime-messaging',
      'payouts',
      'currency-display',
      'push-subscribe',
      'reports',
    ],
  });
});

app.use('/api/violet/auth', authLimiter, require('./routes/user'));
app.use('/api/violet/guest', requireMongo, require('./routes/guest'));
app.use('/api/violet/products', require('./routes/product'));
app.use('/api/violet/favorites', requireMongo, require('./routes/favorites'));
app.use('/api/violet/cart', requireMongo, require('./routes/cart'));
app.use('/api/violet/orders', requireMongo, require('./routes/orders'));
app.use('/api/violet/reviews', requireMongo, require('./routes/reviews'));
app.use('/api/violet/messages', requireMongo, require('./routes/messages'));
app.use('/api/violet/notifications', requireMongo, require('./routes/notifications'));
app.use('/api/violet/shops', requireMongo, require('./routes/shops'));
app.use('/api/violet/coupons', requireMongo, require('./routes/coupons'));
app.use('/api/violet/reports', requireMongo, require('./routes/reports'));
app.use('/api/violet/wishlists', requireMongo, require('./routes/wishlists'));
app.use('/api/violet/admin', requireMongo, require('./routes/admin'));
app.use('/api/violet/payouts', requireMongo, require('./routes/payouts'));
app.use('/api/violet/offers', requireMongo, require('./routes/offers'));
app.use('/api/violet/platform', require('./routes/platform'));

const { s3Configured, ensureBucket } = require('./utils/s3');
if (s3Configured) {
  ensureBucket().catch((err) => {
    console.log('S3 bucket warmup failed:', err.message);
  });
} else {
  console.log('S3 disabled — set S3_ENDPOINT or real AWS credentials to enable image uploads');
}

const frontendDist = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  const server = http.createServer(app);
  initRealtime(server);
  server.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`.green.underline.bold);
  });
}

module.exports = app;
