'use strict';

/**
 * DomainRepository — queries for the dynamic, database-driven career-domain
 * catalogue (frontend, backend, cloud, AI, …). Domains are categories, never
 * system roles.
 */

const BaseRepository = require('./base.repository');
const { Domain } = require('../models');

class DomainRepository extends BaseRepository {
  constructor() {
    super(Domain);
  }

  findBySlug(slug) {
    return Domain.findOne({ slug: String(slug).toLowerCase().trim() });
  }

  findActive(filter = {}, options = {}) {
    return this.paginate({ isActive: true, ...filter }, { sort: { order: 1, name: 1 }, ...options });
  }

  findFeatured(limit = 8) {
    return Domain.find({ isActive: true, isFeatured: true }).sort({ order: 1 }).limit(limit);
  }

  findAllActiveOrdered() {
    return Domain.find({ isActive: true }).sort({ order: 1, name: 1 });
  }

  /** Lightweight list for select inputs and filter menus. */
  listForSelect() {
    return Domain.find({ isActive: true }, 'name slug category icon accent order').sort({
      order: 1,
      name: 1,
    });
  }

  /**
   * Domain cards with a live skill count, so the landing page and domain grid
   * show real numbers rather than hardcoded values.
   */
  async listWithSkillCounts() {
    return this.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'domainskills',
          let: { domainId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$domain', '$$domainId'] } } },
            { $count: 'count' },
          ],
          as: 'skillAgg',
        },
      },
      {
        $addFields: {
          skillCount: { $ifNull: [{ $first: '$skillAgg.count' }, 0] },
        },
      },
      { $project: { skillAgg: 0 } },
      { $sort: { order: 1, name: 1 } },
    ]);
  }

  countActive() {
    return this.count({ isActive: true });
  }

  findByCategory(category) {
    return Domain.find({ category, isActive: true }).sort({ order: 1 });
  }

  distinctCategories() {
    return this.distinct('category', { isActive: true });
  }
}

module.exports = new DomainRepository();
