'use strict';

const { ActivityLog, Streak } = require('../models');
const readinessScoreService = require('./readinessScore.service');
const { localDay } = require('../utils/timezone');

const recordActivity = async (user, action, { entityType, entityId, skill, weight = 1, meta = {} } = {}) => {
  const timezone = user.timezone || 'Asia/Kolkata';
  const day = localDay(new Date(), timezone);
  await ActivityLog.create({ user: user._id, role: user.role, action, entityType, entityId, skill, localDay: day, weight, meta });
  if (user.role === 'student' && skill && ['lesson-completed', 'practice-submitted', 'coding-submitted', 'test-completed'].includes(action)) {
    await readinessScoreService.recordSkillEngagement(user._id, skill);
  }
  if (user.role !== 'student' || !['lesson-completed', 'practice-submitted', 'coding-submitted', 'test-completed'].includes(action)) return;

  let streak = await Streak.findOne({ user: user._id });
  if (!streak) streak = new Streak({ user: user._id, timezone });
  const previous = streak.lastActivityDay;
  const { addDays } = require('../utils/timezone');
  const previousDay = addDays(day, -1);
  if (previous !== day) {
    streak.currentStreak = previous === previousDay ? streak.currentStreak + 1 : 1;
    streak.lastActivityDay = day;
    streak.totalActiveDays += 1;
  }
  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
  if (!streak.activityDates.includes(day)) streak.activityDates.push(day);
  streak.activityDates = streak.activityDates.slice(-365);
  const activity = streak.dailyActivity.find((item) => item.day === day) || { day, learn: 0, practice: 0, test: 0 };
  const category = action.includes('lesson') ? 'learn' : action.includes('test') || action.includes('coding') ? 'test' : 'practice';
  activity[category] += weight;
  if (!streak.dailyActivity.some((item) => item.day === day)) streak.dailyActivity.push(activity);
  streak.dailyActivity = streak.dailyActivity.slice(-365);
  await streak.save();
};

module.exports = { recordActivity };
