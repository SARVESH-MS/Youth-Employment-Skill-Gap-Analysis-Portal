'use strict';

/**
 * RoundResult — the outcome a company records for one candidate in one round.
 * Passed / failed / next-round, with the underlying score where the round was
 * assessment-backed. Feeds the application's status machine and the student's
 * in-portal round-result notification.
 */

const mongoose = require('mongoose');
const { ROUND_RESULT } = require('../config/constants');

const { Schema } = mongoose;

const roundResultSchema = new Schema(
  {
    round: { type: Schema.Types.ObjectId, ref: 'RecruitmentRound', required: true, index: true },
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    attempt: { type: Schema.Types.ObjectId, ref: 'TestAttempt' },
    codingSubmission: { type: Schema.Types.ObjectId, ref: 'CodingSubmission' },

    result: { type: String, enum: Object.values(ROUND_RESULT), required: true },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String, trim: true, maxlength: 4000 },

    /** Manual interviews are marked by the company; assessments self-score. */
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

roundResultSchema.index({ round: 1, student: 1 }, { unique: true });
roundResultSchema.index({ application: 1, createdAt: -1 });

module.exports = mongoose.model('RoundResult', roundResultSchema);
