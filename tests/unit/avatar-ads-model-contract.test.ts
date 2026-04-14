import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GENERATION_COSTS,
  getGenerationCost,
  getSegmentDurationForModel,
  snapDurationToModel,
  VIDEO_MODEL_DISPLAY_NAMES,
  type VideoModel,
} from '@/lib/constants';
import { AVATAR_ADS_DURATION_OPTIONS } from '@/lib/avatar-ads-dialogue';

test('video model lineup only contains seedance2 and kling', () => {
  const models = Object.keys(VIDEO_MODEL_DISPLAY_NAMES).sort();
  assert.deepEqual(models, ['kling_3', 'seedance_2', 'seedance_2_fast']);
});

test('seedance2 pricing is per-second with configured costs', () => {
  assert.equal(GENERATION_COSTS.seedance_2_fast, 33);
  assert.equal(GENERATION_COSTS.seedance_2, 41);
  assert.equal(getGenerationCost('seedance_2_fast', '15'), 15 * 33);
  assert.equal(getGenerationCost('seedance_2', '15'), 15 * 41);
});

test('seedance and kling segment duration is 15 seconds', () => {
  assert.equal(getSegmentDurationForModel('seedance_2_fast'), 15);
  assert.equal(getSegmentDurationForModel('seedance_2'), 15);
  assert.equal(getSegmentDurationForModel('kling_3'), 15);
});

test('avatar duration options support model-native 4-60s and include 15s', () => {
  assert.equal(AVATAR_ADS_DURATION_OPTIONS[0], 4);
  assert.equal(AVATAR_ADS_DURATION_OPTIONS[AVATAR_ADS_DURATION_OPTIONS.length - 1], 60);
  assert.ok(AVATAR_ADS_DURATION_OPTIONS.includes(15));
  assert.ok(!AVATAR_ADS_DURATION_OPTIONS.includes(3));
});

test('seedance duration snapping clamps to 4-60 range', () => {
  const model: VideoModel = 'seedance_2_fast';
  assert.equal(snapDurationToModel(model, 2), '4');
  assert.equal(snapDurationToModel(model, 15), '15');
  assert.equal(snapDurationToModel(model, 99), '60');
});
