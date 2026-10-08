'use strict';

const {
  DomainSkill, UserSkill, LearningModule, LessonProgress, TestAttempt,
  CodingSubmission, ActivityLog, Streak, ProgressSnapshot,
} = require('../models');
const { CAREER_READINESS_WEIGHTS } = require('../config/constants');

const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const getSkillGap = async (userId, domainId, { persist = false } = {}) => {
  const [requiredRows, userSkills] = await Promise.all([
    DomainSkill.find({ domain: domainId, required: true }).populate('skill').sort({ order: 1 }),
    UserSkill.find({ user: userId }).lean(),
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
  const mastered = skills.reduce((sum, row) => sum + (['known', 'completed'].includes(row.status) ? row.weight : 0), 0);
  const weightedProgress = skills.reduce((sum, row) => {
    const progress = ['known', 'completed'].includes(row.status) ? 100 : row.status === 'in-progress' ? Math.max(0, row.progress) : 0;
    return sum + progress * row.weight;
  }, 0);
  const skillCompletionPercentage = weightTotal ? Math.round(weightedProgress / weightTotal) : 0;
  const skillGapPercentage = 100 - skillCompletionPercentage;
  const counts = skills.reduce((result, row) => ({ ...result, [row.status]: (result[row.status] || 0) + 1 }), {});

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const requiredSkillIds = requiredRows.filter((row) => row.required && row.skill?.isActive).map((row) => row.skill._id);
  const [lessons, totalLessons, attempts, coding, practiceEvents, activities, streak] = await Promise.all([
    LessonProgress.find({ user: userId, skill: { $in: requiredSkillIds }, status: 'completed' }).select('_id'),
    LearningModule.find({ skill: { $in: requiredSkillIds }, isPublished: true }).select('topics'),
    TestAttempt.find({ user: userId, status: 'submitted', mode: 'self' }).select('percentage'),
    CodingSubmission.find({ user: userId, kind: 'submit' }).select('executionStatus accepted'),
    ActivityLog.find({ user: userId, action: 'practice-submitted', createdAt: { $gte: since } }).select('meta'),
    ActivityLog.find({ user: userId, createdAt: { $gte: since } }).distinct('localDay'),
    Streak.findOne({ user: userId }),
  ]);
  const subtopicCount = totalLessons.reduce((count, module) => count + (module.topics || []).reduce((sum, topic) => sum + (topic.subtopics || []).length, 0), 0);
  const learningProgress = pct(lessons.length, subtopicCount);
  const practicePerformance = pct(practiceEvents.filter((row) => row.meta?.correct === true).length, practiceEvents.length);
  const assessmentPerformance = Math.round(average(attempts.map((item) => item.percentage || 0)));
  const codingPerformance = pct(coding.filter((item) => item.executionStatus === 'ok' && item.accepted).length, coding.length);
  const consistency = pct(activities.length, 30);
  const streakScore = Math.min(100, (streak?.currentStreak || 0) * 10);
  const readiness = Math.round(
    skillCompletionPercentage * CAREER_READINESS_WEIGHTS.skillCompletion +
    learningProgress * CAREER_READINESS_WEIGHTS.learningProgress +
    practicePerformance * CAREER_READINESS_WEIGHTS.practicePerformance +
    codingPerformance * CAREER_READINESS_WEIGHTS.codingPerformance +
    assessmentPerformance * CAREER_READINESS_WEIGHTS.assessmentPerformance +
    consistency * CAREER_READINESS_WEIGHTS.consistency +
    streakScore * CAREER_READINESS_WEIGHTS.streak
  );
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
    careerReadiness: readiness,
    readinessInputs: { learningProgress, practicePerformance, codingPerformance, assessmentPerformance, consistency, streakScore },
    readinessWeights: CAREER_READINESS_WEIGHTS,
    currentStreak: streak?.currentStreak || 0,
    longestStreak: streak?.longestStreak || 0,
  };
  if (persist) {
    await ProgressSnapshot.create({
      user: userId, domain: domainId, careerReadiness: readiness, skillGapPercentage,
      skillCompletionPercentage, learningProgress, practicePerformance,
      codingPerformance, assessmentPerformance, consistency, streakScore,
      currentStreak: result.currentStreak, ...result.counts,
      reason: 'Calculated from skill status, learning, assessment, coding and recent activity.',
    });
  }
  return result;
};

module.exports = { getSkillGap };
