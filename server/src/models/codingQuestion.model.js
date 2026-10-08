'use strict';

/**
 * CodingQuestion — database-driven coding problems for executable skills.
 * Carries the full statement, constraints, examples, hidden + visible test
 * cases, editor starter code and language-specific solutions. Solutions are
 * only ever returned when the learner explicitly asks for them, and they
 * switch with the selected language.
 */

const mongoose = require('mongoose');
const { SKILL_DIFFICULTY_VALUES, PROGRAMMING_LANGUAGE_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const exampleSchema = new Schema(
  {
    input: { type: String, default: '' },
    output: { type: String, default: '' },
    explanation: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const testCaseSchema = new Schema(
  {
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    /** Hidden cases are used for grading but never shown to the learner. */
    hidden: { type: Boolean, default: false },
    explanation: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

/** Starter templates keyed by language so the editor opens sensibly. */
const starterCodeSchema = new Schema(
  {
    java: { type: String, default: '' },
    python: { type: String, default: '' },
    c: { type: String, default: '' },
    cpp: { type: String, default: '' },
    javascript: { type: String, default: '' },
    sql: { type: String, default: '' },
  },
  { _id: false }
);

/** Reference solutions, one per supported language. */
const solutionsSchema = new Schema(
  {
    java: { type: String, default: '' },
    python: { type: String, default: '' },
    c: { type: String, default: '' },
    cpp: { type: String, default: '' },
    javascript: { type: String, default: '' },
    sql: { type: String, default: '' },
  },
  { _id: false }
);

const codingQuestionSchema = new Schema(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    statement: { type: String, required: true, trim: true },
    inputSpec: { type: String, trim: true, maxlength: 6000 },
    outputSpec: { type: String, trim: true, maxlength: 6000 },
    constraints: { type: [String], default: [] },
    examples: { type: [exampleSchema], default: [] },
    difficulty: { type: String, enum: SKILL_DIFFICULTY_VALUES, default: 'beginner', index: true },
    topic: { type: String, trim: true, maxlength: 200, index: true },
    tags: { type: [String], default: [] },
    supportedLanguages: {
      type: [{ type: String, enum: PROGRAMMING_LANGUAGE_VALUES }],
      default: ['javascript'],
    },
    starterCode: { type: starterCodeSchema, default: () => ({}) },
    testCases: { type: [testCaseSchema], default: [] },
    solutions: { type: solutionsSchema, default: () => ({}) },
    /** Optional worked approach shown alongside the solution. */
    approach: { type: String, trim: true, maxlength: 6000 },
    timeComplexity: { type: String, trim: true, maxlength: 120 },
    spaceComplexity: { type: String, trim: true, maxlength: 120 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

codingQuestionSchema.index({ skill: 1, difficulty: 1, order: 1 });
codingQuestionSchema.index({ skill: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
