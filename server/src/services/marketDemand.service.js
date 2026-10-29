'use strict';

const { Skill, Opportunity, SkillMarketDemand, ReadinessSettings } = require('../models');

const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;
const READINESS_SETTINGS_CACHE_MS = 10_000;
let refreshInFlight;
let refreshTimer;
let readinessSettingsCache;
let readinessSettingsCacheAt = 0;
let readinessSettingsInFlight;
let readinessSettingsGeneration = 0;

const calculateDemandMultipliers = (skillIds, opportunityCounts, minMultiplier, maxMultiplier) => {
  const counts = new Map(opportunityCounts.map((row) => [String(row._id), row.opportunityCount]));
  const maxCount = opportunityCounts.reduce((max, row) => Math.max(max, row.opportunityCount), 0);
  return new Map(skillIds.map((skill) => {
    const opportunityCount = counts.get(String(skill)) || 0;
    const marketDemandMultiplier = maxCount === 0
      ? 1
      : minMultiplier + (maxMultiplier - minMultiplier) * Math.sqrt(opportunityCount / maxCount);
    return [String(skill), { opportunityCount, marketDemandMultiplier }];
  }));
};

const getReadinessSettings = () => {
  if (readinessSettingsCache && Date.now() - readinessSettingsCacheAt < READINESS_SETTINGS_CACHE_MS) {
    return Promise.resolve(readinessSettingsCache);
  }
  if (readinessSettingsInFlight) return readinessSettingsInFlight;

  const generation = readinessSettingsGeneration;
  readinessSettingsInFlight = ReadinessSettings.findOne({ key: 'global' }).lean()
    .then((settings) => settings || ReadinessSettings.findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: { key: 'global' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean())
    .then((settings) => {
      if (generation === readinessSettingsGeneration) {
        readinessSettingsCache = settings;
        readinessSettingsCacheAt = Date.now();
      }
      return settings;
    })
    .finally(() => {
      if (generation === readinessSettingsGeneration) readinessSettingsInFlight = null;
    });
  return readinessSettingsInFlight;
};

const invalidateReadinessSettingsCache = () => {
  readinessSettingsGeneration += 1;
  readinessSettingsCache = null;
  readinessSettingsCacheAt = 0;
  readinessSettingsInFlight = null;
};

const refreshMarketDemand = async () => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const [settings, skillIds] = await Promise.all([
      getReadinessSettings(),
      Skill.find({ isActive: true }).distinct('_id'),
    ]);
    const now = new Date();
    const rows = await Opportunity.aggregate([
      {
        $match: {
          status: 'open',
          $or: [
            { applicationDeadline: { $exists: false } },
            { applicationDeadline: null },
            { applicationDeadline: { $gt: now } },
          ],
        },
      },
      { $lookup: { from: 'users', localField: 'company', foreignField: '_id', as: 'companyProfile' } },
      { $unwind: '$companyProfile' },
      { $match: { 'companyProfile.role': 'company', 'companyProfile.isActive': true, 'companyProfile.approvalStatus': 'approved' } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: { opportunity: '$_id', skill: '$requiredSkills' } } },
      { $group: { _id: '$_id.skill', opportunityCount: { $sum: 1 } } },
    ]);
    const minMultiplier = settings.marketDemand.minMultiplier;
    const maxMultiplier = settings.marketDemand.maxMultiplier;
    const demandBySkill = calculateDemandMultipliers(skillIds, rows, minMultiplier, maxMultiplier);
    const operations = skillIds.map((skill) => {
      const { opportunityCount, marketDemandMultiplier } = demandBySkill.get(String(skill));
      return {
        updateOne: {
          filter: { skill },
          update: { $set: { opportunityCount, marketDemandMultiplier, computedAt: now }, $setOnInsert: { skill } },
          upsert: true,
        },
      };
    });
    if (operations.length) await SkillMarketDemand.bulkWrite(operations, { ordered: false });
    await ReadinessSettings.updateOne({ key: 'global' }, { $set: { 'marketDemand.computedAt': now, 'marketDemand.skillCount': operations.length } });
    return { skillCount: operations.length, opportunityCount: rows.reduce((sum, row) => sum + row.opportunityCount, 0), computedAt: now };
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
};

const startMarketDemandScheduler = async (logger = console) => {
  if (refreshTimer) return;
  try {
    await refreshMarketDemand();
  } catch (error) {
    logger.warn?.('Market-demand refresh failed during startup', { message: error.message });
  }
  refreshTimer = setInterval(() => {
    refreshMarketDemand().catch((error) => logger.warn?.('Scheduled market-demand refresh failed', { message: error.message }));
  }, DAILY_REFRESH_MS);
  refreshTimer.unref?.();
};

const stopMarketDemandScheduler = () => {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
};

module.exports = { DAILY_REFRESH_MS, calculateDemandMultipliers, getReadinessSettings, invalidateReadinessSettingsCache, refreshMarketDemand, startMarketDemandScheduler, stopMarketDemandScheduler };
