'use strict';

/**
 * DomainSkill — the many-to-many join between domains and the central skill
 * catalogue. One skill can belong to many domains (e.g. JavaScript belongs to
 * frontend, full stack and backend). These links ARE the "required skills" the
 * skill-gap engine compares a student against.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const domainSkillSchema = new Schema(
  {
    domain: { type: Schema.Types.ObjectId, ref: 'Domain', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    /** `false` marks an optional/bonus skill for the domain. */
    required: { type: Boolean, default: true },
    /** Relative importance, used for weighted career-readiness maths. */
    weight: { type: Number, default: 1, min: 0, max: 10 },
    /** Recommended learning sequence inside the domain. */
    order: { type: Number, default: 0 },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// A skill can be attached to a domain only once.
domainSkillSchema.index({ domain: 1, skill: 1 }, { unique: true });
domainSkillSchema.index({ domain: 1, order: 1 });

module.exports = mongoose.model('DomainSkill', domainSkillSchema);
