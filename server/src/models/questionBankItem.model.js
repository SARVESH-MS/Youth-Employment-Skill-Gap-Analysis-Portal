'use strict';

/**
 * QuestionBankItem — the single MCQ question pool used by BOTH self-service
 * assessments and company recruitment (MCQ) rounds. Companies draw from this
 * same bank or contribute their own items into it; recruitment never builds a
 * second, separate assessment system.
 */

const mongoose = require('mongoose');
const { SKILL_DIFFICULTY_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const questionBankItemSchema = new Schema(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    difficulty: { type: String, enum: SKILL_DIFFICULTY_VALUES, required: true, index: true },
    topic: { type: String, trim: true, maxlength: 200, index: true },
    prompt: { type: String, required: true, trim: true },
    options: {
      type: [String],
      validate: {
        validator(options) {
          return Array.isArray(options) && options.length >= 2 && options.length <= 6;
        },
        message: 'A question must have between 2 and 6 options',
      },
      required: true,
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, trim: true, maxlength: 4000 },
    tags: { type: [String], default: [] },

    /**
     * Ownership / visibility. `platform` items are visible to everyone;
     * `company` items belong to the company that authored them.
     */
    visibility: { type: String, enum: ['platform', 'company'], default: 'platform', index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },

    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

questionBankItemSchema.index({ skill: 1, difficulty: 1, isActive: 1 });
questionBankItemSchema.index({ visibility: 1, owner: 1 });

questionBankItemSchema.path('correctIndex').validate(function validateIndex(value) {
  return value < this.options.length;
}, 'correctIndex must point at one of the options');

module.exports = mongoose.model('QuestionBankItem', questionBankItemSchema);
