'use strict';

/**
 * TestSet — a numbered set of questions drawn from the shared question bank.
 * Assessments present sets such as "10 sets of 10 questions"; progress reads
 * "3 of 10 sets completed". Set membership is stored so a set is stable for
 * reviewing, retakes and recruitment rounds, while question ORDER is shuffled
 * per attempt by the assessment service.
 */

const mongoose = require('mongoose');
const { SKILL_DIFFICULTY_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const testSetSchema = new Schema(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    difficulty: { type: String, enum: SKILL_DIFFICULTY_VALUES, required: true, index: true },
    setNumber: { type: Number, required: true, min: 1 },
    title: { type: String, trim: true, maxlength: 200 },
    questions: [{ type: Schema.Types.ObjectId, ref: 'QuestionBankItem' }],
    questionCount: { type: Number, default: 0, min: 0 },
    /** Minutes allowed for the attempt; drives the assessment timer. */
    durationMinutes: { type: Number, default: 15, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

testSetSchema.index({ skill: 1, difficulty: 1, setNumber: 1 }, { unique: true });
testSetSchema.index({ skill: 1, difficulty: 1, isActive: 1 });

module.exports = mongoose.model('TestSet', testSetSchema);
