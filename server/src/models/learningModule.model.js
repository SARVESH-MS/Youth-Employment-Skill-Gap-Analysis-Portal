'use strict';

/**
 * LearningModule — database-driven learning content for one
 * skill. Content is structured exactly as: skill → modules → topics →
 * subtopics → detailed theory → examples → real-world examples → exercises →
 * summary → assessment. Nothing is hard-coded into HTML; the platform never
 * redirects a learner to an external site.
 */

const mongoose = require('mongoose');
const { SKILL_DIFFICULTY_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const codeExampleSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 300 },
    language: { type: String, trim: true, maxlength: 40, default: 'text' },
    code: { type: String, default: '' },
    output: { type: String, default: '' },
    explanation: { type: String, trim: true, maxlength: 4000 },
  },
  { _id: false }
);

/** Short checkpoint quiz — a lesson only completes after genuine engagement. */
const checkpointQuestionSchema = new Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 1000 },
    options: { type: [String], default: [] },
    correctIndex: { type: Number, min: 0, default: 0 },
    explanation: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const curriculumReferenceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    publisher: { type: String, trim: true, maxlength: 160 },
    url: { type: String, required: true, trim: true, maxlength: 1000, match: /^https:\/\//i },
  },
  { _id: false }
);

const subtopicSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  order: { type: Number, default: 0 },
  /** Full markdown theory — the substance of the lesson. */
  theory: { type: String, default: '' },
  keyPoints: { type: [String], default: [] },
  examples: { type: [codeExampleSchema], default: [] },
  realWorldExample: { type: String, trim: true, maxlength: 8000 },
  exercise: { type: String, trim: true, maxlength: 6000 },
  exerciseSolution: { type: String, trim: true, maxlength: 6000 },
  commonPitfalls: { type: [String], default: [] },
  summary: { type: String, trim: true, maxlength: 4000 },
  estimatedMinutes: { type: Number, default: 10, min: 1 },
  /** Checkpoint quiz gate for lesson completion. */
  checkpoints: { type: [checkpointQuestionSchema], default: [] },
});

const topicSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  order: { type: Number, default: 0 },
  overview: { type: String, trim: true, maxlength: 4000 },
  subtopics: { type: [subtopicSchema], default: [] },
  estimatedMinutes: { type: Number, default: 20, min: 1 },
});

const learningModuleSchema = new Schema(
  {
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 4000 },
    level: { type: String, enum: SKILL_DIFFICULTY_VALUES, default: 'beginner' },
    order: { type: Number, default: 0 },
    estimatedMinutes: { type: Number, default: 60, min: 1 },
    /** Learning objectives shown at the top of the module. */
    objectives: { type: [String], default: [] },
    topics: { type: [topicSchema], default: [] },
    /** Optional primary references; all required learning remains in YESGAP. */
    references: { type: [curriculumReferenceSchema], default: [] },
    /** Version of the application-authored seed content used by this module. */
    seedRevision: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

learningModuleSchema.index({ skill: 1, order: 1 });
learningModuleSchema.index({ skill: 1, isPublished: 1, order: 1 });
learningModuleSchema.index({ skill: 1, slug: 1 }, { unique: true });

/** Derived counts used by the table of contents / progress bars. */
learningModuleSchema.virtual('subtopicCount').get(function subtopicCount() {
  return (this.topics || []).reduce((total, topic) => total + (topic.subtopics || []).length, 0);
});

module.exports = mongoose.model('LearningModule', learningModuleSchema);
