'use strict';

/**
 * AuditLog — records privileged admin actions with a before/after snapshot so
 * platform governance is fully traceable (approvals, provisioning, content
 * changes, settings). Distinct from ActivityLog, which covers user behaviour.
 */

const mongoose = require('mongoose');
const { ACTIVITY_ACTION } = require('../config/constants');

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: Object.values(ACTIVITY_ACTION), required: true, index: true },
    targetType: { type: String, trim: true, maxlength: 60 },
    targetId: { type: Schema.Types.ObjectId },
    description: { type: String, trim: true, maxlength: 1000 },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String, maxlength: 60 },
    userAgent: { type: String, maxlength: 400 },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
