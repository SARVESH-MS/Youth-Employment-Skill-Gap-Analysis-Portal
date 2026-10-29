'use strict';

const {
  ActivityLog, CodingSubmission, DomainSkill, LessonProgress,
  SkillEngagement, SkillMarketDemand, TestAttempt, UserSkill,
} = require('../models');
const { getReadinessSettings } = require('./marketDemand.service');

const LEGACY_ENGAGEMENT_ACTIONS = ['practice-submitted', 'coding-submitted', 'test-completed', 'lesson-completed'];
const maxDate = (...values) => values
  .filter(Boolean)
  .map((value) => new Date(value))
  .filter((value) => !Number.isNaN(value.getTime()))
  .reduce((latest, value) => (!latest || value > latest ? value : latest), null);

const normalizeState = (record, hasPassedAssessment) => {
  if (hasPassedAssessment || record?.readinessState === 'verified' || record?.verifiedAt) return 'verified';
  if (record?.readinessState === 'completed' || record?.status === 'completed') return 'completed';
  if (record?.readinessState === 'in-progress' || record?.status === 'in-progress' || record?.status === 'known') return 'in-progress';
  return 'missing';
};

const freshnessFactor = (lastEngagedAt, now, settings) => {
  if (!lastEngagedAt) return { factor: 1, inactiveDays: null };
  const inactiveDays = Math.max(0, (now.getTime() - new Date(lastEngagedAt).getTime()) / 86_400_000);
  const daysBeyondGrace = inactiveDays - settings.freshness.graceDays;
  if (daysBeyondGrace <= 0) return { factor: 1, inactiveDays: Math.floor(inactiveDays) };
  const decayProgress = Math.min(1, daysBeyondGrace / settings.freshness.decayDurationDays);
  return {
    factor: Math.max(settings.freshness.decayFloor, 1 - ((1 - settings.freshness.decayFloor) * decayProgress)),
    inactiveDays: Math.floor(inactiveDays),
  };
};

class ReadinessScoreService {
  getSettings() {
    return getReadinessSettings();
  }

  async recordSkillEngagement(userId, skillId, at = new Date()) {
    if (!userId || !skillId) return null;
    return SkillEngagement.findOneAndUpdate(
      { user: userId, skill: skillId },
      { $set: { lastEngagedAt: at }, $setOnInsert: { user: userId, skill: skillId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async recordAssessmentResult(userId, skillId, percentage) {
    const settings = await this.getSettings();
    const existing = await UserSkill.findOne({ user: userId, skill: skillId }).select('status readinessState progress source startedAt completedAt verifiedAt');
    const passed = percentage >= settings.verificationPassPercentage;
    const readinessState = passed || existing?.readinessState === 'verified'
      ? 'verified'
      : existing?.readinessState === 'completed' || existing?.status === 'completed'
        ? 'completed'
        : existing?.readinessState || (existing?.status === 'missing' ? 'missing' : 'in-progress');
    const now = new Date();
    return UserSkill.findOneAndUpdate(
      { user: userId, skill: skillId },
      {
        $set: {
          readinessState,
          source: 'activity',
          lastActivityAt: now,
          ...(passed ? { verifiedAt: existing?.verifiedAt || now } : {}),
          ...(readinessState === 'in-progress' ? { startedAt: existing?.startedAt || now } : {}),
        },
        $setOnInsert: { progress: 0 },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  async migrateDomainSkillMetadata() {
    const links = await DomainSkill.find({ $or: [{ importanceWeight: { $exists: false } }, { importanceLevel: { $exists: false } }] }).select('_id order importanceWeight importanceLevel').lean();
    if (!links.length) return 0;
    await DomainSkill.bulkWrite(links.map((link) => {
      const core = (link.order || 0) < 3;
      return {
        updateOne: {
          filter: { _id: link._id },
          update: { $set: {
            ...(link.importanceWeight === undefined ? { importanceWeight: core ? 5 : 3 } : {}),
            ...(link.importanceLevel === undefined ? { importanceLevel: core ? 'core' : 'supporting' } : {}),
          } },
        },
      };
    }), { ordered: false });
    return links.length;
  }

  async calculate(userId, domainId, { requiredRows, userSkills, now = new Date() } = {}) {
    const [settings, rows, userSkillRows] = await Promise.all([
      this.getSettings(),
      requiredRows || DomainSkill.find({ domain: domainId, required: true }).populate('skill').sort({ order: 1 }),
      userSkills || UserSkill.find({ user: userId }).select('skill status readinessState source progress startedAt completedAt verifiedAt lastActivityAt').lean(),
    ]);
    const activeRows = rows.filter((row) => row.skill?.isActive);
    const skillIds = activeRows.map((row) => row.skill._id);
    if (!skillIds.length) {
      return { careerReadiness: 0, readinessBreakdown: [], readinessModel: {
        formula: 'weighted-confidence-v1', maximumBaselineScore: 0, weightedScore: 0,
        settings: { confidence: settings.confidence, freshness: settings.freshness, verificationPassPercentage: settings.verificationPassPercentage, marketDemand: settings.marketDemand },
        marketDemandComputedAt: settings.marketDemand.computedAt || null,
      } };
    }

    const [engagementRows, lessonRows, activityRows, attemptRows, codingRows, demandRows] = await Promise.all([
      SkillEngagement.find({ user: userId, skill: { $in: skillIds } }).select('skill lastEngagedAt').lean(),
      LessonProgress.aggregate([
        { $match: { user: userId, skill: { $in: skillIds }, lastViewedAt: { $ne: null } } },
        { $group: { _id: '$skill', lastEngagedAt: { $max: '$lastViewedAt' } } },
      ]),
      ActivityLog.aggregate([
        { $match: { user: userId, skill: { $in: skillIds }, action: { $in: LEGACY_ENGAGEMENT_ACTIONS } } },
        { $group: { _id: '$skill', lastEngagedAt: { $max: '$createdAt' } } },
      ]),
      TestAttempt.aggregate([
        { $match: { user: userId, skill: { $in: skillIds }, status: 'submitted', mode: 'self' } },
        { $group: {
          _id: '$skill',
          lastAttemptAt: { $max: '$submittedAt' },
          lastPassingAttemptAt: { $max: { $cond: [{ $gte: ['$percentage', settings.verificationPassPercentage] }, '$submittedAt', null] } },
        } },
      ]),
      CodingSubmission.aggregate([
        { $match: { user: userId, skill: { $in: skillIds }, kind: 'submit' } },
        { $group: {
          _id: '$skill',
          lastSubmissionAt: { $max: { $ifNull: ['$updatedAt', '$createdAt'] } },
          lastAcceptedAt: { $max: { $cond: [{ $and: [{ $eq: ['$accepted', true] }, { $eq: ['$executionStatus', 'ok'] }] }, { $ifNull: ['$updatedAt', '$createdAt'] }, null] } },
        } },
      ]),
      SkillMarketDemand.find({ skill: { $in: skillIds } }).select('skill opportunityCount marketDemandMultiplier computedAt').lean(),
    ]);

    const engagementBySkill = new Map();
    const addEngagement = (skill, at) => {
      const key = String(skill?._id || skill);
      const latest = maxDate(engagementBySkill.get(key), at);
      if (latest) engagementBySkill.set(key, latest);
    };
    engagementRows.forEach((row) => addEngagement(row.skill, row.lastEngagedAt));
    lessonRows.forEach((row) => addEngagement(row._id, row.lastEngagedAt));
    activityRows.forEach((row) => addEngagement(row._id, row.lastEngagedAt));
    attemptRows.forEach((row) => addEngagement(row._id, row.lastAttemptAt));
    codingRows.forEach((row) => addEngagement(row._id, row.lastSubmissionAt));

    const passedSkills = new Set();
    attemptRows.forEach((row) => {
      if (row.lastPassingAttemptAt) {
        passedSkills.add(String(row._id));
      }
    });
    codingRows.forEach((row) => {
      if (row.lastAcceptedAt) {
        passedSkills.add(String(row._id));
      }
    });

    const demandBySkill = new Map(demandRows.map((row) => [String(row.skill), row]));
    const userSkillById = new Map(userSkillRows.map((row) => [String(row.skill?._id || row.skill), row]));
    const confidenceByState = {
      missing: settings.confidence.missing,
      'in-progress': settings.confidence.inProgress,
      completed: settings.confidence.completed,
      verified: settings.confidence.verified,
    };
    const maximumBaselineScore = activeRows.reduce((sum, row) => sum + (row.importanceWeight || 3) * settings.confidence.verified, 0);
    const readinessBreakdown = activeRows.map((row) => {
      const skillId = String(row.skill._id);
      const userSkill = userSkillById.get(skillId);
      const state = normalizeState(userSkill, passedSkills.has(skillId));
      const confidenceMultiplier = confidenceByState[state];
      const engagementAt = maxDate(
        engagementBySkill.get(skillId),
        userSkill?.lastActivityAt,
        userSkill?.verifiedAt,
        userSkill?.completedAt,
        userSkill?.startedAt,
      );
      const freshness = freshnessFactor(engagementAt, now, settings);
      const demand = demandBySkill.get(skillId);
      const marketDemandMultiplier = demand?.marketDemandMultiplier ?? 1;
      const importanceWeight = row.importanceWeight || 3;
      const score = importanceWeight * marketDemandMultiplier * confidenceMultiplier * freshness.factor;
      return {
        skillId: row.skill._id,
        skillName: row.skill.name,
        importanceWeight,
        importanceLevel: row.importanceLevel || (importanceWeight >= 4 ? 'core' : 'supporting'),
        state,
        confidenceMultiplier,
        freshnessDecayFactor: Number(freshness.factor.toFixed(4)),
        inactiveDays: freshness.inactiveDays,
        lastEngagedAt: engagementAt,
        marketDemandMultiplier: Number(marketDemandMultiplier.toFixed(4)),
        marketOpportunityCount: demand?.opportunityCount || 0,
        score: Number(score.toFixed(4)),
        maxBaselineScore: Number((importanceWeight * settings.confidence.verified).toFixed(4)),
        readinessContribution: maximumBaselineScore ? Number((score / maximumBaselineScore * 100).toFixed(2)) : 0,
      };
    });
    const weightedScore = readinessBreakdown.reduce((sum, row) => sum + row.score, 0);
    const careerReadiness = maximumBaselineScore
      ? Math.max(0, Math.min(100, Math.round(weightedScore / maximumBaselineScore * 100)))
      : 0;
    const marketDemandComputedAt = demandRows.reduce((latest, row) => maxDate(latest, row.computedAt), null);

    return {
      careerReadiness,
      readinessBreakdown,
      readinessModel: {
        formula: 'weighted-confidence-v1',
        maximumBaselineScore: Number(maximumBaselineScore.toFixed(4)),
        weightedScore: Number(weightedScore.toFixed(4)),
        settings: {
          confidence: settings.confidence,
          freshness: settings.freshness,
          verificationPassPercentage: settings.verificationPassPercentage,
          marketDemand: settings.marketDemand,
        },
        marketDemandComputedAt,
      },
    };
  }
}

const readinessScoreService = new ReadinessScoreService();
readinessScoreService.normalizeState = normalizeState;
readinessScoreService.freshnessFactor = freshnessFactor;

module.exports = readinessScoreService;
