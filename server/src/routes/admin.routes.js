'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const {
  User, Domain, Skill, DomainSkill, LearningModule, PracticeQuestion,
  CodingQuestion, QuestionBankItem, TestSet, Complaint, AuditLog,
  ActivityLog, Notification, Opportunity, Application, TestAttempt,
  ReadinessSettings,
} = require('../models');
const { env } = require('../config/env');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { notify, notifyAdmins } = require('../services/notification.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { tokenSearchFilter } = require('../utils/search');
const { getReadinessSettings, invalidateReadinessSettingsCache, refreshMarketDemand } = require('../services/marketDemand.service');

const router = express.Router();
router.use(authenticate, requireRole('admin'));
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(ApiError.unprocessable('Please correct the highlighted fields', errors.array()));
  return next();
};
const audit = (req, action, targetType, targetId, description, before, after) => AuditLog.create({ actor: req.user._id, action, targetType, targetId, description, before, after, ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 400) });
const pickFields = (source, fields) => Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(source, field)).map((field) => [field, source[field]]));

const practiceFields = ['skill', 'type', 'difficulty', 'topic', 'title', 'prompt', 'scenario', 'hints', 'options', 'correctIndex', 'expectedAnswer', 'solutionExplanation', 'tags', 'order', 'isActive'];
const codingFields = ['skill', 'title', 'slug', 'statement', 'inputSpec', 'outputSpec', 'constraints', 'examples', 'difficulty', 'topic', 'tags', 'supportedLanguages', 'starterCode', 'testCases', 'solutions', 'approach', 'timeComplexity', 'spaceComplexity', 'order', 'isActive'];
const bankFields = ['prompt', 'options', 'correctIndex', 'topic', 'explanation', 'tags', 'isActive'];

const archiveBankItem = async (item) => {
  item.isActive = false;
  await item.save();
  const sets = await TestSet.find({ questions: item._id });
  await Promise.all(sets.map(async (set) => {
    set.questions = set.questions.filter((questionId) => String(questionId) !== String(item._id));
    set.questionCount = set.questions.length;
    await set.save();
  }));
};

const ensureSkillTestSets = async (skillId, difficulty) => {
  const skill = await Skill.findById(skillId).select('name');
  if (!skill) return;
  const existing = new Set(await TestSet.find({ skill: skillId, difficulty }).distinct('setNumber'));
  const missing = Array.from({ length: 10 }, (_value, index) => index + 1).filter((number) => !existing.has(number));
  if (missing.length) await TestSet.insertMany(missing.map((setNumber) => ({ skill: skillId, difficulty, setNumber, title: `${skill.name} · ${difficulty} set ${String(setNumber).padStart(2, '0')}`, questions: [], questionCount: 0, durationMinutes: 12, isActive: true })));
};

const assignBankItemToSet = async (item) => {
  await ensureSkillTestSets(item.skill, item.difficulty);
  const set = await TestSet.findOne({ skill: item.skill, difficulty: item.difficulty, isActive: true }).sort({ questionCount: 1, setNumber: 1 });
  if (set && !set.questions.some((questionId) => String(questionId) === String(item._id))) {
    set.questions.push(item._id);
    set.questionCount = set.questions.length;
    await set.save();
  }
  return set;
};

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [students, companies, pendingCompanies, domains, skills, opportunities, openComplaints, tests] = await Promise.all([
    User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'company' }),
    User.countDocuments({ role: 'company', approvalStatus: 'pending' }), Domain.countDocuments({ isActive: true }),
    Skill.countDocuments({ isActive: true }), Opportunity.countDocuments({ status: 'open' }),
    Complaint.countDocuments({ status: { $in: ['open', 'in-review'] } }), TestAttempt.countDocuments({ status: 'submitted' }),
  ]);
  const recentActivity = await AuditLog.find().populate('actor', 'fullName username').sort({ createdAt: -1 }).limit(10);
  res.json({ success: true, data: { stats: { students, companies, pendingCompanies, domains, skills, opportunities, openComplaints, assessmentAttempts: tests }, recentActivity } });
}));

router.get('/readiness-settings', asyncHandler(async (_req, res) => {
  const settings = await getReadinessSettings();
  res.json({ success: true, data: settings });
}));
router.put('/readiness-settings', [
  body('confidence.missing').isFloat({ min: 0, max: 1 }),
  body('confidence.inProgress').isFloat({ min: 0, max: 1 }),
  body('confidence.completed').isFloat({ min: 0, max: 1 }),
  body('confidence.verified').isFloat({ min: 0.01, max: 1 }),
  body('freshness.graceDays').isInt({ min: 0, max: 3650 }),
  body('freshness.decayDurationDays').isInt({ min: 1, max: 3650 }),
  body('freshness.decayFloor').isFloat({ min: 0, max: 1 }),
  body('verificationPassPercentage').isInt({ min: 0, max: 100 }),
  body('marketDemand.minMultiplier').isFloat({ min: 0.5, max: 1 }),
  body('marketDemand.maxMultiplier').isFloat({ min: 1, max: 2 }),
], validate, asyncHandler(async (req, res) => {
  const { confidence, freshness, verificationPassPercentage, marketDemand } = req.body;
  if (!(confidence.missing < confidence.inProgress && confidence.inProgress < confidence.completed && confidence.completed < confidence.verified)) {
    throw ApiError.badRequest('Confidence values must increase from missing through verified.');
  }
  if (marketDemand.minMultiplier >= marketDemand.maxMultiplier) throw ApiError.badRequest('The market-demand minimum must be lower than its maximum.');
  const before = await ReadinessSettings.findOne({ key: 'global' }).lean();
  const settings = await ReadinessSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: { confidence, freshness, verificationPassPercentage, marketDemand, updatedBy: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  invalidateReadinessSettingsCache();
  const market = await refreshMarketDemand();
  await audit(req, 'content-updated', 'ReadinessSettings', settings._id, 'Updated the dynamic career-readiness model settings', before, settings.toObject());
  res.json({ success: true, data: settings, meta: { marketDemandComputedAt: market.computedAt } });
}));

router.get('/companies', asyncHandler(async (req, res) => {
  const filter = { role: 'company' };
  if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) filter.approvalStatus = req.query.status;
  const [data, total] = await Promise.all([
    User.find(filter).select('-passwordHash').populate('requiredSkills', 'name slug').sort({ createdAt: -1 }).limit(250),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total } });
}));
router.patch('/companies/:id/approval', [body('status').isIn(['approved', 'rejected']), body('note').optional().isString().isLength({ max: 1000 })], validate, asyncHandler(async (req, res) => {
  if (!req.user.isSuperAdmin) throw ApiError.forbidden('Only the super admin can approve or reject a company registration');
  const company = await User.findOne({ _id: req.params.id, role: 'company' });
  if (!company) throw ApiError.notFound('Company registration not found');
  const before = { approvalStatus: company.approvalStatus };
  company.approvalStatus = req.body.status;
  company.approvalNote = req.body.note || '';
  company.approvedBy = req.user._id;
  company.approvedAt = req.body.status === 'approved' ? new Date() : undefined;
  await company.save();
  const isApproved = company.approvalStatus === 'approved';
  await notify(company._id, isApproved ? 'company-approved' : 'company-rejected', isApproved ? 'Company account approved' : 'Company registration update', isApproved ? 'Your company account is approved. You can now use the hiring workspace.' : (company.approvalNote || 'Your company registration was not approved.'), { actor: req.user._id, priority: 'high' });
  await audit(req, isApproved ? 'company-approved' : 'company-rejected', 'User', company._id, `${isApproved ? 'Approved' : 'Rejected'} company ${company.companyName}`, before, { approvalStatus: company.approvalStatus });
  res.json({ success: true, data: company });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const filter = {};
  if (['student', 'company', 'admin'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) Object.assign(filter, tokenSearchFilter(req.query.q, ['fullName', 'username', 'email', 'companyName']));
  const [data, total] = await Promise.all([User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).limit(250), User.countDocuments(filter)]);
  res.json({ success: true, data, meta: { total } });
}));
router.patch('/users/:id/status', [body('isActive').isBoolean()], validate, asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) throw ApiError.notFound('User not found');
  if (target.isSuperAdmin || String(target._id) === String(req.user._id)) throw ApiError.forbidden('This account cannot be deactivated here');
  const before = target.isActive;
  target.isActive = req.body.isActive;
  await target.save();
  await audit(req, 'content-updated', 'User', target._id, `${target.isActive ? 'Activated' : 'Deactivated'} ${target.role} account`, { isActive: before }, { isActive: target.isActive });
  res.json({ success: true, data: target });
}));

router.post('/admins', [
  body('username').trim().isLength({ min: 3, max: 60 }).matches(/^[a-z0-9_.-]+$/i),
  body('fullName').trim().isLength({ min: 2, max: 120 }),
  body('email').trim().isEmail().normalizeEmail(), body('phone').trim().isLength({ min: 7, max: 20 }),
  body('temporaryPassword').isLength({ min: 12, max: 128 }),
], validate, asyncHandler(async (req, res) => {
  if (!req.user.isSuperAdmin) throw ApiError.forbidden('Only the super admin can provision another admin account');
  const admin = new User({ role: 'admin', username: req.body.username, fullName: req.body.fullName, email: req.body.email, phone: req.body.phone, mustChangePassword: true, createdByAdmin: req.user._id });
  await admin.setPassword(req.body.temporaryPassword);
  await admin.save();
  await audit(req, 'admin-created', 'User', admin._id, `Provisioned admin ${admin.username}`);
  res.status(201).json({ success: true, message: 'Admin account provisioned; the first sign-in requires a password change', data: admin });
}));

router.get('/domains', asyncHandler(async (_req, res) => {
  const rows = await Domain.find().sort({ order: 1, name: 1 });
  const links = await DomainSkill.find({ domain: { $in: rows.map(({ _id }) => _id) } }).populate('skill', 'name slug').sort({ order: 1 });
  const byDomain = new Map();
  links.forEach((row) => { const key = String(row.domain); if (!byDomain.has(key)) byDomain.set(key, []); byDomain.get(key).push(row); });
  res.json({ success: true, data: rows.map((row) => ({ ...row.toObject(), skillLinks: byDomain.get(String(row._id)) || [] })) });
}));
router.post('/domains', [body('name').trim().isLength({ min: 2, max: 120 }), body('slug').trim().isLength({ min: 2, max: 120 })], validate, asyncHandler(async (req, res) => {
  const row = await Domain.create({ ...req.body, createdBy: req.user._id });
  await audit(req, 'content-created', 'Domain', row._id, `Created domain ${row.name}`);
  res.status(201).json({ success: true, data: row });
}));
router.patch('/domains/:id', asyncHandler(async (req, res) => {
  const row = await Domain.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user._id }, { new: true, runValidators: true });
  if (!row) throw ApiError.notFound('Domain not found');
  await audit(req, 'content-updated', 'Domain', row._id, `Updated domain ${row.name}`);
  res.json({ success: true, data: row });
}));
router.delete('/domains/:id', asyncHandler(async (req, res) => {
  const row = await Domain.findById(req.params.id);
  if (!row) throw ApiError.notFound('Domain not found');
  row.isActive = false;
  await row.save();
  await audit(req, 'content-deleted', 'Domain', row._id, `Archived domain ${row.name}`);
  res.json({ success: true, message: 'Domain archived' });
}));
router.put('/domains/:id/skills', [
  body('skills').isArray({ max: 500 }),
  body('skills.*.importanceWeight').optional().isFloat({ min: 1, max: 5 }),
  body('skills.*.importanceLevel').optional().isIn(['core', 'supporting']),
], validate, asyncHandler(async (req, res) => {
  const domain = await Domain.findById(req.params.id);
  if (!domain) throw ApiError.notFound('Domain not found');
  const ids = req.body.skills.map((row) => String(row.skill));
  if (new Set(ids).size !== ids.length) throw ApiError.badRequest('A skill can only appear once in a domain');
  const count = await Skill.countDocuments({ _id: { $in: ids }, isActive: true });
  if (count !== ids.length) throw ApiError.badRequest('All linked skills must exist in the shared catalog');
  await DomainSkill.deleteMany({ domain: domain._id });
  if (req.body.skills.length) await DomainSkill.insertMany(req.body.skills.map((row, order) => ({
    domain: domain._id,
    skill: row.skill,
    required: row.required !== false,
    weight: row.weight ?? 1,
    importanceWeight: row.importanceWeight ?? 3,
    importanceLevel: row.importanceLevel || (row.importanceWeight >= 4 ? 'core' : 'supporting'),
    order: row.order ?? order,
    note: row.note,
  })));
  await audit(req, 'content-updated', 'Domain', domain._id, `Updated required skills for ${domain.name}`);
  res.json({ success: true, data: await DomainSkill.find({ domain: domain._id }).populate('skill', 'name slug').sort({ order: 1 }) });
}));

router.get('/skills', asyncHandler(async (_req, res) => res.json({ success: true, data: await Skill.find().sort({ category: 1, name: 1 }).limit(1000) })));
router.post('/skills', [body('name').trim().isLength({ min: 2, max: 120 }), body('slug').trim().isLength({ min: 2, max: 120 })], validate, asyncHandler(async (req, res) => {
  const skill = await Skill.create({ ...req.body, createdBy: req.user._id });
  await audit(req, 'content-created', 'Skill', skill._id, `Created skill ${skill.name}`);
  res.status(201).json({ success: true, data: skill });
}));
router.patch('/skills/:id', asyncHandler(async (req, res) => {
  const skill = await Skill.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user._id }, { new: true, runValidators: true });
  if (!skill) throw ApiError.notFound('Skill not found');
  await audit(req, 'content-updated', 'Skill', skill._id, `Updated skill ${skill.name}`);
  res.json({ success: true, data: skill });
}));
router.delete('/skills/:id', asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw ApiError.notFound('Skill not found');
  skill.isActive = false;
  await skill.save();
  await audit(req, 'content-deleted', 'Skill', skill._id, `Archived skill ${skill.name}`);
  res.json({ success: true, message: 'Skill archived' });
}));

router.get('/learning', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.skillId) filter.skill = req.query.skillId;
  const [data, total] = await Promise.all([LearningModule.find(filter).populate('skill', 'name slug').sort({ createdAt: -1 }).limit(200), LearningModule.countDocuments(filter)]);
  res.json({ success: true, data, meta: { total } });
}));
router.post('/learning', [body('skill').isMongoId(), body('title').trim().isLength({ min: 2, max: 300 }), body('slug').trim().isLength({ min: 2, max: 300 })], validate, asyncHandler(async (req, res) => {
  const module = await LearningModule.create({ ...req.body, createdBy: req.user._id });
  await audit(req, 'content-created', 'LearningModule', module._id, `Created learning module ${module.title}`);
  res.status(201).json({ success: true, data: module });
}));
router.patch('/learning/:id', asyncHandler(async (req, res) => {
  const module = await LearningModule.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user._id }, { new: true, runValidators: true });
  if (!module) throw ApiError.notFound('Learning module not found');
  await audit(req, 'content-updated', 'LearningModule', module._id, `Updated learning module ${module.title}`);
  res.json({ success: true, data: module });
}));
router.delete('/learning/:id', asyncHandler(async (req, res) => {
  const module = await LearningModule.findByIdAndUpdate(req.params.id, { isPublished: false, updatedBy: req.user._id }, { new: true });
  if (!module) throw ApiError.notFound('Learning module not found');
  await audit(req, 'content-deleted', 'LearningModule', module._id, `Unpublished learning module ${module.title}`);
  res.json({ success: true, message: 'Learning module unpublished' });
}));

router.get('/complaints', asyncHandler(async (req, res) => {
  const filter = {};
  if (['open', 'in-review', 'resolved'].includes(req.query.status)) filter.status = req.query.status;
  const data = await Complaint.find(filter).populate('user', 'fullName companyName email role').sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, data });
}));
router.patch('/complaints/:id', [body('status').optional().isIn(['open', 'in-review', 'resolved']), body('note').optional().isString().isLength({ max: 4000 })], validate, asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw ApiError.notFound('Complaint not found');
  const before = { status: complaint.status };
  if (req.body.status) complaint.status = req.body.status;
  if (req.body.note) complaint.notes.push({ note: req.body.note, author: req.user._id, status: complaint.status });
  if (complaint.status === 'resolved') { complaint.resolvedBy = req.user._id; complaint.resolvedAt = new Date(); }
  await complaint.save();
  await notify(complaint.user, 'complaint-status-updated', 'Complaint status updated', `“${complaint.subject}” is now ${complaint.status}.${req.body.note ? ` ${req.body.note}` : ''}`, { meta: { complaintId: String(complaint._id) }, actor: req.user._id });
  await audit(req, 'content-updated', 'Complaint', complaint._id, `Updated complaint status to ${complaint.status}`, before, { status: complaint.status });
  res.json({ success: true, data: complaint });
}));

router.post('/announcements', [body('title').trim().isLength({ min: 2, max: 300 }), body('body').trim().isLength({ min: 2, max: 4000 })], validate, asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (['student', 'company', 'admin'].includes(req.body.audience)) filter.role = req.body.audience;
  const recipients = await User.find(filter).select('_id');
  const notifications = await Notification.insertMany(recipients.map(({ _id }) => ({ user: _id, type: 'announcement', title: req.body.title, body: req.body.body, link: req.body.link, actor: req.user._id })));
  await audit(req, 'content-created', 'Notification', undefined, `Sent announcement to ${recipients.length} users`);
  res.status(201).json({ success: true, data: { recipientCount: notifications.length } });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const data = await AuditLog.find().populate('actor', 'fullName username').sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data });
}));
router.get('/activity', asyncHandler(async (req, res) => {
  const data = await ActivityLog.find(req.query.userId ? { user: req.query.userId } : {}).populate('user', 'fullName role').sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, data });
}));

router.get('/practice-questions', asyncHandler(async (req, res) => {
  const filter = req.query.skillId ? { skill: req.query.skillId } : {};
  const data = await PracticeQuestion.find(filter).populate('skill', 'name slug').sort({ skill: 1, difficulty: 1, order: 1 }).limit(500);
  res.json({ success: true, data, meta: { total: await PracticeQuestion.countDocuments(filter) } });
}));
router.post('/practice-questions', [
  body('skill').isMongoId(), body('type').optional().isIn(['theory', 'coding', 'scenario']), body('difficulty').isIn(['beginner', 'intermediate', 'advanced']),
  body('title').trim().isLength({ min: 2, max: 300 }), body('prompt').trim().isLength({ min: 2 }), body('options').optional().isArray({ min: 2, max: 6 }),
  body('correctIndex').optional().isInt({ min: 0 }),
], validate, asyncHandler(async (req, res) => {
  if (req.body.options?.length && req.body.correctIndex !== undefined && req.body.correctIndex >= req.body.options.length) throw ApiError.badRequest('The correct answer must match one of the available options');
  const data = await PracticeQuestion.create({ ...pickFields(req.body, practiceFields), createdBy: req.user._id });
  await audit(req, 'content-created', 'PracticeQuestion', data._id, `Created practice question ${data.title}`);
  res.status(201).json({ success: true, data });
}));
router.patch('/practice-questions/:id', asyncHandler(async (req, res) => {
  const data = await PracticeQuestion.findById(req.params.id);
  if (!data) throw ApiError.notFound('Practice question not found');
  const before = data.toObject();
  Object.assign(data, pickFields(req.body, practiceFields), { updatedBy: req.user._id });
  if (data.options.length && data.correctIndex >= data.options.length) throw ApiError.badRequest('The correct answer must match one of the available options');
  await data.save();
  await audit(req, 'content-updated', 'PracticeQuestion', data._id, `Updated practice question ${data.title}`, before, data.toObject());
  res.json({ success: true, data });
}));
router.delete('/practice-questions/:id', asyncHandler(async (req, res) => {
  const data = await PracticeQuestion.findByIdAndUpdate(req.params.id, { isActive: false, updatedBy: req.user._id }, { new: true });
  if (!data) throw ApiError.notFound('Practice question not found');
  await audit(req, 'content-deleted', 'PracticeQuestion', data._id, `Archived practice question ${data.title}`);
  res.json({ success: true, message: 'Practice question archived' });
}));

router.get('/coding-questions', asyncHandler(async (req, res) => {
  const filter = req.query.skillId ? { skill: req.query.skillId } : {};
  const data = await CodingQuestion.find(filter).populate('skill', 'name slug').sort({ skill: 1, difficulty: 1, order: 1 }).limit(500);
  res.json({ success: true, data, meta: { total: await CodingQuestion.countDocuments(filter) } });
}));
router.post('/coding-questions', [
  body('skill').isMongoId(), body('title').trim().isLength({ min: 2, max: 300 }), body('slug').trim().isLength({ min: 2, max: 300 }),
  body('statement').trim().isLength({ min: 2 }), body('difficulty').isIn(['beginner', 'intermediate', 'advanced']),
], validate, asyncHandler(async (req, res) => {
  const data = await CodingQuestion.create({ ...pickFields(req.body, codingFields), createdBy: req.user._id });
  await audit(req, 'content-created', 'CodingQuestion', data._id, `Created coding question ${data.title}`);
  res.status(201).json({ success: true, data });
}));
router.patch('/coding-questions/:id', asyncHandler(async (req, res) => {
  const data = await CodingQuestion.findById(req.params.id);
  if (!data) throw ApiError.notFound('Coding question not found');
  const before = data.toObject();
  Object.assign(data, pickFields(req.body, codingFields), { updatedBy: req.user._id });
  await data.save();
  await audit(req, 'content-updated', 'CodingQuestion', data._id, `Updated coding question ${data.title}`, before, data.toObject());
  res.json({ success: true, data });
}));
router.delete('/coding-questions/:id', asyncHandler(async (req, res) => {
  const data = await CodingQuestion.findByIdAndUpdate(req.params.id, { isActive: false, updatedBy: req.user._id }, { new: true });
  if (!data) throw ApiError.notFound('Coding question not found');
  await audit(req, 'content-deleted', 'CodingQuestion', data._id, `Archived coding question ${data.title}`);
  res.json({ success: true, message: 'Coding question archived' });
}));

router.get('/question-bank', asyncHandler(async (req, res) => {
  const filter = { visibility: 'platform' };
  if (req.query.skillId) filter.skill = req.query.skillId;
  if (['beginner', 'intermediate', 'advanced'].includes(req.query.difficulty)) filter.difficulty = req.query.difficulty;
  const data = await QuestionBankItem.find(filter).populate('skill', 'name slug').sort({ skill: 1, difficulty: 1, topic: 1 }).limit(1000);
  res.json({ success: true, data, meta: { total: await QuestionBankItem.countDocuments(filter) } });
}));
router.post('/question-bank', [
  body('skill').isMongoId(), body('difficulty').isIn(['beginner', 'intermediate', 'advanced']), body('prompt').trim().isLength({ min: 2 }),
  body('options').isArray({ min: 2, max: 6 }), body('correctIndex').isInt({ min: 0 }),
], validate, asyncHandler(async (req, res) => {
  if (req.body.correctIndex >= req.body.options.length) throw ApiError.badRequest('The correct answer must match one of the available options');
  const data = await QuestionBankItem.create({ ...pickFields(req.body, bankFields), skill: req.body.skill, difficulty: req.body.difficulty, visibility: 'platform', createdBy: req.user._id });
  const set = await assignBankItemToSet(data);
  await audit(req, 'content-created', 'QuestionBankItem', data._id, `Added a ${data.difficulty} question to the shared ${set ? 'assessment set' : 'question bank'}`);
  res.status(201).json({ success: true, data, message: set ? `Question added to ${set.title || `set ${set.setNumber}`}` : 'Question added to the bank; create an assessment set to make it available for testing' });
}));
router.patch('/question-bank/:id', asyncHandler(async (req, res) => {
  const data = await QuestionBankItem.findOne({ _id: req.params.id, visibility: 'platform' });
  if (!data) throw ApiError.notFound('Shared question not found');
  if (req.body.options && (!Array.isArray(req.body.options) || req.body.options.length < 2 || req.body.options.length > 6)) throw ApiError.badRequest('A question must have between 2 and 6 options');
  const wasActive = data.isActive;
  const before = data.toObject();
  Object.assign(data, pickFields(req.body, bankFields.filter((field) => field !== 'isActive')), { updatedBy: req.user._id });
  if (data.correctIndex >= data.options.length) throw ApiError.badRequest('The correct answer must match one of the available options');
  await data.save();
  if (req.body.isActive === false) await archiveBankItem(data);
  else if (req.body.isActive === true && !wasActive) { data.isActive = true; await data.save(); await assignBankItemToSet(data); }
  await audit(req, req.body.isActive === false ? 'content-deleted' : 'content-updated', 'QuestionBankItem', data._id, `${req.body.isActive === false ? 'Archived' : 'Updated'} a question-bank item`, before, data.toObject());
  res.json({ success: true, data });
}));
router.delete('/question-bank/:id', asyncHandler(async (req, res) => {
  const data = await QuestionBankItem.findOne({ _id: req.params.id, visibility: 'platform' });
  if (!data) throw ApiError.notFound('Shared question not found');
  await archiveBankItem(data);
  await audit(req, 'content-deleted', 'QuestionBankItem', data._id, 'Archived a shared question and removed it from active sets');
  res.json({ success: true, message: 'Question archived and removed from active assessment sets' });
}));

module.exports = router;
