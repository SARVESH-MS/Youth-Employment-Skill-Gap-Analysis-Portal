'use strict';

/**
 * SkillRepository — queries over the CENTRAL skill catalogue, the single
 * shared source of truth for the skill-gap engine, all-skills browsing,
 * practice, assessments and company required-skill selection.
 */

const BaseRepository = require('./base.repository');
const { Skill } = require('../models');

class SkillRepository extends BaseRepository {
  constructor() {
    super(Skill);
  }

  findBySlug(slug) {
    return Skill.findOne({ slug: String(slug).toLowerCase().trim() });
  }

  /** Full skill page payload: about panel, prerequisites and related skills. */
  findBySlugWithRelations(slug) {
    return Skill.findOne({ slug: String(slug).toLowerCase().trim() })
      .populate('prerequisites', 'name slug difficulty executionType category')
      .populate('relatedSkills', 'name slug difficulty executionType category');
  }

  findByIds(ids, projection) {
    return Skill.find({ _id: { $in: ids } }, projection);
  }

  /** Lightweight map used when hydrating skill references in bulk. */
  findByIdsMapped(ids, projection = 'name slug category difficulty executionType') {
    return Skill.find({ _id: { $in: ids } }, projection).lean();
  }

  /**
   * All-skills catalogue search with the filters the UI exposes: text, domain,
   * category, difficulty and execution capability.
   */
  searchSkills({
    search,
    categories = [],
    difficulties = [],
    executionTypes = [],
    skillIds,
    skip = 0,
    limit = 20,
    sort = { name: 1 },
  } = {}) {
    const filter = { isActive: true };
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { shortDescription: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (categories.length) filter.category = { $in: categories };
    if (difficulties.length) filter.difficulty = { $in: difficulties };
    if (executionTypes.length) filter.executionType = { $in: executionTypes };
    if (skillIds) filter._id = { $in: skillIds };
    return this.paginate(filter, { skip, limit, sort });
  }

  /** Skills linked to a domain via the DomainSkill join (used by the gap engine). */
  findForDomain(domainId) {
    return this.aggregate([
      {
        $lookup: {
          from: 'domainskills',
          let: { skillId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$skill', '$$skillId'] }, { $eq: ['$domain', domainId] }] } } },
            { $project: { required: 1, weight: 1, order: 1, note: 1 } },
          ],
          as: 'link',
        },
      },
      { $match: { 'link.0': { $exists: true } } },
      {
        $addFields: {
          domainLink: { $first: '$link' },
        },
      },
      { $project: { link: 0 } },
      { $sort: { 'domainLink.order': 1, name: 1 } },
    ]);
  }

  /** Skills belonging to any of several domains (all-skills, multi-domain view). */
  findForDomains(domainIds) {
    return this.aggregate([
      {
        $lookup: {
          from: 'domainskills',
          let: { skillId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$skill', '$$skillId'] }, { $in: ['$domain', domainIds] }] } } },
            { $project: { domain: 1 } },
          ],
          as: 'links',
        },
      },
      { $match: { 'links.0': { $exists: true } } },
      { $project: { links: 0 } },
      { $sort: { name: 1 } },
    ]);
  }

  /** Execution-capable skills only (a compiler/runtime/preview applies). */
  findExecutable() {
    return Skill.find({ isActive: true, executionType: { $ne: 'none' } }).sort({ name: 1 });
  }

  distinctCategories() {
    return this.distinct('category', { isActive: true });
  }

  distinctDifficulties() {
    return this.distinct('difficulty', { isActive: true });
  }

  countActive() {
    return this.count({ isActive: true });
  }

  /** Resolve skills by a list of slugs (company required-skill selection). */
  findBySlugs(slugs = []) {
    const normalised = [...new Set(slugs.map((s) => String(s).toLowerCase().trim()).filter(Boolean))];
    if (!normalised.length) return Promise.resolve([]);
    return Skill.find({ slug: { $in: normalised }, isActive: true });
  }

  /** Dependencies used to order the learning roadmap. */
  findPrerequisiteGraph(skillIds) {
    return Skill.find({ _id: { $in: skillIds } }, 'name slug difficulty prerequisites order').lean();
  }
}

module.exports = new SkillRepository();
