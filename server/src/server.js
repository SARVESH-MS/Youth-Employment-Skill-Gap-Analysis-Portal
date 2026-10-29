'use strict';

const app = require('./app');
const { env, assertProductionSafety } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { User } = require('./models');
const { createLogger } = require('./utils/logger');
const readinessScoreService = require('./services/readinessScore.service');
const { startMarketDemandScheduler, stopMarketDemandScheduler } = require('./services/marketDemand.service');

const log = createLogger('server');
let server;

const bootstrapInitialAdmin = async () => {
  const existing = await User.exists({ role: 'admin' });
  if (existing) return;
  const { email, username, phone, password, fullName } = env.initialAdmin;
  if (![email, username, phone, password, fullName].every(Boolean)) {
    throw new Error('No admin exists yet. Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_PHONE, INITIAL_ADMIN_PASSWORD, and INITIAL_ADMIN_FULL_NAME to bootstrap the first admin.');
  }
  const admin = new User({ role: 'admin', email, username, phone, fullName, isSuperAdmin: true });
  await admin.setPassword(password);
  await admin.save();
  log.info(`Initial super admin created for ${email}; rotate its configured password after sign-in.`);
};

const start = async () => {
  assertProductionSafety();
  await connectDB();
  await bootstrapInitialAdmin();
  const migratedLinks = await readinessScoreService.migrateDomainSkillMetadata();
  if (migratedLinks) log.info(`Added domain-specific readiness importance metadata to ${migratedLinks} skill links`);
  await startMarketDemandScheduler(log);
  server = app.listen(env.server.port, '0.0.0.0', () => log.info(`YESGAP API listening on port ${env.server.port}`));
};

const shutdown = async (signal) => {
  log.info(`${signal} received; closing the server`);
  stopMarketDemandScheduler();
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
start().catch((error) => {
  log.error('Startup failed', { message: error.message, stack: error.stack });
  process.exitCode = 1;
});
