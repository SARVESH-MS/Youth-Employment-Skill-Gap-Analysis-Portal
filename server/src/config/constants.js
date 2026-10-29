'use strict';

/**
 * The single vocabulary of the platform. Models, services, validators and the
 * frontend all align on these values, so no string literals are scattered
 * across the codebase.
 */

const ROLES = Object.freeze({
  STUDENT: 'student',
  COMPANY: 'company',
  ADMIN: 'admin',
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/** Career domains are *categories*, never system roles. */
const DOMAIN_CATEGORY = Object.freeze({
  PROGRAMMING: 'programming',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  FULLSTACK: 'fullstack',
  MOBILE: 'mobile',
  DATA: 'data',
  AI: 'ai',
  CLOUD: 'cloud',
  DEVOPS: 'devops',
  SECURITY: 'security',
  DATABASE: 'database',
  QUALITY: 'quality',
  DESIGN: 'design',
  INFRASTRUCTURE: 'infrastructure',
  EMERGING: 'emerging',
});

const SKILL_STATUS = Object.freeze({
  KNOWN: 'known',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  MISSING: 'missing',
});

const SKILL_STATUS_VALUES = Object.freeze(Object.values(SKILL_STATUS));

/** Manual status a student can set for a skill on their profile. */
const MANUAL_SKILL_STATUS_VALUES = Object.freeze([
  SKILL_STATUS.KNOWN,
  SKILL_STATUS.IN_PROGRESS,
  SKILL_STATUS.COMPLETED,
]);

const SKILL_DIFFICULTY = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
});

const SKILL_DIFFICULTY_VALUES = Object.freeze(Object.values(SKILL_DIFFICULTY));

/**
 * Determines which in-portal editor/practice surface a skill gets.
 * Only executable skills expose a compiler/runtime.
 */
const EXECUTION_TYPE_VALUES = Object.freeze([
  'none',
  'html-preview',
  'css-preview',
  'js-runtime',
  'python-runtime',
  'java-runtime',
  'c-compiler',
  'cpp-compiler',
  'node-runtime',
  'react-preview',
  'sql-sandbox',
]);

const EXECUTION_TYPE = Object.freeze({
  NONE: 'none',
  HTML_PREVIEW: 'html-preview',
  CSS_PREVIEW: 'css-preview',
  JS_RUNTIME: 'js-runtime',
  PYTHON_RUNTIME: 'python-runtime',
  JAVA_RUNTIME: 'java-runtime',
  C_COMPILER: 'c-compiler',
  CPP_COMPILER: 'cpp-compiler',
  NODE_RUNTIME: 'node-runtime',
  REACT_PREVIEW: 'react-preview',
  SQL_SANDBOX: 'sql-sandbox',
});

/** Languages a coding question / code editor can target. */
const PROGRAMMING_LANGUAGE = Object.freeze({
  JAVA: 'java',
  PYTHON: 'python',
  C: 'c',
  CPP: 'cpp',
  JAVASCRIPT: 'javascript',
  SQL: 'sql',
});

const PROGRAMMING_LANGUAGE_VALUES = Object.freeze(Object.values(PROGRAMMING_LANGUAGE));

const PRACTICE_TYPE = Object.freeze({
  THEORY: 'theory',
  CODING: 'coding',
  SCENARIO: 'scenario',
});

const ASSESSMENT_MODE = Object.freeze({
  SELF: 'self',
  RECRUITMENT: 'recruitment',
});

const ATTEMPT_STATUS = Object.freeze({
  IN_PROGRESS: 'in-progress',
  SUBMITTED: 'submitted',
  ABANDONED: 'abandoned',
});

const COMPANY_APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const OPPORTUNITY_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  FILLED: 'filled',
});

const APPLICATION_STATUS = Object.freeze({
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  IN_PROGRESS: 'in-progress',
  SELECTED: 'selected',
  REJECTED_FINAL: 'rejected-final',
});

const ROUND_TYPE = Object.freeze({
  MCQ: 'mcq',
  CODING: 'coding',
  TECHNICAL: 'technical',
  FACE_TO_FACE: 'face-to-face',
  VIDEO: 'video-interview',
  CUSTOM: 'custom-assessment',
});

const ROUND_TYPE_VALUES = Object.freeze(Object.values(ROUND_TYPE));

const ROUND_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const ROUND_RESULT = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  NEXT_ROUND: 'next-round',
});

const COMPLAINT_STATUS = Object.freeze({
  OPEN: 'open',
  IN_REVIEW: 'in-review',
  RESOLVED: 'resolved',
});

/** Concrete in-portal notification types (no external email, ever). */
const NOTIFICATION_TYPE = Object.freeze({
  // student
  OPPORTUNITY_RECEIVED: 'opportunity-received',
  OPPORTUNITY_ACCEPTED: 'opportunity-accepted',
  OPPORTUNITY_REJECTED: 'opportunity-rejected',
  ROUND_SCHEDULED: 'round-scheduled',
  ROUND_RESULT: 'round-result',
  COMPLAINT_STATUS_UPDATED: 'complaint-status-updated',
  ANNOUNCEMENT: 'announcement',
  // company
  COMPANY_APPROVED: 'company-approved',
  COMPANY_REJECTED: 'company-rejected',
  CANDIDATE_ACCEPTED: 'candidate-accepted',
  CANDIDATE_REJECTED: 'candidate-rejected',
  // admin
  COMPANY_REGISTRATION_PENDING: 'company-registration-pending',
  COMPLAINT_SUBMITTED: 'complaint-submitted',
});

const NOTIFICATION_TYPE_VALUES = Object.freeze(Object.values(NOTIFICATION_TYPE));

/** Notification audience keeps inbox routing deterministic. */
const NOTIFICATION_AUDIENCE = Object.freeze({
  [NOTIFICATION_TYPE.OPPORTUNITY_RECEIVED]: ROLES.STUDENT,
  [NOTIFICATION_TYPE.OPPORTUNITY_ACCEPTED]: ROLES.COMPANY,
  [NOTIFICATION_TYPE.OPPORTUNITY_REJECTED]: ROLES.COMPANY,
  [NOTIFICATION_TYPE.ROUND_SCHEDULED]: ROLES.STUDENT,
  [NOTIFICATION_TYPE.ROUND_RESULT]: ROLES.STUDENT,
  [NOTIFICATION_TYPE.COMPLAINT_STATUS_UPDATED]: null,
  [NOTIFICATION_TYPE.ANNOUNCEMENT]: null,
  [NOTIFICATION_TYPE.COMPANY_APPROVED]: ROLES.COMPANY,
  [NOTIFICATION_TYPE.COMPANY_REJECTED]: ROLES.COMPANY,
  [NOTIFICATION_TYPE.CANDIDATE_ACCEPTED]: ROLES.COMPANY,
  [NOTIFICATION_TYPE.CANDIDATE_REJECTED]: ROLES.COMPANY,
  [NOTIFICATION_TYPE.COMPANY_REGISTRATION_PENDING]: ROLES.ADMIN,
  [NOTIFICATION_TYPE.COMPLAINT_SUBMITTED]: ROLES.ADMIN,
});

const ACTIVITY_ACTION = Object.freeze({
  LESSON_COMPLETED: 'lesson-completed',
  PRACTICE_SUBMITTED: 'practice-submitted',
  CODING_SUBMITTED: 'coding-submitted',
  TEST_COMPLETED: 'test-completed',
  SKILL_UPDATED: 'skill-updated',
  DOMAIN_CHANGED: 'domain-changed',
  LOGIN: 'login',
  LOGOUT: 'logout',
  PROFILE_UPDATED: 'profile-updated',
  RESUME_UPLOADED: 'resume-uploaded',
  OPPORTUNITY_ACCEPTED: 'opportunity-accepted',
  OPPORTUNITY_REJECTED: 'opportunity-rejected',
  COMPLAINT_SUBMITTED: 'complaint-submitted',
  COMPANY_CREATED: 'company-created',
  COMPANY_APPROVED: 'company-approved',
  COMPANY_REJECTED: 'company-rejected',
  OPPORTUNITY_CREATED: 'opportunity-created',
  ROUND_CREATED: 'round-created',
  ADMIN_CREATED: 'admin-created',
  CONTENT_CREATED: 'content-created',
  CONTENT_UPDATED: 'content-updated',
  CONTENT_DELETED: 'content-deleted',
});

/** A lesson only counts as complete after genuine engagement. */
const LESSON_ENGAGEMENT = Object.freeze({
  MIN_TIME_ON_PAGE_SECONDS: 45,
  COMPLETION_QUIZ_PASS_RATIO: 0.6,
});

/** Default IANA timezone for streak day boundaries (user's local timezone). */
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

const THEMES = Object.freeze([
  'light',
  'dark',
  'midnight',
  'slate',
  'emerald',
  'royal',
  'sunset',
  'graphite',
]);

const TEST_SET_CONFIG = Object.freeze({
  DEFAULT_SET_COUNT: 10,
  DEFAULT_QUESTIONS_PER_SET: 10,
});

module.exports = {
  ROLES,
  ROLE_VALUES,
  DOMAIN_CATEGORY,
  SKILL_STATUS,
  SKILL_STATUS_VALUES,
  MANUAL_SKILL_STATUS_VALUES,
  SKILL_DIFFICULTY,
  SKILL_DIFFICULTY_VALUES,
  EXECUTION_TYPE,
  EXECUTION_TYPE_VALUES,
  PROGRAMMING_LANGUAGE,
  PROGRAMMING_LANGUAGE_VALUES,
  PRACTICE_TYPE,
  ASSESSMENT_MODE,
  ATTEMPT_STATUS,
  COMPANY_APPROVAL_STATUS,
  OPPORTUNITY_STATUS,
  APPLICATION_STATUS,
  ROUND_TYPE,
  ROUND_TYPE_VALUES,
  ROUND_STATUS,
  ROUND_RESULT,
  COMPLAINT_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_AUDIENCE,
  ACTIVITY_ACTION,
  LESSON_ENGAGEMENT,
  DEFAULT_TIMEZONE,
  PAGINATION,
  THEMES,
  TEST_SET_CONFIG,
};
