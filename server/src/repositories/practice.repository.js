'use strict';

/**
 * Practice repositories — the "practice & coding" aggregate: PracticeQuestion
 * (theory + scenario practice for every skill), CodingQuestion (executable
 * problems with test cases and per-language solutions) and CodingSubmission
 * (the auditable record of every run/submit).
 */

const BaseRepository = require('./base.repository');
const { PracticeQuestion, CodingQuestion, CodingSubmission } = require('../models');

class PracticeQuestionRepository extends BaseRepository {
  constructor() {
    super(PracticeQuestion);
  }

  findBySkill(skillId, { type, difficulty, skip = 0, limit = 50 } = {}) {
    const filter = { skill: skillId, isActive: true };
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    return this.paginate(filter, { skip, limit, sort: { difficulty: 1, order: 1 } });
  }

  findByIdForSkill(id, skillId) {
    return this.findOne({ _id: id, skill: skillId, isActive: true });
  }

  /** Counts by type/difficulty used to show practice availability per skill. */
  availabilityForSkill(skillId) {
    return this.aggregate([
      { $match: { skill: skillId, isActive: true } },
      { $group: { _id: { type: '$type', difficulty: '$difficulty' }, count: { $sum: 1 } } },
    ]);
  }

  countForSkill(skillId) {
    return this.count({ skill: skillId, isActive: true });
  }
}

class CodingQuestionRepository extends BaseRepository {
  constructor() {
    super(CodingQuestion);
  }

  findByIdForSkill(id, skillId) {
    return this.findOne({ _id: id, skill: skillId, isActive: true });
  }

  findBySlugForSkill(skillId, slug) {
    return this.findOne({ skill: skillId, slug: String(slug).toLowerCase().trim(), isActive: true });
  }

  /**
   * Problem list. The heavy `solutions` payload is excluded here so the list
   * view stays light; solutions are fetched only when a learner asks for them.
   */
  listForSkill(skillId, { difficulty, topic, skip = 0, limit = 20 } = {}) {
    const filter = { skill: skillId, isActive: true };
    if (difficulty) filter.difficulty = difficulty;
    if (topic) filter.topic = topic;
    return this.paginate(filter, {
      skip,
      limit,
      sort: { difficulty: 1, order: 1 },
      projection: '-solutions -testCases',
    });
  }

  countForSkill(skillId, difficulty) {
    const filter = { skill: skillId, isActive: true };
    if (difficulty) filter.difficulty = difficulty;
    return this.count(filter);
  }

  difficultyBreakdownForSkill(skillId) {
    return this.aggregate([
      { $match: { skill: skillId, isActive: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]);
  }

  /** Only the graded (hidden) cases are needed when submitting. */
  findGradingData(codingQuestionId) {
    return this.findById(codingQuestionId, 'title testCases solutions supportedLanguages skill');
  }
}

class CodingSubmissionRepository extends BaseRepository {
  constructor() {
    super(CodingSubmission);
  }

  /** Has this student already solved this problem? */
  hasAccepted(userId, questionId) {
    return this.exists({ user: userId, question: questionId, accepted: true });
  }

  /** Distinct solved problems — the "coding problems solved" counter. */
  async solvedCount(userId) {
    const results = await this.distinct('question', { user: userId, accepted: true });
    return results.length;
  }

  /**
   * Coding performance score: acceptance rate weighted by how many distinct
   * problems were solved. Drives the career-readiness "coding" input.
   */
  async performanceForUser(userId) {
    const [row] = await this.aggregate([
      { $match: { user: userId, kind: 'submit' } },
      {
        $group: {
          _id: null,
          submissions: { $sum: 1 },
          accepted: { $sum: { $cond: ['$accepted', 1, 0] } },
          problems: { $addToSet: '$question' },
          passedTests: { $sum: '$passedTests' },
          totalTests: { $sum: '$totalTests' },
        },
      },
    ]);
    if (!row) return { submissions: 0, accepted: 0, solved: 0, acceptanceRate: 0, testPassRate: 0 };
    const acceptedProblems = await this.distinct('question', { user: userId, accepted: true });
    return {
      submissions: row.submissions,
      accepted: row.accepted,
      solved: acceptedProblems.length,
      acceptanceRate: row.submissions ? Math.round((row.accepted / row.submissions) * 100) : 0,
      testPassRate: row.totalTests ? Math.round((row.passedTests / row.totalTests) * 100) : 0,
    };
  }

  recentForUser(userId, limit = 10) {
    return CodingSubmission.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('question', 'title difficulty topic')
      .populate('skill', 'name slug');
  }

  findByUserAndQuestion(userId, questionId, limit = 10) {
    return CodingSubmission.find({ user: userId, question: questionId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-outcomes');
  }

  /** Solved problems grouped by difficulty — the coding dashboard breakdown. */
  solvedByDifficulty(userId) {
    return this.aggregate([
      { $match: { user: userId, accepted: true } },
      { $group: { _id: '$question', skill: { $first: '$skill' } } },
      {
        $lookup: {
          from: 'codingquestions',
          localField: '_id',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      { $group: { _id: '$question.difficulty', count: { $sum: 1 } } },
    ]);
  }

  countSubmissionsForQuestion(questionId) {
    return this.count({ question: questionId, kind: 'submit' });
  }
}

module.exports = {
  practiceQuestionRepository: new PracticeQuestionRepository(),
  codingQuestionRepository: new CodingQuestionRepository(),
  codingSubmissionRepository: new CodingSubmissionRepository(),
};
