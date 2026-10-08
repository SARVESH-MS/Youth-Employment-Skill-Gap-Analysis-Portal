'use strict';

/**
 * Recruitment repositories — the "recruitment" aggregate: Opportunity,
 * Application (with its contact-unlock flag), the flexible RecruitmentRound
 * sequence, and RoundResult outcomes.
 */

const BaseRepository = require('./base.repository');
const { Opportunity, Application, RecruitmentRound, RoundResult } = require('../models');
const { OPPORTUNITY_STATUS, APPLICATION_STATUS } = require('../config/constants');

class OpportunityRepository extends BaseRepository {
  constructor() {
    super(Opportunity);
  }

  /** Only OPEN opportunities are visible to candidates. */
  findOpen(filter = {}, options = {}) {
    return this.paginate({ status: OPPORTUNITY_STATUS.OPEN, ...filter }, {
      sort: { createdAt: -1 },
      populate: { path: 'company', select: 'companyName location industry website' },
      ...options,
    });
  }

  findForCompany(companyId, { status, skip = 0, limit = 20 } = {}) {
    const filter = { company: companyId };
    if (status) filter.status = status;
    return this.paginate(filter, { skip, limit, sort: { createdAt: -1 } });
  }

  findByIdForCompany(id, companyId) {
    return this.findOne({ _id: id, company: companyId });
  }

  findByIdWithCompany(id) {
    return Opportunity.findById(id).populate(
      'company',
      'companyName memberName location industry website description'
    );
  }

  /** Candidate-view version of open opportunities matching a student's domain. */
  findOpenForDomain(domainId, options = {}) {
    return this.paginate(
      { status: OPPORTUNITY_STATUS.OPEN },
      {
        sort: { createdAt: -1 },
        populate: [
          { path: 'company', select: 'companyName location industry' },
          { path: 'requiredSkills', select: 'name slug difficulty executionType' },
        ],
        ...options,
      }
    );
  }

  async setStatus(id, status, note) {
    const update = { status };
    if (status === OPPORTUNITY_STATUS.CLOSED) update.closedAt = new Date();
    if (status === OPPORTUNITY_STATUS.FILLED) update.filledAt = new Date();
    if (note !== undefined) update.statusNote = note;
    return this.updateById(id, update);
  }

  countOpen() {
    return this.count({ status: OPPORTUNITY_STATUS.OPEN });
  }

  countForCompany(companyId) {
    return this.count({ company: companyId });
  }
}

class ApplicationRepository extends BaseRepository {
  constructor() {
    super(Application);
  }

  findByOpportunityAndStudent(opportunityId, studentId) {
    return this.findOne({ opportunity: opportunityId, student: studentId });
  }

  /** Student inbox of opportunities, with company and required skills. */
  findForStudent(studentId, { status, skip = 0, limit = 20 } = {}) {
    const filter = { student: studentId };
    if (status) filter.status = status;
    return this.paginate(filter, {
      skip,
      limit,
      sort: { createdAt: -1 },
      populate: [
        { path: 'opportunity', select: 'title location compensation workMode employmentType requiredSkills status' },
        {
          path: 'opportunity',
          select: 'title location compensation workMode employmentType requiredSkills status',
          populate: { path: 'requiredSkills', select: 'name slug difficulty' },
        },
        { path: 'company', select: 'companyName location industry website' },
      ],
    });
  }

  findForCompany(companyId, { status, opportunityId, skip = 0, limit = 20 } = {}) {
    const filter = { company: companyId };
    if (status) filter.status = status;
    if (opportunityId) filter.opportunity = opportunityId;
    return this.paginate(filter, {
      skip,
      limit,
      sort: { createdAt: -1 },
      populate: [
        { path: 'student', select: 'fullName headline careerDomain email phone resume education' },
        { path: 'opportunity', select: 'title status' },
      ],
    });
  }

  findByIdForCompany(id, companyId) {
    return this.findOne({ _id: id, company: companyId }).populate(
      'student',
      'fullName headline careerDomain email phone resume education'
    );
  }

  findByIdForStudent(id, studentId) {
    return this.findOne({ _id: id, student: studentId }).populate(
      'company',
      'companyName location industry website description'
    );
  }

  /** Records a state change and appends to the audit timeline. */
  async transition(id, status, { note, actorId, extra = {} } = {}) {
    const update = {
      $set: { status, ...extra, respondedAt: new Date() },
      $push: { timeline: { status, note, actor: actorId, at: new Date() } },
    };
    return this.updateById(id, update, { runValidators: false });
  }

  async setFinalResult(id, finalResult, { note, actorId } = {}) {
    return this.updateById(
      id,
      {
        $set: {
          status:
            finalResult === 'selected' ? APPLICATION_STATUS.SELECTED : APPLICATION_STATUS.REJECTED_FINAL,
          finalResult,
          finalResultAt: new Date(),
          ...(finalResult === 'selected' ? { contactUnlocked: true } : {}),
        },
        $push: { timeline: { status: finalResult, note, actor: actorId, at: new Date() } },
      },
      { runValidators: false }
    );
  }

  async withdraw(id, studentId, note) {
    return this.updateOne(
      { _id: id, student: studentId },
      {
        $set: {
          status: APPLICATION_STATUS.WITHDRAWN,
          withdrawnAt: new Date(),
          contactUnlocked: false,
        },
        $push: { timeline: { status: APPLICATION_STATUS.WITHDRAWN, note, at: new Date() } },
      }
    );
  }

  countForCompany(companyId, status) {
    const filter = { company: companyId };
    if (status) filter.status = status;
    return this.count(filter);
  }

  countForStudent(studentId, status) {
    const filter = { student: studentId };
    if (status) filter.status = status;
    return this.count(filter);
  }

  /** Active recruitment pipelines (accepted or in-progress). */
  findActiveForStudent(studentId) {
    return Application.find({
      student: studentId,
      status: { $in: [APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.IN_PROGRESS] },
    })
      .populate('company', 'companyName location industry')
      .populate('opportunity', 'title status')
      .sort({ updatedAt: -1 });
  }

  /** Funnel counts per stage, used by company/admin analytics. */
  statusCounts(companyId) {
    const match = companyId ? { company: companyId } : {};
    return this.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  }
}

class RecruitmentRoundRepository extends BaseRepository {
  constructor() {
    super(RecruitmentRound);
  }

  findByOpportunity(opportunityId) {
    return RecruitmentRound.find({ opportunity: opportunityId }).sort({ roundNumber: 1 });
  }

  findByApplication(applicationId) {
    return RecruitmentRound.find({ application: applicationId }).sort({ roundNumber: 1 });
  }

  findOneRound(id) {
    return RecruitmentRound.findById(id)
      .populate('testSet')
      .populate('skill', 'name slug executionType')
      .populate('opportunity', 'title company')
      .populate('company', 'companyName');
  }

  async nextRoundNumber(opportunityId) {
    const [row] = await this.aggregate([
      { $match: { opportunity: opportunityId } },
      { $group: { _id: null, max: { $max: '$roundNumber' } } },
    ]);
    return (row?.max || 0) + 1;
  }

  async markCompleted(id) {
    return this.updateById(id, { status: 'completed', completedAt: new Date() });
  }

  countForCompany(companyId) {
    return this.count({ company: companyId });
  }

  /** Rounds a candidate can currently act on. */
  upcomingForStudent(studentId) {
    return RecruitmentRound.find({
      application: { $ne: null },
      status: 'scheduled',
    })
      .populate('opportunity', 'title company')
      .sort({ date: 1 });
  }
}

class RoundResultRepository extends BaseRepository {
  constructor() {
    super(RoundResult);
  }

  findByRound(roundId) {
    return RoundResult.find({ round: roundId }).populate('student', 'fullName email phone');
  }

  findByApplication(applicationId) {
    return RoundResult.find({ application: applicationId })
      .populate('round', 'roundNumber name type')
      .sort({ createdAt: 1 });
  }

  findByRoundAndStudent(roundId, studentId) {
    return this.findOne({ round: roundId, student: studentId });
  }

  upsertResult(payload) {
    const { round, student, ...rest } = payload;
    return this.upsert(
      { round, student },
      { $set: { ...rest, round, student, recordedAt: new Date() } }
    );
  }

  countForCompany(companyId) {
    return this.count({ company: companyId });
  }
}

module.exports = {
  opportunityRepository: new OpportunityRepository(),
  applicationRepository: new ApplicationRepository(),
  recruitmentRoundRepository: new RecruitmentRoundRepository(),
  roundResultRepository: new RoundResultRepository(),
};
