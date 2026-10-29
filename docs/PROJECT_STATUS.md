# YESGAP Project Status

Last reviewed: 28 October 2026

## Implemented

YESGAP is a working MERN application with a React/Vite client, Express API, and MongoDB/Mongoose persistence. The product includes:

- Student, company, and administrator accounts with role checks, session refresh/revocation, CSRF protection, company approval, profile settings, and resume storage in MongoDB GridFS.
- A shared career-domain/skill catalog, roadmap, skill-gap calculation, learning modules, checkpoints, notes, bookmarks, practice, assessments, activity, and progress history.
- A configurable career-readiness score using domain importance, evidence confidence, engagement freshness, and YESGAP opportunity demand. Its calculation reads history without writing per-user state; assessment results update verification when submitted.
- Company opportunity and candidate workflows, acceptance-gated contact details, MCQ and coding recruitment rounds, in-portal notifications, complaints, and admin operations.
- A Gemini assistant configured server-side and optional through `GEMINI_API_KEY`.
- Code Lab execution through a self-hosted Piston-compatible API, plus a Piston adapter for challenge and recruitment runs. Code runs inside the isolated Piston service, never in Express. SQL challenges need a separate SQL sandbox.
- A safe repeatable demo seed, an explicit `seed:fresh` reset, and CI jobs for server unit tests and the client production build.

## Learning content

The seed catalog covers 8 domains and 20 skills with 3 modules and 6 lessons per skill (60 modules and 120 lessons). Lessons include explanations, worked examples, applications, exercises, model approaches, common pitfalls, and checkpoints. Each skill has links to public, first-party references. The materials are a broad starter curriculum; additional subject-matter-reviewed lessons and practice banks are needed for a complete multi-year learning library.

## Current local infrastructure

- MongoDB is the application database. The default local URI is `mongodb://127.0.0.1:27017/youth_employment_sgap`.
- `docker-compose.piston.yml` starts a local Piston runtime on `127.0.0.1:2000` with job networking disabled and installed packages stored in a Docker volume.
- `COMPILER_SERVICE_URL` enables the Code Lab. To enable code challenges too, set `EXECUTION_ENABLED=true`, `EXECUTION_PROVIDER=piston`, and `EXECUTION_SERVICE_URL=http://127.0.0.1:2000/api/v2/execute` in `server/.env`, then restart the API.
- Health probes are `/api/health/live` for process liveness and `/api/health/ready` for MongoDB readiness.

## Remaining work before a public launch

- Choose hosting, a production MongoDB deployment, domains, HTTPS, backups, monitoring, and secret management.
- Configure production Piston or another isolated execution service. Provide a separate SQL sandbox if SQL challenge execution is required.
- Configure Google OAuth if desired. Outbound email is not implemented, so email verification and recovery flows need a selected mail provider and product decisions.
- Add browser end-to-end coverage for student, company, and administrator critical paths, plus accessibility review on representative screens.
- Expand and review lesson depth, question quality, and regional hiring content with educators and hiring partners.

The continuous-integration workflow and new readiness-focused tests are present, but the current working-tree changes still need a local test and production-build run before release.
