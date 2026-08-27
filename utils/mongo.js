const mongoose = require('mongoose');

const DB_UNAVAILABLE_MSG =
  'Database is unavailable. On MongoDB Atlas → Network Access, allow 0.0.0.0/0. On Render, confirm MONGO is set, then Manual Deploy → Restart.';

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function isMongoError(error) {
  if (!error) return false;
  if (
    error.name === 'MongoServerSelectionError' ||
    error.name === 'MongoNetworkError' ||
    error.name === 'MongooseError' ||
    error.name === 'MongoTimeoutError'
  ) {
    return true;
  }
  return /buffering timed out|ECONNREFUSED|server selection timed out|MongoNetworkError|failed to connect/i.test(
    error.message || ''
  );
}

async function ensureMongo() {
  if (isMongoReady()) return true;
  const uri = process.env.MONGO;
  if (!uri) return false;
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5
    });
    return isMongoReady();
  } catch (err) {
    console.log('MongoDB reconnect failed:', err.message);
    return false;
  }
}

function requireMongo(req, res, next) {
  Promise.resolve()
    .then(async () => {
      if (isMongoReady()) return true;
      return ensureMongo();
    })
    .then((ok) => {
      if (!ok) {
        return res.status(503).json({
          success: false,
          msg: DB_UNAVAILABLE_MSG
        });
      }
      return next();
    })
    .catch((err) => {
      console.log(err);
      return res.status(503).json({
        success: false,
        msg: DB_UNAVAILABLE_MSG
      });
    });
}

function mongoFailure(res, error, fallbackMsg) {
  if (isMongoError(error) || !isMongoReady()) {
    return res.status(503).json({
      success: false,
      msg: DB_UNAVAILABLE_MSG
    });
  }
  return res.status(error?.status || 500).json({
    success: false,
    msg: fallbackMsg || error?.message || 'Server error'
  });
}

module.exports = {
  isMongoReady,
  isMongoError,
  ensureMongo,
  requireMongo,
  mongoFailure,
  DB_UNAVAILABLE_MSG
};
