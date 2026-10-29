# YESGAP — Youth Employment Skill Gap Analysis Portal

YESGAP is a MERN platform for students, hiring companies, and administrators. It brings a shared career and skill catalog, learning and assessment progress, company candidate discovery, recruitment workflows, and in-portal notifications into one responsive workspace.

## Requirements

- Node.js 22 or newer and npm (Node.js 24 LTS is pinned in `.nvmrc`)
- A MongoDB Atlas cluster and database user
- An isolated execution service only if code running is enabled (optional)

## Local development

From the repository root in PowerShell:

```powershell
if (!(Test-Path .\server\.env)) { Copy-Item .\.env.example .\server\.env }
npm ci
# Set MONGODB_URI and development credentials in the ignored server/.env file.
npm run seed
npm run dev
```

The Vite client is available at `http://localhost:5173`; the API is at `http://localhost:5000/api`. `/api/health/ready` checks API and MongoDB readiness; `/api/health/live` is a process liveness probe. `npm run dev` starts both processes. To run them separately, use `npm run dev:server` and `npm run dev:client` in separate terminals.

MongoDB Atlas is the single source of truth for local development and deployment. All application models and services use the central `MONGODB_URI` setting; there are no per-feature database connections. Set it in `server/.env`; YESGAP refuses to start without an Atlas `mongodb+srv://` URI and does not fall back to a local database. Keep the URI private and out of Git. `npm run seed` writes to the configured Atlas database and preserves existing demo student profiles and learning history. `npm run seed:fresh` deletes demo student, company, and secondary-admin records, so do not use it on data you want to preserve.

To move an existing local database to Atlas once, set the Atlas URI in `server/.env` and run `npm run db:migrate:atlas`. The command leaves the local source unchanged, verifies document counts, maps references to an already existing matching admin account while preserving its Atlas password, and stops if it finds unexpected Atlas records. `LOCAL_MONGODB_URI` can select a non-default local source URI.

## Development demo accounts

These are shared demo credentials for development data in the configured Atlas database. Never use them for production accounts. `npm run seed` writes demo users to the same Atlas database used by local development and deployment.

| Account | Username | Password |
| --- | --- | --- |
| Super administrator | `superadmin` | `ChangeMe!SuperAdmin#2026` |
| Administrator | `demo-admin-01` through `demo-admin-03` | `Demo@12345` |
| Student | `demo-student-001` through `demo-student-060` | `Demo@12345` |
| Approved company | `demo-company-001` through `demo-company-100` | `Demo@12345` |

The super-admin username, email, phone, and password are read from `INITIAL_ADMIN_*`. If you change those variables, use the configured username or email. Demo counts and the shared demo password are configurable with `SEED_STUDENT_COUNT`, `SEED_COMPANY_COUNT`, `SEED_ADMIN_COUNT`, and `SEED_DEMO_PASSWORD`.

See [DEMO LOGIN CREDENTIALS.md](DEMO%20LOGIN%20CREDENTIALS.md) for the complete local account list and Windows setup steps.

## Product areas

- **Student:** profile and education, career domain selection, skill-gap and readiness views, roadmap, guided lessons and checkpoints, notes and bookmarks, practice questions, self-assessments, assessment results, opportunity responses, recruitment rounds, inbox, complaints, theme, and resume upload.
- **Company:** approval-gated hiring workspace, candidate discovery by domain and skill, opportunity management, invitations, student responses, staged recruitment and outcomes. Companies can schedule timed MCQ assessments or coding challenges after a candidate accepts. Candidate contact details and resumes are only revealed after the candidate accepts that company's opportunity.
- **Administrator:** company approvals, user status, domain and skill catalog management, domain-to-skill links, learning-module authoring, practice, coding and assessment question banks, complaints, announcements, notifications, activity, and audit views. Only the super administrator can approve companies or provision another administrator.
- **YESGAP AI assistant:** a floating, signed-in workspace chat for questions about YESGAP, its learning and hiring workflows, and related study topics. The API key stays on the server. Set `GEMINI_API_KEY` in `server/.env` to enable it; chat messages are sent to Google Gemini, and users should not enter passwords, API keys, resumes, or other sensitive information.

MongoDB is the source of truth for catalog, learning, progress, assessments, opportunities, recruitment, and portal messages. Resumes are stored in MongoDB GridFS. The seed includes 8 career domains and 20 skills. Every skill has 3 modules and 6 lessons, for 120 lessons across the catalog. Lessons include explanations, worked examples, real-world applications, practice exercises with model approaches, common pitfalls, and knowledge checkpoints. The path progresses from foundational topics into applied and professional practice; it is designed as a substantial learning foundation rather than a replacement for an entire reference book or formal course.

Each seeded skill has links to public, first-party learning references in its modules. YESGAP lessons, examples, exercises, and checkpoints remain in the portal; learners do not need to upload books or lesson files. To add references to existing modules without replacing instructor-edited references, run `npm run seed:references`. After changing authored curriculum, run `npm run seed:curriculum` to update seeded lessons while preserving existing lesson-progress records.

The AI assistant sends the current question and up to eight recent chat messages to Gemini through the server. YESGAP does not save chat history, and requests opt out of Gemini interaction storage. AI responses can be inaccurate; verify important information. The default model is `gemini-3.8-flash`; set `GEMINI_MODEL` to another available model if your Google AI Studio project requires it.

## Isolated code execution

YESGAP never runs submitted source inside the Express server. Challenge execution is disabled by default. Use a self-hosted Piston service or another compatible isolated runner. Piston executes each test input in its sandbox; expected answers stay in the API. The configured Piston runtimes support JavaScript, Python, Java, C, and C++. SQL exercises need a dedicated SQL sandbox.

For local Piston, start Docker and run `docker compose -f docker-compose.piston.yml up -d` from the repository root. Configure `server/.env`:

```dotenv
EXECUTION_ENABLED=true
EXECUTION_PROVIDER=piston
EXECUTION_SERVICE_URL=http://127.0.0.1:2000/api/v2/execute
```

For another compatible runner, use `EXECUTION_PROVIDER=custom`, set `EXECUTION_SERVICE_URL` and `EXECUTION_SERVICE_TOKEN`, and implement the YESGAP contract for source code, language, test inputs, resource limits, and actual outputs. Never return hidden expected answers. The API applies output limits, evaluates hidden cases itself, rate-limits student execution, and records submissions. Coding recruitment rounds use the same question catalog and runner. Production requires HTTPS runner URLs; custom runners also require a service token, and self-hosted Piston should only be reachable over a private service network.

HTML/CSS preview uses a sandboxed browser iframe and is separate from server-side code execution.

### Standalone compiler

The student Code Lab is a freeform compiler: it has no challenge statement or hidden test cases. Students can write a program, provide optional standard input, and run it in JavaScript, Python, Java, C, or C++. Execution is proxied by the API to a self-hosted Piston-compatible endpoint; arbitrary code is never evaluated by the YESGAP web server. Configure `COMPILER_SERVICE_URL` with the runner's `/api/v2/execute` URL and optionally `COMPILER_SERVICE_TOKEN`. Set the time and input/output limits with the `COMPILER_*` variables in `.env.example`. Piston accepts language/version, source files, stdin, and execution limits, then returns compile/run results; YESGAP adapts these to Code Lab and challenge submissions. See the [Piston API reference](https://github.com/engineer-man/piston/blob/master/docs/api-v2.md).

For local development, the Piston service binds to `127.0.0.1:2000`, disables job networking, and keeps installed runtimes in a Docker volume. Set `COMPILER_SERVICE_URL=http://127.0.0.1:2000/api/v2/execute`, restart the API, and install runtimes for every enabled language. The local setup includes Node.js 20.11.1, Python 3.12.0, Java 15.0.2, and GCC 10.2.0 (C/C++). To use this instance for challenge execution and recruitment rounds too, set `EXECUTION_ENABLED=true`, `EXECUTION_PROVIDER=piston`, and `EXECUTION_SERVICE_URL=http://127.0.0.1:2000/api/v2/execute`. A self-hosted instance avoids dependence on the public API, which currently requires authorization. See the [Piston setup guide](https://github.com/engineer-man/piston#readme).

## Production configuration

Create `server/.env` from `.env.example`, then set secure values for `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, the `INITIAL_ADMIN_*` bootstrap account, `CLIENT_URL`, and `CORS_ORIGIN`. Keep `SESSION_COOKIE_SAME_SITE=strict` for same-site deployments; use `none` only when the UI and API are truly cross-site and both use HTTPS. Set `GEMINI_API_KEY` only if you want the assistant enabled. Generate secrets with a cryptographically secure random generator; use at least 32 characters. Set `NODE_ENV=production` and `SEED_DEMO_DATA=false`. Production startup rejects development secrets and demo seeding. Keep the API behind HTTPS and configure the frontend hosting origin in both `CLIENT_URL` and `CORS_ORIGIN`.

Build the frontend with `npm run build`; the deployable static files are written to `client/dist`. Start the API with `npm start` from the repository root or deploy the `server` workspace as a Node service.

## Deploy on Render

The repository includes a Render Blueprint at `render.yaml`. It builds the React client and serves it from the Express service, so the website and API share one HTTPS origin. This keeps authentication cookies first-party and supports direct links to client-side routes.

1. Push the repository to GitHub. Do not commit `server/.env` or paste its contents into a public issue.
2. Use the existing MongoDB Atlas cluster and database user for this project; do not create a second cluster. After the Render service exists, open its **Connect → Outbound** panel and add the listed CIDR ranges to Atlas **Network Access**. Use that cluster's Atlas **Connect → Drivers** connection string for `MONGODB_URI`; URL-encode any reserved characters in its password. Render's outbound ranges are shared by services in the same region, so copy the ranges shown for this service rather than opening Atlas to every IP address. See Render's [Atlas guide](https://render.com/docs/connect-to-mongodb-atlas) and [outbound IP guide](https://render.com/docs/outbound-ip-addresses), plus MongoDB's [connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
3. In Render, create a new Blueprint and select this repository. Render reads `render.yaml`; provide the same Atlas URI used by local development and the five `INITIAL_ADMIN_*` values when prompted. Render generates the JWT and CSRF secrets. The web service deploys in Singapore.
4. Wait for the build and deployment, then open `https://<your-service>.onrender.com/api/health/ready`. A healthy response reports MongoDB as connected. Sign in with the initial administrator account and immediately change its password.

Use a unique admin email and username, a reachable phone number, and a unique password of at least 14 characters. Demo accounts are disabled in production. For a custom domain, set both `CLIENT_URL` and `CORS_ORIGIN` to that site's HTTPS origin in the Render service environment. Render's service URL is detected automatically when those variables are unset. The compiler and code execution remain disabled until a separate HTTPS isolated runner is configured. The Gemini assistant is optional; configure `GEMINI_API_KEY` in Render if you want to enable it. YESGAP sign-in uses email, phone, or username with a password.

Render setup references: [Blueprint configuration](https://render.com/docs/blueprint-spec), [Node.js version selection](https://render.com/docs/node-version), and [service environment variables](https://render.com/docs/environment-variables).

Run the server unit tests with `npm test`. GitHub Actions runs those tests and the client production build for pushes and pull requests.

## Project notes

- API routes are mounted under `/api`; session cookies are HTTP-only and refresh sessions are stored hashed in MongoDB.
- Public admin registration is not available.
- Outbound email and Google sign-in are not configured; users sign in with their YESGAP account credentials, and notices remain in-app.
- Companies schedule coding challenges after a candidate accepts, when they can select a published problem for the matching skill.
- The implementation plan and persistence map are in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).
