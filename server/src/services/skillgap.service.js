'use strict';

const {
  DomainSkill, UserSkill, LearningModule, LessonProgress, TestAttempt,
  CodingSubmission, ActivityLog, Streak, ProgressSnapshot,
} = require('../models');
const readinessScoreService = require('./readinessScore.service');

const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

const getSkillGap = async (userId, domainId, { persist = false } = {}) => {
  const requiredRows = await DomainSkill.find({ domain: domainId, required: true })
    .populate('skill', 'name slug category difficulty executionType isActive')
    .sort({ order: 1 });
  const requiredSkillIds = requiredRows.filter((row) => row.skill?.isActive).map((row) => row.skill._id);
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const userSkillsPromise = UserSkill.find({ user: userId, skill: { $in: requiredSkillIds } })
    .select('skill status readinessState progress source startedAt completedAt verifiedAt lastActivityAt')
    .lean();
  const metricsPromise = Promise.all([
    LessonProgress.countDocuments({ user: userId, skill: { $in: requiredSkillIds }, status: 'completed' }),
    LearningModule.aggregate([
      { $match: { skill: { $in: requiredSkillIds }, isPublished: true } },
      {
        $project: {
          subtopicCount: {
            $sum: {
              $map: {
                input: { $ifNull: ['$topics', []] },
                as: 'topic',
                in: { $size: { $ifNull: ['$$topic.subtopics', []] } },
              },
            },
          },
        },
      },
      { $group: { _id: null, count: { $sum: '$subtopicCount' } } },
    ]),
    TestAttempt.aggregate([
      { $match: { user: userId, skill: { $in: requiredSkillIds }, status: 'submitted', mode: 'self' } },
      { $group: { _id: null, completed: { $sum: 1 }, averageScore: { $avg: '$percentage' } } },
    ]),
    CodingSubmission.aggregate([
      { $match: { user: userId, skill: { $in: requiredSkillIds }, kind: 'submit' } },
      { $group: { _id: null, submitted: { $sum: 1 }, accepted: { $sum: { $cond: [{ $and: [{ $eq: ['$executionStatus', 'ok'] }, { $eq: ['$accepted', true] }] }, 1, 0] } } } },
    ]),
    ActivityLog.aggregate([
      { $match: { user: userId, skill: { $in: requiredSkillIds }, action: 'practice-submitted', createdAt: { $gte: since } } },
      { $group: { _id: null, submitted: { $sum: 1 }, correct: { $sum: { $cond: [{ $eq: ['$meta.correct', true] }, 1, 0] } } } },
    ]),
    ActivityLog.find({ user: userId, createdAt: { $gte: since } }).distinct('localDay'),
    Streak.findOne({ user: userId }).lean(),
  ]);

  const userSkills = await userSkillsPromise;
  const readinessPromise = readinessScoreService.calculate(userId, domainId, { requiredRows, userSkills });
  const [readiness, [lessonCount, subtopicCounts, attempts, coding, practiceEvents, activities, streak]] = await Promise.all([
    readinessPromise,
    metricsPromise,
  ]);

  const statusBySkill = new Map(userSkills.map((row) => [String(row.skill), row]));
  const skills = requiredRows.filter((row) => row.skill?.isActive).map((row) => {
    const record = statusBySkill.get(String(row.skill._id));
    return {
      skill: row.skill,
      status: record?.status || 'missing',
      progress: record?.progress || 0,
      weight: row.weight || 1,
      order: row.order,
    };
  });
  const weightTotal = skills.reduce((sum, row) => sum + row.weight, 0);
  const weightedProgress = skills.reduce((sum, row) => {
    const progress = ['known', 'completed'].includes(row.status) ? 100 : row.status === 'in-progress' ? Math.max(0, row.progress) : 0;
    return sum + progress * row.weight;
  }, 0);
  const skillCompletionPercentage = weightTotal ? Math.round(weightedProgress / weightTotal) : 0;
  const skillGapPercentage = 100 - skillCompletionPercentage;
  const counts = skills.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});

  const learningProgress = pct(lessonCount, subtopicCounts[0]?.count || 0);
  const practicePerformance = pct(practiceEvents[0]?.correct || 0, practiceEvents[0]?.submitted || 0);
  const assessmentPerformance = Math.round(attempts[0]?.averageScore || 0);
  const codingPerformance = pct(coding[0]?.accepted || 0, coding[0]?.submitted || 0);
  const consistency = pct(activities.length, 30);
  const streakScore = Math.min(100, (streak?.currentStreak || 0) * 10);
  const result = {
    domainId,
    skills,
    counts: {
      known: counts.known || 0,
      completed: counts.completed || 0,
      inProgress: counts['in-progress'] || 0,
      missing: counts.missing || 0,
      total: skills.length,
    },
    skillGapPercentage,
    skillCompletionPercentage,
    careerReadiness: readiness.careerReadiness,
    readinessBreakdown: readiness.readinessBreakdown,
    readinessModel: readiness.readinessModel,
    readinessCounts: readiness.readinessBreakdown.reduce((totals, row) => {
      totals[row.state] = (totals[row.state] || 0) + 1;
      return totals;
    }, { missing: 0, 'in-progress': 0, completed: 0, verified: 0 }),
    learningMetrics: { learningProgress, practicePerformance, codingPerformance, assessmentPerformance, consistency, streakScore },
    currentStreak: streak?.currentStreak || 0,
    longestStreak: streak?.longestStreak || 0,
  };
  if (persist) {
    await ProgressSnapshot.create({
      user: userId, domain: domainId, careerReadiness: readiness.careerReadiness, skillGapPercentage,
      skillCompletionPercentage, learningProgress, practicePerformance,
      codingPerformance, assessmentPerformance, consistency, streakScore,
      currentStreak: result.currentStreak, ...result.counts,
      reason: 'Career readiness calculated from domain importance, skill confidence, activity freshness, and current market demand; separate learning and skill-gap metrics are retained.',
    });
  }
  return result;
};

module.exports = { getSkillGap };
