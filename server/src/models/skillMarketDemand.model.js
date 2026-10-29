'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const skillMarketDemandSchema = new Schema({
  skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, unique: true, index: true },
  opportunityCount: { type: Number, default: 0, min: 0 },
  marketDemandMultiplier: { type: Number, default: 1, min: 0.5, max: 2 },
  computedAt: { type: Date, default: Date.now },
}, { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } });

module.exports = mongoose.model('SkillMarketDemand', skillMarketDemandSchema);
