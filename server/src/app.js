'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { env } = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const assistantRoutes = require('./routes/assistant.routes');
const platformRoutes = require('./routes/platform.routes');
const adminRoutes = require('./routes/admin.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { protectCsrf } = require('./middleware/csrf.middleware');
const { createLogger } = require('./utils/logger');

const log = createLogger('http');
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.isProduction ? 1 : false);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.security.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token', 'X-Session-Idle-Timeout'],
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());
app.use(protectCsrf);
app.use(mongoSanitize());
app.use((_req, res, next) => { res.setHeader('X-Session-Idle-Timeout', String(env.auth.idleTimeoutMinutes)); next(); });
if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev', { stream: { write: (line) => log.info(line.trim()) } }));

app.get('/api/health/live', (_req, res) => res.json({
  success: true,
  data: { status: 'ok', service: 'yesgap-api', timestamp: new Date().toISOString() },
}));
const readinessHealth = (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: {
      status: databaseConnected ? 'ok' : 'not-ready',
      service: 'yesgap-api',
      dependencies: { mongodb: databaseConnected ? 'connected' : 'disconnected' },
      timestamp: new Date().toISOString(),
    },
  });
};
app.get('/api/health/ready', readinessHealth);
app.get('/api/health', readinessHealth);
app.use('/api', rateLimit({
  windowMs: env.security.rateLimitWindowMinutes * 60 * 1000,
  limit: env.security.rateLimitMax,
  // Authentication has its own limiter; don't let unrelated app traffic
  // exhaust the shared API bucket and prevent users from signing in.
  skip: (req) => req.path.startsWith('/auth/'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ success: false, message: 'Too many requests. Please wait a moment and try again.' }),
}));
app.use('/api/auth', authRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', platformRoutes);
app.use('/api', notFound);

// In production, serve the Vite build from the same origin as the API. This
// keeps session cookies first-party and lets BrowserRouter deep links work.
if (env.isProduction) {
  const clientBuildPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientBuildPath, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.startsWith(path.join(clientBuildPath, 'assets') + path.sep)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(clientBuildPath, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use(errorHandler);

module.exports = app;
