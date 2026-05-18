import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAN_27_QUALITY_COSTS,
  getGenerationCost,
  normalizeCloneVideoQualityForModel,
} from '@/lib/constants';

test('wan 2.7 exposes both documented quality prices', () => {
  assert.deepEqual(WAN_27_QUALITY_COSTS, {
    '720p': 16,
    '1080p': 24,
  });
});

test('wan 2.7 accepts documented qualities and bills by selected quality', () => {
  assert.equal(normalizeCloneVideoQualityForModel('wan_27', '720p'), '720p');
  assert.equal(normalizeCloneVideoQualityForModel('wan_27', '1080p'), '1080p');
  assert.equal(getGenerationCost('wan_27', '5', '720p'), 80);
  assert.equal(getGenerationCost('wan_27', '5', '1080p'), 120);
});
