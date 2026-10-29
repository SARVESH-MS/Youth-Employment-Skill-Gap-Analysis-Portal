'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const readinessSettingsSchema = new Schema({
  key: { type: String, default: 'global', unique: true, immutable: true },
  confidence: {
    missing: { type: Number, default: 0, min: 0, max: 1 },
    inProgress: { type: Number, default: 0.35, min: 0, max: 1 },
    completed: { type: Number, default: 0.7, min: 0, max: 1 },
    verified: { type: Number, default: 1, min: 0, max: 1 },
  },
  freshness: {
    graceDays: { type: Number, default: 30, min: 0, max: 3650 },
    decayDurationDays: { type: Number, default: 120, min: 1, max: 3650 },
    decayFloor: { type: Number, default: 0.5, min: 0, max: 1 },
  },
  verificationPassPercentage: { type: Number, default: 70, min: 0, max: 100 },
  marketDemand: {
    minMultiplier: { type: Number, default: 0.75, min: 0.5, max: 1 },
    maxMultiplier: { type: Number, default: 1.5, min: 1, max: 2 },
    computedAt: { type: Date },
    skillCount: { type: Number, default: 0, min: 0 },
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } });

module.exports = mongoose.model('ReadinessSettings', readinessSettingsSchema);
