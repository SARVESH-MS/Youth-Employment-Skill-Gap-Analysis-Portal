'use strict';

/**
 * Opportunity — a recruitment opportunity posted by a company. Required
 * skills are OBJECT IDs drawn from the central skills catalogue (never free
 * text) so candidate skill-matching is always exact. A company can close an
 * opportunity or mark it filled at any time, which removes it from active
 * candidate visibility.
 */

const mongoose = require('mongoose');
const { OPPORTUNITY_STATUS, ROUND_TYPE_VALUES } = require('../config/constants');

const { Schema } = mongoose;

const firstRoundSchema = new Schema(
  {
    type: { type: String, enum: ROUND_TYPE_VALUES, default: 'mcq' },
    name: { type: String, trim: true, maxlength: 200, default: 'Round 1' },
    date: { type: String, trim: true, maxlength: 40 },
    time: { type: String, trim: true, maxlength: 40 },
    durationMinutes: { type: Number, min: 1, max: 600 },
    instructions: { type: String, trim: true, maxlength: 4000 },
  },
  { _id: false }
);

const opportunitySchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 8000 },
    responsibilities: { type: String, trim: true, maxlength: 6000 },
    compensation: { type: String, trim: true, maxlength: 200 },
    location: { type: String, trim: true, maxlength: 200 },
    workMode: { type: String, enum: ['on-site', 'hybrid', 'remote'], default: 'on-site' },
    employmentType: {
      type: String,
      enum: ['full-time', 'internship', 'part-time', 'contract'],
      default: 'full-time',
    },
    experienceLevel: {
      type: String,
      enum: ['fresher', '0-1 years', '1-3 years', '3+ years'],
      default: 'fresher',
    },
    openings: { type: Number, default: 1, min: 1, max: 1000 },
    applicationDeadline: { type: Date },

    /** Selected from the shared skills catalogue — enables exact matching. */
    requiredSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],

    firstRound: { type: firstRoundSchema, default: () => ({}) },

    status: {
      type: String,
      enum: Object.values(OPPORTUNITY_STATUS),
      default: OPPORTUNITY_STATUS.OPEN,
      index: true,
    },
    closedAt: { type: Date },
    filledAt: { type: Date },
    statusNote: { type: String, trim: true, maxlength: 1000 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

opportunitySchema.index({ company: 1, status: 1, createdAt: -1 });
opportunitySchema.index({ status: 1, createdAt: -1 });
opportunitySchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Opportunity', opportunitySchema);
