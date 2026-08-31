const mongoose = require('mongoose');
const { isMongoReady } = require('../utils/mongo');

const connectDB = async () => {
  const uri = process.env.MONGO;
  if (!uri) {
    console.log('MONGO env var is missing — database features will fail');
    return null;
  }

  mongoose.set('strictQuery', true);
  // Fail fast instead of hanging login/register for ~10s while buffering.
  mongoose.set('bufferTimeoutMS', 2500);

  mongoose.connection.on('error', (err) => {
    console.log('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected — will retry on next request');
  });
  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 5
    });
    console.log(`MongoDB connected ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.log('MongoDB connection failed:', err.message);
    console.log(
      'Fix: Atlas Network Access allow 0.0.0.0/0, verify Render MONGO URI, then restart the service.'
    );
    // Do not exit — keep serving static SPA / health so Render does not crash-loop.
    return null;
  }
};

connectDB.isMongoReady = isMongoReady;

module.exports = connectDB;
