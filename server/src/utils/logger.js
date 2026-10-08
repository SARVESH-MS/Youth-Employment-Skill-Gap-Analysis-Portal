'use strict';

/**
 * logger — a tiny, dependency-free leveled logger. Requests and services use
 * this instead of raw console calls so output is consistent and can be
 * silenced or redirected in production without touching call sites.
 */

const { env } = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL =
  LEVELS[process.env.LOG_LEVEL] ?? (env.isProduction ? LEVELS.info : LEVELS.debug);

const COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
};
const RESET = '\x1b[0m';

const timestamp = () => new Date().toISOString();

const write = (level, scope, message, meta) => {
  if (LEVELS[level] > CURRENT_LEVEL) return;
  const prefix = `${COLORS[level]}[${level.toUpperCase()}]${RESET}`;
  const line = `${prefix} ${timestamp()} ${scope ? `(${scope}) ` : ''}${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) sink(line, meta);
  else sink(line);
};

/** Create a scoped logger, e.g. `const log = createLogger('auth-service')`. */
const createLogger = (scope = '') => ({
  error: (message, meta) => write('error', scope, message, meta),
  warn: (message, meta) => write('warn', scope, message, meta),
  info: (message, meta) => write('info', scope, message, meta),
  debug: (message, meta) => write('debug', scope, message, meta),
});

module.exports = { createLogger, LEVELS };
