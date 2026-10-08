'use strict';

const { connectDB, disconnectDB } = require('../config/db');
const { Skill, LearningModule } = require('../models');
const catalog = require('./catalog');
const { mergeSeededCurriculum } = require('./merge-seeded-curriculum');

const run = async () => {
  await connectDB();
  const skills = await Skill.find({ slug: { $in: catalog.skills.map((skill) => skill.slug) } });
  let updated = 0;
  let skipped = 0;

  for (const skill of skills) {
    for (const moduleData of catalog.buildModules(skill)) {
      const module = await LearningModule.findOne({ skill: skill._id, slug: moduleData.slug });
      if (!module || !mergeSeededCurriculum(module, moduleData)) {
        skipped += 1;
        continue;
      }
      await module.save();
      updated += 1;
    }
  }

  console.log(`Curriculum sync complete: updated ${updated} seeded modules; skipped ${skipped} missing, current, or admin-authored modules.`);
};

run().catch((error) => {
  console.error('[curriculum sync] failed:', error.message);
  process.exitCode = 1;
}).finally(() => disconnectDB());
