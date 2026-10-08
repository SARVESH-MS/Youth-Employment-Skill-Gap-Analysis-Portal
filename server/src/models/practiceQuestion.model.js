'use strict';

/**
 * PracticeQuestion — theory and scenario practice for every skill (including
 * non-programming skills such as cloud troubleshooting, security threat
 * analysis and AI concepts). Executable coding practice is handled by
 * CodingQuestion, which carries test cases and per-language solutions.
 *
 * The practice architecture is extensible: new `type` values can be added by
 * extending the enum in constants and the practice service.
 */

const mongoose = require('mongoose');
const { PRACTICE_TYPE, SKILL_DIFFICULTY_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const practiceQuestionSchema = new Schema(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(PRACTICE_TYPE),
      default: PRACTICE_TYPE.THEORY,
      index: true,
    },
    difficulty: { type: String, enum: SKILL_DIFFICULTY_VALUES, default: 'beginner', index: true },
    topic: { type: String, trim: true, maxlength: 200, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    /** The task or question presented to the learner. */
    prompt: { type: String, required: true, trim: true },
    /** Optional supporting context / scenario narrative. */
    scenario: { type: String, trim: true, maxlength: 8000 },
    hints: { type: [String], default: [] },
    /** For theory checks presented as a single-best-answer question. */
    options: { type: [String], default: [] },
    correctIndex: { type: Number, min: 0 },
    /** Model answer / expected approach revealed only on request. */
    expectedAnswer: { type: String, trim: true, maxlength: 8000 },
    solutionExplanation: { type: String, trim: true, maxlength: 8000 },
    tags: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

practiceQuestionSchema.index({ skill: 1, difficulty: 1, type: 1, order: 1 });

module.exports = mongoose.model('PracticeQuestion', practiceQuestionSchema);
