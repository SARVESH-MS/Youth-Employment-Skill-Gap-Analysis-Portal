'use strict';

/**
 * ActivityLog — the real, append-only record of everything a user does. The
 * streak engine and progress/consistency metrics derive ONLY from these real
 * events, never from anything a user can set by hand.
 */

const mongoose = require('mongoose');
const { ACTIVITY_ACTION, ROLES } = require('../config/constants');

const { Schema } = mongoose;

const activityLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: Object.values(ROLES) },
    action: { type: String, enum: Object.values(ACTIVITY_ACTION), required: true, index: true },

    entityType: { type: String, trim: true, maxlength: 60 },
    entityId: { type: Schema.Types.ObjectId },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', index: true },

    /** The user's local calendar day (YYYY-MM-DD) — the streak day boundary. */
    localDay: { type: String, index: true },
    /** Points/weight used for daily activity intensity visualisations. */
    weight: { type: Number, default: 1, min: 0 },

    meta: { type: Schema.Types.Mixed, default: () => ({}) },
    ip: { type: String, maxlength: 60 },
    userAgent: { type: String, maxlength: 400 },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, localDay: 1 });
activityLogSchema.index({ user: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
