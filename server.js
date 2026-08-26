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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`.green.underline.bold);
});
