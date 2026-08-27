const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO;
  if (!uri) {
    console.log('MONGO env var is missing — database features will fail');
    return null;
  }

  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => {
    console.log('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected — will retry on next query');
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 5
    });
    console.log(`MongoDB connected ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.log('MongoDB connection failed:', err.message);
    // Do not exit — keep serving static SPA / health so Render does not crash-loop.
    return null;
  }
};

module.exports = connectDB;
