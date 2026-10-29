'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const skillEngagementSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
  lastEngagedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

skillEngagementSchema.index({ user: 1, skill: 1 }, { unique: true });

module.exports = mongoose.model('SkillEngagement', skillEngagementSchema);
