'use strict';

/**
 * MongoDB (Mongoose) connection management plus GridFS bucket access.
 *
 * The whole platform uses one MongoDB database; resumes are stored inside it
 * with GridFS, so there is never a second datastore.
 */

const mongoose = require('mongoose');
const { env } = require('./env');

mongoose.set('strictQuery', true);

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return mongoose.connection;
  if (!env.db.uri) {
    throw new Error('MONGODB_URI is required. Set the Atlas connection string in server/.env or the deployment environment.');
  }
  if (!env.db.uri.startsWith('mongodb+srv://')) {
    throw new Error('YESGAP is configured to use MongoDB Atlas. MONGODB_URI must be an Atlas mongodb+srv:// connection string.');
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    // eslint-disable-next-line no-console
    console.log(`[db] connected → ${mongoose.connection.name}`);
  });
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    // eslint-disable-next-line no-console
    console.warn('[db] disconnected');
  });
  mongoose.connection.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[db] connection error:', error.message);
  });

  await mongoose.connect(env.db.uri, env.db.options);
  isConnected = true;
  return mongoose.connection;
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  isConnected = false;
};

/**
 * Lazily create (and cache) a GridFS bucket. GridFS buckets are implicitly
 * created on first write, so this is safe to call before any upload happens.
 */
const gridFsBuckets = new Map();

const getGridFSBucket = (bucketName = env.resume.bucketName) => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready — cannot open a GridFS bucket yet');
  }
  if (!gridFsBuckets.has(bucketName)) {
    gridFsBuckets.set(bucketName, new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName }));
  }
  return gridFsBuckets.get(bucketName);
};

module.exports = {
  mongoose,
  connectDB,
  disconnectDB,
  getGridFSBucket,
};
