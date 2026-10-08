'use strict';

const { verifyAccessToken } = require('../utils/token');
const { User, RefreshToken } = require('../models');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

const tokenFromRequest = (req) => {
  const header = req.headers.authorization || '';
  return req.cookies?.yesgap_access || (header.startsWith('Bearer ') ? header.slice(7) : null);
};

const authenticate = async (req, _res, next) => {
  try {
    const token = tokenFromRequest(req);
    if (!token) throw ApiError.unauthorized();
    const claims = verifyAccessToken(token);
    if (claims.sid) {
      const session = await RefreshToken.findOne({ sessionId: claims.sid, user: claims.sub, revokedAt: null, expiresAt: { $gt: new Date() } }).select('_id lastUsedAt createdAt');
      if (!session) throw ApiError.unauthorized('This session has been signed out');
      const now = Date.now();
      const lastActiveAt = session.lastUsedAt?.getTime?.() || session.createdAt?.getTime?.() || 0;
      if (now - lastActiveAt > env.auth.idleTimeoutMinutes * 60 * 1000) {
        session.revokedAt = new Date(now);
        await session.save();
        throw ApiError.unauthorized('Your session expired after a period of inactivity');
      }
      if (now - lastActiveAt > 60 * 1000) {
        await RefreshToken.updateOne({ _id: session._id, revokedAt: null }, { $set: { lastUsedAt: new Date(now) } });
      }
    }
    const user = await User.findById(claims.sub).select('-passwordHash').populate('careerDomain', 'name slug category');
    if (!user || !user.isActive) throw ApiError.unauthorized('This account is unavailable');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Your account does not have access to this area'));
  }
  return next();
};

const requireApprovedCompany = (req, _res, next) => {
  if (req.user?.role !== 'company') return next(ApiError.forbidden());
  if (req.user.approvalStatus !== 'approved') {
    return next(ApiError.forbidden('Company access is pending administrator approval', {
      code: 'COMPANY_PENDING_APPROVAL',
      details: { approvalStatus: req.user.approvalStatus, approvalNote: req.user.approvalNote },
    }));
  }
  return next();
};

module.exports = { authenticate, requireRole, requireApprovedCompany };
