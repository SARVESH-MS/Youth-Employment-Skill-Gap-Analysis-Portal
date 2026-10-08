'use strict';

/**
 * RefreshToken — one row per active session. Enables server-side revocation
 * and the inactivity auto-logout policy.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, index: true },
    /** SHA-256 hash of the refresh token — the raw token is never persisted. */
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
    userAgent: { type: String, maxlength: 400 },
    ip: { type: String, maxlength: 60 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Expired documents are removed automatically by MongoDB's TTL monitor.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });

refreshTokenSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
