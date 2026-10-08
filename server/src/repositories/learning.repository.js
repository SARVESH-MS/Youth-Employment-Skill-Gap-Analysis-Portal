'use strict';

/**
 * Learning repositories — grouped by bounded context (the "learning" aggregate):
 * LearningModule (book-depth content), LessonProgress (engagement) and
 * Annotation (bookmarks + notes). Grouping related entities in one data-access
 * module keeps the learning queries in one auditable place.
 */

const BaseRepository = require('./base.repository');
const { LearningModule, LessonProgress, Annotation } = require('../models');

class LearningModuleRepository extends BaseRepository {
  constructor() {
    super(LearningModule);
  }

  findBySlug(skillId, slug) {
    return LearningModule.findOne({ skill: skillId, slug: String(slug).toLowerCase().trim() });
  }

  /** Table of contents for a skill: modules ordered, topics/subtopics trimmed. */
  findOutlineForSkill(skillId) {
    return LearningModule.find(
      { skill: skillId, isPublished: true },
      'title slug description level order estimatedMinutes objectives topics.title topics.order topics._id'
    ).sort({ order: 1 });
  }

  /** Full content of a single module (used by the reading view). */
  findFullModule(moduleId) {
    return LearningModule.findById(moduleId).populate('skill', 'name slug executionType category');
  }

  findFullSkillContent(skillId) {
    return LearningModule.find({ skill: skillId, isPublished: true }).sort({ order: 1 });
  }

  countModulesForSkill(skillId) {
    return this.count({ skill: skillId, isPublished: true });
  }

  /** Total subtopics across a skill's modules — drives learning progress. */
  async countSubtopicsForSkill(skillId) {
    const [row] = await this.aggregate([
      { $match: { skill: skillId, isPublished: true } },
      { $unwind: '$topics' },
      { $unwind: '$topics.subtopics' },
      { $count: 'subtopics' },
    ]);
    return row?.subtopics || 0;
  }

  countPublished() {
    return this.count({ isPublished: true });
  }
}

class LessonProgressRepository extends BaseRepository {
  constructor() {
    super(LessonProgress);
  }

  findByUserAndSubtopic(userId, subtopicId) {
    return LessonProgress.findOne({ user: userId, subtopicId });
  }

  findByUserAndSkill(userId, skillId) {
    return LessonProgress.find({ user: userId, skill: skillId }).lean();
  }

  /** Upsert used when a learner views a subtopic and accrues time on page. */
  recordView(userId, { skill, module, topicId, subtopicId, timeSpentSec = 0 }) {
    const update = {
      $set: { skill, module, topicId, lastViewedAt: new Date() },
      $setOnInsert: { status: 'in-progress' },
    };
    // `$inc` must be a sibling of `$set`, never nested inside it.
    if (timeSpentSec > 0) update.$inc = { timeSpentSec };
    return this.upsert({ user: userId, subtopicId }, update);
  }

  /** Accrue genuine reading time without needing the full document. */
  addTime(userId, subtopicId, seconds) {
    return this.updateOne(
      { user: userId, subtopicId },
      { $inc: { timeSpentSec: seconds }, $set: { lastViewedAt: new Date() } }
    );
  }

  /** Complete a subtopic only after the engagement gate is satisfied. */
  markCompleted(userId, subtopicId, { quizPassed = false, quizScore = 0 } = {}) {
    return this.updateOne(
      { user: userId, subtopicId },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          ...(quizPassed ? { quizPassed: true, quizScore } : {}),
        },
      }
    );
  }

  recordQuizAttempt(userId, subtopicId, { passed, score }) {
    return this.updateOne(
      { user: userId, subtopicId },
      {
        $inc: { quizAttempts: 1 },
        $set: { quizPassed: passed, quizScore: score, lastViewedAt: new Date() },
      }
    );
  }

  /** Completed subtopic ids for a skill — the progress bar source of truth. */
  completedSubtopicIds(userId, skillId) {
    return this.distinct('subtopicId', { user: userId, skill: skillId, status: 'completed' });
  }

  countCompletedForSkill(userId, skillId) {
    return this.count({ user: userId, skill: skillId, status: 'completed' });
  }

  countStartedForSkill(userId, skillId) {
    return this.count({ user: userId, skill: skillId, status: { $in: ['in-progress', 'completed'] } });
  }

  /** Total minutes a student has genuinely spent learning. */
  async totalLearningMinutes(userId) {
    const [row] = await this.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, seconds: { $sum: '$timeSpentSec' } } },
    ]);
    return Math.round((row?.seconds || 0) / 60);
  }
}

class AnnotationRepository extends BaseRepository {
  constructor() {
    super(Annotation);
  }

  findBookmarks(userId, { skip = 0, limit = 50 } = {}) {
    return Annotation.find({ user: userId, type: 'bookmark' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('skill', 'name slug category difficulty')
      .populate('module', 'title');
  }

  findNotes(userId, { skip = 0, limit = 50 } = {}) {
    return Annotation.find({ user: userId, type: 'note' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('skill', 'name slug category difficulty')
      .populate('module', 'title');
  }

  findForSubtopic(userId, subtopicId) {
    return Annotation.find({ user: userId, subtopicId }).sort({ createdAt: -1 });
  }

  async toggleBookmark(userId, payload) {
    const existing = await this.findOne({
      user: userId,
      type: 'bookmark',
      subtopicId: payload.subtopicId || null,
      skill: payload.skill,
    });
    if (existing) {
      await this.deleteById(existing._id);
      return { bookmarked: false, annotation: null };
    }
    const annotation = await this.create({ ...payload, user: userId, type: 'bookmark' });
    return { bookmarked: true, annotation };
  }

  countForUser(userId, type) {
    return this.count({ user: userId, type });
  }
}

module.exports = {
  learningModuleRepository: new LearningModuleRepository(),
  lessonProgressRepository: new LessonProgressRepository(),
  annotationRepository: new AnnotationRepository(),
};
