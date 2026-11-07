import mongoose from 'mongoose';

let connectionPromise = null;

/**
 * Reusable MongoDB connection for AWS Lambda & local server.
 * Reuses existing warm connection pool across Lambda invocations.
 */
export async function connectDB() {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, await the existing connection promise
  if (mongoose.connection.readyState === 2 && connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment variables');

  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    maxPoolSize: 10, // Optimized pool size for serverless Lambda execution
  });

  try {
    await connectionPromise;
    console.log('[DB] MongoDB connected (readyState: 1)');
    return mongoose.connection;
  } catch (err) {
    connectionPromise = null;
    console.error('[DB] MongoDB connection error:', err.message);
    throw err;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    connectionPromise = null;
  }
}
