'use strict';

/**
 * Assessment repositories — the "assessment" aggregate shared by self-service
 * tests AND company recruitment rounds: QuestionBankItem (the one MCQ pool),
 * TestSet (numbered sets of 10) and TestAttempt (the immutable attempt record).
 */

const BaseRepository = require('./base.repository');
const { QuestionBankItem, TestSet, TestAttempt } = require('../models');
const { ATTEMPT_STATUS } = require('../config/constants');

class QuestionBankItemRepository extends BaseRepository {
  constructor() {
    super(QuestionBankItem);
  }

  /** Bank items visible to a company: platform-wide OR authored by that company. */
  visibleTo(companyId, filter = {}) {
    return {
      $and: [
        { isActive: true },
        { $or: [{ visibility: 'platform' }, { visibility: 'company', owner: companyId }] },
        filter,
      ],
    };
  }

  search({ skillId, difficulty, topic, companyId, skip = 0, limit = 20 } = {}) {
    const filter = {};
    if (skillId) filter.skill = skillId;
    if (difficulty) filter.difficulty = difficulty;
    if (topic) filter.topic = topic;

    const finalFilter = companyId ? this.visibleTo(companyId, filter) : { isActive: true, ...filter };
    return this.paginate(finalFilter, { skip, limit, sort: { createdAt: -1 } });
  }

  findByIds(ids, projection) {
    return QuestionBankItem.find({ _id: { $in: ids } }, projection);
  }

  /** Pool size check before creating a set — guides graceful degradation. */
  countPool({ skillId, difficulty, companyId }) {
    const filter = { skill: skillId, difficulty };
    const finalFilter = companyId ? this.visibleTo(companyId, filter) : { isActive: true, ...filter };
    return this.count(finalFilter);
  }

  topicBreakdown({ skillId, difficulty }) {
    return this.aggregate([
      { $match: { skill: skillId, difficulty, isActive: true } },
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  /** Random pool used when assembling a set, optionally excluding seen ids. */
  async randomSelection({ skillId, difficulty, size, excludeIds = [], companyId }) {
    const filter = { skill: skillId, difficulty };
    const visible = companyId ? this.visibleTo(companyId, filter) : { isActive: true, ...filter };
    const ids = excludeIds.map((id) => id.toString());

    const pipeline = [{ $match: visible }];
    if (ids.length) {
      pipeline.push({
        $addFields: {
          alreadySeen: { $in: [{ $toString: '$_id' }, ids] },
        },
      });
      // Unseen questions first, then a random tiebreak.
      pipeline.push({ $sort: { alreadySeen: 1 } });
    }
    pipeline.push({ $sample: { size: Math.max(1, size) } });
    return this.aggregate(pipeline);
  }

  countAll() {
    return this.count({ isActive: true });
  }

  countBySkillAndDifficulty() {
    return this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { skill: '$skill', difficulty: '$difficulty' }, count: { $sum: 1 } } },
    ]);
  }
}

class TestSetRepository extends BaseRepository {
  constructor() {
    super(TestSet);
  }

  findBySkillAndDifficulty(skillId, difficulty) {
    return TestSet.find({ skill: skillId, difficulty, isActive: true }).sort({ setNumber: 1 });
  }

  findSet(skillId, difficulty, setNumber) {
    return TestSet.findOne({ skill: skillId, difficulty, setNumber, isActive: true }).populate(
      'questions'
    );
  }

  /** Set counts per difficulty — drives the "3 of 10 sets" progress display. */
  async setCountsForSkill(skillId) {
    const rows = await this.aggregate([
      { $match: { skill: skillId, isActive: true } },
      { $group: { _id: '$difficulty', sets: { $sum: 1 } } },
    ]);
    return rows.reduce((acc, row) => ({ ...acc, [row._id]: row.sets }), {});
  }

  countSets(skillId, difficulty) {
    return this.count({ skill: skillId, difficulty, isActive: true });
  }

  async nextSetNumber(skillId, difficulty) {
    const [row] = await this.aggregate([
      { $match: { skill: skillId, difficulty } },
      { $group: { _id: null, max: { $max: '$setNumber' } } },
    ]);
    return (row?.max || 0) + 1;
  }

  async replaceSet(skillId, difficulty, setNumber, questionIds, durationMinutes = 15) {
    return this.upsert(
      { skill: skillId, difficulty, setNumber },
      {
        $set: {
          questions: questionIds,
          questionCount: questionIds.length,
          durationMinutes,
          isActive: true,
          generatedAt: new Date(),
        },
      }
    );
  }

  countAll() {
    return this.count({ isActive: true });
  }
}

class TestAttemptRepository extends BaseRepository {
  constructor() {
    super(TestAttempt);
  }

  findInProgress(userId, skillId) {
    return TestAttempt.findOne({
      user: userId,
      skill: skillId,
      status: ATTEMPT_STATUS.IN_PROGRESS,
    });
  }

  /** Completed sets for a skill — decides which set to offer next. */
  completedSetNumbers(userId, skillId, difficulty) {
    return this.distinct('setNumber', {
      user: userId,
      skill: skillId,
      difficulty,
      status: ATTEMPT_STATUS.SUBMITTED,
    });
  }

  /** Question ids the user has already encountered (prioritise unseen). */
  seenQuestionIds(userId, skillId) {
    return this.distinct('answers.question', { user: userId, skill: skillId });
  }

  historyForUser(userId, { skillId, skip = 0, limit = 20 } = {}) {
    const filter = { user: userId, status: ATTEMPT_STATUS.SUBMITTED };
    if (skillId) filter.skill = skillId;
    return this.paginate(filter, {
      skip,
      limit,
      sort: { submittedAt: -1 },
      populate: [
        { path: 'skill', select: 'name slug category' },
        { path: 'testSet', select: 'setNumber title' },
      ],
    });
  }

  findFullAttempt(attemptId, userId) {
    return this.findOne({ _id: attemptId, user: userId }).populate('skill', 'name slug');
  }

  /** Assessment performance score for career readiness. */
  async performanceForUser(userId) {
    const [row] = await this.aggregate([
      { $match: { user: userId, status: ATTEMPT_STATUS.SUBMITTED, mode: 'self' } },
      {
        $group: {
          _id: null,
          attempts: { $sum: 1 },
          averagePercentage: { $avg: '$percentage' },
          bestPercentage: { $max: '$percentage' },
          totalCorrect: { $sum: '$correct' },
          totalQuestions: { $sum: '$totalQuestions' },
          tabSwitches: { $sum: '$tabSwitchCount' },
        },
      },
    ]);
    if (!row) {
      return { attempts: 0, averagePercentage: 0, bestPercentage: 0, accuracy: 0, tabSwitches: 0 };
    }
    return {
      attempts: row.attempts,
      averagePercentage: Math.round(row.averagePercentage || 0),
      bestPercentage: Math.round(row.bestPercentage || 0),
      accuracy: row.totalQuestions ? Math.round((row.totalCorrect / row.totalQuestions) * 100) : 0,
      tabSwitches: row.tabSwitches,
    };
  }

  /** Weak topics across all recent attempts — feeds recommended learning. */
  weakTopicsForUser(userId, { limit = 8 } = {}) {
    return this.aggregate([
      { $match: { user: userId, status: ATTEMPT_STATUS.SUBMITTED } },
      { $unwind: '$topicBreakdown' },
      { $match: { 'topicBreakdown.total': { $gt: 0 } } },
      {
        $group: {
          _id: '$topicBreakdown.topic',
          correct: { $sum: '$topicBreakdown.correct' },
          total: { $sum: '$topicBreakdown.total' },
        },
      },
      {
        $addFields: {
          percentage: {
            $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$correct', '$total'] }, 100] }, 0],
          },
        },
      },
      { $match: { percentage: { $lt: 70 } } },
      { $sort: { percentage: 1, total: -1 } },
      { $limit: limit },
    ]);
  }

  /** Recent score trend for the results chart. */
  scoreTrend(userId, limit = 10) {
    return this.aggregate([
      { $match: { user: userId, status: ATTEMPT_STATUS.SUBMITTED } },
      { $sort: { submittedAt: -1 } },
      { $limit: limit },
      {
        $project: {
          percentage: 1,
          difficulty: 1,
          submittedAt: 1,
          skill: 1,
        },
      },
    ]);
  }

  countCompletedForUser(userId) {
    return this.count({ user: userId, status: ATTEMPT_STATUS.SUBMITTED, mode: 'self' });
  }

  countAllCompleted() {
    return this.count({ status: ATTEMPT_STATUS.SUBMITTED });
  }

  /** Platform-wide average score used by the landing statistics. */
  async platformAverageScore() {
    const [row] = await this.aggregate([
      { $match: { status: ATTEMPT_STATUS.SUBMITTED } },
      { $group: { _id: null, avg: { $avg: '$percentage' } } },
    ]);
    return Math.round(row?.avg || 0);
  }

  attemptsForRound(roundId) {
    return TestAttempt.find({ round: roundId, status: ATTEMPT_STATUS.SUBMITTED })
      .populate('user', 'fullName email phone')
      .sort({ percentage: -1 });
  }
}

module.exports = {
  questionBankItemRepository: new QuestionBankItemRepository(),
  testSetRepository: new TestSetRepository(),
  testAttemptRepository: new TestAttemptRepository(),
};
