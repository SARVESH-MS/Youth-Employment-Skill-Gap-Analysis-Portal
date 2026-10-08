'use strict';

/**
 * LessonProgress — per-subtopic engagement record for a student. Lesson
 * completion is only ever granted after genuine engagement (time-on-page
 * threshold and/or a passed checkpoint quiz); users can never fake progress.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const lessonProgressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'LearningModule', required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, required: true },
    subtopicId: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed'],
      default: 'not-started',
      index: true,
    },
    /** Accumulated genuine reading time for this subtopic. */
    timeSpentSec: { type: Number, default: 0, min: 0 },
    quizPassed: { type: Boolean, default: false },
    quizScore: { type: Number, default: 0, min: 0, max: 100 },
    quizAttempts: { type: Number, default: 0, min: 0 },
    lastViewedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

lessonProgressSchema.index({ user: 1, subtopicId: 1 }, { unique: true });
lessonProgressSchema.index({ user: 1, skill: 1, status: 1 });

module.exports = mongoose.model('LessonProgress', lessonProgressSchema);
