'use strict';

/**
 * UserSkill — a student's relationship to one skill from the central
 * catalogue. This is the source of truth for the student's learning state and
 * assessment verification; the skill-gap engine reads it and never a duplicate list.
 */

const mongoose = require('mongoose');
const { SKILL_STATUS_VALUES, SKILL_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const userSkillSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    status: { type: String, enum: SKILL_STATUS_VALUES, default: SKILL_STATUS.MISSING, index: true },
    /** Evidence-based state used only by the career-readiness confidence model. */
    readinessState: { type: String, enum: ['missing', 'in-progress', 'completed', 'verified'], index: true },
    /** Real learning progress for this skill (0-100), driven by activity. */
    progress: { type: Number, default: 0, min: 0, max: 100 },
    /**
     * Where the record came from. `manual` = set by the student,
     * `signup` = declared at registration, `resume` = reserved for future
     * AI resume parsing, `activity` = promoted automatically by real progress.
     */
    source: {
      type: String,
      enum: ['manual', 'signup', 'resume', 'activity'],
      default: 'manual',
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    verifiedAt: { type: Date },
    lastActivityAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

userSkillSchema.index({ user: 1, skill: 1 }, { unique: true });
userSkillSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('UserSkill', userSkillSchema);
