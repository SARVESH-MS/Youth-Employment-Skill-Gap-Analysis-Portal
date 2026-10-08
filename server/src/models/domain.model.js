'use strict';

/**
 * Domain — a career domain (frontend, backend, cloud, AI …). Domains are
 * database-driven categories, never system roles. The required skills for a
 * domain are the `Skill`s joined through DomainSkill.
 */

const mongoose = require('mongoose');
const { DOMAIN_CATEGORY } = require('../config/constants');

const { Schema } = mongoose;

const domainSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 2000 },
    icon: { type: String, trim: true, maxlength: 60, default: 'layers' },
    category: {
      type: String,
      enum: Object.values(DOMAIN_CATEGORY),
      default: DOMAIN_CATEGORY.PROGRAMMING,
      index: true,
    },
    /** Colour accent used by the UI; a hex value chosen by the admin. */
    accent: { type: String, trim: true, maxlength: 20, default: '#3b82f6' },
    /** Plain-language summary of who this domain suits and why it matters. */
    careerOutlook: { type: String, trim: true, maxlength: 2000 },
    /** Indicative entry-level salary band shown on the domain page. */
    averageEntrySalary: { type: String, trim: true, maxlength: 120 },
    growthOutlook: {
      type: String,
      enum: ['emerging', 'growing', 'stable', 'high-demand'],
      default: 'high-demand',
    },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

domainSchema.index({ name: 'text', description: 'text' });
domainSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('Domain', domainSchema);
