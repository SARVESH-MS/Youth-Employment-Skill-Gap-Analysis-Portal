'use strict';

/**
 * Notification — the in-portal inbox item. There is NO external email anywhere
 * in the platform: every message, approval communication and system event is
 * delivered here, with unread badges and mark-as-read support. The `type`
 * vocabulary is fixed in constants so inbox behaviour is deterministic.
 */

const mongoose = require('mongoose');
const { NOTIFICATION_TYPE_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPE_VALUES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, trim: true, maxlength: 4000 },
    /** In-app deep link the notification opens, e.g. /student/opportunities. */
    link: { type: String, trim: true, maxlength: 500 },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    /** Free-form context: ids of the related opportunity, round, complaint… */
    meta: { type: Schema.Types.Mixed, default: () => ({}) },
    /** Who caused the notification (company, admin, system). */
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });

notificationSchema.methods.markRead = function markRead() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
  }
  return this;
};

module.exports = mongoose.model('Notification', notificationSchema);
