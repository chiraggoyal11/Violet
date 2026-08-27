const path = require('path');
const fs = require('fs');
const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { isMongoReady } = require('./utils/mongo');

dotenv.config({
  path: './config/config.env'
});

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Allow Google Identity Services popup to postMessage the ID token back.
  // Default "same-origin" severs window.opener and leaves a blank
  // accounts.google.com/gsi/transform page after sign-in.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(morgan('dev'));

const corsOrigin =
  process.env.CORS_ORIGIN ||
  process.env.RENDER_EXTERNAL_URL ||
  true;
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, msg: 'Too many requests, try again later' }
});

connectDB().catch((err) => {
  console.log('MongoDB bootstrap failed:'.red, err.message);
});

app.get('/api/violet/health', (req, res) => {
  const mongo = isMongoReady();
  res.status(200).json({
    success: true,
    version: 3,
    mongo,
    features: ['multi-image', 'messages', 'notifications', 'password-reset', 'google-oauth']
  });
});

app.use('/api/violet/auth', authLimiter, require('./routes/user'));
app.use('/api/violet/products', require('./routes/product'));
app.use('/api/violet/favorites', require('./routes/favorites'));
app.use('/api/violet/cart', require('./routes/cart'));
app.use('/api/violet/orders', require('./routes/orders'));
app.use('/api/violet/reviews', require('./routes/reviews'));
app.use('/api/violet/messages', require('./routes/messages'));
app.use('/api/violet/notifications', require('./routes/notifications'));

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
  app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`.green.underline.bold);
  });
}

module.exports = app;
