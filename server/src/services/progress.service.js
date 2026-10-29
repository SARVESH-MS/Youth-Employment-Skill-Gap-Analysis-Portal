'use strict';

const { LearningModule, LessonProgress, UserSkill } = require('../models');

const updateSkillProgress = async (userId, skillId) => {
  const modules = await LearningModule.find({ skill: skillId, isPublished: true }).select('topics');
  const total = modules.reduce((count, module) => count + (module.topics || []).reduce((sum, topic) => sum + (topic.subtopics || []).length, 0), 0);
  const completed = await LessonProgress.countDocuments({ user: userId, skill: skillId, status: 'completed' });
  const progress = total ? Math.min(100, Math.round(completed / total * 100)) : 0;
  const existing = await UserSkill.findOne({ user: userId, skill: skillId }).select('readinessState');
  const status = progress === 100 ? 'completed' : 'in-progress';
  const readinessState = existing?.readinessState === 'verified' ? 'verified' : status;
  return UserSkill.findOneAndUpdate(
    { user: userId, skill: skillId },
    { $set: { status, readinessState, progress, source: 'activity', lastActivityAt: new Date(), ...(status === 'completed' ? { completedAt: new Date() } : {}) } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
};

module.exports = { updateSkillProgress };
