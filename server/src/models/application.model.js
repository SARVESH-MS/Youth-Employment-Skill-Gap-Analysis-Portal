'use strict';

/**
 * Application — the recruitment relationship between a student and one
 * opportunity. Tracks the full state machine (offered → accepted/rejected →
 * in-progress → selected/rejected-final, with a student-initiated withdraw
 * available at any stage before a final result). `contactUnlocked` is the
 * single flag that governs whether the company may see contact details.
 */

const mongoose = require('mongoose');
const { APPLICATION_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const timelineEventSchema = new Schema(
  {
    status: { type: String, required: true },
    note: { type: String, trim: true, maxlength: 1000 },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new Schema(
  {
    opportunity: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.OFFERED,
      index: true,
    },
    /**
     * Contact details stay hidden from the company until the student accepts
     * the opportunity. This is enforced in the service layer, not the UI.
     */
    contactUnlocked: { type: Boolean, default: false },

    offeredAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    withdrawnAt: { type: Date },
    finalResultAt: { type: Date },
    finalResult: { type: String, enum: ['selected', 'rejected', null], default: null },

    /** Current round pointer used by the recruitment screen. */
    currentRoundNumber: { type: Number, default: 0, min: 0 },

    timeline: { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

// A student receives at most one application per opportunity.
applicationSchema.index({ opportunity: 1, student: 1 }, { unique: true });
applicationSchema.index({ student: 1, status: 1, createdAt: -1 });
applicationSchema.index({ company: 1, status: 1, createdAt: -1 });

/** A student may withdraw any time before a final result has been issued. */
applicationSchema.methods.canWithdraw = function canWithdraw() {
  return [
    APPLICATION_STATUS.OFFERED,
    APPLICATION_STATUS.ACCEPTED,
    APPLICATION_STATUS.IN_PROGRESS,
  ].includes(this.status);
};

/** Final results are terminal. */
applicationSchema.methods.isTerminal = function isTerminal() {
  return [
    APPLICATION_STATUS.WITHDRAWN,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.SELECTED,
    APPLICATION_STATUS.REJECTED_FINAL,
  ].includes(this.status);
};

module.exports = mongoose.model('Application', applicationSchema);
