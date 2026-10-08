'use strict';

/**
 * User — the single identity collection for all three system roles
 * (student, company, admin). Role-specific fields are optional and validated
 * conditionally so one document shape serves every role without duplication.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ROLE_VALUES, COMPANY_APPROVAL_STATUS, THEMES, SKILL_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const languageSchema = new Schema(
  {
    language: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'professional', 'native'],
      default: 'conversational',
    },
  },
  { _id: false }
);

const resumeSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId },
    fileName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0 },
    uploadedAt: { type: Date },
  },
  { _id: false }
);

const educationSchema = new Schema(
  {
    tenth: {
      board: { type: String, trim: true },
      school: { type: String, trim: true },
      percentage: { type: Number, min: 0, max: 100 },
      yearOfPassing: { type: Number, min: 1950, max: 2100 },
    },
    twelfth: {
      board: { type: String, trim: true },
      school: { type: String, trim: true },
      stream: { type: String, trim: true },
      percentage: { type: Number, min: 0, max: 100 },
      yearOfPassing: { type: Number, min: 1950, max: 2100 },
    },
    diploma: {
      institution: { type: String, trim: true },
      specialization: { type: String, trim: true },
      percentage: { type: Number, min: 0, max: 100 },
      yearOfPassing: { type: Number, min: 1950, max: 2100 },
    },
    undergraduate: {
      degree: { type: String, trim: true },
      specialization: { type: String, trim: true },
      college: { type: String, trim: true },
      cgpa: { type: Number, min: 0, max: 10 },
      gradeType: { type: String, enum: ['cgpa', 'percentage'], default: 'cgpa' },
      startYear: { type: Number, min: 1950, max: 2100 },
      graduationYear: { type: Number, min: 1950, max: 2100 },
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    // ---- common identity -------------------------------------------------
    role: { type: String, enum: ROLE_VALUES, required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    phone: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },

    // ---- preferences / account state ------------------------------------
    theme: { type: String, enum: THEMES, default: 'dark' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastActivityAt: { type: Date },

    // ---- student fields --------------------------------------------------
    education: { type: educationSchema, default: () => ({}) },
    spokenLanguages: { type: [languageSchema], default: [] },
    careerDomain: { type: Schema.Types.ObjectId, ref: 'Domain' },
    careerDomainChangedAt: { type: Date },
    resume: { type: resumeSchema, default: () => ({}) },
    /** Optional short self-introduction shown on the student profile. */
    headline: { type: String, trim: true, maxlength: 200 },

    // ---- company fields --------------------------------------------------
    companyName: { type: String, trim: true, maxlength: 200 },
    memberName: { type: String, trim: true, maxlength: 120 },
    designation: { type: String, trim: true, maxlength: 120 },
    industry: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 4000 },
    website: { type: String, trim: true, maxlength: 300 },
    location: { type: String, trim: true, maxlength: 200 },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    expectedCompensation: { type: String, trim: true, maxlength: 120 },
    expectedHires: { type: Number, min: 0, max: 10000 },
    hiringRequirements: { type: String, trim: true, maxlength: 4000 },
    requiredSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    approvalStatus: {
      type: String,
      enum: Object.values(COMPANY_APPROVAL_STATUS),
      default: COMPANY_APPROVAL_STATUS.PENDING,
    },
    approvalNote: { type: String, trim: true, maxlength: 1000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },

    // ---- admin fields ----------------------------------------------------
    isSuperAdmin: { type: Boolean, default: false },
    createdByAdmin: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound text-ish search index used by admin user management & discovery.
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ fullName: 'text', email: 'text', companyName: 'text' });

// ---- instance helpers -----------------------------------------------------
userSchema.methods.setPassword = async function setPassword(plainPassword) {
  const { env } = require('../config/env');
  this.passwordHash = await bcrypt.hash(plainPassword, env.auth.saltRounds);
};

userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// ---- statics --------------------------------------------------------------
/** Locate a login identity by email, phone or username (case-insensitive). */
userSchema.statics.findByIdentifierAndRole = function findByIdentifierAndRole(identifier, role) {
  const value = String(identifier || '').trim().toLowerCase();
  return this.findOne({
    role,
    $or: [{ email: value }, { username: value }, { phone: String(identifier).trim() }],
  }).select('+passwordHash');
};

/** A candidate profile view never exposes contact details by default. */
userSchema.methods.toPublicProfile = function toPublicProfile(options = {}) {
  const { includeContact = false } = options;
  const base = {
    id: this._id,
    role: this.role,
    fullName: this.fullName,
    headline: this.headline,
    careerDomain: this.careerDomain,
    education: this.education,
    spokenLanguages: this.spokenLanguages,
    theme: this.theme,
    createdAt: this.createdAt,
  };
  if (includeContact) {
    base.email = this.email;
    base.phone = this.phone;
    base.resume = this.resume;
  }
  return base;
};

userSchema.statics.STATUS = SKILL_STATUS;

module.exports = mongoose.model('User', userSchema);
