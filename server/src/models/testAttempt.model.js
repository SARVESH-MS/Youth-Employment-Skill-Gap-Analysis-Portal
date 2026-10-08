'use strict';

/**
 * TestAttempt — a complete, immutable record of one assessment attempt, used
 * for both self-service tests and company recruitment rounds. Stores a
 * snapshot of each question so review screens stay accurate even if the bank
 * item is later edited, plus tab-switch integrity signals, timing, and the
 * per-topic breakdown that powers weak-topic recommendations.
 */

const mongoose = require('mongoose');
const { SKILL_DIFFICULTY_VALUES, ASSESSMENT_MODE, ATTEMPT_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'QuestionBankItem' },
    /** Snapshot so historical review never changes when the bank is edited. */
    prompt: { type: String, default: '' },
    options: { type: [String], default: [] },
    correctIndex: { type: Number, default: 0 },
    topic: { type: String, default: '' },
    selectedIndex: { type: Number, default: null },
    /** Learner explicitly skipped rather than ran out of time. */
    skipped: { type: Boolean, default: false },
    /** Learner revealed the answer during the attempt. */
    revealed: { type: Boolean, default: false },
    timeSpentSec: { type: Number, default: 0, min: 0 },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const topicBreakdownSchema = new Schema(
  {
    topic: { type: String, default: '' },
    correct: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const testAttemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    difficulty: { type: String, enum: SKILL_DIFFICULTY_VALUES, required: true, index: true },
    testSet: { type: Schema.Types.ObjectId, ref: 'TestSet' },
    setNumber: { type: Number, min: 1 },
    mode: { type: String, enum: Object.values(ASSESSMENT_MODE), default: ASSESSMENT_MODE.SELF, index: true },
    /** Set when the attempt belongs to a company recruitment round. */
    round: { type: Schema.Types.ObjectId, ref: 'RecruitmentRound' },
    company: { type: Schema.Types.ObjectId, ref: 'User' },

    status: { type: String, enum: Object.values(ATTEMPT_STATUS), default: ATTEMPT_STATUS.IN_PROGRESS, index: true },
    startedAt: { type: Date, default: Date.now },
    /** Hard deadline derived from the test set duration. */
    expiresAt: { type: Date },
    submittedAt: { type: Date },
    durationMinutes: { type: Number, default: 15, min: 1 },
    timeTakenSec: { type: Number, default: 0, min: 0 },

    answers: { type: [answerSchema], default: [] },
    totalQuestions: { type: Number, default: 0, min: 0 },
    correct: { type: Number, default: 0, min: 0 },
    wrong: { type: Number, default: 0, min: 0 },
    skipped: { type: Number, default: 0, min: 0 },
    revealed: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },

    /** Integrity signals captured during the attempt. */
    tabSwitchCount: { type: Number, default: 0, min: 0 },
    tabSwitchEvents: { type: [{ type: Date }], default: [] },

    topicBreakdown: { type: [topicBreakdownSchema], default: [] },
    weakTopics: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

testAttemptSchema.index({ user: 1, skill: 1, status: 1 });
testAttemptSchema.index({ user: 1, createdAt: -1 });
testAttemptSchema.index({ user: 1, skill: 1, difficulty: 1, setNumber: 1, status: 1 });

module.exports = mongoose.model('TestAttempt', testAttemptSchema);
