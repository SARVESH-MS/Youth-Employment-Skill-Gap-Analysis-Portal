'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { body, validationResult } = require('express-validator');
const { User, Domain, Skill, UserSkill, ActivityLog, RefreshToken } = require('../models');
const { env } = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { issue, rotate, revoke, serializeUser } = require('../services/session.service');
const { notifyAdmins } = require('../services/notification.service');
const { authenticate } = require('../middleware/auth.middleware');
const { recordActivity } = require('../services/activity.service');
const { createCsrfToken, verifyCsrfToken } = require('../utils/csrf');

const router = express.Router();
const googleAuthClient = new OAuth2Client();
const authApiRateLimit = rateLimit({
  windowMs: env.security.rateLimitWindowMinutes * 60 * 1000,
  limit: env.security.rateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: 'Too many authentication requests. Please wait a moment and try again.',
  }),
});
const credentialRateLimit = rateLimit({
  windowMs: env.security.rateLimitWindowMinutes * 60 * 1000,
  limit: env.security.authRateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    message: 'Too many sign-in attempts. Please wait a few minutes before trying again.',
  }),
});
router.use(authApiRateLimit);
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(ApiError.unprocessable('Please correct the highlighted fields', errors.array()));
  return next();
};

router.get('/csrf', (req, res) => {
  const token = verifyCsrfToken(req.cookies?.yesgap_csrf) ? req.cookies.yesgap_csrf : createCsrfToken();
  res.cookie('yesgap_csrf', token, { httpOnly: false, secure: env.isProduction, sameSite: 'strict', path: '/api', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.setHeader('X-CSRF-Token', token);
  res.json({ success: true, data: { token } });
});

router.post('/register/student', credentialRateLimit, [
  body('fullName').trim().isLength({ min: 2, max: 120 }),
  body('username').trim().isLength({ min: 3, max: 60 }).matches(/^[a-z0-9_.-]+$/i),
  body('email').trim().isEmail().normalizeEmail(),
  body('phone').trim().isLength({ min: 7, max: 20 }),
  body('password').isLength({ min: 10, max: 128 }),
  body('confirmPassword').custom((value, { req }) => value === req.body.password),
], validate, asyncHandler(async (req, res) => {
  const { fullName, username, email, phone, password, domainId, skills = [], education = {}, spokenLanguages = [] } = req.body;
  if (!Array.isArray(skills) || skills.length > 100) throw ApiError.badRequest('Choose skills from the catalog');
  const domain = domainId ? await Domain.findById(domainId) : null;
  if (domainId && !domain) throw ApiError.badRequest('Choose a valid career domain');
  const skillDocs = skills.length ? await Skill.find({ _id: { $in: skills }, isActive: true }).select('_id') : [];
  if (skillDocs.length !== skills.length) throw ApiError.badRequest('One or more selected skills are no longer available');
  const user = new User({ role: 'student', fullName, username, email, phone, careerDomain: domain?._id, education, spokenLanguages });
  await user.setPassword(password);
  await user.save();
  if (skillDocs.length) await UserSkill.insertMany(skillDocs.map(({ _id }) => ({ user: user._id, skill: _id, status: 'known', source: 'signup', progress: 0 })));
  await issue(user, req, res);
  await recordActivity(user, 'login', { meta: { source: 'registration' } });
  res.status(201).json({ success: true, message: 'Your student account is ready', data: serializeUser(user) });
}));

router.post('/register/company', credentialRateLimit, [
  body('companyName').trim().isLength({ min: 2, max: 200 }),
  body('fullName').trim().isLength({ min: 2, max: 120 }),
  body('username').trim().isLength({ min: 3, max: 60 }).matches(/^[a-z0-9_.-]+$/i),
  body('email').trim().isEmail().normalizeEmail(),
  body('phone').trim().isLength({ min: 7, max: 20 }),
  body('password').isLength({ min: 10, max: 128 }),
], validate, asyncHandler(async (req, res) => {
  const { companyName, fullName, username, email, phone, password, designation, industry, description, website, location, expectedCompensation, expectedHires, hiringRequirements, requiredSkills = [] } = req.body;
  if (!Array.isArray(requiredSkills) || requiredSkills.length > 100) throw ApiError.badRequest('Required skills must come from the catalog');
  const skillDocs = requiredSkills.length ? await Skill.find({ _id: { $in: requiredSkills }, isActive: true }).select('_id') : [];
  if (skillDocs.length !== requiredSkills.length) throw ApiError.badRequest('One or more required skills are unavailable');
  const user = new User({ role: 'company', fullName, memberName: fullName, companyName, username, email, phone, designation, industry, description, website, location, expectedCompensation, expectedHires, hiringRequirements, requiredSkills: skillDocs.map(({ _id }) => _id), approvalStatus: 'pending' });
  await user.setPassword(password);
  await user.save();
  await issue(user, req, res);
  await notifyAdmins('company-registration-pending', 'Company approval needed', `${companyName} submitted a registration for review.`, { meta: { companyId: String(user._id) }, priority: 'high' });
  res.status(201).json({ success: true, message: 'Registration received. Company access opens after admin approval.', data: serializeUser(user) });
}));

router.post('/google', credentialRateLimit, [
  body('credential').isString().isLength({ min: 100, max: 8192 }),
  body('role').isIn(['student', 'company']),
  body('password').optional().isString().isLength({ max: 128 }),
], validate, asyncHandler(async (req, res) => {
  if (!env.auth.googleClientId) throw new ApiError(503, 'Google sign-in is not configured yet');

  let payload;
  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: req.body.credential,
      audience: env.auth.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Google sign-in could not be verified. Please try again.');
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw ApiError.unauthorized('Google must provide a verified email address to sign in');
  }

  const email = payload.email.trim().toLowerCase();
  let user = await User.findOne({ googleId: payload.sub }).select('+googleId');
  if (user && user.role !== req.body.role) {
    throw ApiError.forbidden('Choose the role associated with this YESGAP account');
  }

  if (!user) {
    user = await User.findOne({ email }).select('+googleId');
    if (!user) throw ApiError.notFound('No YESGAP account uses this Google email. Create a profile with this email first.');
    if (user.role !== req.body.role) {
      throw ApiError.forbidden('Choose the role associated with this YESGAP account');
    }
    if (user.googleId) {
      if (user.googleId !== payload.sub) throw ApiError.conflict('This YESGAP account is linked to a different Google account');
    } else {
      if (!req.body.password) throw ApiError.conflict('Enter your YESGAP password above to securely link Google to this account, then try again');
      const accountToLink = await User.findById(user._id).select('+passwordHash +googleId');
      if (!accountToLink || !(await accountToLink.verifyPassword(req.body.password))) {
        throw ApiError.unauthorized('Your YESGAP password is incorrect; Google was not linked');
      }
      accountToLink.googleId = payload.sub;
      user = accountToLink;
    }
    if (user.googleId && user.googleId !== payload.sub) {
      throw ApiError.conflict('This YESGAP account is linked to a different Google account');
    }
  }

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  await issue(user, req, res);
  await recordActivity(user, 'login', { meta: { source: 'google' } });
  res.json({ success: true, message: 'Signed in with Google', data: serializeUser(user) });
}));

router.post('/login', credentialRateLimit, [
  body('identifier').trim().notEmpty(),
  body('password').isString().isLength({ min: 1, max: 128 }),
  body('role').isIn(['student', 'company', 'admin']),
], validate, asyncHandler(async (req, res) => {
  const { identifier, password, role } = req.body;
  const user = await User.findByIdentifierAndRole(identifier, role);
  if (!user || !(await user.verifyPassword(password))) throw ApiError.unauthorized('Email, phone, username, or password is incorrect');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  await issue(user, req, res);
  await recordActivity(user, 'login');
  res.json({ success: true, message: 'Signed in', data: serializeUser(user) });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const user = await rotate(req, res);
  res.json({ success: true, data: serializeUser(user) });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await revoke(req, res);
  res.json({ success: true, message: 'Signed out' });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ success: true, data: serializeUser(req.user) });
}));

router.patch('/password', authenticate, [body('currentPassword').isString(), body('password').isLength({ min: 10, max: 128 })], validate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!await user.verifyPassword(req.body.currentPassword)) throw ApiError.unauthorized('Current password is incorrect');
  await user.setPassword(req.body.password);
  user.mustChangePassword = false;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await issue(user, req, res);
  await User.updateOne({ _id: user._id }, { $set: { lastActivityAt: new Date() } });
  res.json({ success: true, message: 'Password updated. Other sessions have been signed out.', data: serializeUser(user) });
}));

module.exports = router;
