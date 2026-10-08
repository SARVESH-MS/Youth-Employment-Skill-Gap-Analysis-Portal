'use strict';

/**
 * Skill — the CENTRAL skills catalogue and the single shared source of truth
 * for every place skills appear: the skill-gap engine, learning content,
 * practice, assessments, company required-skills and candidate matching.
 * There is no second, disconnected skill list anywhere in the system.
 */

const mongoose = require('mongoose');
const { SKILL_DIFFICULTY_VALUES, EXECUTION_TYPE_VALUES, PROGRAMMING_LANGUAGE_VALUES } = require('../config/constants');

const { Schema } = mongoose;

/** The "About" panel every skill page renders. Stored as structured data. */
const aboutSchema = new Schema(
  {
    whatItIs: { type: String, trim: true, maxlength: 4000 },
    whyItMatters: { type: String, trim: true, maxlength: 4000 },
    whereItIsUsed: { type: String, trim: true, maxlength: 4000 },
    realWorldApplications: { type: [String], default: [] },
    careerRelevance: { type: String, trim: true, maxlength: 4000 },
    relatedTechnologies: { type: [String], default: [] },
    prerequisiteNotes: { type: String, trim: true, maxlength: 2000 },
    beginnerSuitability: {
      type: String,
      enum: ['beginner-friendly', 'some-experience-helpful', 'intermediate', 'advanced'],
      default: 'beginner-friendly',
    },
    jobRelevance: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const skillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    shortDescription: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 6000 },

    /** Broad grouping used by the all-skills filters (language, framework, …). */
    category: { type: String, trim: true, maxlength: 80, index: true },
    difficulty: { type: String, enum: SKILL_DIFFICULTY_VALUES, default: 'beginner', index: true },

    /**
     * Which in-portal editor / practice surface this skill gets. Only skills
     * whose executionType is not `none` expose a compiler or runtime.
     */
    executionType: { type: String, enum: EXECUTION_TYPE_VALUES, default: 'none', index: true },
    supportedLanguages: { type: [{ type: String, enum: PROGRAMMING_LANGUAGE_VALUES }], default: [] },

    about: { type: aboutSchema, default: () => ({}) },

    /** Prerequisite skills — drive the recommended learning-roadmap order. */
    prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    relatedSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],

    /** Free-form labels for search ("es6", "flexbox", "async" …). */
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

skillSchema.index({ name: 'text', shortDescription: 'text', description: 'text', tags: 'text' });
skillSchema.index({ isActive: 1, category: 1, difficulty: 1 });
skillSchema.index({ name: 1 });

/** A skill is executable when it declares a runtime/compiler/preview. */
skillSchema.virtual('isExecutable').get(function isExecutable() {
  return this.executionType && this.executionType !== 'none';
});

module.exports = mongoose.model('Skill', skillSchema);
