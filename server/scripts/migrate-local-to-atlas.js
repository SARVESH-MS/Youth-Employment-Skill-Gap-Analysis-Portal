'use strict';

/**
 * One-time, non-destructive migration of an existing local YESGAP database to
 * the configured MongoDB Atlas database. The source is never modified. The
 * destination may contain the matching bootstrap administrator and readiness
 * settings only; other existing application records stop the migration. The
 * local source is never modified. Documents are copied as BSON and indexes
 * missing from Atlas are created after the documents are copied.
 */

const mongoose = require('mongoose');
const { env } = require('../src/config/env');
const { isDeepStrictEqual } = require('node:util');

const localUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/youth_employment_sgap';
const connectionOptions = { serverSelectionTimeoutMS: 12000, maxPoolSize: 5 };

const fail = (message) => {
  throw new Error(message);
};

const countDocuments = async (db, collectionName) => db.collection(collectionName).countDocuments({});

const comparable = (value) => {
  if (value instanceof mongoose.Types.ObjectId) return { $oid: value.toHexString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') {
    if (value._bsontype) return { $bsonType: value._bsontype, $value: value.toString() };
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, comparable(value[key])]));
  }
  return value;
};

const remapObjectIds = (value, idMap) => {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof mongoose.Types.ObjectId) return idMap.get(value.toHexString()) || value;
  if (Array.isArray(value)) return value.map((item) => remapObjectIds(item, idMap));
  if (value._bsontype) return value;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapObjectIds(item, idMap)]));
};

const sameValue = (left, right) => {
  const normalize = (value) => typeof value === 'string' ? value.trim().toLowerCase() : value;
  return left !== undefined && left !== null && right !== undefined && right !== null
    && isDeepStrictEqual(normalize(left), normalize(right));
};

const syncIndexes = async (sourceCollection, targetCollection) => {
  const sourceIndexes = await sourceCollection.indexes();
  const targetIndexes = await targetCollection.indexes();
  let copied = 0;

  for (const index of sourceIndexes) {
    if (index.name === '_id_') continue;
    const existing = targetIndexes.find((candidate) => candidate.name === index.name);
    if (existing) {
      if (!isDeepStrictEqual(comparable(existing.key), comparable(index.key))
        || Boolean(existing.unique) !== Boolean(index.unique)
        || Boolean(existing.sparse) !== Boolean(index.sparse)) {
        fail(`An Atlas index conflicts with the local index definition for ${sourceCollection.collectionName}.`);
      }
      continue;
    }
    const { key, name, ns, v, background, ...options } = index;
    await targetCollection.createIndex(key, { name, ...options });
    copied += 1;
  }
  return copied;
};

const migrate = async () => {
  if (!env.db.uri.startsWith('mongodb+srv://')) {
    fail('MONGODB_URI must be set to a MongoDB Atlas mongodb+srv:// URI in server/.env.');
  }

  let source;
  let target;
  try {
    source = await mongoose.createConnection(localUri, connectionOptions).asPromise();
    target = await mongoose.createConnection(env.db.uri, connectionOptions).asPromise();

    const sourceCollections = await source.db.listCollections().toArray();
    const targetCollections = await target.db.listCollections().toArray();
    if (sourceCollections.length === 0) fail('The local source database has no collections to migrate.');
    if (sourceCollections.some((collection) => collection.type !== 'collection')) {
      fail('The local database contains a non-collection object; migration stopped without copying data.');
    }
    let sourceDocumentTotal = 0;
    for (const info of sourceCollections) {
      sourceDocumentTotal += await countDocuments(source.db, info.name);
    }
    if (sourceDocumentTotal === 0) fail('The local source database contains no documents to migrate.');

    const sourceNames = new Set(sourceCollections.map((collection) => collection.name));
    const targetDocumentCounts = new Map();
    for (const info of targetCollections) {
      const count = await countDocuments(target.db, info.name);
      targetDocumentCounts.set(info.name, count);
      if (count > 0 && !sourceNames.has(info.name)) {
        fail('Atlas contains records outside the local source database. Migration stopped to protect them.');
      }
    }

    const localUsers = await source.db.collection('users').find({}).toArray();
    const atlasUsers = await target.db.collection('users').find({}).toArray();
    const userIdMap = new Map();
    const skippedLocalUserIds = new Set();
    const mutableAccountFields = new Set(['_id', 'createdAt', 'lastLoginAt', 'passwordHash', 'updatedAt']);
    for (const atlasUser of atlasUsers) {
      const conflictingLocalUsers = localUsers.filter((localUser) =>
        ['email', 'username', 'phone', 'googleId'].some((field) => sameValue(localUser[field], atlasUser[field])));
      if (conflictingLocalUsers.length === 0) continue;
      if (conflictingLocalUsers.length !== 1) {
        fail('An Atlas account conflicts with multiple local users. Migration stopped to protect account data.');
      }

      const localUser = conflictingLocalUsers[0];
      const sameIdentity = ['email', 'username', 'phone'].every((field) => sameValue(localUser[field], atlasUser[field]));
      const localComparable = Object.fromEntries(Object.entries(localUser).filter(([key]) => !mutableAccountFields.has(key)));
      const atlasComparable = Object.fromEntries(Object.entries(atlasUser).filter(([key]) => !mutableAccountFields.has(key)));
      if (!sameIdentity || localUser.role !== atlasUser.role
        || !isDeepStrictEqual(comparable(localComparable), comparable(atlasComparable))) {
        fail('An Atlas account has different identity or profile data from a local account. Migration stopped to protect it.');
      }

      userIdMap.set(localUser._id.toHexString(), atlasUser._id);
      skippedLocalUserIds.add(localUser._id.toHexString());
    }

    const localSettings = await source.db.collection('readinesssettings').find({}).toArray();
    const atlasSettings = await target.db.collection('readinesssettings').find({}).toArray();
    const settingsPairs = [];
    for (const atlasSetting of atlasSettings) {
      const matches = localSettings.filter((localSetting) => sameValue(localSetting.key, atlasSetting.key));
      if (matches.length > 1) fail('Local readiness settings contain duplicate keys. Migration stopped.');
      if (matches.length === 1) settingsPairs.push({ local: matches[0], atlas: atlasSetting });
    }

    const allowedExistingRecords = new Set(['users', 'readinesssettings']);
    for (const [name, count] of targetDocumentCounts) {
      if (count > 0 && !allowedExistingRecords.has(name)) {
        fail('Atlas contains application records that require reconciliation. Migration stopped to protect them.');
      }
    }
    if (atlasUsers.length > 0 && (atlasUsers.length !== skippedLocalUserIds.size || skippedLocalUserIds.size === 0)) {
      fail('Atlas contains unmatched user records. Migration stopped to protect account data.');
    }
    if (atlasSettings.length > 0 && settingsPairs.length !== atlasSettings.length) {
      fail('Atlas contains readiness settings that do not match the local source. Migration stopped to protect them.');
    }

    const skippedSettingsIds = new Set(settingsPairs.map(({ local }) => local._id.toString()));
    const initialTargetCounts = new Map(targetDocumentCounts);

    let copiedDocumentTotal = 0;
    let copiedIndexTotal = 0;
    for (const info of sourceCollections) {
      const sourceCollection = source.db.collection(info.name);
      let targetCollection;
      if (targetCollections.some((collection) => collection.name === info.name)) {
        targetCollection = target.db.collection(info.name);
      } else {
        targetCollection = await target.db.createCollection(info.name);
      }

      if (info.name === 'readinesssettings') {
        for (const { local, atlas } of settingsPairs) {
          await targetCollection.replaceOne({ _id: atlas._id }, { ...local, _id: atlas._id });
        }
      }

      const cursor = sourceCollection.find({}).batchSize(250);
      let batch = [];

      while (await cursor.hasNext()) {
        const document = await cursor.next();
        if (info.name === 'users' && skippedLocalUserIds.has(document._id.toHexString())) continue;
        if (info.name === 'readinesssettings' && skippedSettingsIds.has(document._id.toString())) continue;
        batch.push(remapObjectIds(document, userIdMap));
        if (batch.length === 250) {
          await targetCollection.insertMany(batch, { ordered: true });
          copiedDocumentTotal += batch.length;
          batch = [];
        }
      }
      if (batch.length > 0) {
        await targetCollection.insertMany(batch, { ordered: true });
        copiedDocumentTotal += batch.length;
      }

      copiedIndexTotal += await syncIndexes(sourceCollection, targetCollection);
    }

    let verifiedDocumentTotal = 0;
    for (const info of sourceCollections) {
      const sourceCount = await countDocuments(source.db, info.name);
      const targetCount = await countDocuments(target.db, info.name);
      const skippedCount = (info.name === 'users' ? skippedLocalUserIds.size : 0)
        + (info.name === 'readinesssettings' ? skippedSettingsIds.size : 0);
      const expectedCount = (initialTargetCounts.get(info.name) || 0) + sourceCount - skippedCount;
      if (expectedCount !== targetCount) {
        fail('Atlas document count verification failed after migration.');
      }
      verifiedDocumentTotal += targetCount;
    }

    const skippedTotal = skippedLocalUserIds.size + skippedSettingsIds.size;

    // eslint-disable-next-line no-console
    console.log(`Atlas migration complete: ${sourceCollections.length} local collections processed; ${sourceDocumentTotal} local documents accounted for; ${verifiedDocumentTotal} Atlas documents verified; ${copiedIndexTotal} indexes created; ${skippedTotal} matching records merged safely.`);
  } finally {
    if (source) await source.close();
    if (target) await target.close();
  }
};

migrate().catch((error) => {
  // eslint-disable-next-line no-console
  const safeMessage = String(error.message || 'Unknown error').replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[MongoDB URI redacted]');
  console.error(`Atlas migration stopped: ${safeMessage}`);
  process.exitCode = 1;
});
