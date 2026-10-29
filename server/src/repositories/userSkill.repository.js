'use strict';

/**
 * UserSkillRepository — the student's skill state (known / in-progress /
 * completed / missing) against the central catalogue. The skill-gap engine and
 * career-readiness maths read exclusively from here.
 */

const BaseRepository = require('./base.repository');
const { UserSkill } = require('../models');
const { SKILL_STATUS } = require('../config/constants');

class UserSkillRepository extends BaseRepository {
  constructor() {
    super(UserSkill);
  }

  findByUserAndSkill(userId, skillId) {
    return UserSkill.findOne({ user: userId, skill: skillId });
  }

  /** All skill rows for a student with the skill document hydrated. */
  findByUser(userId, filter = {}) {
    return UserSkill.find({ user: userId, ...filter }).populate(
      'skill',
      'name slug category difficulty executionType supportedLanguages shortDescription'
    );
  }

  /** Compact status map keyed by skill id — used by the gap engine. */
  async statusMapForUser(userId) {
    const rows = await UserSkill.find({ user: userId }, 'skill status progress completedAt').lean();
    return rows.reduce((map, row) => {
      map[String(row.skill)] = {
        status: row.status,
        progress: row.progress,
        completedAt: row.completedAt,
      };
      return map;
    }, {});
  }

  /** Bulk upsert used when a student edits known skills or switches domain. */
  async setStatus(userId, skillId, status, extra = {}) {
    const update = {
      $set: {
        status,
        readinessState: status === SKILL_STATUS.COMPLETED ? 'completed' : status === SKILL_STATUS.MISSING ? 'missing' : 'in-progress',
        ...extra,
        lastActivityAt: new Date(),
      },
    };
    if (status === SKILL_STATUS.IN_PROGRESS) update.$setOnInsert = { startedAt: new Date() };
    if (status === SKILL_STATUS.COMPLETED) update.$set.completedAt = new Date();
    return this.upsert({ user: userId, skill: skillId }, update);
  }

  async removeSkill(userId, skillId) {
    return this.deleteOne({ user: userId, skill: skillId });
  }

  async setManyStatuses(userId, skillIds, status, source = 'manual') {
    if (!skillIds.length) return { modifiedCount: 0 };
    return this.updateMany(
      { user: userId, skill: skillIds },
      { $set: { status, readinessState: status === SKILL_STATUS.COMPLETED ? 'completed' : status === SKILL_STATUS.MISSING ? 'missing' : 'in-progress', source, lastActivityAt: new Date() } },
      { upsert: false }
    );
  }

  async bulkUpsert(userId, entries = []) {
    if (!entries.length) return { matchedCount: 0, modifiedCount: 0 };
    const operations = entries.map((entry) => ({
      updateOne: {
        filter: { user: userId, skill: entry.skill },
        update: {
          $set: {
            status: entry.status,
            readinessState: entry.status === SKILL_STATUS.COMPLETED ? 'completed' : entry.status === SKILL_STATUS.MISSING ? 'missing' : 'in-progress',
            source: entry.source || 'manual',
            progress: entry.progress ?? 0,
            ...(entry.status === SKILL_STATUS.COMPLETED ? { completedAt: new Date() } : {}),
          },
        },
        upsert: true,
      },
    }));
    return UserSkill.bulkWrite(operations, { ordered: false });
  }

  /** Counts per status for one student (dashboard tiles). */
  async countByStatus(userId) {
    const rows = await this.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const base = {
      [SKILL_STATUS.KNOWN]: 0,
      [SKILL_STATUS.IN_PROGRESS]: 0,
      [SKILL_STATUS.COMPLETED]: 0,
      [SKILL_STATUS.MISSING]: 0,
    };
    return rows.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), base);
  }

  /** Average progress across a student's in-progress skills. */
  async averageProgress(userId) {
    const [row] = await this.aggregate([
      { $match: { user: userId, status: { $ne: SKILL_STATUS.MISSING } } },
      { $group: { _id: null, avg: { $avg: '$progress' } } },
    ]);
    return row ? Math.round(row.avg) : 0;
  }

  /** Student ids who hold ALL of the given skills (company candidate filter). */
  findUserIdsWithAllSkills(skillIds = []) {
    if (!skillIds.length) return Promise.resolve([]);
    return this.aggregate([
      {
        $match: {
          skill: { $in: skillIds },
          status: { $in: [SKILL_STATUS.KNOWN, SKILL_STATUS.COMPLETED] },
        },
      },
      { $group: { _id: '$user', skills: { $addToSet: '$skill' } } },
      { $match: { $expr: { $eq: [{ $size: '$skills' }, skillIds.length] } } },
      { $project: { _id: 1 } },
    ]).then((rows) => rows.map((row) => row._id));
  }

  /** Per-skill holder counts — used to rank the most in-demand skills. */
  popularityBySkill(limit = 10) {
    return this.aggregate([
      { $match: { status: { $in: [SKILL_STATUS.KNOWN, SKILL_STATUS.COMPLETED] } } },
      { $group: { _id: '$skill', holders: { $sum: 1 } } },
      { $sort: { holders: -1 } },
      { $limit: limit },
    ]);
  }
}

module.exports = new UserSkillRepository();
