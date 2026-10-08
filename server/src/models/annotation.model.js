'use strict';

/**
 * Annotation — a student's personal bookmark or note attached to a skill,
 * module or topic. Kept in one collection because both share the same owner,
 * target and lifecycle; the `type` field discriminates them.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const annotationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['bookmark', 'note'], required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'LearningModule' },
    topicId: { type: Schema.Types.ObjectId },
    subtopicId: { type: Schema.Types.ObjectId },
    /** Descriptive label so the bookmark list is readable. */
    label: { type: String, trim: true, maxlength: 300 },
    /** Note body (empty for plain bookmarks). */
    content: { type: String, trim: true, maxlength: 8000 },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, r) { delete r.__v; return r; } } }
);

annotationSchema.index({ user: 1, type: 1, createdAt: -1 });
annotationSchema.index({ user: 1, skill: 1, subtopicId: 1, type: 1 });

module.exports = mongoose.model('Annotation', annotationSchema);
