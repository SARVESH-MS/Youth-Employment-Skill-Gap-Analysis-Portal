'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDemandMultipliers } = require('../src/services/marketDemand.service');

test('uses neutral multiplier for every catalog skill when no opportunities exist', () => {
  const result = calculateDemandMultipliers(
    ['html', 'css', 'javascript'],
    [],
    0.75,
    1.5,
  );

  assert.deepEqual([...result.values()], [
    { opportunityCount: 0, marketDemandMultiplier: 1 },
    { opportunityCount: 0, marketDemandMultiplier: 1 },
    { opportunityCount: 0, marketDemandMultiplier: 1 },
  ]);
});

test('maps zero-count and maximum-count skills to configured bounds when opportunities exist', () => {
  const result = calculateDemandMultipliers(
    ['no-demand', 'some-demand', 'top-demand'],
    [
      { _id: 'some-demand', opportunityCount: 1 },
      { _id: 'top-demand', opportunityCount: 4 },
    ],
    0.75,
    1.5,
  );

  assert.equal(result.get('no-demand').opportunityCount, 0);
  assert.equal(result.get('no-demand').marketDemandMultiplier, 0.75);
  assert.equal(result.get('top-demand').opportunityCount, 4);
  assert.equal(result.get('top-demand').marketDemandMultiplier, 1.5);
  assert.equal(result.get('some-demand').marketDemandMultiplier, 1.125);
});
