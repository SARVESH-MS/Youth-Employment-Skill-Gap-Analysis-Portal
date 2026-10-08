'use strict';

/**
 * DomainSkillRepository — the many-to-many join between domains and the
 * central skill catalogue. These rows ARE the "required skills" a domain
 * demands, so the skill-gap engine reads them here.
 */

const BaseRepository = require('./base.repository');
const { DomainSkill } = require('../models');

class DomainSkillRepository extends BaseRepository {
  constructor() {
    super(DomainSkill);
  }

  /** Required + optional links for a domain, ordered by recommended sequence. */
  findByDomain(domainId) {
    return DomainSkill.find({ domain: domainId })
      .sort({ order: 1 })
      .populate('skill', 'name slug category difficulty executionType supportedLanguages prerequisites');
  }

  /** Required skills only — the exact list the gap engine compares against. */
  findRequiredByDomain(domainId) {
    return DomainSkill.find({ domain: domainId, required: true })
      .sort({ order: 1 })
      .populate('skill', 'name slug category difficulty executionType supportedLanguages prerequisites');
  }

  findBySkill(skillId) {
    return DomainSkill.find({ skill: skillId }).populate('domain', 'name slug category icon accent');
  }

  /** Used when a student switches career domain: recalculate against these. */
  skillIdsForDomain(domainId) {
    return this.distinct('skill', { domain: domainId, required: true });
  }

  countByDomain(domainId) {
    return this.count({ domain: domainId });
  }

  /** Bulk replace of a domain's skill links (admin domain editor). */
  async replaceForDomain(domainId, links = []) {
    await this.deleteMany({ domain: domainId });
    if (!links.length) return [];
    return this.createMany(
      links.map((link, index) => ({
        domain: domainId,
        skill: link.skill,
        required: link.required !== false,
        weight: link.weight ?? 1,
        order: link.order ?? index,
        note: link.note,
      }))
    );
  }

  /** Skill counts per domain in one round trip (analytics + domain cards). */
  countGroupedByDomain() {
    return this.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } },
    ]);
  }

  /** Domains a skill belongs to, by skill slug (skill page "related domains"). */
  async domainsForSkill(skillId) {
    const rows = await this.aggregate([
      { $match: { skill: skillId } },
      { $lookup: { from: 'domains', localField: 'domain', foreignField: '_id', as: 'domain' } },
      { $unwind: '$domain' },
      { $project: { name: '$domain.name', slug: '$domain.slug', icon: '$domain.icon', accent: '$domain.accent', required: 1 } },
      { $sort: { name: 1 } },
    ]);
    return rows;
  }
}

module.exports = new DomainSkillRepository();
