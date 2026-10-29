'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readinessScoreService = require('../src/services/readinessScore.service');

const settings = {
  freshness: { graceDays: 30, decayDurationDays: 120, decayFloor: 0.5 },
};

test('maps legacy skill status to a conservative readiness state', () => {
  assert.equal(readinessScoreService.normalizeState({ status: 'known' }, false), 'in-progress');
  assert.equal(readinessScoreService.normalizeState({ status: 'completed' }, false), 'completed');
  assert.equal(readinessScoreService.normalizeState({ status: 'missing' }, false), 'missing');
  assert.equal(readinessScoreService.normalizeState({ status: 'missing' }, true), 'verified');
  assert.equal(readinessScoreService.normalizeState({ verifiedAt: new Date() }, false), 'verified');
});

test('keeps freshness neutral through the grace period and decays linearly to the floor', () => {
  const now = new Date('2026-10-28T00:00:00.000Z');
  const dateAtDaysAgo = (days) => new Date(now.getTime() - days * 86_400_000);

  assert.deepEqual(readinessScoreService.freshnessFactor(dateAtDaysAgo(30), now, settings), { factor: 1, inactiveDays: 30 });
  assert.deepEqual(readinessScoreService.freshnessFactor(dateAtDaysAgo(90), now, settings), { factor: 0.75, inactiveDays: 90 });
  assert.deepEqual(readinessScoreService.freshnessFactor(dateAtDaysAgo(150), now, settings), { factor: 0.5, inactiveDays: 150 });
  assert.deepEqual(readinessScoreService.freshnessFactor(null, now, settings), { factor: 1, inactiveDays: null });
});
