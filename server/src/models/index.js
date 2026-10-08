'use strict';

/**
 * Barrel export for every Mongoose model. Importing models from here keeps
 * references consistent and makes the persistence layer easy to enumerate.
 */

module.exports = {
  User: require('./user.model'),
  RefreshToken: require('./refreshToken.model'),
  Domain: require('./domain.model'),
  Skill: require('./skill.model'),
  DomainSkill: require('./domainSkill.model'),
  UserSkill: require('./userSkill.model'),
  LearningModule: require('./learningModule.model'),
  LessonProgress: require('./lessonProgress.model'),
  Annotation: require('./annotation.model'),
  PracticeQuestion: require('./practiceQuestion.model'),
  CodingQuestion: require('./codingQuestion.model'),
  QuestionBankItem: require('./questionBankItem.model'),
  TestSet: require('./testSet.model'),
  TestAttempt: require('./testAttempt.model'),
  CodingSubmission: require('./codingSubmission.model'),
  Opportunity: require('./opportunity.model'),
  Application: require('./application.model'),
  RecruitmentRound: require('./recruitmentRound.model'),
  RoundResult: require('./roundResult.model'),
  Notification: require('./notification.model'),
  Complaint: require('./complaint.model'),
  ActivityLog: require('./activityLog.model'),
  AuditLog: require('./auditLog.model'),
  Streak: require('./streak.model'),
  ProgressSnapshot: require('./progressSnapshot.model'),
  AssistantConversation: require('./assistantConversation.model'),
};
