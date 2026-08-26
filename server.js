const path = require('path');
const fs = require('fs');
const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config({
    path: './config/config.env'
});

const app = express();

app.use(morgan('dev'));
app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

connectDB();

app.use('/api/violet/auth', require('./routes/user'));
app.use('/api/violet/products', require('./routes/product'));

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
