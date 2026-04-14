import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatApproxVideoMinutesFromCredits,
  getApproxVideoMinutesFromCredits,
  getPackageModelDurationRows,
} from '@/lib/constants';

test('approx video minutes from credits uses per-second pricing for Seedance and Kling qualities', () => {
  assert.equal(getApproxVideoMinutesFromCredits(1930, 'seedance_2_fast').toFixed(1), '1.0');
  assert.equal(getApproxVideoMinutesFromCredits(1930, 'seedance_2').toFixed(1), '0.8');
  assert.equal(getApproxVideoMinutesFromCredits(1930, 'kling_3', '720p').toFixed(1), '1.6');
  assert.equal(getApproxVideoMinutesFromCredits(1930, 'kling_3', '1080p').toFixed(1), '1.2');
});

test('formatted package model duration rows include dual Kling labels', () => {
  const basicRows = getPackageModelDurationRows('basic');
  const seedanceFast = basicRows.find((row) => row.model === 'seedance_2_fast');
  const seedance = basicRows.find((row) => row.model === 'seedance_2');
  const kling = basicRows.find((row) => row.model === 'kling_3');

  assert.ok(seedanceFast);
  assert.ok(seedance);
  assert.ok(kling);

  assert.equal(seedanceFast.durationLabel, '≈ 2.0 min');
  assert.equal(seedance.durationLabel, '≈ 1.6 min');

  assert.deepEqual(kling.durationLabels, ['720p ≈ 3.3 min', '1080p ≈ 2.4 min']);
  assert.equal(kling.durationLabel, '720p ≈ 3.3 min / 1080p ≈ 2.4 min');

  assert.equal(formatApproxVideoMinutesFromCredits(6600, 'kling_3', '720p'), '≈ 5.5 min');
  assert.equal(formatApproxVideoMinutesFromCredits(6600, 'kling_3', '1080p'), '≈ 4.1 min');
});
