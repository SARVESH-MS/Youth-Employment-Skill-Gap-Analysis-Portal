'use strict';

const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const {
  User, Domain, Skill, DomainSkill, UserSkill, LearningModule, LessonProgress,
  Annotation, PracticeQuestion, QuestionBankItem, TestSet, TestAttempt,
  CodingSubmission, Opportunity, Application, Notification, Complaint,
  ActivityLog, Streak, ProgressSnapshot, RecruitmentRound, RoundResult, CodingQuestion,
} = require('../models');
const { getGridFSBucket } = require('../config/db');
const { env } = require('../config/env');
const { authenticate, requireRole, requireApprovedCompany } = require('../middleware/auth.middleware');
const { getSkillGap } = require('../services/skillgap.service');
const { notify, notifyAdmins } = require('../services/notification.service');
const { recordActivity } = require('../services/activity.service');
const { updateSkillProgress } = require('../services/progress.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { parsePagination, parseSort } = require('../utils/pagination');
const { buildPaginationMeta } = require('../utils/apiResponse');

const router = express.Router();
const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.resume.maxFileSizeMb * 1024 * 1024, files: 1 } });
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(ApiError.unprocessable('Please correct the highlighted fields', errors.array()));
  return next();
};
const studentOnly = [authenticate, requireRole('student')];
const companyOnly = [authenticate, requireRole('company'), requireApprovedCompany];
const adminOnly = [authenticate, requireRole('admin')];
const candidateSummary = (user) => user.toPublicProfile();
const skillProjection = 'name slug shortDescription category difficulty executionType supportedLanguages about';

async function completeCodingRound(round, student, submission, score) {
  const application = round.application;
  if (!application) throw ApiError.notFound('Recruitment application not found');
  const outcome = score >= round.passPercentage ? 'passed' : 'failed';
  const result = await RoundResult.findOneAndUpdate(
    { round: round._id, student: student._id },
    { $set: { round: round._id, application: application._id, student: student._id, company: round.company, ...(submission?._id ? { codingSubmission: submission._id } : {}), result: outcome, score, recordedAt: new Date() } },
    { new: true, upsert: true, runValidators: true }
  );
  round.status = 'completed'; round.completedAt = new Date(); await round.save();
  application.status = outcome === 'failed' ? 'rejected-final' : 'in-progress';
  if (outcome === 'failed') { application.finalResult = 'rejected'; application.finalResultAt = new Date(); }
  else application.currentRoundNumber = Math.max(application.currentRoundNumber || 1, round.roundNumber);
  await application.save();
  await notify(round.company, outcome === 'passed' ? 'candidate-accepted' : 'candidate-rejected', 'A coding assessment was completed', `${student.fullName} scored ${score}% in ${round.name}.`, { meta: { applicationId: String(application._id), roundId: String(round._id), resultId: String(result._id) }, actor: student._id });
  await notify(student._id, 'round-result', `${round.name} result is ready`, `Your score was ${score}%. The company recorded this as ${outcome}.`, { meta: { roundId: String(round._id), resultId: String(result._id) }, actor: round.company, priority: 'high' });
  return { result: outcome, score, feedback: result.feedback };
}

async function expireCodingRound(round, student) {
  const lastSubmission = await CodingSubmission.findOne({ round: round._id, user: student._id, kind: 'submit', executionStatus: { $ne: 'internal' } }).sort({ createdAt: -1 });
  const score = lastSubmission?.totalTests ? Math.round(lastSubmission.passedTests / lastSubmission.totalTests * 100) : 0;
  return completeCodingRound(round, student, lastSubmission, score);
}

// Public catalog. Student status is joined from UserSkill on the authenticated
// endpoints below; catalog entries always come from the shared Skill model.
router.get('/catalog/domains', asyncHandler(async (_req, res) => {
  const domains = await Domain.find({ isActive: true }).sort({ order: 1, name: 1 });
  res.json({ success: true, data: domains });
}));
router.get('/catalog/skills', asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.difficulty) filter.difficulty = String(req.query.difficulty);
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
  if (req.query.domain) {
    const links = await DomainSkill.find({ domain: req.query.domain }).select('skill');
    filter._id = { $in: links.map((link) => link.skill) };
  }
  const skills = await Skill.find(filter, req.query.q ? { score: { $meta: 'textScore' } } : undefined)
    .select(skillProjection).sort(req.query.q ? { score: { $meta: 'textScore' } } : { category: 1, order: 1, name: 1 }).limit(200);
  res.json({ success: true, data: skills });
}));
router.get('/catalog/skills/:skillId', asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.skillId, isActive: true }).select(skillProjection + ' prerequisites relatedSkills tags');
  if (!skill) throw ApiError.notFound('Skill not found');
  const [domains, modules, practice] = await Promise.all([
    DomainSkill.find({ skill: skill._id }).populate('domain', 'name slug category accent').sort({ order: 1 }),
    LearningModule.find({ skill: skill._id, isPublished: true }).sort({ order: 1 }).select('title slug description level order estimatedMinutes objectives topics references'),
    PracticeQuestion.countDocuments({ skill: skill._id, isActive: true }),
  ]);
  res.json({ success: true, data: { skill, domains: domains.map((row) => row.domain), modules, practiceCount: practice } });
}));

router.get('/student/dashboard', ...studentOnly, asyncHandler(async (req, res) => {
  const domainId = req.user.careerDomain?._id || req.user.careerDomain;
  const [gap, userSkills, modules, latestActivity, applications, attempts, coding, snapshots] = await Promise.all([
    domainId ? getSkillGap(req.user._id, domainId) : null,
    UserSkill.find({ user: req.user._id }).populate('skill', 'name slug category').sort({ updatedAt: -1 }).limit(12),
    LearningModule.find({ isPublished: true, ...(domainId ? { skill: { $in: await DomainSkill.find({ domain: domainId }).distinct('skill') } } : {}) }).populate('skill', 'name slug').sort({ order: 1 }).limit(8),
    ActivityLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).select('action localDay createdAt skill'),
    Application.countDocuments({ student: req.user._id, status: 'offered' }),
    TestAttempt.find({ user: req.user._id, status: 'submitted', mode: 'self' }).select('percentage'),
    CodingSubmission.countDocuments({ user: req.user._id, kind: 'submit', executionStatus: 'ok', accepted: true }),
    ProgressSnapshot.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(8).select('careerReadiness createdAt'),
  ]);
  const streak = await Streak.findOne({ user: req.user._id });
  const learningDone = await LessonProgress.countDocuments({ user: req.user._id, status: 'completed' });
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ success: true, data: {
    user: req.user.toPublicProfile({ includeContact: true }),
    gap,
    recentSkills: userSkills,
    recommendedModules: modules,
    activity: latestActivity,
    readinessHistory: snapshots.reverse(),
    stats: {
      learningProgress: gap?.readinessInputs.learningProgress || 0,
      lessonsCompleted: learningDone,
      codingProblemsSolved: coding,
      testsCompleted: attempts.length,
      averageAssessmentScore: attempts.length ? Math.round(attempts.reduce((sum, row) => sum + row.percentage, 0) / attempts.length) : 0,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      opportunitiesReceived: applications,
      unreadNotifications: unread,
    },
  } });
}));

router.get('/student/profile', ...studentOnly, asyncHandler(async (req, res) => {
  const skills = await UserSkill.find({ user: req.user._id }).populate('skill', skillProjection).sort({ updatedAt: -1 });
  res.json({ success: true, data: { user: req.user.toPublicProfile({ includeContact: true }), skills } });
}));

router.patch('/profile', authenticate, [
  body('fullName').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ min: 7, max: 20 }),
  body('theme').optional().isIn(['light', 'dark', 'midnight', 'slate', 'emerald', 'royal', 'sunset', 'graphite']),
], validate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const allowed = req.user.role === 'company'
    ? ['fullName', 'email', 'phone', 'theme', 'timezone', 'companyName', 'designation', 'industry', 'description', 'website', 'location', 'companySize', 'expectedCompensation', 'expectedHires', 'hiringRequirements']
    : ['fullName', 'email', 'phone', 'theme', 'timezone', 'headline', 'education', 'spokenLanguages'];
  for (const key of allowed) if (req.body[key] !== undefined) user[key] = req.body[key];
  if (req.user.role === 'company' && Array.isArray(req.body.requiredSkills)) {
    const valid = await Skill.countDocuments({ _id: { $in: req.body.requiredSkills }, isActive: true });
    if (valid !== req.body.requiredSkills.length) throw ApiError.badRequest('Required skills must be selected from the catalog');
    user.requiredSkills = req.body.requiredSkills;
  }
  if (req.user.role === 'student' && req.body.careerDomain !== undefined) {
    const domain = await Domain.findOne({ _id: req.body.careerDomain, isActive: true });
    if (!domain) throw ApiError.badRequest('Select an active career domain');
    user.careerDomain = domain._id;
    user.careerDomainChangedAt = new Date();
  }
  await user.save();
  await recordActivity(user, 'profile-updated');
  res.json({ success: true, message: 'Profile updated', data: user.toPublicProfile({ includeContact: true }) });
}));

router.post('/student/resume', ...studentOnly, resumeUpload.single('resume'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest('Choose a PDF or DOCX resume');
  const extension = String(file.originalname).toLowerCase().split('.').pop();
  const mimeAllowed = env.resume.allowedMimeTypes.includes(file.mimetype);
  const signatureAllowed = extension === 'pdf' ? file.buffer.subarray(0, 5).toString() === '%PDF-' : extension === 'docx' && file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
  if (!mimeAllowed || !signatureAllowed || !['pdf', 'docx'].includes(extension)) throw ApiError.badRequest('Resume must be a valid PDF or DOCX file');
  const bucket = getGridFSBucket();
  const upload = bucket.openUploadStream(file.originalname.replace(/[\\/\r\n]/g, '_'), { contentType: file.mimetype, metadata: { user: req.user._id } });
  upload.end(file.buffer);
  await new Promise((resolve, reject) => { upload.once('finish', resolve); upload.once('error', reject); });
  const user = await User.findById(req.user._id);
  if (user.resume?.fileId) await bucket.delete(user.resume.fileId).catch(() => undefined);
  user.resume = { fileId: upload.id, fileName: upload.filename, mimeType: file.mimetype, size: file.size, uploadedAt: new Date() };
  await user.save();
  await recordActivity(user, 'resume-uploaded');
  res.status(201).json({ success: true, message: 'Resume saved securely', data: user.resume });
}));

router.get('/resumes/:fileId', authenticate, asyncHandler(async (req, res) => {
  const owner = await User.findOne({ 'resume.fileId': req.params.fileId }).select('_id resume');
  if (!owner) throw ApiError.notFound('Resume not found');
  const self = String(owner._id) === String(req.user._id);
  const accepted = req.user.role === 'company' && await Application.exists({ company: req.user._id, student: owner._id, status: 'accepted', contactUnlocked: true });
  if (!self && !accepted && req.user.role !== 'admin') throw ApiError.forbidden('This resume is private until the student accepts your opportunity');
  const bucket = getGridFSBucket();
  res.setHeader('Content-Type', owner.resume.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${String(owner.resume.fileName || 'resume').replace(/["\r\n]/g, '')}"`);
  const stream = bucket.openDownloadStream(owner.resume.fileId);
  stream.on('error', () => { if (!res.headersSent) res.status(404).end(); });
  stream.pipe(res);
}));

router.get('/student/skill-gap', ...studentOnly, asyncHandler(async (req, res) => {
  const domainId = req.query.domainId || req.user.careerDomain?._id || req.user.careerDomain;
  if (!domainId) throw ApiError.badRequest('Choose a career domain in your profile to calculate the skill gap');
  res.json({ success: true, data: await getSkillGap(req.user._id, domainId, { persist: req.query.snapshot === 'true' }) });
}));

router.put('/student/skills/:skillId', ...studentOnly, [body('status').isIn(['known', 'in-progress', 'missing'])], validate, asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.skillId, isActive: true });
  if (!skill) throw ApiError.notFound('Skill not found');
  if (req.body.status === 'missing') {
    await UserSkill.deleteOne({ user: req.user._id, skill: skill._id });
    return res.json({ success: true, message: 'Skill removed from your profile' });
  }
  const status = req.body.status;
  const row = await UserSkill.findOneAndUpdate(
    { user: req.user._id, skill: skill._id },
    { $set: { status, source: 'manual', ...(status === 'in-progress' ? { startedAt: new Date() } : {}) }, $setOnInsert: { progress: 0 } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await recordActivity(req.user, 'skill-updated', { skill: skill._id });
  res.json({ success: true, data: row });
}));

router.get('/student/roadmap', ...studentOnly, asyncHandler(async (req, res) => {
  const domainId = req.user.careerDomain?._id || req.user.careerDomain;
  if (!domainId) throw ApiError.badRequest('Choose a career domain to build your roadmap');
  const gap = await getSkillGap(req.user._id, domainId);
  const skillIds = gap.skills.map(({ skill }) => skill._id);
  const modules = await LearningModule.find({ skill: { $in: skillIds }, isPublished: true }).sort({ order: 1 });
  const firstModule = new Map();
  modules.forEach((module) => { if (!firstModule.has(String(module.skill))) firstModule.set(String(module.skill), module); });
  res.json({ success: true, data: gap.skills.map((row) => ({ ...row, recommendedModule: firstModule.get(String(row.skill._id)) || null })) });
}));

router.get('/student/skills/:skillId/learning', ...studentOnly, asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.skillId, isActive: true }).select(skillProjection);
  if (!skill) throw ApiError.notFound('Skill not found');
  const [modules, progress, annotations] = await Promise.all([
    LearningModule.find({ skill: skill._id, isPublished: true }).sort({ order: 1 }),
    LessonProgress.find({ user: req.user._id, skill: skill._id }).select('subtopicId status timeSpentSec quizPassed quizScore'),
    Annotation.find({ user: req.user._id, skill: skill._id }),
  ]);
  res.json({ success: true, data: { skill, modules, progress, annotations } });
}));

router.post('/student/learning/:moduleId/:subtopicId/engagement', ...studentOnly, [body('seconds').isInt({ min: 1, max: 60 })], validate, asyncHandler(async (req, res) => {
  const module = await LearningModule.findOne({ _id: req.params.moduleId, isPublished: true });
  if (!module) throw ApiError.notFound('Lesson not found');
  const topic = module.topics.find((item) => item.subtopics.id(req.params.subtopicId));
  const subtopic = topic?.subtopics.id(req.params.subtopicId);
  if (!subtopic) throw ApiError.notFound('Lesson not found');
  const row = await LessonProgress.findOneAndUpdate(
    { user: req.user._id, subtopicId: subtopic._id },
    { $setOnInsert: { user: req.user._id, skill: module.skill, module: module._id, topicId: topic._id, subtopicId: subtopic._id }, $inc: { timeSpentSec: req.body.seconds }, $set: { status: 'in-progress', lastViewedAt: new Date() } },
    { new: true, upsert: true, runValidators: true }
  );
  if (row.timeSpentSec >= 45 && row.status !== 'completed') {
    row.status = 'completed';
    row.completedAt = new Date();
    await row.save();
    await updateSkillProgress(req.user._id, module.skill);
    await recordActivity(req.user, 'lesson-completed', { entityType: 'LessonProgress', entityId: row._id, skill: module.skill });
  }
  res.json({ success: true, data: row });
}));

router.post('/student/learning/:moduleId/:subtopicId/checkpoint', ...studentOnly, [body('answers').isArray()], validate, asyncHandler(async (req, res) => {
  const module = await LearningModule.findOne({ _id: req.params.moduleId, isPublished: true });
  const topic = module?.topics.find((item) => item.subtopics.id(req.params.subtopicId));
  const subtopic = topic?.subtopics.id(req.params.subtopicId);
  if (!subtopic) throw ApiError.notFound('Lesson not found');
  const answers = req.body.answers;
  const total = subtopic.checkpoints.length;
  if (!total) throw ApiError.badRequest('This lesson has no checkpoint quiz');
  const correct = subtopic.checkpoints.reduce((count, question, index) => count + (Number(answers[index]) === question.correctIndex ? 1 : 0), 0);
  const score = Math.round(correct / total * 100);
  const row = await LessonProgress.findOneAndUpdate(
    { user: req.user._id, subtopicId: subtopic._id },
    { $setOnInsert: { user: req.user._id, skill: module.skill, module: module._id, topicId: topic._id, subtopicId: subtopic._id }, $set: { quizPassed: score >= 60, quizScore: score, ...(score >= 60 ? { status: 'completed', completedAt: new Date() } : {}) }, $inc: { quizAttempts: 1 } },
    { upsert: true, new: true, runValidators: true }
  );
  if (score >= 60) {
    await updateSkillProgress(req.user._id, module.skill);
    await recordActivity(req.user, 'lesson-completed', { entityType: 'LessonProgress', entityId: row._id, skill: module.skill });
  }
  res.json({ success: true, data: { progress: row, score, passed: score >= 60, total, correct } });
}));

router.get('/student/practice/:skillId', ...studentOnly, asyncHandler(async (req, res) => {
  const questions = await PracticeQuestion.find({ skill: req.params.skillId, isActive: true }).sort({ order: 1 }).limit(100).select('-correctIndex -expectedAnswer -solutionExplanation');
  res.json({ success: true, data: questions });
}));
router.post('/student/practice/:questionId/submit', ...studentOnly, [body('selectedIndex').isInt({ min: 0 })], validate, asyncHandler(async (req, res) => {
  const question = await PracticeQuestion.findOne({ _id: req.params.questionId, isActive: true });
  if (!question) throw ApiError.notFound('Practice question not found');
  if (req.body.selectedIndex >= question.options.length) throw ApiError.badRequest('Choose one of the available options');
  const correct = req.body.selectedIndex === question.correctIndex;
  await recordActivity(req.user, 'practice-submitted', { skill: question.skill, entityType: 'PracticeQuestion', entityId: question._id, meta: { correct } });
  res.json({ success: true, data: { correct, correctIndex: question.correctIndex, explanation: question.solutionExplanation || question.expectedAnswer || '' } });
}));

router.get('/student/coding/:skillId', ...studentOnly, asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.skillId, isActive: true });
  if (!skill) throw ApiError.notFound('Skill not found');
  if (skill.executionType === 'none') throw ApiError.badRequest('This skill uses scenario or discussion practice rather than a code runner');
  const questions = await require('../models').CodingQuestion.find({ skill: skill._id, isActive: true }).sort({ order: 1 }).select('-solutions -testCases');
  res.json({ success: true, data: { skill: { id: skill._id, name: skill.name, executionType: skill.executionType, supportedLanguages: skill.supportedLanguages }, questions } });
}));
router.get('/student/coding/questions/:id/solution', ...studentOnly, asyncHandler(async (req, res) => {
  const question = await require('../models').CodingQuestion.findOne({ _id: req.params.id, isActive: true }).select('solutions approach timeComplexity spaceComplexity supportedLanguages');
  if (!question) throw ApiError.notFound('Coding question not found');
  const language = String(req.query.language || 'javascript');
  if (!question.supportedLanguages.includes(language)) throw ApiError.badRequest('This question does not support that language');
  const source = question.solutions?.[language];
  if (!source) throw ApiError.notFound('No solution is available in the selected language');
  res.json({ success: true, data: { language, source, approach: question.approach, timeComplexity: question.timeComplexity, spaceComplexity: question.spaceComplexity } });
}));
router.post('/student/coding/questions/:id/execute', ...studentOnly, [body('language').isIn(['java', 'python', 'c', 'cpp', 'javascript', 'sql']), body('sourceCode').isString().isLength({ min: 1, max: 60000 }), body('kind').optional().isIn(['run', 'submit']), body('roundId').optional().isMongoId()], validate, asyncHandler(async (req, res) => {
  const question = await require('../models').CodingQuestion.findOne({ _id: req.params.id, isActive: true }).populate('skill', 'executionType');
  if (!question) throw ApiError.notFound('Coding question not found');
  if (question.skill.executionType === 'none') throw ApiError.badRequest('This skill does not provide executable practice');
  if (!question.supportedLanguages.includes(req.body.language)) throw ApiError.badRequest('This question does not support the selected language');
  let recruitmentRound = null;
  if (req.body.roundId) {
    recruitmentRound = await RecruitmentRound.findById(req.body.roundId).populate('application');
    if (!recruitmentRound || recruitmentRound.type !== 'coding' || !recruitmentRound.application || String(recruitmentRound.application.student) !== String(req.user._id) || String(recruitmentRound.codingQuestion) !== String(question._id)) throw ApiError.notFound('Coding recruitment round not found');
    if (recruitmentRound.status !== 'in-progress') throw ApiError.badRequest('Start this coding round before submitting code');
    if (!recruitmentRound.assessmentStartedAt) throw ApiError.badRequest('Start this coding round before submitting code');
    if (Date.now() > recruitmentRound.assessmentStartedAt.getTime() + (recruitmentRound.durationMinutes || 30) * 60000) { await expireCodingRound(recruitmentRound, req.user); throw ApiError.conflict('The coding round time limit has expired and the round is now closed'); }
    if (await RoundResult.exists({ round: recruitmentRound._id, student: req.user._id })) throw ApiError.conflict('This coding round already has a recorded result');
  }
  if (!env.execution.enabled || !env.execution.runnerUrl) throw ApiError.unprocessable('The isolated code runner is not configured. Code is not executed by the YESGAP web server.', { code: 'RUNNER_UNAVAILABLE' });
  const kind = req.body.kind === 'submit' ? 'submit' : 'run';
  const cases = question.testCases.filter((item) => kind === 'submit' || !item.hidden);
  let runnerResult;
  try {
    const response = await fetch(env.execution.runnerUrl, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(env.execution.runnerToken ? { authorization: `Bearer ${env.execution.runnerToken}` } : {}) },
      body: JSON.stringify({ sourceCode: req.body.sourceCode, language: req.body.language, executionType: question.skill.executionType, testCases: cases.map((item) => ({ input: item.input, expectedOutput: item.expectedOutput })), limits: { timeoutMs: env.execution.timeoutMs, cpuSeconds: env.execution.cpuLimitSeconds, memoryMb: env.execution.memoryLimitMb, maxOutputChars: env.execution.maxOutputChars } }),
      signal: AbortSignal.timeout(env.execution.timeoutMs + 2000),
    });
    runnerResult = await response.json();
    if (!response.ok) throw new Error(`Isolated runner returned ${response.status}`);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    runnerResult = { status: timedOut ? 'timeout' : 'internal', stdout: '', stderr: timedOut ? 'Execution timed out.' : 'The isolated execution service is unavailable.', exitCode: -1, durationMs: env.execution.timeoutMs };
  }
  const allowedStatuses = ['ok', 'compile_error', 'runtime_error', 'timeout', 'memory_limit', 'internal'];
  const executionStatus = allowedStatuses.includes(runnerResult.status) ? runnerResult.status : 'internal';
  const outcomes = cases.map((item, index) => {
    const result = runnerResult.results?.[index] || {};
    const actual = String(result.actualOutput ?? '').slice(0, env.execution.maxOutputChars);
    const expected = String(item.expectedOutput ?? '').trim();
    return { index, input: item.hidden ? '' : item.input, expectedOutput: item.hidden ? '' : item.expectedOutput, actualOutput: item.hidden ? '' : actual, passed: executionStatus === 'ok' && (typeof result.passed === 'boolean' ? result.passed : actual.trim() === expected), hidden: Boolean(item.hidden) };
  });
  const submission = await CodingSubmission.create({ user: req.user._id, skill: question.skill._id, question: question._id, round: recruitmentRound?._id, language: req.body.language, source: req.body.sourceCode, kind, executionStatus, stdout: String(runnerResult.stdout || '').slice(0, env.execution.maxOutputChars), stderr: String(runnerResult.stderr || '').slice(0, env.execution.maxOutputChars), exitCode: Number.isInteger(runnerResult.exitCode) ? runnerResult.exitCode : 0, durationMs: Math.min(Number(runnerResult.durationMs) || 0, env.execution.timeoutMs), totalTests: cases.length, passedTests: outcomes.filter((item) => item.passed).length, outcomes, accepted: kind === 'submit' && executionStatus === 'ok' && outcomes.every((item) => item.passed) });
  if (kind === 'submit') await recordActivity(req.user, 'coding-submitted', { skill: question.skill._id, entityType: 'CodingSubmission', entityId: submission._id, meta: { accepted: submission.accepted } });
  let roundOutcome;
  if (kind === 'submit' && recruitmentRound && executionStatus !== 'internal') roundOutcome = await completeCodingRound(recruitmentRound, req.user, submission, submission.totalTests ? Math.round(submission.passedTests / submission.totalTests * 100) : 0);
  else if (kind === 'submit' && recruitmentRound) roundOutcome = { result: 'pending', message: 'The execution service had a problem. You can submit again.' };
  res.json({ success: true, data: { submissionId: submission._id, executionStatus, stdout: submission.stdout, stderr: submission.stderr, exitCode: submission.exitCode, durationMs: submission.durationMs, accepted: submission.accepted, passedTests: submission.passedTests, totalTests: submission.totalTests, roundOutcome, outcomes: outcomes.map(({ index, actualOutput, expectedOutput, input, passed, hidden }) => hidden ? ({ index, passed, hidden: true }) : ({ index, actualOutput, expectedOutput, input, passed, hidden: false })) } });
}));

router.get('/student/annotations', ...studentOnly, asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.skillId) filter.skill = req.query.skillId;
  res.json({ success: true, data: await Annotation.find(filter).populate('skill', 'name slug').sort({ updatedAt: -1 }) });
}));
router.post('/student/annotations', ...studentOnly, [body('type').isIn(['bookmark', 'note']), body('skillId').isMongoId()], validate, asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.body.skillId);
  if (!skill) throw ApiError.notFound('Skill not found');
  const item = await Annotation.create({ user: req.user._id, type: req.body.type, skill: skill._id, module: req.body.moduleId, subtopicId: req.body.subtopicId, label: req.body.label, content: req.body.content || '' });
  res.status(201).json({ success: true, data: item });
}));
router.delete('/student/annotations/:id', ...studentOnly, asyncHandler(async (req, res) => {
  const item = await Annotation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) throw ApiError.notFound('Note or bookmark not found');
  res.json({ success: true, message: 'Removed' });
}));

// Assessments: self-service skill tests use the shared question bank and the
// same immutable attempt records used for recruitment assessment stages.
router.get('/student/assessments/:skillId/sets', ...studentOnly, asyncHandler(async (req, res) => {
  const difficulty = ['beginner', 'intermediate', 'advanced'].includes(req.query.difficulty) ? req.query.difficulty : 'beginner';
  const sets = await TestSet.find({ skill: req.params.skillId, difficulty, isActive: true, questionCount: { $gt: 0 } }).sort({ setNumber: 1 }).select('setNumber title questionCount durationMinutes');
  const completed = await TestAttempt.find({ user: req.user._id, skill: req.params.skillId, difficulty, status: 'submitted' }).distinct('setNumber');
  res.json({ success: true, data: { sets, completedSetNumbers: completed, setCount: sets.length } });
}));
router.post('/student/assessments/attempts', ...studentOnly, [body('skillId').isMongoId(), body('setNumber').isInt({ min: 1 })], validate, asyncHandler(async (req, res) => {
  const difficulty = ['beginner', 'intermediate', 'advanced'].includes(req.body.difficulty) ? req.body.difficulty : 'beginner';
  const set = await TestSet.findOne({ skill: req.body.skillId, difficulty, setNumber: req.body.setNumber, isActive: true }).populate('questions');
  if (!set || !set.questions.length) throw ApiError.notFound('This assessment set has no available questions yet');
  const expiresAt = new Date(Date.now() + set.durationMinutes * 60000);
  const orderedQuestions = [...set.questions].sort(() => Math.random() - 0.5);
  const attempt = await TestAttempt.create({ user: req.user._id, skill: set.skill, difficulty, testSet: set._id, setNumber: set.setNumber, durationMinutes: set.durationMinutes, expiresAt, totalQuestions: orderedQuestions.length, answers: orderedQuestions.map((question) => ({ question: question._id, prompt: question.prompt, options: question.options, correctIndex: question.correctIndex, topic: question.topic })) });
  const questions = attempt.answers.map(({ prompt, options, topic }, index) => ({ index, prompt, options, topic }));
  res.status(201).json({ success: true, data: { attemptId: attempt._id, expiresAt, durationMinutes: attempt.durationMinutes, questions } });
}));
router.patch('/student/assessments/attempts/:id/answer', ...studentOnly, [body('index').isInt({ min: 0 }), body('selectedIndex').optional({ nullable: true }).isInt({ min: 0 })], validate, asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findOne({ _id: req.params.id, user: req.user._id, status: 'in-progress' });
  if (!attempt) throw ApiError.notFound('Assessment attempt not found or already submitted');
  if (Date.now() > attempt.expiresAt?.getTime()) throw ApiError.badRequest('The assessment time has ended');
  const answer = attempt.answers[req.body.index];
  if (!answer || (req.body.selectedIndex != null && req.body.selectedIndex >= answer.options.length)) throw ApiError.badRequest('Answer index is invalid');
  answer.selectedIndex = req.body.selectedIndex ?? null;
  answer.skipped = req.body.skipped === true;
  answer.timeSpentSec += Math.min(Number(req.body.timeSpentSec) || 0, 600);
  await attempt.save();
  res.json({ success: true, data: { saved: true } });
}));
router.post('/student/assessments/attempts/:id/reveal/:index', ...studentOnly, asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findOne({ _id: req.params.id, user: req.user._id, status: 'in-progress' });
  const answer = attempt?.answers[Number(req.params.index)];
  if (!answer) throw ApiError.notFound('Assessment question not found');
  answer.revealed = true;
  await attempt.save();
  res.json({ success: true, data: { correctIndex: answer.correctIndex, explanation: (await QuestionBankItem.findById(answer.question).select('explanation'))?.explanation || '' } });
}));
router.post('/student/assessments/attempts/:id/tab-switch', ...studentOnly, asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findOneAndUpdate({ _id: req.params.id, user: req.user._id, status: 'in-progress' }, { $inc: { tabSwitchCount: 1 }, $push: { tabSwitchEvents: new Date() } }, { new: true });
  if (!attempt) throw ApiError.notFound('Assessment attempt not found');
  res.json({ success: true, data: { tabSwitchCount: attempt.tabSwitchCount } });
}));
router.post('/student/assessments/attempts/:id/abandon', ...studentOnly, asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findOne({ _id: req.params.id, user: req.user._id, status: 'in-progress' });
  if (!attempt) throw ApiError.notFound('Assessment attempt not found');
  attempt.status = 'abandoned';
  attempt.submittedAt = new Date();
  attempt.timeTakenSec = Math.max(0, Math.round((Date.now() - attempt.startedAt.getTime()) / 1000));
  await attempt.save();
  res.json({ success: true, message: 'Assessment attempt saved as abandoned' });
}));
router.post('/student/assessments/attempts/:id/submit', ...studentOnly, asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findOne({ _id: req.params.id, user: req.user._id, status: 'in-progress' });
  if (!attempt) throw ApiError.notFound('Assessment attempt not found or already submitted');
  attempt.answers.forEach((answer) => { answer.isCorrect = answer.selectedIndex === answer.correctIndex && !answer.revealed; });
  attempt.correct = attempt.answers.filter((row) => row.isCorrect).length;
  attempt.skipped = attempt.answers.filter((row) => row.selectedIndex == null).length;
  attempt.wrong = attempt.totalQuestions - attempt.correct - attempt.skipped;
  attempt.revealed = attempt.answers.filter((row) => row.revealed).length;
  attempt.score = attempt.correct;
  attempt.percentage = attempt.totalQuestions ? Math.round(attempt.correct / attempt.totalQuestions * 100) : 0;
  attempt.timeTakenSec = Math.min(Math.round((Date.now() - attempt.startedAt.getTime()) / 1000), attempt.durationMinutes * 60);
  attempt.submittedAt = new Date();
  attempt.status = 'submitted';
  const topics = new Map();
  attempt.answers.forEach((row) => { const item = topics.get(row.topic || 'General') || { topic: row.topic || 'General', correct: 0, total: 0 }; item.total += 1; if (row.isCorrect) item.correct += 1; topics.set(item.topic, item); });
  attempt.topicBreakdown = Array.from(topics.values()).map((row) => ({ ...row, percentage: Math.round(row.correct / row.total * 100) }));
  attempt.weakTopics = attempt.topicBreakdown.filter((row) => row.percentage < 60).map((row) => row.topic);
  await attempt.save();
  await recordActivity(req.user, 'test-completed', { skill: attempt.skill, entityType: 'TestAttempt', entityId: attempt._id });
  await UserSkill.findOneAndUpdate({ user: req.user._id, skill: attempt.skill }, { $set: { status: 'in-progress', source: 'activity', lastActivityAt: new Date() } }, { upsert: true, setDefaultsOnInsert: true });
  if (attempt.mode === 'recruitment' && attempt.round) {
    const round = await RecruitmentRound.findById(attempt.round).populate('application');
    if (round?.application) {
      const outcome = attempt.percentage >= round.passPercentage ? 'passed' : 'failed';
      const result = await RoundResult.findOneAndUpdate({ round: round._id, student: req.user._id }, { $set: { round: round._id, application: round.application._id, student: req.user._id, company: round.company, attempt: attempt._id, result: outcome, score: attempt.percentage, recordedAt: new Date() } }, { new: true, upsert: true, runValidators: true });
      round.status = 'completed'; round.completedAt = new Date(); await round.save();
      round.application.status = outcome === 'failed' ? 'rejected-final' : 'in-progress';
      if (outcome === 'failed') { round.application.finalResult = 'rejected'; round.application.finalResultAt = new Date(); }
      await round.application.save();
      await notify(round.company, outcome === 'passed' ? 'candidate-accepted' : 'candidate-rejected', 'A recruitment assessment was completed', `${req.user.fullName} scored ${attempt.percentage}% in ${round.name}.`, { meta: { applicationId: String(round.application._id), roundId: String(round._id), resultId: String(result._id) }, actor: req.user._id });
      await notify(req.user._id, 'round-result', `${round.name} result is ready`, `Your score was ${attempt.percentage}%. The company recorded this as ${outcome}.`, { meta: { roundId: String(round._id), resultId: String(result._id) }, actor: round.company, priority: 'high' });
    }
  }
  res.json({ success: true, data: attempt });
}));
router.get('/student/assessments/attempts', ...studentOnly, asyncHandler(async (req, res) => {
  const attempts = await TestAttempt.find({ user: req.user._id, ...(req.query.skillId ? { skill: req.query.skillId } : {}) }).populate('skill', 'name slug').sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: attempts });
}));
router.get('/student/assessments/attempts/:id', ...studentOnly, asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findOne({ _id: req.params.id, user: req.user._id, status: 'submitted' }).populate('skill', 'name slug');
  if (!attempt) throw ApiError.notFound('Assessment result not found');
  res.json({ success: true, data: attempt });
}));

// Student opportunity inbox and response actions.
router.get('/student/opportunities', ...studentOnly, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { status: 'open' };
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
  const [items, total] = await Promise.all([
    Opportunity.find(filter).populate('company', 'companyName location industry website').populate('requiredSkills', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Opportunity.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: buildPaginationMeta({ page, limit, total }) });
}));
router.post('/student/opportunities/:id/apply', ...studentOnly, asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findOne({ _id: req.params.id, status: 'open' });
  if (!opportunity) throw ApiError.notFound('Open opportunity not found');
  const existing = await Application.findOne({ opportunity: opportunity._id, student: req.user._id });
  if (existing) throw ApiError.conflict('You already have a response for this opportunity');
  const application = await Application.create({ opportunity: opportunity._id, company: opportunity.company, student: req.user._id, status: 'accepted', contactUnlocked: true, respondedAt: new Date(), timeline: [{ status: 'accepted', actor: req.user._id }] });
  await notify(opportunity.company, 'candidate-accepted', 'A candidate applied to your opportunity', `${req.user.fullName} accepted ${opportunity.title} and shared their contact profile.`, { meta: { applicationId: String(application._id), opportunityId: String(opportunity._id) }, actor: req.user._id });
  await recordActivity(req.user, 'opportunity-accepted', { entityType: 'Application', entityId: application._id });
  res.status(201).json({ success: true, message: 'Application submitted', data: application });
}));
router.get('/student/applications', ...studentOnly, asyncHandler(async (req, res) => {
  const items = await Application.find({ student: req.user._id }).populate('opportunity', 'title description compensation location workMode employmentType requiredSkills status').populate('company', 'companyName location industry website').sort({ createdAt: -1 });
  res.json({ success: true, data: items });
}));
router.post('/student/applications/:id/respond', ...studentOnly, [body('response').isIn(['accepted', 'rejected'])], validate, asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, student: req.user._id, status: 'offered' }).populate('opportunity', 'status title').populate('company', 'companyName');
  if (!application) throw ApiError.notFound('Opportunity invitation not found');
  if (application.opportunity.status !== 'open') throw ApiError.badRequest('This opportunity is no longer open');
  const accepted = req.body.response === 'accepted';
  application.status = accepted ? 'accepted' : 'rejected';
  application.contactUnlocked = accepted;
  application.respondedAt = new Date();
  application.timeline.push({ status: application.status, actor: req.user._id, at: new Date() });
  await application.save();
  await notify(application.company._id, accepted ? 'candidate-accepted' : 'candidate-rejected', accepted ? 'A candidate accepted' : 'A candidate declined', `${req.user.fullName} ${accepted ? 'accepted' : 'declined'} the ${application.opportunity.title} opportunity.`, { meta: { applicationId: String(application._id), opportunityId: String(application.opportunity._id) }, actor: req.user._id });
  await recordActivity(req.user, accepted ? 'opportunity-accepted' : 'opportunity-rejected', { entityType: 'Application', entityId: application._id });
  res.json({ success: true, message: accepted ? 'You accepted the opportunity. The company can now view your contact details.' : 'You declined the opportunity.', data: application });
}));
router.post('/student/applications/:id/withdraw', ...studentOnly, asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, student: req.user._id }).populate('company', 'companyName');
  if (!application || !application.canWithdraw()) throw ApiError.badRequest('This recruitment process can no longer be withdrawn');
  application.status = 'withdrawn';
  application.withdrawnAt = new Date();
  application.contactUnlocked = false;
  application.timeline.push({ status: 'withdrawn', actor: req.user._id, note: String(req.body?.note || '').slice(0, 1000) });
  await application.save();
  res.json({ success: true, message: 'You withdrew from this recruitment process', data: application });
}));
router.get('/student/rounds', ...studentOnly, asyncHandler(async (req, res) => {
  const applications = await Application.find({ student: req.user._id, status: { $in: ['accepted', 'in-progress', 'selected', 'rejected-final'] } }).select('_id');
  const [rounds, results] = await Promise.all([
    RecruitmentRound.find({ application: { $in: applications.map(({ _id }) => _id) } }).populate('opportunity', 'title company').populate('company', 'companyName').populate('codingQuestion', 'title slug statement inputSpec outputSpec constraints examples difficulty topic supportedLanguages starterCode').sort({ date: 1, roundNumber: 1 }),
    RoundResult.find({ student: req.user._id }).populate('round', 'roundNumber name type').sort({ createdAt: -1 }),
  ]);
  res.json({ success: true, data: { rounds, results } });
}));
router.post('/student/rounds/:id/start', ...studentOnly, asyncHandler(async (req, res) => {
  const round = await RecruitmentRound.findById(req.params.id).populate('testSet').populate('application').populate('codingQuestion', 'title slug statement inputSpec outputSpec constraints examples difficulty topic supportedLanguages starterCode');
  if (!round || !round.application || String(round.application.student) !== String(req.user._id)) throw ApiError.notFound('Recruitment round not found');
  if (!['accepted', 'in-progress'].includes(round.application.status)) throw ApiError.forbidden('Accept the opportunity before starting its rounds');
  if (!['mcq', 'coding', 'custom-assessment'].includes(round.type)) throw ApiError.badRequest('This round is scheduled as a live or interviewer-reviewed stage');
  if (await RoundResult.exists({ round: round._id, student: req.user._id })) throw ApiError.conflict('This round already has a recorded result');
  if (round.type === 'coding') {
    if (!round.codingQuestion || !round.codingQuestion.supportedLanguages?.length) throw ApiError.badRequest('This coding round has no available challenge');
    if (round.assessmentStartedAt && Date.now() > round.assessmentStartedAt.getTime() + (round.durationMinutes || 30) * 60000) { await expireCodingRound(round, req.user); throw ApiError.conflict('The coding round time limit has expired'); }
    if (!env.execution.enabled || !env.execution.runnerUrl) throw ApiError.unprocessable('The isolated code runner is not configured. Ask the company to reschedule this challenge after the sandbox is connected.', { code: 'RUNNER_UNAVAILABLE' });
    if (!round.assessmentStartedAt) round.assessmentStartedAt = new Date();
    round.status = 'in-progress'; await round.save();
    const durationMinutes = round.durationMinutes || 30;
    res.status(200).json({ success: true, data: { codingRoundId: round._id, durationMinutes, expiresAt: new Date(round.assessmentStartedAt.getTime() + durationMinutes * 60000), question: round.codingQuestion } });
    return;
  }
  if (!round.testSet && !round.questionItems.length) throw ApiError.badRequest('This assessment round has no questions configured');
  const ids = round.testSet ? round.testSet.questions : round.questionItems;
  const questions = await QuestionBankItem.find({ _id: { $in: ids }, isActive: true });
  if (!questions.length) throw ApiError.badRequest('This assessment round has no available questions');
  const duration = round.durationMinutes || round.testSet?.durationMinutes || 30;
  const attempt = await TestAttempt.create({ user: req.user._id, skill: round.skill || questions[0].skill, difficulty: round.testSet?.difficulty || 'intermediate', testSet: round.testSet?._id, mode: 'recruitment', round: round._id, company: round.company, durationMinutes: duration, expiresAt: new Date(Date.now() + duration * 60000), totalQuestions: questions.length, answers: questions.map((question) => ({ question: question._id, prompt: question.prompt, options: question.options, correctIndex: question.correctIndex, topic: question.topic })) });
  round.status = 'in-progress';
  await round.save();
  res.status(201).json({ success: true, data: { attemptId: attempt._id, expiresAt: attempt.expiresAt, durationMinutes: duration, questions: attempt.answers.map(({ prompt, options, topic }, index) => ({ index, prompt, options, topic })) } });
}));
router.get('/student/round-results', ...studentOnly, asyncHandler(async (req, res) => {
  const data = await RoundResult.find({ student: req.user._id }).populate('round', 'roundNumber name type').populate('company', 'companyName').sort({ createdAt: -1 });
  res.json({ success: true, data });
}));

// Company candidate discovery never serializes email, phone, or resume.
router.get('/company/dashboard', ...companyOnly, asyncHandler(async (req, res) => {
  const [opportunities, offered, accepted, candidates, unread] = await Promise.all([
    Opportunity.countDocuments({ company: req.user._id, status: 'open' }),
    Application.countDocuments({ company: req.user._id, status: 'offered' }),
    Application.countDocuments({ company: req.user._id, status: 'accepted' }),
    User.countDocuments({ role: 'student', isActive: true }),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ success: true, data: { company: { id: req.user._id, fullName: req.user.fullName, companyName: req.user.companyName, industry: req.user.industry, location: req.user.location, description: req.user.description, website: req.user.website, approvalStatus: req.user.approvalStatus }, stats: { openOpportunities: opportunities, pendingResponses: offered, acceptedCandidates: accepted, discoverableCandidates: candidates, unreadNotifications: unread } } });
}));
router.get('/company/candidates', ...companyOnly, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { role: 'student', isActive: true };
  if (req.query.domainId) filter.careerDomain = req.query.domainId;
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
  let candidates = await User.find(filter).select('fullName headline careerDomain education createdAt').populate('careerDomain', 'name slug').sort(parseSort(req.query.sort, { createdAt: -1 })).skip(skip).limit(limit);
  const total = await User.countDocuments(filter);
  if (req.query.skillId) {
    const knownIds = new Set((await UserSkill.find({ skill: req.query.skillId, status: { $in: ['known', 'completed'] }, user: { $in: candidates.map(({ _id }) => _id) } }).distinct('user')).map(String));
    candidates = candidates.filter(({ _id }) => knownIds.has(String(_id)));
  }
  const candidateIds = candidates.map(({ _id }) => _id);
  const [skills, attempts, lessons, applications] = await Promise.all([
    UserSkill.find({ user: { $in: candidateIds } }).populate('skill', 'name slug').lean(),
    TestAttempt.aggregate([{ $match: { user: { $in: candidateIds }, status: 'submitted', mode: 'self' } }, { $group: { _id: '$user', averageScore: { $avg: '$percentage' }, completed: { $sum: 1 } } }]),
    LessonProgress.aggregate([{ $match: { user: { $in: candidateIds }, status: 'completed' } }, { $group: { _id: '$user', completed: { $sum: 1 } } }]),
    Application.find({ company: req.user._id, student: { $in: candidateIds } }).select('student status contactUnlocked opportunity'),
  ]);
  const byUser = (rows) => new Map(rows.map((row) => [String(row._id || row.user), row]));
  const skillMap = new Map();
  skills.forEach((row) => { const key = String(row.user); if (!skillMap.has(key)) skillMap.set(key, []); skillMap.get(key).push({ skill: row.skill, status: row.status, progress: row.progress }); });
  const testMap = byUser(attempts); const lessonMap = byUser(lessons); const appMap = new Map(applications.map((row) => [String(row.student), row]));
  const data = candidates.map((user) => {
    const userSkills = skillMap.get(String(user._id)) || [];
    const test = testMap.get(String(user._id));
    return {
      ...candidateSummary(user),
      skills: userSkills,
      learningProgress: lessonMap.get(String(user._id))?.completed || 0,
      assessmentPerformance: Math.round(test?.averageScore || 0),
      assessmentsCompleted: test?.completed || 0,
      recruitmentStatus: appMap.get(String(user._id))?.status || null,
      indicators: [
        ...(userSkills.filter(({ status }) => status === 'known' || status === 'completed').length >= 3 ? ['strong-skill-match'] : []),
        ...(lessonMap.get(String(user._id))?.completed >= 5 ? ['high-progress'] : []),
        ...(test?.averageScore >= 80 ? ['strong-assessment-performance'] : []),
      ],
    };
  });
  res.json({ success: true, data, meta: buildPaginationMeta({ page, limit, total }) });
}));
router.get('/company/applications', ...companyOnly, asyncHandler(async (req, res) => {
  const filter = { company: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const rows = await Application.find(filter).populate('opportunity', 'title status').populate('student', 'fullName headline careerDomain education').sort({ createdAt: -1 }).limit(200);
  const data = await Promise.all(rows.map(async (row) => {
    const student = row.student.toObject();
    if (['accepted', 'in-progress', 'selected', 'rejected-final'].includes(row.status) && row.contactUnlocked) {
      const withContact = await User.findById(row.student._id).select('email phone resume');
      Object.assign(student, { email: withContact.email, phone: withContact.phone, resume: withContact.resume });
    }
    return { ...row.toObject(), student };
  }));
  res.json({ success: true, data });
}));
router.get('/company/applications/:id/rounds', ...companyOnly, asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, company: req.user._id });
  if (!application) throw ApiError.notFound('Recruitment application not found');
  const data = await RecruitmentRound.find({ application: application._id }).populate('testSet', 'title difficulty questionCount durationMinutes').populate('skill', 'name slug').sort({ roundNumber: 1 });
  res.json({ success: true, data });
}));
router.get('/company/assessment-sets/:skillId', ...companyOnly, asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.skillId, isActive: true });
  if (!skill) throw ApiError.notFound('Skill not found');
  const sets = await TestSet.find({ skill: skill._id, isActive: true, questionCount: { $gt: 0 } }).sort({ difficulty: 1, setNumber: 1 }).select('title skill difficulty setNumber questionCount durationMinutes');
  res.json({ success: true, data: sets });
}));
router.get('/company/coding-questions/:skillId', ...companyOnly, asyncHandler(async (req, res) => {
  const skill = await Skill.findOne({ _id: req.params.skillId, isActive: true });
  if (!skill) throw ApiError.notFound('Skill not found');
  const data = await CodingQuestion.find({ skill: skill._id, isActive: true }).sort({ difficulty: 1, order: 1 }).select('title difficulty topic supportedLanguages skill');
  res.json({ success: true, data });
}));
router.get('/company/question-bank', ...companyOnly, asyncHandler(async (req, res) => {
  const filter = { isActive: true, $or: [{ visibility: 'platform' }, { visibility: 'company', owner: req.user._id }] };
  if (req.query.skillId) filter.skill = req.query.skillId;
  if (['beginner', 'intermediate', 'advanced'].includes(req.query.difficulty)) filter.difficulty = req.query.difficulty;
  const data = await QuestionBankItem.find(filter).populate('skill', 'name slug').sort({ difficulty: 1, topic: 1, createdAt: -1 }).limit(500);
  res.json({ success: true, data });
}));
router.post('/company/question-bank', ...companyOnly, [
  body('skillId').isMongoId(), body('difficulty').isIn(['beginner', 'intermediate', 'advanced']),
  body('prompt').trim().isLength({ min: 2, max: 3000 }), body('options').isArray({ min: 2, max: 6 }), body('correctIndex').isInt({ min: 0 }),
], validate, asyncHandler(async (req, res) => {
  if (req.body.correctIndex >= req.body.options.length) throw ApiError.badRequest('The correct answer must match one of the available options');
  const skill = await Skill.findOne({ _id: req.body.skillId, isActive: true });
  if (!skill) throw ApiError.badRequest('Choose an active skill from the shared catalog');
  const item = await QuestionBankItem.create({ skill: skill._id, difficulty: req.body.difficulty, prompt: req.body.prompt, options: req.body.options, correctIndex: req.body.correctIndex, topic: req.body.topic, explanation: req.body.explanation, tags: req.body.tags || [], visibility: 'company', owner: req.user._id, createdBy: req.user._id });
  res.status(201).json({ success: true, data: item });
}));
router.post('/company/applications/:id/rounds', ...companyOnly, [
  body('name').trim().isLength({ min: 2, max: 200 }), body('type').isIn(['mcq', 'coding', 'technical', 'face-to-face', 'video-interview', 'custom-assessment']),
  body('testSetId').optional().isMongoId(), body('skillId').optional().isMongoId(), body('codingQuestionId').optional().isMongoId(), body('questionItems').optional().isArray({ min: 1, max: 100 }),
], validate, asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, company: req.user._id }).populate('opportunity');
  if (!application) throw ApiError.notFound('Recruitment application not found');
  if (!['accepted', 'in-progress'].includes(application.status)) throw ApiError.badRequest('The candidate must accept before rounds can be scheduled');
  const roundNumber = (await RecruitmentRound.countDocuments({ application: application._id })) + 1;
  let testSet;
  let codingQuestion;
  if (req.body.type === 'coding') {
    if (!env.execution.enabled || !env.execution.runnerUrl) throw ApiError.unprocessable('The isolated code runner is not configured. Connect the sandbox before scheduling coding challenges.', { code: 'RUNNER_UNAVAILABLE' });
    const selectedSkill = req.body.skillId || application.opportunity.requiredSkills[0];
    codingQuestion = req.body.codingQuestionId ? await CodingQuestion.findOne({ _id: req.body.codingQuestionId, isActive: true }).select('_id skill supportedLanguages testCases') : null;
    if (!codingQuestion || String(codingQuestion.skill) !== String(selectedSkill) || !codingQuestion.supportedLanguages.length || !codingQuestion.testCases.length) throw ApiError.badRequest('Choose an active coding challenge with test cases for the selected skill');
  }
  if (['mcq', 'custom-assessment'].includes(req.body.type)) {
    testSet = req.body.testSetId ? await TestSet.findById(req.body.testSetId) : null;
    if (req.body.testSetId && (!testSet || !testSet.isActive || testSet.questionCount < 1)) throw ApiError.badRequest('Choose an active shared assessment set with questions');
    const selectedSkill = req.body.skillId || application.opportunity.requiredSkills[0];
    if (testSet && String(testSet.skill) !== String(selectedSkill)) throw ApiError.badRequest('The shared assessment set must match the selected skill');
    if (!testSet && !Array.isArray(req.body.questionItems)) throw ApiError.badRequest('Choose a shared test set or question bank items');
    const selectedItems = !testSet ? await QuestionBankItem.find({ _id: { $in: req.body.questionItems }, isActive: true, $or: [{ visibility: 'platform' }, { visibility: 'company', owner: req.user._id }] }).select('_id skill') : [];
    if (!testSet && selectedItems.some((item) => String(item.skill) !== String(selectedSkill))) throw ApiError.badRequest('All selected questions must match the assessment skill');
    const count = testSet ? testSet.questionCount : selectedItems.length;
    if (count < 1) throw ApiError.badRequest('The selected assessment has no available questions');
  }
  const round = await RecruitmentRound.create({
    company: req.user._id, opportunity: application.opportunity._id, application: application._id,
    roundNumber, name: req.body.name, type: req.body.type, description: req.body.description,
    date: req.body.date, time: req.body.time, durationMinutes: req.body.durationMinutes,
    instructions: req.body.instructions, eligibility: req.body.eligibility, meetingLink: req.body.meetingLink,
    testSet: testSet?._id, codingQuestion: codingQuestion?._id, skill: req.body.skillId || application.opportunity.requiredSkills[0],
    questionItems: req.body.questionItems || [], passPercentage: req.body.passPercentage, createdBy: req.user._id,
  });
  application.status = 'in-progress';
  application.currentRoundNumber = roundNumber;
  await application.save();
  await notify(application.student, 'round-scheduled', `${round.name} is scheduled`, `Your ${round.name} stage for ${application.opportunity.title} is ready.`, { link: '/student/recruitment', meta: { roundId: String(round._id), applicationId: String(application._id) }, actor: req.user._id, priority: 'high' });
  res.status(201).json({ success: true, data: round });
}));
router.post('/company/rounds/:id/results', ...companyOnly, [body('result').isIn(['passed', 'failed', 'next-round']), body('score').optional().isFloat({ min: 0, max: 100 }), body('feedback').optional().isString().isLength({ max: 4000 })], validate, asyncHandler(async (req, res) => {
  const round = await RecruitmentRound.findOne({ _id: req.params.id, company: req.user._id }).populate('application');
  if (!round || !round.application) throw ApiError.notFound('Recruitment round not found');
  const result = await RoundResult.findOneAndUpdate({ round: round._id, student: round.application.student }, { $set: { round: round._id, application: round.application._id, student: round.application.student, company: req.user._id, result: req.body.result, score: req.body.score, feedback: req.body.feedback, recordedBy: req.user._id, recordedAt: new Date() } }, { new: true, upsert: true, runValidators: true });
  round.status = 'completed'; round.completedAt = new Date(); await round.save();
  if (req.body.result === 'failed') { round.application.status = 'rejected-final'; round.application.finalResult = 'rejected'; round.application.finalResultAt = new Date(); }
  else { round.application.status = 'in-progress'; round.application.currentRoundNumber = Math.max(round.application.currentRoundNumber, round.roundNumber); }
  await round.application.save();
  await notify(round.application.student, 'round-result', `${round.name} result is ready`, `The company recorded ${req.body.result.replace('-', ' ')}. ${req.body.feedback || ''}`.trim(), { link: '/student/recruitment', meta: { roundId: String(round._id), resultId: String(result._id) }, actor: req.user._id, priority: 'high' });
  res.json({ success: true, data: result });
}));
router.patch('/company/applications/:id/final-result', ...companyOnly, [body('result').isIn(['selected', 'rejected']), body('note').optional().isString().isLength({ max: 1000 })], validate, asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, company: req.user._id });
  if (!application || !['accepted', 'in-progress'].includes(application.status)) throw ApiError.notFound('Active recruitment application not found');
  application.finalResult = req.body.result;
  application.finalResultAt = new Date();
  application.status = req.body.result === 'selected' ? 'selected' : 'rejected-final';
  application.contactUnlocked = true;
  application.timeline.push({ status: application.status, note: req.body.note, actor: req.user._id, at: new Date() });
  await application.save();
  await notify(application.student, 'round-result', `Final recruitment result: ${req.body.result}`, req.body.note || `The company has recorded a final ${req.body.result} decision.`, { meta: { applicationId: String(application._id) }, actor: req.user._id, priority: 'high' });
  res.json({ success: true, data: application });
}));
router.post('/company/opportunities', ...companyOnly, [body('title').trim().isLength({ min: 3, max: 200 })], validate, asyncHandler(async (req, res) => {
  if (req.body.firstRound?.type === 'coding') throw ApiError.badRequest('Schedule a coding challenge after the candidate accepts, so you can choose an active problem for the right skill.');
  const allowedSkills = req.body.requiredSkills || [];
  if (!Array.isArray(allowedSkills) || allowedSkills.length === 0) throw ApiError.badRequest('Select at least one required skill from the central catalog');
  const valid = await Skill.countDocuments({ _id: { $in: allowedSkills }, isActive: true });
  if (valid !== allowedSkills.length) throw ApiError.badRequest('Required skills must be selected from the central skills catalog');
  const opportunity = await Opportunity.create({
    company: req.user._id, createdBy: req.user._id,
    title: req.body.title, description: req.body.description,
    responsibilities: req.body.responsibilities, compensation: req.body.compensation,
    location: req.body.location || req.user.location, workMode: req.body.workMode,
    employmentType: req.body.employmentType, experienceLevel: req.body.experienceLevel,
    openings: req.body.openings, applicationDeadline: req.body.applicationDeadline,
    requiredSkills: allowedSkills, firstRound: req.body.firstRound,
  });
  await recordActivity(req.user, 'opportunity-created', { entityType: 'Opportunity', entityId: opportunity._id });
  res.status(201).json({ success: true, message: 'Opportunity published', data: opportunity });
}));
router.post('/company/opportunities/:id/send', ...companyOnly, [body('studentId').isMongoId()], validate, asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findOne({ _id: req.params.id, company: req.user._id, status: 'open' });
  if (!opportunity) throw ApiError.notFound('Open opportunity not found');
  const student = await User.findOne({ _id: req.body.studentId, role: 'student', isActive: true });
  if (!student) throw ApiError.notFound('Candidate not found');
  let application = await Application.findOne({ opportunity: opportunity._id, student: student._id });
  if (application) throw ApiError.conflict('This candidate already has a response for this opportunity');
  application = await Application.create({ opportunity: opportunity._id, company: req.user._id, student: student._id, status: 'offered', timeline: [{ status: 'offered', actor: req.user._id }] });
  if (opportunity.firstRound?.name) {
    const first = opportunity.firstRound.toObject ? opportunity.firstRound.toObject() : opportunity.firstRound;
    let testSet;
    if (['mcq', 'custom-assessment'].includes(first.type)) {
      testSet = await TestSet.findOne({ skill: opportunity.requiredSkills[0], difficulty: 'beginner', isActive: true }).sort({ setNumber: 1 });
    }
    const round = await RecruitmentRound.create({
      company: req.user._id, opportunity: opportunity._id, application: application._id,
      roundNumber: 1, name: first.name || 'Round 1', type: first.type || 'technical',
      date: first.date, time: first.time, durationMinutes: first.durationMinutes,
      instructions: first.instructions, status: 'scheduled', createdBy: req.user._id,
      skill: opportunity.requiredSkills[0], testSet: testSet?._id,
    });
    await notify(student._id, 'round-scheduled', 'A recruitment round is scheduled', `${round.name} for ${opportunity.title} is ready in your recruitment workspace.`, { link: '/student/recruitment', meta: { roundId: String(round._id), applicationId: String(application._id) }, actor: req.user._id });
  }
  await notify(student._id, 'opportunity-received', 'A company invited you to apply', `${req.user.companyName} invited you to consider ${opportunity.title}.`, { link: '/student/opportunities', meta: { applicationId: String(application._id), opportunityId: String(opportunity._id) }, actor: req.user._id, priority: 'high' });
  res.status(201).json({ success: true, data: application });
}));
router.patch('/company/opportunities/:id/status', ...companyOnly, [body('status').isIn(['open', 'closed', 'filled'])], validate, asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findOne({ _id: req.params.id, company: req.user._id });
  if (!opportunity) throw ApiError.notFound('Opportunity not found');
  opportunity.status = req.body.status;
  opportunity.updatedBy = req.user._id;
  if (req.body.status === 'closed') opportunity.closedAt = new Date();
  if (req.body.status === 'filled') opportunity.filledAt = new Date();
  await opportunity.save();
  res.json({ success: true, data: opportunity });
}));
router.get('/company/opportunities', ...companyOnly, asyncHandler(async (req, res) => {
  const rows = await Opportunity.find({ company: req.user._id }).populate('requiredSkills', 'name slug').sort({ createdAt: -1 });
  res.json({ success: true, data: rows });
}));

// In-portal inbox and complaints.
router.get('/notifications', authenticate, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [data, total, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ success: true, data, meta: { ...buildPaginationMeta({ page, limit, total }), unreadCount } });
}));
router.patch('/notifications/read-all', authenticate, asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true, readAt: new Date() } });
  res.json({ success: true, message: 'All notifications marked as read' });
}));
router.patch('/notifications/:id/read', authenticate, asyncHandler(async (req, res) => {
  const row = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { read: true, readAt: new Date() } }, { new: true });
  if (!row) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: row });
}));
router.get('/complaints', authenticate, asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
  const data = await Complaint.find(filter).populate('user', 'fullName companyName role').sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data });
}));
router.post('/complaints', authenticate, [body('subject').trim().isLength({ min: 3, max: 200 }), body('message').trim().isLength({ min: 10, max: 8000 })], validate, asyncHandler(async (req, res) => {
  if (!['student', 'company'].includes(req.user.role)) throw ApiError.forbidden('Only student and company accounts may submit complaints');
  const complaint = await Complaint.create({ user: req.user._id, role: req.user.role, category: req.body.category, subject: req.body.subject, message: req.body.message });
  await notifyAdmins('complaint-submitted', 'New complaint submitted', req.body.subject, { link: '/admin/complaints', meta: { complaintId: String(complaint._id) }, actor: req.user._id, priority: 'high' });
  await recordActivity(req.user, 'complaint-submitted', { entityType: 'Complaint', entityId: complaint._id });
  res.status(201).json({ success: true, message: 'Your message was sent to the admin inbox', data: complaint });
}));

module.exports = router;
