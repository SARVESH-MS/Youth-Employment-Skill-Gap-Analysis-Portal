'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BACKUP_DIR = path.join(os.tmpdir(), 'yesgap-readiness-test-backups');
const READINESS_STATES = new Set(['missing', 'in-progress', 'completed', 'verified']);

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

const parseArgs = (argv) => {
  const [command, ...parts] = argv;
  const options = {};
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === '--help' || part === '-h') {
      options.help = true;
      continue;
    }
    if (part === '--apply') {
      options.apply = true;
      continue;
    }
    if (!part.startsWith('--')) throw new Error(`Unexpected argument: ${part}`);
    const [rawKey, inlineValue] = part.slice(2).split('=', 2);
    if (!rawKey || rawKey === 'apply') throw new Error(`Invalid option: ${part}`);
    const value = inlineValue === undefined ? parts[++index] : inlineValue;
    if (!value || value.startsWith('--')) throw new Error(`Option --${rawKey} needs a value`);
    if (Object.hasOwn(options, rawKey)) throw new Error(`Option --${rawKey} was provided more than once`);
    options[rawKey] = value;
  }
  return { command, options };
};

const usage = () => [
  'Usage:',
  '  node scripts/readiness-test-tools.js backdate-engagement --student <username-or-email> --skill <slug-or-id> --days-ago <integer> [--apply]',
  '  node scripts/readiness-test-tools.js record-engagement --student <username-or-email> --skill <slug-or-id> [--apply]',
  '  node scripts/readiness-test-tools.js set-state --student <username-or-email> --skill <slug-or-id> --state <missing|in-progress|completed|verified> [--apply]',
  '  node scripts/readiness-test-tools.js restore --backup <backup-file> --apply',
  '',
  'Writes require NODE_ENV=development, ENABLE_READINESS_TEST_TOOLS=true, and --apply.',
].join('\n');

const assertEnvironment = () => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to run: NODE_ENV must be exactly "development".');
  }
  if (process.env.ENABLE_READINESS_TEST_TOOLS !== 'true') {
    throw new Error('Refusing to run: ENABLE_READINESS_TEST_TOOLS must be exactly "true".');
  }
};

const assertLocalDatabase = (uri) => {
  const authority = String(uri).match(/^mongodb(?:\+srv)?:\/\/([^/]+)/i)?.[1]?.split('?')[0];
  if (!authority) throw new Error('Refusing to run: the configured MongoDB URI could not be verified as local.');
  const hosts = authority.split('@').pop().split(',').map((entry) => {
    const host = entry.trim().startsWith('[') ? entry.trim().slice(1).split(']')[0] : entry.trim().split(':')[0];
    return host.toLowerCase();
  });
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!hosts.length || hosts.some((host) => !localHosts.has(host))) {
    throw new Error('Refusing to run: readiness fixtures may only target a localhost MongoDB database.');
  }
};

const readBackup = (backupFile) => {
  const resolvedBackupDir = path.resolve(BACKUP_DIR) + path.sep;
  const resolvedFile = path.resolve(backupFile);
  if (!resolvedFile.startsWith(resolvedBackupDir)) {
    throw new Error(`Backup must be inside ${BACKUP_DIR}`);
  }
  const backup = JSON.parse(fs.readFileSync(resolvedFile, 'utf8'));
  if (backup.version !== 2 || !['engagement', 'engagement-touch', 'readiness-state'].includes(backup.kind)) {
    throw new Error('Unsupported or invalid readiness test backup.');
  }
  return { backup, resolvedFile };
};

const writeBackup = (backup) => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`);
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporaryFile, file);
  return file;
};

const snapshotDocuments = (documents, fields) => documents.map((document) => ({
  id: String(document._id),
  fields: Object.fromEntries(fields.map((field) => [
    field,
    document[field] instanceof Date ? document[field].toISOString() : null,
  ])),
  changedFields: fields.filter((field) => document[field] instanceof Date),
}));

const applyTimestampSnapshots = async (collection, snapshots, appliedAt) => {
  const operations = snapshots.filter((snapshot) => snapshot.changedFields.length).map((snapshot) => ({
    updateOne: {
      filter: { _id: require('mongoose').Types.ObjectId.createFromHexString(snapshot.id) },
      update: { $set: Object.fromEntries(snapshot.changedFields.map((field) => [field, appliedAt])) },
    },
  }));
  if (operations.length) await collection.bulkWrite(operations, { ordered: true });
};

const restoreTimestampSnapshots = async (collection, snapshots, appliedAt, writeRequested) => {
  const operations = [];
  let preservedNewer = 0;
  for (const snapshot of snapshots) {
    const id = require('mongoose').Types.ObjectId.createFromHexString(snapshot.id);
    const current = await collection.findOne({ _id: id });
    if (!current) continue;
    const set = {};
    const unset = {};
    for (const field of snapshot.changedFields) {
      const currentDate = current[field] instanceof Date ? current[field].getTime() : null;
      const appliedTime = new Date(appliedAt).getTime();
      if (currentDate === appliedTime) {
        const beforeValue = snapshot.fields[field];
        if (beforeValue === null) unset[field] = 1;
        else set[field] = new Date(beforeValue);
      } else if (currentDate !== null && currentDate > appliedTime) {
        preservedNewer += 1;
      } else {
        throw new Error(`Refusing to restore ${field} on ${snapshot.id}: it changed after fixture setup.`);
      }
    }
    if (Object.keys(set).length || Object.keys(unset).length) operations.push({ updateOne: { filter: { _id: id }, update: { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) } } });
  }
  if (writeRequested && operations.length) await collection.bulkWrite(operations, { ordered: true });
  return { restored: operations.length, preservedNewer };
};

const main = async () => {
  if (process.argv[2] === '--help' || process.argv[2] === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  assertEnvironment();
  const writeRequested = options.apply === true;

  const mongoose = require('mongoose');
  const env = require('../src/config/env').env;
  assertLocalDatabase(env.db.uri);
  const connectDB = require('../src/config/db').connectDB;
  const { ActivityLog, CodingSubmission, DomainSkill, LessonProgress, Skill, SkillEngagement, TestAttempt, User, UserSkill } = require('../src/models');

  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  console.log = (...args) => {
    if (String(args[0] || '').startsWith('[db]')) return;
    originalConsoleLog.apply(console, args);
  };
  console.warn = (...args) => {
    if (String(args[0] || '').startsWith('[db]')) return;
    originalConsoleWarn.apply(console, args);
  };

  try {
    await connectDB();
    if (command === 'restore') {
      if (!options.backup) throw new Error(`--backup is required.\n${usage()}`);
      const { backup, resolvedFile } = readBackup(options.backup);
      const user = await User.findById(backup.userId).select('username role');
      const skill = await Skill.findById(backup.skillId).select('name slug');
      if (!user || user.role !== 'student' || !skill) throw new Error('The backed-up student or skill no longer exists.');

      if (['engagement', 'engagement-touch'].includes(backup.kind)) {
        const current = await SkillEngagement.findOne({ user: backup.userId, skill: backup.skillId }).lean();
        let engagementAction = 'already removed';
        let engagementRestore = null;
        if (current) {
          const currentAt = new Date(current.lastEngagedAt).getTime();
          const appliedAt = new Date(backup.appliedAt).getTime();
          if (currentAt === appliedAt) {
            engagementAction = backup.beforeSkillEngagement
              ? `restore to ${backup.beforeSkillEngagement.lastEngagedAt}`
              : 'remove the inserted test record';
            engagementRestore = { currentId: current._id, before: backup.beforeSkillEngagement };
          } else if (currentAt > appliedAt) {
            engagementAction = 'preserve newer engagement';
          } else {
            throw new Error('Engagement changed after this fixture was applied; restore refused to overwrite the value.');
          }
        }
        const sourceModels = { lessonProgress: LessonProgress, activityLogs: ActivityLog, testAttempts: TestAttempt, codingSubmissions: CodingSubmission, userSkillTimestamps: UserSkill };
        const restoreResults = {};
        for (const [source, snapshots] of Object.entries(backup.sources)) {
          if (source === 'skillEngagement' || !snapshots.length) continue;
          const model = sourceModels[source];
          if (!model) throw new Error(`Unknown timestamp source in backup: ${source}`);
          restoreResults[source] = await restoreTimestampSnapshots(model.collection, snapshots, backup.appliedAt, false);
        }
        if (!writeRequested) {
          process.stdout.write(`Dry run: ${engagementAction} for ${user.username} / ${skill.name} engagement.\n`);
        } else {
          if (engagementRestore?.before) {
            await SkillEngagement.collection.updateOne(
              { _id: engagementRestore.currentId },
              { $set: { lastEngagedAt: new Date(engagementRestore.before.lastEngagedAt) } },
            );
          } else if (engagementRestore) {
            await SkillEngagement.deleteOne({ _id: engagementRestore.currentId });
          }
          for (const [source, snapshots] of Object.entries(backup.sources)) {
            if (source === 'skillEngagement' || !snapshots.length) continue;
            const model = sourceModels[source];
            restoreResults[source] = await restoreTimestampSnapshots(model.collection, snapshots, backup.appliedAt, true);
          }
        }
        if (writeRequested) {
          const restoredCount = Object.values(restoreResults).reduce((total, result) => total + result.restored, 0);
          const preservedCount = Object.values(restoreResults).reduce((total, result) => total + result.preservedNewer, 0);
          process.stdout.write(`Restored ${restoredCount} timestamp source record(s); preserved ${preservedCount} newer timestamp(s).\n`);
        }
      } else {
        const current = await UserSkill.findOne({ user: backup.userId, skill: backup.skillId }).lean();
        const currentMatches = Boolean(current)
          && current.readinessState === backup.appliedState
          && ((current.verifiedAt ? new Date(current.verifiedAt).getTime() : null) === (backup.appliedVerifiedAt ? new Date(backup.appliedVerifiedAt).getTime() : null));
        if (!currentMatches) throw new Error('Readiness state changed after this fixture was applied; restore refused to overwrite the newer value.');
        if (!writeRequested) {
          process.stdout.write(`Dry run: restore ${user.username} / ${skill.name} readiness state to ${backup.beforeState || 'unset'}\n`);
        } else {
          const update = {};
          if (backup.beforeState === null) update.$unset = { readinessState: 1 };
          else update.$set = { readinessState: backup.beforeState };
          if (backup.beforeVerifiedAt === null) update.$unset = { ...(update.$unset || {}), verifiedAt: 1 };
          else update.$set = { ...(update.$set || {}), verifiedAt: backup.beforeVerifiedAt };
          await UserSkill.updateOne({ user: backup.userId, skill: backup.skillId }, update);
          if (backup.createdUserSkill) await UserSkill.deleteOne({ user: backup.userId, skill: backup.skillId });
        }
      }

      if (writeRequested) {
        fs.unlinkSync(resolvedFile);
        process.stdout.write(`Restored fixture for ${user.username} / ${skill.name}.\n`);
      }
      return;
    }

    if (!['backdate-engagement', 'record-engagement', 'set-state'].includes(command)) {
      throw new Error(`Unknown command: ${command}\n${usage()}`);
    }
    if (!options.student || !options.skill) throw new Error(`Both --student and --skill are required.\n${usage()}`);

    const studentKey = String(options.student).trim().toLowerCase();
    const student = await User.findOne({ role: 'student', $or: [{ username: studentKey }, { email: studentKey }] }).select('_id username role careerDomain');
    if (!student) throw new Error('Student not found. Supply a student username or email.');
    if (!student.careerDomain) throw new Error(`${student.username} has no selected career domain.`);

    const skillKey = String(options.skill).trim().toLowerCase();
    const skillQuery = [{ slug: skillKey }];
    if (mongoose.isValidObjectId(skillKey)) skillQuery.push({ _id: skillKey });
    const skill = await Skill.findOne({ $or: skillQuery }).select('_id name slug isActive');
    if (!skill || !skill.isActive) throw new Error('Active catalog skill not found. Supply its slug or ID.');
    const domainLink = await DomainSkill.findOne({ domain: student.careerDomain, skill: skill._id, required: true }).select('_id');
    if (!domainLink) throw new Error(`${skill.name} is not a required skill in ${student.username}'s selected domain.`);

    if (command === 'backdate-engagement') {
      const daysAgo = Number(options['days-ago']);
      if (!Number.isInteger(daysAgo) || daysAgo < 0 || daysAgo > 36500) throw new Error('--days-ago must be an integer between 0 and 36500.');
      const activityActions = ['practice-submitted', 'coding-submitted', 'test-completed', 'lesson-completed'];
      const [beforeEngagement, lessonRows, activityRows, attemptRows, codingRows, userSkillRow] = await Promise.all([
        SkillEngagement.findOne({ user: student._id, skill: skill._id }).lean(),
        LessonProgress.find({ user: student._id, skill: skill._id, lastViewedAt: { $ne: null } }).select('lastViewedAt').lean(),
        ActivityLog.find({ user: student._id, skill: skill._id, action: { $in: activityActions } }).select('createdAt').lean(),
        TestAttempt.find({ user: student._id, skill: skill._id, status: 'submitted' }).select('submittedAt').lean(),
        CodingSubmission.find({ user: student._id, skill: skill._id, kind: 'submit' }).select('createdAt updatedAt').lean(),
        UserSkill.findOne({ user: student._id, skill: skill._id }).select('completedAt verifiedAt').lean(),
      ]);
      const appliedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const backup = {
        version: 2, kind: 'engagement', createdAt: new Date().toISOString(), userId: String(student._id), skillId: String(skill._id),
        beforeSkillEngagement: beforeEngagement ? { lastEngagedAt: new Date(beforeEngagement.lastEngagedAt).toISOString() } : null,
        sources: {
          skillEngagement: beforeEngagement ? { lastEngagedAt: new Date(beforeEngagement.lastEngagedAt).toISOString() } : null,
          lessonProgress: snapshotDocuments(lessonRows, ['lastViewedAt']),
          activityLogs: snapshotDocuments(activityRows, ['createdAt']),
          testAttempts: snapshotDocuments(attemptRows, ['submittedAt']),
          codingSubmissions: snapshotDocuments(codingRows, ['createdAt', 'updatedAt']),
          userSkillTimestamps: snapshotDocuments(userSkillRow ? [userSkillRow] : [], ['completedAt', 'verifiedAt']),
        },
        appliedAt: appliedAt.toISOString(),
      };
      const touchedRows = Object.entries(backup.sources).reduce((sum, [source, rows]) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
      process.stdout.write(`${writeRequested ? 'Apply' : 'Dry run'}: backdate all ${touchedRows} engagement history row(s) for ${student.username} / ${skill.name} to ${appliedAt.toISOString()} (${daysAgo} days ago).\n`);
      if (writeRequested) {
        const backupFile = writeBackup(backup);
        await SkillEngagement.collection.updateOne(
          { user: student._id, skill: skill._id },
          { $set: { lastEngagedAt: appliedAt }, $setOnInsert: { user: student._id, skill: skill._id } },
          { upsert: true },
        );
        await applyTimestampSnapshots(LessonProgress.collection, backup.sources.lessonProgress, appliedAt);
        await applyTimestampSnapshots(ActivityLog.collection, backup.sources.activityLogs, appliedAt);
        await applyTimestampSnapshots(TestAttempt.collection, backup.sources.testAttempts, appliedAt);
        await applyTimestampSnapshots(CodingSubmission.collection, backup.sources.codingSubmissions, appliedAt);
        await applyTimestampSnapshots(UserSkill.collection, backup.sources.userSkillTimestamps, appliedAt);
        process.stdout.write(`Applied. Restore with: node scripts/readiness-test-tools.js restore --backup "${backupFile}" --apply\n`);
      }
      return;
    }

    if (command === 'record-engagement') {
      const before = await SkillEngagement.findOne({ user: student._id, skill: skill._id }).lean();
      const appliedAt = new Date();
      const backup = {
        version: 2, kind: 'engagement-touch', createdAt: new Date().toISOString(), userId: String(student._id), skillId: String(skill._id),
        beforeSkillEngagement: before ? { lastEngagedAt: new Date(before.lastEngagedAt).toISOString() } : null,
        sources: { skillEngagement: before ? { lastEngagedAt: new Date(before.lastEngagedAt).toISOString() } : null },
        appliedAt: appliedAt.toISOString(),
      };
      process.stdout.write(`${writeRequested ? 'Apply' : 'Dry run'}: record a skill-engagement event for ${student.username} / ${skill.name} at ${appliedAt.toISOString()}.\n`);
      if (writeRequested) {
        const backupFile = writeBackup(backup);
        await require('../src/services/readinessScore.service').recordSkillEngagement(student._id, skill._id, appliedAt);
        process.stdout.write(`Applied through ReadinessScoreService. Restore with: node scripts/readiness-test-tools.js restore --backup "${backupFile}" --apply\n`);
      }
      return;
    }

    const nextState = String(options.state || '');
    if (!READINESS_STATES.has(nextState)) throw new Error('--state must be missing, in-progress, completed, or verified.');
    const before = await UserSkill.findOne({ user: student._id, skill: skill._id }).lean();
    const appliedVerifiedAt = nextState === 'verified' ? new Date() : null;
    const backup = {
      version: 2, kind: 'readiness-state', createdAt: new Date().toISOString(), userId: String(student._id), skillId: String(skill._id),
      beforeState: before?.readinessState ?? null,
      beforeVerifiedAt: before?.verifiedAt ? new Date(before.verifiedAt).toISOString() : null,
      createdUserSkill: !before,
      appliedState: nextState,
      appliedVerifiedAt: appliedVerifiedAt?.toISOString() || null,
    };
    process.stdout.write(`${writeRequested ? 'Apply' : 'Dry run'}: set ${student.username} / ${skill.name} readiness state to ${nextState}; legacy status and progress are unchanged.\n`);
    if (writeRequested) {
      const backupFile = writeBackup(backup);
      const update = {
        $set: { readinessState: nextState, ...(appliedVerifiedAt ? { verifiedAt: appliedVerifiedAt } : {}) },
        $setOnInsert: { user: student._id, skill: skill._id },
      };
      if (!appliedVerifiedAt) update.$unset = { verifiedAt: 1 };
      await UserSkill.findOneAndUpdate({ user: student._id, skill: skill._id }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
      process.stdout.write(`Applied. Restore with: node scripts/readiness-test-tools.js restore --backup "${backupFile}" --apply\n`);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  }
};

main().catch((error) => {
  fail(error.message);
});
