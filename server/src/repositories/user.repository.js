'use strict';

/**
 * UserRepository — every query touching the User collection lives here:
 * identity lookups for auth, profile reads, and the candidate discovery
 * queries the company portal depends on.
 */

const BaseRepository = require('./base.repository');
const { User } = require('../models');
const { ROLES, COMPANY_APPROVAL_STATUS } = require('../config/constants');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /** Login lookup: match email, username or phone for a given role. */
  findByIdentifierAndRole(identifier, role) {
    return User.findByIdentifierAndRole(identifier, role);
  }

  findByIdWithPassword(id) {
    return User.findById(id).select('+passwordHash');
  }

  findByEmail(email) {
    return User.findOne({ email: String(email).toLowerCase().trim() });
  }

  findByUsername(username) {
    return User.findOne({ username: String(username).toLowerCase().trim() });
  }

  findByPhone(phone) {
    return User.findOne({ phone: String(phone).trim() });
  }

  /** Detect a collision on any of the three unique identity fields at once. */
  findIdentityConflicts({ email, username, phone }) {
    return User.findOne({
      $or: [
        email ? { email: String(email).toLowerCase().trim() } : null,
        username ? { username: String(username).toLowerCase().trim() } : null,
        phone ? { phone: String(phone).trim() } : null,
      ].filter(Boolean),
    }).select('email username phone role');
  }

  async recordLogin(id, at = new Date()) {
    return this.updateById(id, { lastLoginAt: at, lastActivityAt: at });
  }

  recordActivity(id, at = new Date()) {
    return User.updateOne({ _id: id }, { $set: { lastActivityAt: at } });
  }

  findByIdPopulatedDomain(id) {
    return User.findById(id).populate('careerDomain', 'name slug category icon accent');
  }

  countByRole(role, extraFilter = {}) {
    return this.count({ role, ...extraFilter });
  }

  countActiveByRole(role) {
    return this.count({ role, isActive: true });
  }

  findByRole(role, filter = {}, options = {}) {
    return this.paginate({ role, ...filter }, options);
  }

  /** Approved companies only — used by public directory / statistics. */
  findApprovedCompanies(filter = {}, options = {}) {
    return this.paginate(
      { role: ROLES.COMPANY, approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED, ...filter },
      options
    );
  }

  findPendingCompanies(options = {}) {
    return this.paginate(
      { role: ROLES.COMPANY, approvalStatus: COMPANY_APPROVAL_STATUS.PENDING },
      { sort: { createdAt: 1 }, ...options }
    );
  }

  /**
   * Candidate discovery. Every filter is optional and composes into one query.
   * `skillIds` requires exact coverage, so a company finds candidates who hold
   * ALL of the requested skills.
   */
  async findCandidates({
    careerDomain,
    candidateIds,
    educationContains,
    skip = 0,
    limit = 20,
    sort = { createdAt: -1 },
    requireContact = false,
  } = {}) {
    const filter = { role: ROLES.STUDENT, isActive: true };
    if (careerDomain) filter.careerDomain = careerDomain;
    if (candidateIds) filter._id = { $in: candidateIds };

    if (educationContains) {
      const escaped = String(educationContains).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [
        { 'education.undergraduate.college': pattern },
        { 'education.undergraduate.specialization': pattern },
        { 'education.undergraduate.degree': pattern },
      ];
    }

    const projection = requireContact ? undefined : '-email -phone -resume';
    return this.paginate(filter, { skip, limit, sort, projection });
  }

  /** Aggregated role counts used by admin analytics and landing statistics. */
  async roleCounts() {
    const rows = await this.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    return rows.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});
  }

  /** Students grouped by career domain — powers the analytics breakdown. */
  studentCountByDomain() {
    return this.aggregate([
      { $match: { role: ROLES.STUDENT, isActive: true, careerDomain: { $ne: null } } },
      { $group: { _id: '$careerDomain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  /** Distinct graduation years for the education filter UI. */
  distinctGraduationYears() {
    return this.distinct('education.undergraduate.graduationYear', { role: ROLES.STUDENT });
  }
}

module.exports = new UserRepository();
