'use strict';

/**
 * Refresh application-authored lessons without invalidating student progress.
 * Completion rows refer to subtopic ids, so matching modules, topics, and
 * lessons retain their existing ids by position when seeded content advances.
 * Admin-authored modules are left to their owners.
 */
const mergeSeededCurriculum = (module, moduleData) => {
  const currentRevision = module.seedRevision || 0;
  if (moduleData.seedRevision <= currentRevision || module.createdBy || module.updatedBy) return false;

  const previousTopics = module.topics || [];
  const topics = moduleData.topics.map((topicData, topicIndex) => {
    const previousTopic = previousTopics[topicIndex];
    const previousSubtopics = previousTopic?.subtopics || [];
    return {
      ...topicData,
      ...(previousTopic?._id ? { _id: previousTopic._id } : {}),
      subtopics: topicData.subtopics.map((subtopicData, subtopicIndex) => {
        const previousSubtopic = previousSubtopics[subtopicIndex];
        return {
          ...subtopicData,
          ...(previousSubtopic?._id ? { _id: previousSubtopic._id } : {}),
        };
      }),
    };
  });

  module.set({
    title: moduleData.title,
    slug: moduleData.slug,
    description: moduleData.description,
    level: moduleData.level,
    order: moduleData.order,
    estimatedMinutes: moduleData.estimatedMinutes,
    objectives: moduleData.objectives,
    topics,
    references: moduleData.references,
    isPublished: moduleData.isPublished,
    seedRevision: moduleData.seedRevision,
  });
  return true;
};

module.exports = { mergeSeededCurriculum };
