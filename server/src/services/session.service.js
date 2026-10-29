'use strict';

const { env } = require('../config/env');
const { RefreshToken } = require('../models');
const { signAccessToken, signRefreshToken, hashToken, randomToken, verifyRefreshToken } = require('../utils/token');
const ApiError = require('../utils/ApiError');
const { createCsrfToken, verifyCsrfToken } = require('../utils/csrf');

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: env.isProduction || env.auth.cookieSameSite === 'none',
  sameSite: env.auth.cookieSameSite,
  path: '/api',
  ...(maxAge ? { maxAge } : {}),
});

const serializeUser = (user) => {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.passwordHash;
  delete value.googleId;
  return value;
};

const issue = async (user, req, res) => {
  const jti = randomToken(24);
  const refresh = signRefreshToken(user, jti);
  const refreshClaims = verifyRefreshToken(refresh);
  await RefreshToken.create({
    user: user._id,
    sessionId: jti,
    tokenHash: hashToken(refresh),
    expiresAt: new Date(refreshClaims.exp * 1000),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 400),
    ip: req.ip,
  });
  res.cookie('yesgap_access', signAccessToken(user, jti), cookieOptions(30 * 60 * 1000));
  res.cookie('yesgap_refresh', refresh, cookieOptions(7 * 24 * 60 * 60 * 1000));
  const csrfToken = verifyCsrfToken(req.cookies?.yesgap_csrf) ? req.cookies.yesgap_csrf : createCsrfToken();
  res.cookie('yesgap_csrf', csrfToken, { ...cookieOptions(7 * 24 * 60 * 60 * 1000), httpOnly: false });
  res.setHeader('X-CSRF-Token', csrfToken);
};

const rotate = async (req, res) => {
  const refresh = req.cookies?.yesgap_refresh;
  if (!refresh) throw ApiError.unauthorized('Your session has expired; please sign in again');
  const claims = verifyRefreshToken(refresh);
  const tokenHash = hashToken(refresh);
  const existing = await RefreshToken.findOne({ tokenHash, user: claims.sub, revokedAt: null });
  if (!existing || !existing.isActive()) throw ApiError.unauthorized('Your session has expired; please sign in again');
  const lastActiveAt = existing.lastUsedAt?.getTime?.() || existing.createdAt?.getTime?.() || 0;
  if (Date.now() - lastActiveAt > env.auth.idleTimeoutMinutes * 60 * 1000) {
    existing.revokedAt = new Date();
    await existing.save();
    throw ApiError.unauthorized('Your session expired after a period of inactivity');
  }
  const { User } = require('../models');
  const user = await User.findById(claims.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('This account is unavailable');
  const replacement = signRefreshToken(user, randomToken(24));
  const replacementClaims = verifyRefreshToken(replacement);
  const replacementHash = hashToken(replacement);
  await RefreshToken.create({
    user: user._id,
    sessionId: replacementClaims.jti,
    tokenHash: replacementHash,
    expiresAt: new Date(replacementClaims.exp * 1000),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 400),
    ip: req.ip,
  });
  existing.revokedAt = new Date();
  existing.replacedByHash = replacementHash;
  existing.lastUsedAt = new Date();
  await existing.save();
  res.cookie('yesgap_access', signAccessToken(user, replacementClaims.jti), cookieOptions(30 * 60 * 1000));
  res.cookie('yesgap_refresh', replacement, cookieOptions(7 * 24 * 60 * 60 * 1000));
  const csrfToken = verifyCsrfToken(req.cookies?.yesgap_csrf) ? req.cookies.yesgap_csrf : createCsrfToken();
  res.cookie('yesgap_csrf', csrfToken, { ...cookieOptions(7 * 24 * 60 * 60 * 1000), httpOnly: false });
  res.setHeader('X-CSRF-Token', csrfToken);
  return user;
};

const revoke = async (req, res) => {
  const refresh = req.cookies?.yesgap_refresh;
  if (refresh) await RefreshToken.updateOne({ tokenHash: hashToken(refresh), revokedAt: null }, { $set: { revokedAt: new Date() } });
  res.clearCookie('yesgap_access', cookieOptions());
  res.clearCookie('yesgap_refresh', cookieOptions());
  res.clearCookie('yesgap_csrf', { ...cookieOptions(), httpOnly: false });
};

module.exports = { issue, rotate, revoke, serializeUser };
