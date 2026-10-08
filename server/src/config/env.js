'use strict';

/**
 * Centralised, validated environment configuration.
 *
 * Every module reads configuration from here — never from `process.env`
 * directly — so defaults, coercion and validation live in exactly one place.
 */

const path = require('path');
const dotenv = require('dotenv');

// The .env file always lives at the server package root, regardless of the
// process working directory (workspace scripts vs. direct node invocation).
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toList = (value, fallback = []) => {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const isPlaceholderSecret = (value) => !value || value.length < 32 || /^(replace|your|change|dev)[-_!]/i.test(value) || value.includes('change-me');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const env = {
  nodeEnv: NODE_ENV,
  isProduction,
  isDevelopment: NODE_ENV === 'development',
  isTest: NODE_ENV === 'test',

  server: {
    port: toInt(process.env.PORT, 5000),
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  },

  db: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/youth_employment_sgap',
    options: {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20,
    },
  },

  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    idleTimeoutMinutes: toInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES, 30),
    saltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 12),
  },

  security: {
    corsOrigins: toList(process.env.CORS_ORIGIN || process.env.CLIENT_URL, [
      'http://localhost:5173',
    ]),
    rateLimitWindowMinutes: toInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
    rateLimitMax: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
    authRateLimitMax: toInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 20),
    csrfSecret: process.env.CSRF_SECRET || 'dev-csrf-secret-change-me',
  },

  initialAdmin: {
    email: process.env.INITIAL_ADMIN_EMAIL || (isProduction ? '' : 'super.admin@yesgap.local'),
    username: process.env.INITIAL_ADMIN_USERNAME || (isProduction ? '' : 'superadmin'),
    phone: process.env.INITIAL_ADMIN_PHONE || (isProduction ? '' : '9000000001'),
    password: process.env.INITIAL_ADMIN_PASSWORD || (isProduction ? '' : 'ChangeMe!SuperAdmin#2026'),
    fullName: process.env.INITIAL_ADMIN_FULL_NAME || (isProduction ? '' : 'Platform Super Administrator'),
  },

  resume: {
    maxFileSizeMb: toInt(process.env.RESUME_MAX_FILE_SIZE_MB, 5),
    allowedMimeTypes: toList(process.env.RESUME_ALLOWED_MIME_TYPES, [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    bucketName: 'resumes',
  },

  execution: {
    enabled: toBool(process.env.EXECUTION_ENABLED, false),
    runnerUrl: process.env.EXECUTION_SERVICE_URL || '',
    runnerToken: process.env.EXECUTION_SERVICE_TOKEN || '',
    timeoutMs: toInt(process.env.EXECUTION_TIMEOUT_MS, 5000),
    cpuLimitSeconds: toInt(process.env.EXECUTION_CPU_LIMIT_SECONDS, 5),
    memoryLimitMb: toInt(process.env.EXECUTION_MEMORY_LIMIT_MB, 256),
    maxOutputChars: toInt(process.env.EXECUTION_MAX_OUTPUT_CHARS, 20000),
    tempDir: process.env.EXECUTION_TEMP_DIR || '.sandbox',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  },

  seed: {
    demoData: toBool(process.env.SEED_DEMO_DATA, !isProduction),
    studentCount: toInt(process.env.SEED_STUDENT_COUNT, 60),
    companyCount: toInt(process.env.SEED_COMPANY_COUNT, 100),
    adminCount: toInt(process.env.SEED_ADMIN_COUNT, 4),
    demoPassword: process.env.SEED_DEMO_PASSWORD || 'Demo@12345',
  },
};

/**
 * Fail fast on truly unsafe production configuration instead of silently
 * booting with development defaults.
 */
const assertProductionSafety = () => {
  if (!isProduction) return;
  const problems = [];
  if (isPlaceholderSecret(env.auth.accessSecret)) {
    problems.push('JWT_ACCESS_SECRET must be set to a strong secret in production');
  }
  if (isPlaceholderSecret(env.auth.refreshSecret)) {
    problems.push('JWT_REFRESH_SECRET must be set to a strong secret in production');
  }
  if (isPlaceholderSecret(env.security.csrfSecret)) {
    problems.push('CSRF_SECRET must be set in production');
  }
  if (env.initialAdmin.password && (env.initialAdmin.password.length < 14 || env.initialAdmin.password === 'ChangeMe!SuperAdmin#2026')) {
    problems.push('INITIAL_ADMIN_PASSWORD must be a unique password of at least 14 characters in production');
  }
  if (env.initialAdmin.email?.endsWith('.local') || env.initialAdmin.username === 'superadmin') {
    problems.push('Replace the development INITIAL_ADMIN_* values before production');
  }
  if (env.seed.demoData) problems.push('SEED_DEMO_DATA must be false in production');
  if (env.execution.enabled && !env.execution.runnerUrl) problems.push('EXECUTION_SERVICE_URL must point to an isolated runner when code execution is enabled');
  if (env.execution.enabled && !env.execution.runnerToken) problems.push('EXECUTION_SERVICE_TOKEN must be set when code execution is enabled');
  if (env.execution.runnerUrl && !env.execution.runnerUrl.startsWith('https://')) problems.push('EXECUTION_SERVICE_URL must use HTTPS in production');
  if (problems.length) {
    throw new Error(`Unsafe production configuration:\n  - ${problems.join('\n  - ')}`);
  }
};

module.exports = { env, assertProductionSafety };
