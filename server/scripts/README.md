# Readiness test tools

`readiness-test-tools.js` is a local development utility for preparing one student's readiness fixtures. It has no HTTP route or UI entry.

## Required safeguards

The script reads `server/.env` and refuses to run unless both conditions are true and the MongoDB URI points only to `localhost`, `127.0.0.1`, or `::1`:

```text
NODE_ENV=development
ENABLE_READINESS_TEST_TOOLS=true
```

It performs database reads in dry-run mode by default. Add `--apply` to write. Each write stores a backup under the operating system's temporary directory at `yesgap-readiness-test-backups`. Restore backups in reverse order if you made several changes to the same student and skill.

## Commands

Run from the `server` directory:

```powershell
$env:NODE_ENV = 'development'
$env:ENABLE_READINESS_TEST_TOOLS = 'true'
npm run readiness:test-tools -- backdate-engagement --student demo-student-001 --skill html --days-ago 60
npm run readiness:test-tools -- backdate-engagement --student demo-student-001 --skill html --days-ago 60 --apply
npm run readiness:test-tools -- record-engagement --student demo-student-001 --skill html --apply
npm run readiness:test-tools -- set-state --student demo-student-001 --skill html --state verified --apply
npm run readiness:test-tools -- restore --backup "<backup-path>" --apply
Remove-Item Env:NODE_ENV
Remove-Item Env:ENABLE_READINESS_TEST_TOOLS
```

The student must have a selected domain, and the skill must be an active required skill in that domain. Backdating updates the engagement timestamp sources used by the readiness calculation for that student and skill, so historical lesson views, practice activity, assessment submissions, coding submissions, and completion/verification timestamps cannot make the fixture look newer than requested. A later genuine engagement remains newer and takes precedence.

The `record-engagement` command calls the production `ReadinessScoreService.recordSkillEngagement` method for the selected skill. The `set-state` command changes only `UserSkill.readinessState` and its `verifiedAt` timestamp. It leaves the legacy `status` and progress fields unchanged. This is a fixture shortcut; it does not create assessment evidence and cannot test assessment pass/fail behavior. Use the normal student assessment flow for those checks.

Each applied change prints a backup path. Preview restoration, then apply it:

```powershell
npm run readiness:test-tools -- restore --backup "<backup-path>"
npm run readiness:test-tools -- restore --backup "<backup-path>" --apply
```

The restore command preserves a newer timestamp if the student genuinely re-engaged after the fixture was applied. It refuses to overwrite other unexpected changes.

## Demand boundary checks

The demand multiplier calculation has focused tests for both required boundaries:

- No qualifying opportunity counts: every catalog skill receives neutral multiplier `1.0`.
- At least one qualifying opportunity exists: zero-count skills receive the configured minimum, and the highest-count skill receives the configured maximum.

Run them from `server`:

```powershell
npm run test:readiness-demand
```
