# YESGAP Project Plan

## Product objective

Build YESGAP as a professional, responsive MERN platform for students, hiring
companies, and administrators. MongoDB is the single source of truth for the
shared domain and skill catalog, learning content, progress, assessments,
recruitment, complaints, and in-portal notifications. No external email service
is part of the design.

## Current workspace baseline

The workspace contains a substantial persistence scaffold: Mongoose models,
repositories, shared constants, environment configuration, and GridFS setup.
It does not yet contain an Express application/server, routes, controllers,
services, seed implementation, README, or any React application source. The
workspace also has no `.git` directory, so there is no commit history to use as
a continuation marker.

## Target folder structure

```text
docs/
  PROJECT_PLAN.md
server/
  src/
    app.js, server.js
    config/                 environment, MongoDB, constants
    middleware/             auth, role/approval gates, validation, errors
    models/                 MongoDB schemas and GridFS resume metadata
    repositories/           model-focused data access
    routes/                 versioned REST endpoints by product area
    controllers/            HTTP request/response boundaries
    services/               auth, skill gap, learning, assessment, recruitment,
                            notifications, admin, activity and progress rules
    seed/                   catalog, learning and development demo data
    utils/                  pagination, tokens, timezone, errors, logging
client/
  index.html, vite.config.js
  src/
    main.jsx, App.jsx
    api/                    authenticated API client
    app/                    routing, session and theme providers
    components/             shared accessible UI
    layouts/                public, student, company and admin shells
    features/               auth, dashboard, skills, learning, tests,
                            opportunities, recruitment, inbox and admin
    styles/                 design tokens, responsive styles, motion rules
README.md
.env.example
```

## Database schema and source of truth

The existing Mongoose models remain the canonical persistence layer. Collections
are linked by ObjectId references; derived numbers such as skill gap and
readiness are calculated from activity and stored only as snapshots where a
historical record is useful.

| Collection/model | Purpose and important relationships |
| --- | --- |
| `User` | One identity per student/company/admin; role, auth, profile, education, theme/timezone, company approval and hiring profile. Password hashes are never returned. |
| `RefreshToken` | Revocable refresh sessions owned by a user. |
| `Domain` | Dynamic career domain catalog. |
| `Skill` | The one shared skills catalog, including execution type, languages, about content and prerequisites. |
| `DomainSkill` | Unique many-to-many `(domain, skill)` link with required flag, weight and order. This link defines the domain skill-gap baseline. |
| `UserSkill` | Unique `(user, skill)` status and activity-derived progress. Source for known/in-progress/completed states. |
| `LearningModule` | Database-driven modules, topics, subtopics, examples, exercises, checkpoint questions, and optional official source references for a skill. |
| `LessonProgress` | Per-user engagement and completion for a learning unit. |
| `Annotation` | Per-user lesson bookmarks and notes. |
| `PracticeQuestion`, `CodingQuestion` | Reusable skill practice and language-specific coding prompts/solutions. |
| `QuestionBankItem`, `TestSet`, `TestAttempt` | Shared assessment bank, stable numbered sets, immutable attempt snapshots and result/integrity history; usable for self-tests and MCQ recruitment. |
| `CodingSubmission` | Code execution request/result metadata; execution must be delegated to an isolated runner. |
| `Opportunity`, `Application` | Company postings and student responses. Application acceptance is the gate for company-specific contact access. |
| `RecruitmentRound`, `RoundResult` | Flexible scheduled stages and recorded outcomes attached to an opportunity/application, including direct coding-question assignments and submissions. |
| `Notification` | In-portal inbox with explicit types, unread state and read timestamps. |
| `Complaint` | Student/company complaint and admin-managed open, in-review or resolved status. |
| `ActivityLog`, `AuditLog` | User activity and administrator/action audit history. |
| `Streak`, `ProgressSnapshot` | Timezone-aware activity streak history and explainable progress/readiness snapshots. |
| GridFS `resumes` bucket | Resume bytes inside MongoDB; `User.resume.fileId` stores metadata/reference. |

## Implementation phases

1. **Application foundation:** server bootstrap, validated production config,
   API error handling, security middleware, route versioning, React entry,
   design system, responsive shells, and a useful public landing/auth flow.
2. **Identity and access:** student/company registration, login by email/phone/
   username, session lifecycle, protected role routes, company pending/approved
   gates, environment-based initial admin, and no public admin signup.
3. **Student learning core:** editable profile/theme, resume GridFS flow, shared
   catalog, domain skill gap/roadmap, module learning, engagement-gated lesson
   completion, bookmarks/notes, practice and test history, dashboard, streaks.
4. **Hiring workflows:** company profile and candidate discovery with privacy
   filters, central-catalog required skills, opportunities, student accept/
   reject/withdraw, contact unlock on acceptance, flexible rounds and results.
5. **Admin operations:** approval queue, user/company/domain/skill/content
   management, complaints, in-portal announcements/notifications, admin
   provisioning by super admin, audit trail and analytics.
6. **Development/demo readiness:** repeatable idempotent seed command, realistic
   student/company/admin demo accounts, starter domain/skill/learning/test data,
   `.env.example`, setup/deployment notes and demo credentials in README.

Each phase is implemented in dependency order. Learning and question content is
stored in MongoDB and designed for expansion by admins. Official public sources
are indexed by skill in `server/src/seed/curriculum-sources.js`; lesson text,
examples and exercises are authored for YESGAP and presented inside the portal.
The seed corpus must be described honestly and grown through reviewed authoring
rather than represented as complete when it is not. Code execution is not
implemented inside Express; enabling real compilers requires a separately
isolated execution service.

## Product rules that govern implementation

- Companies only access student email, phone, and resume after that student
  accepts an opportunity from the same company.
- Company accounts stay pending until an admin approves them. Admin accounts
  cannot be publicly registered; super-admin provisioning is privileged.
- Required skills always reference `Skill` documents, never free-text names.
- Lesson completion, skill progress, readiness and streaks come from recorded
  platform activity; users cannot directly set completion percentages.
- Recruitment MCQ assessments reuse the same question-bank/attempt model as
  self-service assessments.
- Resumes are PDF/DOCX uploads stored through MongoDB GridFS with a size limit.
- Notifications and complaint communications stay inside the authenticated
  portal; no outbound email integration is added.
- Motion respects `prefers-reduced-motion`; routes/forms include loading,
  empty, error, keyboard and mobile-responsive states.
- Production startup rejects development secrets and demo seeding is disabled.

## Completion standard

For an implemented phase, a flow is complete only when its persistence,
authorization, server behavior, client interaction, and failure states exist.
The README will state any external infrastructure needed (MongoDB and an
isolated code runner) and any content scale that still requires authoring.
