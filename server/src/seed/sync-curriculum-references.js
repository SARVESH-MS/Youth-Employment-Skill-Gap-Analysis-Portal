'use strict';

const { connectDB, disconnectDB } = require('../config/db');
const { Skill, LearningModule } = require('../models');
const curriculumSources = require('./curriculum-sources');

/**
 * Safely attach the public source list to existing modules that do not have
 * references yet. This never replaces references an instructor has edited.
 */
const syncCurriculumReferences = async () => {
  await connectDB();
  let updatedModules = 0;

  for (const [skillSlug, references] of Object.entries(curriculumSources)) {
    if (!references.length) continue;
    const skill = await Skill.findOne({ slug: skillSlug }).select('_id').lean();
    if (!skill) continue;

    const result = await LearningModule.updateMany(
      {
        skill: skill._id,
        $or: [{ references: { $exists: false } }, { references: { $size: 0 } }],
      },
      { $set: { references } },
      { runValidators: true }
    );
    updatedModules += result.modifiedCount || 0;
  }

  console.log(`[seed] added public curriculum references to ${updatedModules} learning modules`);
};

syncCurriculumReferences()
  .catch((error) => {
    console.error('[seed] curriculum reference sync failed:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
