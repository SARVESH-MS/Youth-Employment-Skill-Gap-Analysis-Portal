'use strict';

/**
 * Streak — per-user learning streak state derived ONLY from real ActivityLog
 * events. The day boundary is the user's LOCAL timezone (IST by default), not
 * server UTC, so a late-evening session never breaks a streak. Each day stores
 * activity by category (learn / practice / test) for the daily-activity view.
 */

const mongoose = require('mongoose');
const { DEFAULT_TIMEZONE } = require('../config/constants');

const { Schema } = mongoose;

const dailyActivitySchema = new Schema(
  {
    day: { type: String, required: true }, // YYYY-MM-DD in the user's timezone
    learn: { type: Number, default: 0, min: 0 },
    practice: { type: Number, default: 0, min: 0 },
    test: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const streakSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    totalActiveDays: { type: Number, default: 0, min: 0 },
    lastActivityDay: { type: String },
    /** Recent active days (newest last) for the streak calendar. */
    activityDates: { type: [String], default: [] },
    /** Rolling per-day breakdown, capped at 365 entries. */
    dailyActivity: { type: [dailyActivitySchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

streakSchema.index({ currentStreak: -1 });
streakSchema.index({ longestStreak: -1 });

module.exports = mongoose.model('Streak', streakSchema);
