'use strict';

/**
 * Complaint — a student or company submits this directly to admin through the
 * in-portal inbox. Each complaint carries a status (open / in-review /
 * resolved) so admin can see what still needs attention, and the submitter
 * sees the current status from their own profile.
 */

const mongoose = require('mongoose');
const { ROLES, COMPLAINT_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const complaintNoteSchema = new Schema(
  {
    note: { type: String, required: true, trim: true, maxlength: 4000 },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: Object.values(COMPLAINT_STATUS) },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const complaintSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Submitter role at the time of filing (student or company). */
    role: { type: String, enum: [ROLES.STUDENT, ROLES.COMPANY], required: true },
    category: {
      type: String,
      enum: ['technical', 'content', 'account', 'recruitment', 'assessment', 'other'],
      default: 'other',
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 8000 },
    status: {
      type: String,
      enum: Object.values(COMPLAINT_STATUS),
      default: COMPLAINT_STATUS.OPEN,
      index: true,
    },
    notes: { type: [complaintNoteSchema], default: [] },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

complaintSchema.index({ user: 1, status: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
