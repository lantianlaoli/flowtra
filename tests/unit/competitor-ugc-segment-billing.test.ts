import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveSegmentDurationSeconds,
  getSegmentPromptVideoGenerationCost,
  getTimeRangeDurationSeconds,
  parseTimecodeToSeconds
} from '@/lib/video-clone-segment-billing';
import { getGenerationCost, getSegmentVideoGenerationCost } from '@/lib/constants';

test('getSegmentVideoGenerationCost returns per-second Seedance pricing', () => {
  assert.equal(getSegmentVideoGenerationCost('seedance_2_fast', 8), 264);
  assert.equal(getSegmentVideoGenerationCost('seedance_2', 8), 328);
});

test('getSegmentVideoGenerationCost returns per-second Kling pricing', () => {
  assert.equal(getSegmentVideoGenerationCost('kling_3', 2, '720p'), 40);
  assert.equal(getSegmentVideoGenerationCost('kling_3', 12, '1080p'), 324);
});

test('getSegmentVideoGenerationCost keeps Seedance quality fixed to native 720p pricing', () => {
  assert.equal(getSegmentVideoGenerationCost('seedance_2_fast', 4, '720p'), 132);
  assert.equal(getSegmentVideoGenerationCost('seedance_2_fast', 8, '1080p'), 264);
  assert.equal(getSegmentVideoGenerationCost('seedance_2', 12, '1080p'), 492);
});

test('parseTimecodeToSeconds supports mm:ss and hh:mm:ss formats', () => {
  assert.equal(parseTimecodeToSeconds('00:02'), 2);
  assert.equal(parseTimecodeToSeconds('01:02:03'), 3723);
  assert.equal(parseTimecodeToSeconds('invalid'), null);
});

test('getTimeRangeDurationSeconds parses editor shot ranges', () => {
  assert.equal(getTimeRangeDurationSeconds('00:00 - 00:02'), 2);
  assert.equal(getTimeRangeDurationSeconds('00:02 - 00:05'), 3);
  assert.equal(getTimeRangeDurationSeconds('00:05 - 00:05'), null);
});

test('getEffectiveSegmentDurationSeconds prefers explicit shot durations', () => {
  const duration = getEffectiveSegmentDurationSeconds([
    { duration_seconds: 2, time_range: '00:00 - 00:04' },
    { duration_seconds: 3, time_range: '00:04 - 00:10' }
  ]);

  assert.equal(duration, 5);
});

test('getEffectiveSegmentDurationSeconds falls back to summed time ranges', () => {
  const duration = getEffectiveSegmentDurationSeconds([
    { time_range: '00:00 - 00:02' },
    { time_range: '00:02 - 00:05' }
  ]);

  assert.equal(duration, 5);
});

test('getEffectiveSegmentDurationSeconds uses fallback when shots are missing', () => {
  assert.equal(getEffectiveSegmentDurationSeconds([], 12), 12);
  assert.equal(getEffectiveSegmentDurationSeconds(undefined, 0), 8);
});

test('getSegmentPromptVideoGenerationCost uses parsed segment duration', () => {
  const cost = getSegmentPromptVideoGenerationCost(
    'kling_3',
    [{ time_range: '00:00 - 00:02' }, { time_range: '00:02 - 00:05' }],
    12,
    '720p'
  );

  assert.equal(cost, 100);
});

test('getGenerationCost maps clone-quality pricing for Kling and Seedance', () => {
  assert.equal(getGenerationCost('kling_3', '10', '720p'), 200);
  assert.equal(getGenerationCost('kling_3', '10', '1080p'), 270);
  assert.equal(getGenerationCost('seedance_2_fast', '16', '720p'), 528);
});
