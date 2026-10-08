'use strict';

/**
 * token — JWT issuing/verifying plus opaque-token hashing for refresh tokens.
 * Access tokens are short-lived; refresh tokens are stored only as a SHA-256
 * hash so a database leak cannot be replayed.
 */

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const ApiError = require('./ApiError');

/** Short-lived access token carrying the minimum needed for authorization. */
const signAccessToken = (user, sessionId = undefined) =>
  jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      username: user.username,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      ...(sessionId ? { sid: sessionId } : {}),
    },
    env.auth.accessSecret,
    { expiresIn: env.auth.accessExpiresIn, issuer: 'yesgap' }
  );

/** Long-lived refresh token; `jti` lets a single session be revoked. */
const signRefreshToken = (user, jti) =>
  jwt.sign(
    { sub: String(user._id), jti, role: user.role },
    env.auth.refreshSecret,
    { expiresIn: env.auth.refreshExpiresIn, issuer: 'yesgap' }
  );

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.auth.accessSecret, { issuer: 'yesgap' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired — please sign in again', {
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }
    throw ApiError.unauthorized('Invalid authentication token', { code: 'AUTH_TOKEN_INVALID' });
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.auth.refreshSecret, { issuer: 'yesgap' });
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token', {
      code: 'AUTH_REFRESH_INVALID',
    });
  }
};

/** Stable, one-way hash for persisting refresh tokens at rest. */
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** Random opaque identifier (refresh-token jti / CSRF nonce). */
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** Compare two secrets without leaking length/timing information. */
const safeCompare = (a, b) => {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
};

/** Decode an access token's expiry so the client can schedule silent refresh. */
const accessTokenExpiryMs = () => {
  const decoded = jwt.decode(signAccessToken({ _id: '000000000000000000000000', role: 'student' }));
  return decoded?.exp ? decoded.exp * 1000 : Date.now() + 30 * 60 * 1000;
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
  safeCompare,
  accessTokenExpiryMs,
};
