'use strict';

/**
 * BaseRepository — the single gateway between services and Mongoose. Every
 * concrete repository extends this, so query construction lives in the data
 * layer and never leaks into services or controllers.
 */

class BaseRepository {
  constructor(model) {
    if (!model) throw new Error('BaseRepository requires a Mongoose model');
    this.model = model;
  }

  create(data, options = {}) {
    return this.model.create(data, options);
  }

  /** Ordered:false so one duplicate does not abort a whole bulk insert. */
  createMany(documents, options = {}) {
    return this.model.insertMany(documents, { ordered: false, ...options });
  }

  findById(id, projection = undefined, options = {}) {
    return this.model.findById(id, projection, options);
  }

  findOne(filter = {}, projection = undefined, options = {}) {
    return this.model.findOne(filter, projection, options);
  }

  find(filter = {}, projection = undefined, options = {}) {
    return this.model.find(filter, projection, options);
  }

  updateById(id, update, options = {}) {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true, ...options });
  }

  updateOne(filter, update, options = {}) {
    return this.model.updateOne(filter, update, { runValidators: true, ...options });
  }

  updateMany(filter, update, options = {}) {
    return this.model.updateMany(filter, update, { runValidators: true, ...options });
  }

  /** Upsert helper used by progress/streak maintenance. */
  upsert(filter, update, options = {}) {
    return this.model.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, ...options }
    );
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  deleteOne(filter) {
    return this.model.deleteOne(filter);
  }

  deleteMany(filter) {
    return this.model.deleteMany(filter);
  }

  count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  exists(filter = {}) {
    return this.model.exists(filter);
  }

  distinct(field, filter = {}) {
    return this.model.distinct(field, filter);
  }

  aggregate(pipeline = [], options = {}) {
    return this.model.aggregate(pipeline, options);
  }

  /**
   * Standard paginated list. Returns `{ items, total }` so callers can wrap it
   * with `buildPaginationMeta` from utils/pagination.
   */
  async paginate(filter = {}, { skip = 0, limit = 20, sort = { createdAt: -1 }, projection, populate } = {}) {
    let query = this.model.find(filter, projection).sort(sort).skip(skip).limit(limit);
    if (populate) {
      const populations = Array.isArray(populate) ? populate : [populate];
      populations.forEach((entry) => {
        query = query.populate(entry);
      });
    }
    const [items, total] = await Promise.all([query.exec(), this.count(filter)]);
    return { items, total };
  }

  /** Cursor-style iteration for large result sets during seeding/analytics. */
  async *cursor(filter = {}, { projection, batchSize = 500 } = {}) {
    const query = this.model.find(filter, projection).batchSize(batchSize);
    for await (const doc of query.cursor()) {
      yield doc;
    }
  }
}

module.exports = BaseRepository;
