'use strict';

/**
 * RecruitmentRound — one round in a company's flexible recruitment process.
 * Rounds are NOT forced into one fixed sequence: each carries its own number,
 * type, schedule, instructions and status. MCQ rounds reference shared test
 * sets or selected bank items; coding rounds reference a published CodingQuestion
 * and use the separately hosted sandbox service.
 */

const mongoose = require('mongoose');
const { ROUND_TYPE_VALUES, ROUND_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const roundSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunity: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    application: { type: Schema.Types.ObjectId, ref: 'Application', index: true },

    roundNumber: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: ROUND_TYPE_VALUES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 4000 },

    /** Schedule. DATE + TIME are strings so the company states local intent. */
    date: { type: String, trim: true, maxlength: 40 },
    time: { type: String, trim: true, maxlength: 40 },
    durationMinutes: { type: Number, min: 1, max: 600 },

    instructions: { type: String, trim: true, maxlength: 4000 },
    eligibility: { type: String, trim: true, maxlength: 2000 },

    /**
     * MCQ rounds point at a TestSet (drawn from the shared bank) or carry
     * selected question items. Coding rounds point at a CodingQuestion.
     * Interviews use a meeting link only — conferencing is out of scope.
     */
    testSet: { type: Schema.Types.ObjectId, ref: 'TestSet' },
    codingQuestion: { type: Schema.Types.ObjectId, ref: 'CodingQuestion' },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill' },
    questionItems: [{ type: Schema.Types.ObjectId, ref: 'QuestionBankItem' }],
    passPercentage: { type: Number, default: 50, min: 0, max: 100 },

    meetingLink: { type: String, trim: true, maxlength: 500 },

    status: {
      type: String,
      enum: Object.values(ROUND_STATUS),
      default: ROUND_STATUS.SCHEDULED,
      index: true,
    },
    completedAt: { type: Date },
    assessmentStartedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

// Several candidates for one opportunity can receive the same numbered stage.
roundSchema.index({ opportunity: 1, roundNumber: 1 });
roundSchema.index({ company: 1, status: 1 });
roundSchema.index({ application: 1, roundNumber: 1 });

/** Assessment-backed rounds can be launched directly from the portal. */
roundSchema.virtual('isAssessmentBacked').get(function isAssessmentBacked() {
  return this.type === 'mcq' || this.type === 'coding' || this.type === 'custom-assessment';
});

module.exports = mongoose.model('RecruitmentRound', roundSchema);
