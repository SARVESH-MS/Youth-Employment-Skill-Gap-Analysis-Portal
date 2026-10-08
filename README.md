# YESGAP — Youth Employment Skill Gap Analysis Portal

YESGAP is a MERN platform for students, hiring companies, and administrators. It brings a shared career and skill catalog, learning and assessment progress, company candidate discovery, recruitment workflows, and in-portal notifications into one responsive workspace.

## Requirements

- Node.js 18 or newer and npm
- MongoDB 6 or newer, local or Atlas
- An isolated execution service only if code running is enabled (optional)

## Local development

From the repository root in PowerShell:

```powershell
npm install
Copy-Item .env.example server/.env
# Edit server/.env if MongoDB is not running locally or to change development credentials.
npm run seed
npm run dev
```

The Vite client is available at `http://localhost:5173`; the API is at `http://localhost:5000/api`. The API health endpoint is `http://localhost:5000/api/health`. `npm run dev` starts both processes. To run them separately, use `npm run dev:server` and `npm run dev:client` in separate terminals.

The default database is `mongodb://127.0.0.1:27017/youth_employment_sgap`. MongoDB must be running before the server or seed command starts. The development seed is repeatable. `npm run seed:fresh` deletes only YESGAP demo student, company, and secondary-admin records before recreating them; it does not remove the super-admin account or unrelated database records.

## Development demo accounts

These shared credentials are only for a local development database. Change them before sharing a development environment and never use them in production.

| Account | Username | Password |
| --- | --- | --- |
| Super administrator | `superadmin` | `ChangeMe!SuperAdmin#2026` |
| Administrator | `demo-admin-01` through `demo-admin-03` | `Demo@12345` |
| Student | `demo-student-001` through `demo-student-060` | `Demo@12345` |
| Approved company | `demo-company-001` through `demo-company-100` | `Demo@12345` |

The super-admin username, email, phone, and password are read from `INITIAL_ADMIN_*`. If you change those variables, use the configured username or email. Demo counts and the shared demo password are configurable with `SEED_STUDENT_COUNT`, `SEED_COMPANY_COUNT`, `SEED_ADMIN_COUNT`, and `SEED_DEMO_PASSWORD`.

## Product areas

- **Student:** profile and education, career domain selection, skill-gap and readiness views, roadmap, guided lessons and checkpoints, notes and bookmarks, practice questions, self-assessments, assessment results, opportunity responses, recruitment rounds, inbox, complaints, theme, and resume upload.
- **Company:** approval-gated hiring workspace, candidate discovery by domain and skill, opportunity management, invitations, student responses, staged recruitment and outcomes. Companies can schedule timed MCQ assessments or coding challenges after a candidate accepts. Candidate contact details and resumes are only revealed after the candidate accepts that company's opportunity.
- **Administrator:** company approvals, user status, domain and skill catalog management, domain-to-skill links, learning-module authoring, practice, coding and assessment question banks, complaints, announcements, notifications, activity, and audit views. Only the super administrator can approve companies or provision another administrator.
- **YESGAP AI assistant:** a floating, signed-in workspace chat for questions about YESGAP, its learning and hiring workflows, and related study topics. The API key stays on the server. Set `GEMINI_API_KEY` in `server/.env` to enable it; chat messages are sent to Google Gemini, and users should not enter passwords, API keys, resumes, or other sensitive information.

MongoDB is the source of truth for catalog, learning, progress, assessments, opportunities, recruitment, and portal messages. Resumes are stored in MongoDB GridFS. The seed includes 8 career domains and 20 skills. Every skill has 3 modules and 6 lessons, for 120 lessons across the catalog. Lessons include explanations, worked examples, real-world applications, practice exercises with model approaches, common pitfalls, and knowledge checkpoints. The path progresses from foundational topics into applied and professional practice; it is designed as a substantial learning foundation rather than a replacement for an entire reference book or formal course.

Each seeded skill has links to public, first-party learning references in its modules. YESGAP lessons, examples, exercises, and checkpoints remain in the portal; learners do not need to upload books or lesson files. To add references to existing modules without replacing instructor-edited references, run `npm run seed:references`. After changing authored curriculum, run `npm run seed:curriculum` to update seeded lessons while preserving existing lesson-progress records.

The AI assistant sends the current question and up to eight recent chat messages to Gemini through the server. YESGAP does not save chat history, and requests opt out of Gemini interaction storage. AI responses can be inaccurate; verify important information.

## Isolated code execution

Code execution is disabled by default. YESGAP does not run submitted source inside the Express server. To offer runnable challenges, deploy a separate sandbox service with CPU, memory, time, filesystem, network, output, and cleanup controls, then configure:

```dotenv
EXECUTION_ENABLED=true
EXECUTION_SERVICE_URL=https://your-isolated-runner.example/api/execute
EXECUTION_SERVICE_TOKEN=your-runner-service-token
```

The API sends a JSON `POST` with `sourceCode`, `language`, `executionType`, visible or all `testCases` depending on run/submit, and a `limits` object (`timeoutMs`, `cpuSeconds`, `memoryMb`, `maxOutputChars`). The runner should return JSON with `status` (`ok`, `compile_error`, `runtime_error`, `timeout`, `memory_limit`, or `internal`), `stdout`, `stderr`, `exitCode`, `durationMs`, and `results`; each result contains `actualOutput` and may contain a boolean `passed`. The API applies its own output limits and hides expected values for hidden cases. Coding recruitment rounds use the same question catalog and runner, are timed, and record the outcome in the candidate's recruitment results. A runner infrastructure error does not finalize a round. Production configuration requires an HTTPS runner URL and a runner token.

HTML/CSS preview uses a sandboxed browser iframe and is separate from server-side code execution.

## Production configuration

Create `server/.env` from `.env.example`, then set secure values for `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, the `INITIAL_ADMIN_*` bootstrap account, `CLIENT_URL`, and `CORS_ORIGIN`. Set `GEMINI_API_KEY` only if you want the assistant enabled. Generate secrets with a cryptographically secure random generator; use at least 32 characters. Set `NODE_ENV=production` and `SEED_DEMO_DATA=false`. Production startup rejects development secrets and demo seeding. Keep the API behind HTTPS and configure the frontend hosting origin in both `CLIENT_URL` and `CORS_ORIGIN`.

Build the frontend with `npm run build`; the deployable static files are written to `client/dist`. Start the API with `npm start` from the repository root or deploy the `server` workspace as a Node service.

## Project notes

- API routes are mounted under `/api`; session cookies are HTTP-only and refresh sessions are stored hashed in MongoDB.
- Public admin registration is not available.
- Email delivery and third-party identity providers are not configured. Portal notices and notifications remain in-app.
- Companies schedule coding challenges after a candidate accepts, when they can select a published problem for the matching skill.
- The implementation plan and persistence map are in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).
