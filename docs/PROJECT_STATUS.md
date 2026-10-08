# YESGAP Project Status

## Implemented

The repository now runs as a React/Vite client and an Express/Mongoose API against one MongoDB database.

- Account registration for students and companies, role-based sign-in, session refresh/revocation, company approval gates, password changes, and profile settings.
- Shared dynamic career-domain/skill catalog, mapped domain requirements, readiness and skill-gap calculations, student dashboard and roadmap.
- Learning modules with subtopics, examples, checkpoint questions, engagement-based completion, bookmarks, and personal notes.
- Official public documentation references mapped to all 20 catalog skills and displayed as optional further reading; core learning material remains inside YESGAP.
- Scenario practice and question-bank assessments with stored attempts, timed rounds, score breakdowns, weak-topic summaries, and integrity events.
- Isolated coding practice with language-specific starter code, safe public/hidden-case result shaping, contextual editor suggestions, and a runner service contract.
- Skill-based candidate search, company opportunity posts, invitations, student responses, contact unlock after acceptance, flexible MCQ/interview stages, timed coding recruitment challenges, recorded outcomes, in-app inbox, and complaints.
- Admin dashboards and CRUD for domains, skills, domain links, learning modules, practice/coding/assessment banks, company approvals, accounts, complaints, announcements, and audit/activity views.
- Resume upload/download through MongoDB GridFS with PDF/DOCX type and size controls.
- A signed-in floating YESGAP assistant backed by Gemini, with server-only API-key configuration, per-user rate limiting, short in-memory chat history, and no saved profile, progress, or contact data sent to the model.
- A development seed, responsive multi-role workspaces, theme options, loading/error/empty states, and reduced-motion CSS.

## Current source layout

```text
docs/                    plan and implementation status
server/src/config/       MongoDB, environment, constants
server/src/middleware/   authentication and errors
server/src/models/        Mongoose schemas
server/src/repositories/  data access
server/src/routes/        auth, platform and admin APIs
server/src/services/      sessions, progress, skill gap, activity, notices
server/src/seed/          catalog and demo records
server/src/utils/         token, date, logging and API helpers
client/src/api/           HTTP client
client/src/app/           auth/session context
client/src/components/    shared UI
client/src/pages/         public, role workspace and learning pages
```

## Required external inputs for the full product vision

- Public source material is available and no files are needed from the user. All seeded skill modules link to official or first-party references, and `npm run seed:references` safely fills missing links in an existing database without overwriting instructor-edited links. The seed corpus is still starter content (8 domains, 20 skills, 60 modules and sample practice/assessment questions); full curriculum depth requires continued original lesson authoring and subject-matter review.
- The isolated compiler/runtime is intentionally not included. Practice and recruitment code execution require a separately hosted sandbox endpoint and token. Execution stays off until configured; a real candidate coding round cannot be completed until that service is connected.
- No outbound email or social login is configured. Gemini chat is optional and requires `GEMINI_API_KEY`; career readiness calculations remain native to the application, with no external recommendation service.

## Local readiness

The development database `youth_employment_sgap` has been seeded with 60 students, 100 approved demo companies, and 4 admins. All 65 backend JavaScript files pass `node --check`; the production client build completes and separates the learning/editor route, editor languages and parsers, charts, and motion dependencies into chunks. `npm audit --omit=dev` reports no production dependency vulnerabilities. Visual browser review could not be performed in this environment because no browser connection was available.
