'use strict';

/**
 * ProgressSnapshot — a periodic capture of a student's career-readiness inputs.
 * Powers the "why did my readiness change?" explanation and the readiness
 * trend chart. Written by the analytics service, never by the user directly.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const progressSnapshotSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    domain: { type: Schema.Types.ObjectId, ref: 'Domain' },

    careerReadiness: { type: Number, default: 0, min: 0, max: 100 },
    skillGapPercentage: { type: Number, default: 0, min: 0, max: 100 },
    skillCompletionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    learningProgress: { type: Number, default: 0, min: 0, max: 100 },
    practicePerformance: { type: Number, default: 0, min: 0, max: 100 },
    codingPerformance: { type: Number, default: 0, min: 0, max: 100 },
    assessmentPerformance: { type: Number, default: 0, min: 0, max: 100 },
    consistency: { type: Number, default: 0, min: 0, max: 100 },
    streakScore: { type: Number, default: 0, min: 0, max: 100 },

    currentStreak: { type: Number, default: 0, min: 0 },
    knownCount: { type: Number, default: 0, min: 0 },
    inProgressCount: { type: Number, default: 0, min: 0 },
    completedCount: { type: Number, default: 0, min: 0 },
    missingCount: { type: Number, default: 0, min: 0 },

    reason: { type: String, trim: true, maxlength: 1000 },
    capturedFor: { type: String, trim: true, maxlength: 60, default: 'daily' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

progressSnapshotSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ProgressSnapshot', progressSnapshotSchema);
