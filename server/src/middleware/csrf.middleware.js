'use strict';

const ApiError = require('../utils/ApiError');
const { safeCompare } = require('../utils/token');
const { verifyCsrfToken } = require('../utils/csrf');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

const protectCsrf = (req, _res, next) => {
  if (safeMethods.has(req.method) || req.headers.authorization?.startsWith('Bearer ')) return next();
  const hasSessionCookie = Boolean(req.cookies?.yesgap_access || req.cookies?.yesgap_refresh);
  const establishesSession = /^\/api\/auth\/(login|google|register\/)/.test(req.path);
  if (!hasSessionCookie && !establishesSession) return next();
  const cookieToken = req.cookies?.yesgap_csrf;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken) || !verifyCsrfToken(cookieToken)) {
    return next(ApiError.forbidden('A valid CSRF token is required for this request'));
  }
  return next();
};

module.exports = { protectCsrf };
