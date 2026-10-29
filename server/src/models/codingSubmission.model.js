'use strict';

/**
 * CodingSubmission — one run/submit of user code against a CodingQuestion.
 * Records the language, source, the isolated execution result and per-test
 * outcomes. This is the auditable record behind "coding problems solved",
 * coding performance and career-readiness maths.
 */

const mongoose = require('mongoose');
const { PROGRAMMING_LANGUAGE_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const testOutcomeSchema = new Schema(
  {
    index: { type: Number, min: 0 },
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    actualOutput: { type: String, default: '' },
    passed: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const codingSubmissionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'CodingQuestion', required: true, index: true },
    round: { type: Schema.Types.ObjectId, ref: 'RecruitmentRound', index: true },

    language: { type: String, enum: PROGRAMMING_LANGUAGE_VALUES, required: true },
    source: { type: String, default: '' },
    /** `run` executes sample cases; `submit` grades all cases. */
    kind: { type: String, enum: ['run', 'submit'], default: 'run' },

    /** Verbatim result from the isolated execution service. */
    executionStatus: {
      type: String,
      enum: ['ok', 'compile_error', 'runtime_error', 'timeout', 'memory_limit', 'internal'],
      default: 'ok',
    },
    stdout: { type: String, default: '' },
    stderr: { type: String, default: '' },
    exitCode: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0, min: 0 },

    totalTests: { type: Number, default: 0, min: 0 },
    passedTests: { type: Number, default: 0, min: 0 },
    outcomes: { type: [testOutcomeSchema], default: [] },
    accepted: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

codingSubmissionSchema.index({ user: 1, question: 1, accepted: 1 });
codingSubmissionSchema.index({ user: 1, skill: 1, kind: 1, createdAt: -1 });
codingSubmissionSchema.index({ user: 1, createdAt: -1 });
codingSubmissionSchema.index({ user: 1, language: 1 });

module.exports = mongoose.model('CodingSubmission', codingSubmissionSchema);
