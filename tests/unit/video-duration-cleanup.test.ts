import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSegmentCountFromDuration,
  getSegmentDurationForModel,
  snapDurationToModel,
} from '@/lib/constants';

test('modern video models use model-native segment lengths without legacy duration ladders', () => {
  assert.equal(getSegmentDurationForModel('seedance_2_fast'), 15);
  assert.equal(getSegmentDurationForModel('seedance_2'), 15);
  assert.equal(getSegmentDurationForModel('kling_3'), 15);
  assert.equal(snapDurationToModel('seedance_2_fast', 17), '17');
  assert.equal(snapDurationToModel('kling_3', 17), '17');
  assert.equal(getSegmentCountFromDuration(undefined, 'seedance_2_fast'), 0);
});
